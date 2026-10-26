import { session, requireOrigin } from "@/lib/auth";
import { db, transaction } from "@/lib/db";
import { localDay, commission } from "@/lib/domain";
import { addDays } from "@/lib/calendar";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  HttpError,
  errorResponse,
  dateSchema,
  amountSchema,
  methodSchema,
  idempotent,
  rateLimit,
} from "@/lib/http";
import { createBooking, rescheduleBooking, cancelBooking } from "@/lib/booking";
import { registerWalkIn } from "@/lib/walk-ins";
import {
  lockAppointment,
  receipt,
  refund,
  balances,
  financialReport,
  cashMovement,
  audit,
} from "@/lib/finance";
export async function GET(request: Request) {
  try {
    const auth = await session();
    if (!auth) throw new HttpError("Entre para continuar", 401);
    const day = dateSchema.parse(
      new URL(request.url).searchParams.get("day") || localDay(),
    );
    const tenant = auth.tenant_id;
    const pid = auth.role === "barber" ? auth.professional_id : null;
    const payroll = auth.role !== "receptionist";
    const result = await transaction(async (c) => {
      await c.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const [
        professionals,
        services,
        appointments,
        expenses,
        payouts,
        notifications,
        totals,
        finance,
        shop,
      ] = await Promise.all([
        c.query(
          "SELECT * FROM professionals WHERE tenant_id=$1 AND ($2::text IS NULL OR id=$2) ORDER BY active DESC,name",
          [tenant, pid],
        ),
        c.query(
          "SELECT * FROM services WHERE tenant_id=$1 ORDER BY active DESC,price",
          [tenant],
        ),
        c.query(
          "SELECT a.*,p.name professional_name,p.color,COALESCE(a.service_name_snapshot,s.name) service_name FROM appointments a JOIN professionals p ON p.id=a.professional_id JOIN services s ON s.id=a.service_id WHERE a.tenant_id=$1 AND (a.starts_at AT TIME ZONE 'America/Sao_Paulo')::date=$2::date AND ($3::text IS NULL OR a.professional_id=$3) ORDER BY a.starts_at",
          [tenant, day, pid],
        ),
        auth.role === "owner"
          ? c.query(
              "SELECT * FROM expenses WHERE tenant_id=$1 ORDER BY paid_at DESC",
              [tenant],
            )
          : Promise.resolve({ rows: [] }),
        payroll
          ? c.query(
              "SELECT * FROM payouts WHERE tenant_id=$1 AND ($2::text IS NULL OR professional_id=$2) ORDER BY created_at DESC",
              [tenant, pid],
            )
          : Promise.resolve({ rows: [] }),
        ["owner", "barber"].includes(auth.role)
          ? c.query(
              "SELECT n.id,n.kind,n.status,n.due_at,n.last_error,a.customer,a.professional_id FROM notifications n JOIN appointments a ON a.id=n.appointment_id WHERE a.tenant_id=$1 AND ($2::text IS NULL OR a.professional_id=$2) ORDER BY n.due_at DESC LIMIT 50",
              [tenant, pid],
            )
          : Promise.resolve({ rows: [] }),
        payroll ? balances(c, tenant, pid) : Promise.resolve([]),
        payroll
          ? financialReport(c, tenant, day, addDays(day, 1), pid)
          : Promise.resolve(null),
        c.query("SELECT * FROM tenants WHERE id=$1", [tenant]),
      ]);
      return {
        role: auth.role,
        readOnly: auth.read_only,
        isDemo: auth.is_demo,
        whatsappEnabled:
          process.env.WHATSAPP_ENABLED === "true" &&
          process.env.DEMO_MODE !== "true",
        name: auth.name,
        professionalId: auth.professional_id,
        professionals: professionals.rows.map((p) =>
          payroll
            ? p
            : {
                id: p.id,
                name: p.name,
                color: p.color,
                specialty: p.specialty,
                active: p.active,
              },
        ),
        services: services.rows.map((s) =>
          payroll ? s : { ...s, commission_bps: undefined },
        ),
        appointments: appointments.rows.map((a) => ({
          ...a,
          manage_hash: undefined,
          manage_cipher: undefined,
          ...(!payroll
            ? { commission: 0, commission_bps: 0, commission_fixed: 0 }
            : {}),
        })),
        expenses: expenses.rows,
        payouts: payouts.rows,
        notifications: notifications.rows,
        totals,
        finance,
        tenant: shop.rows[0],
      };
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
const bookingSchema = z.object({
  professionalId: z.string(),
  serviceId: z.string(),
  customer: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^\d{10,13}$/),
  date: dateSchema,
  hour: z.string().regex(/^\d{2}:\d{2}$/),
  consent: z.boolean().default(false),
  quotedPrice: amountSchema.optional(),
  quotedDuration: z.number().int().positive().optional(),
  internal: z.boolean().default(false),
  slug: z.string().default("elares-beauty"),
});
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = await request.json();
    if (
      [
        "receive",
        "refund",
        "payout",
        "advance",
        "expense",
        "cash_open",
        "cash_close",
        "discount",
        "notification_reconcile",
        "walk_in",
      ].includes(body.action) &&
      !body.idempotencyKey
    )
      throw new HttpError("Informe a chave de idempotência da operação.");
    const auth = await session();
    if (body.action === "book") {
      const b = bookingSchema.parse(body);
      if (b.internal && !auth)
        throw new HttpError("Entre para criar reservas internas.", 401);
      if (b.internal && auth?.read_only)
        throw new HttpError(
          "A demonstração é de consulta. Use uma conta administrativa para alterar dados.",
          403,
        );
      const shop = b.internal
        ? { id: auth!.tenant_id }
        : (await db.query("SELECT id FROM tenants WHERE slug=$1", [b.slug]))
            .rows[0];
      if (!shop) throw new HttpError("Salão não encontrado.", 404);
      if (
        b.internal &&
        auth?.role === "barber" &&
        b.professionalId !== auth.professional_id
      )
        throw new HttpError("Sem permissão.", 403);
      await rateLimit(
        "book:" + shop.id + ":" + b.phone,
        b.internal ? 100 : 10,
        3600,
      );
      return Response.json(
        await transaction((c) =>
          idempotent(
            c,
            shop.id,
            body.idempotencyKey || randomUUID(),
            body,
            async () => {
              await c.query("SELECT set_config('app.user_id',$1,true)", [
                auth?.user_id || "",
              ]);
              return createBooking(c, shop.id, b);
            },
          ),
        ),
      );
    }
    if (!auth) throw new HttpError("Entre para continuar.", 401);
    if (auth.read_only)
      throw new HttpError(
        "A demonstração permite consultar os dados. Entre com uma conta administrativa para salvar alterações.",
        403,
      );
    const result = await transaction((c) =>
      idempotent(
        c,
        auth.tenant_id,
        body.idempotencyKey || randomUUID(),
        body,
        async () => {
          await c.query("SELECT set_config('app.user_id',$1,true)", [
            auth.user_id,
          ]);
          if (body.action === "walk_in") {
            const d = z
              .object({
                professionalId: z.string().min(1),
                serviceId: z.string().min(1),
                customer: z.string().trim().max(100).default(""),
                price: amountSchema.optional(),
                quotedPrice: amountSchema.optional(),
                received: z.boolean().default(true),
                method: methodSchema.default("Pix"),
                tip: amountSchema.default(0),
                fee: amountSchema.default(0),
              })
              .parse(body);
            return registerWalkIn(c, auth, d);
          }
          if (body.action === "reschedule") {
            const d = z
              .object({ id: z.uuid(), date: dateSchema, hour: z.string() })
              .parse(body);
            const a = await lockAppointment(c, auth.tenant_id, d.id);
            if (
              auth.role === "barber" &&
              a.professional_id !== auth.professional_id
            )
              throw new HttpError("Sem permissão.", 403);
            return rescheduleBooking(c, auth.tenant_id, d.id, d.date, d.hour);
          }
          if (body.action === "status") {
            const d = z
              .object({
                id: z.uuid(),
                status: z.enum([
                  "confirmed",
                  "in_progress",
                  "completed",
                  "cancelled",
                  "no_show",
                ]),
                method: methodSchema.optional(),
                collect: z.boolean().optional(),
              })
              .parse(body);
            const a = await lockAppointment(c, auth.tenant_id, d.id);
            if (
              auth.role === "barber" &&
              a.professional_id !== auth.professional_id
            )
              throw new HttpError("Atendimento não encontrado.", 404);
            if (a.status === d.status) return { ok: true };
            if (["completed", "cancelled", "no_show"].includes(a.status))
              throw new HttpError("Atendimento já encerrado.");
            if (d.status === "cancelled")
              return cancelBooking(c, auth.tenant_id, d.id);
            if (d.status === "confirmed" && a.status !== "scheduled")
              throw new HttpError("Transição inválida.");
            if (d.status === "in_progress") {
              const ongoing = await c.query(
                "SELECT id FROM appointments WHERE professional_id=$1 AND tenant_id=$2 AND status='in_progress' AND id<>$3",
                [a.professional_id, auth.tenant_id, a.id],
              );
              if (ongoing.rowCount)
                throw new HttpError(
                  "Finalize o atendimento em andamento deste profissional antes de iniciar outro.",
                );
            }
            if (
              d.status === "completed" &&
              d.collect !== false &&
              a.price > a.paid
            )
              await receipt(c, auth, d.id, {
                amount: a.price - a.paid,
                tip: 0,
                fee: 0,
                method: d.method || "Pix",
              });
            await c.query(
              "UPDATE appointments SET status=$1,completed_at=CASE WHEN $1='completed' THEN now() ELSE completed_at END WHERE id=$2",
              [d.status, d.id],
            );
            if (["completed", "no_show"].includes(d.status))
              await c.query(
                "UPDATE notifications SET status='cancelled',updated_at=now() WHERE appointment_id=$1 AND status IN ('pending','retry')",
                [d.id],
              );
            await audit(c, auth.tenant_id, d.status, d.id);
            return { ok: true };
          }
          if (body.action === "receive") {
            const d = z
              .object({
                id: z.uuid(),
                amount: amountSchema,
                tip: amountSchema.default(0),
                fee: amountSchema.default(0),
                method: methodSchema,
              })
              .parse(body);
            await receipt(c, auth, d.id, d);
            return { ok: true };
          }
          if (body.action === "discount") {
            if (auth.role === "barber")
              throw new HttpError(
                "Somente dono e recepção podem aplicar descontos.",
                403,
              );
            const d = z
              .object({ id: z.uuid(), amount: amountSchema })
              .parse(body);
            const a = await lockAppointment(c, auth.tenant_id, d.id);
            if (!["scheduled", "confirmed", "in_progress"].includes(a.status))
              throw new HttpError(
                "Desconto deve ser definido antes da conclusão.",
              );
            const net = a.list_price - d.amount;
            if (
              net < 0 ||
              net < a.paid ||
              (a.commission_kind === "fixed" && a.commission_fixed > net)
            )
              throw new HttpError(
                "Desconto incompatível com os recebimentos ou a comissão fixa.",
              );
            await c.query(
              "UPDATE appointments SET discount=$1,price=$2,commission=$3 WHERE id=$4",
              [
                d.amount,
                net,
                a.commission_kind === "fixed"
                  ? a.commission_fixed
                  : commission(net, a.commission_bps),
                a.id,
              ],
            );
            await audit(c, auth.tenant_id, "discount", a.id);
            return { ok: true };
          }
          if (body.action === "cash_open") {
            if (auth.role === "barber")
              throw new HttpError("Sem permissão.", 403);
            const d = z.object({ amount: amountSchema }).parse(body);
            await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
              auth.tenant_id,
            ]);
            await c.query(
              "INSERT INTO cash_sessions(tenant_id,opening,opened_by) VALUES ($1,$2,$3)",
              [auth.tenant_id, d.amount, auth.user_id],
            );
            return { ok: true };
          }
          if (body.action === "cash_close") {
            if (auth.role === "barber")
              throw new HttpError("Sem permissão.", 403);
            const d = z
              .object({
                amount: amountSchema,
                note: z.string().max(500).default(""),
              })
              .parse(body);
            const cash = (
              await c.query(
                "SELECT * FROM cash_sessions WHERE tenant_id=$1 AND closed_at IS NULL FOR UPDATE",
                [auth.tenant_id],
              )
            ).rows[0];
            if (!cash) throw new HttpError("Nenhum caixa aberto.");
            const moves = (
              await c.query(
                "SELECT COALESCE(sum(amount),0)::int total FROM cash_movements WHERE session_id=$1",
                [cash.id],
              )
            ).rows[0].total;
            const expected = cash.opening + moves;
            if (d.amount !== expected && !d.note.trim())
              throw new HttpError("Informe o motivo da diferença no caixa.");
            await c.query(
              "UPDATE cash_sessions SET closed_at=now(),closed_by=$1,counted=$2::int,expected=$3::int,difference=$2::int-$3::int,note=$4 WHERE id=$5",
              [auth.user_id, d.amount, expected, d.note, cash.id],
            );
            await audit(c, auth.tenant_id, "cash_close", cash.id);
            return { ok: true };
          }
          if (auth.role !== "owner")
            throw new HttpError("Acesso do proprietário necessário.", 403);
          if (body.action === "notification_reconcile") {
            const d = z
              .object({
                id: z.uuid(),
                resolution: z.enum(["not_sent", "sent"]),
                verified: z.literal(true),
                providerId: z.string().max(300).optional(),
              })
              .parse(body);
            const job = (
              await c.query(
                "SELECT n.* FROM notifications n JOIN appointments a ON a.id=n.appointment_id WHERE n.id=$1 AND a.tenant_id=$2 FOR UPDATE OF n",
                [d.id, auth.tenant_id],
              )
            ).rows[0];
            if (!job || !["unknown", "failed"].includes(job.status))
              throw new HttpError(
                "A tarefa não está disponível para conciliação.",
              );
            if (d.resolution === "sent" && !d.providerId?.trim())
              throw new HttpError(
                "Informe o identificador confirmado pelo provedor.",
              );
            await c.query(
              "UPDATE notifications SET status=$1,provider_message_id=$2,due_at=now(),attempts=0,lease_token=NULL,lease_until=NULL,last_error='Conciliado manualmente pelo proprietário',updated_at=now() WHERE id=$3",
              [
                d.resolution === "not_sent" ? "pending" : "sent",
                d.resolution === "sent" ? d.providerId : null,
                d.id,
              ],
            );
            await audit(
              c,
              auth.tenant_id,
              "notification_reconcile_" + d.resolution,
              d.id,
            );
            return { ok: true };
          }
          if (body.action === "refund") {
            const d = z
              .object({
                paymentId: z.uuid(),
                amount: amountSchema,
                tip: amountSchema.default(0),
                fee: amountSchema.default(0),
                reason: z.string().trim().min(3).max(500),
              })
              .parse(body);
            await refund(c, auth, d.paymentId, d);
            return { ok: true };
          }
          if (body.action === "expense") {
            const d = z
              .object({
                description: z.string().trim().min(2).max(150),
                amount: amountSchema.refine((v) => v > 0),
                method: methodSchema.default("Pix"),
              })
              .parse(body);
            const row = (
              await c.query(
                "INSERT INTO expenses(tenant_id,description,amount,method) VALUES ($1,$2,$3,$4) RETURNING id",
                [auth.tenant_id, d.description, d.amount, d.method],
              )
            ).rows[0];
            await cashMovement(
              c,
              auth.tenant_id,
              d.method,
              -d.amount,
              "expense",
              row.id,
            );
            await audit(c, auth.tenant_id, "expense", row.id);
            return { ok: true };
          }
          if (["payout", "advance"].includes(body.action)) {
            const d = z
              .object({
                professionalId: z.string(),
                amount: amountSchema.refine((v) => v > 0),
                method: methodSchema.default("Pix"),
                reason: z.string().max(500).default("Adiantamento"),
              })
              .parse(body);
            const pro = await c.query(
              "SELECT id FROM professionals WHERE id=$1 AND tenant_id=$2 FOR UPDATE",
              [d.professionalId, auth.tenant_id],
            );
            if (!pro.rowCount)
              throw new HttpError("Profissional não encontrado.", 404);
            if (body.action === "payout") {
              const balance = (
                await balances(c, auth.tenant_id, d.professionalId)
              )[0];
              if (!balance || d.amount > balance.available)
                throw new HttpError("Valor maior que o saldo disponível.");
            }
            const row =
              body.action === "payout"
                ? (
                    await c.query(
                      "INSERT INTO payouts(tenant_id,professional_id,amount,method) VALUES ($1,$2,$3,$4) RETURNING id",
                      [auth.tenant_id, d.professionalId, d.amount, d.method],
                    )
                  ).rows[0]
                : (
                    await c.query(
                      "INSERT INTO advances(tenant_id,professional_id,amount,method,reason) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                      [
                        auth.tenant_id,
                        d.professionalId,
                        d.amount,
                        d.method,
                        d.reason,
                      ],
                    )
                  ).rows[0];
            await cashMovement(
              c,
              auth.tenant_id,
              d.method,
              -d.amount,
              body.action,
              row.id,
            );
            await audit(c, auth.tenant_id, body.action, row.id);
            return { ok: true };
          }
          throw new HttpError("Ação inválida.");
        },
      ),
    );
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
