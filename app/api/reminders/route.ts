import { requireSession, requireOrigin } from "@/lib/auth";
import { db, transaction } from "@/lib/db";
import { audit } from "@/lib/finance";
import { errorResponse, HttpError } from "@/lib/http";
import { localDay } from "@/lib/domain";
import { addDays } from "@/lib/calendar";
import { z } from "zod";
import {
  lockRemindableAppointment,
  claimManualReminder,
} from "@/lib/manual-reminder-store";

export async function GET(request: Request) {
  try {
    const s = await requireSession();
    const params = new URL(request.url).searchParams;
    const period = z
      .enum(["today", "tomorrow", "week"])
      .parse(params.get("period") || "week");
    const requested = z
      .string()
      .max(128)
      .parse(params.get("professionalId") || "");
    if (s.role === "barber" && requested && requested !== s.professional_id)
      throw new HttpError(
        "Você pode consultar apenas seus próprios lembretes.",
        403,
      );
    const professional =
      s.role === "barber" ? s.professional_id : requested || null;
    const today = localDay();
    const start = period === "tomorrow" ? addDays(today, 1) : today;
    const end = addDays(start, period === "week" ? 7 : 1);
    const appointments = (
      await db.query(
        "SELECT a.id,a.customer,a.phone,a.professional_id,a.starts_at,a.consent,a.schedule_version,p.name professional_name,COALESCE(a.service_name_snapshot,se.name) service_name,(a.starts_at - (t.reminder_minutes * interval '1 minute') <= now()) due,m.state reminder_state,m.requested_at,m.opened_at,m.done_at,u.name requested_by_name FROM appointments a JOIN professionals p ON p.id=a.professional_id AND p.tenant_id=a.tenant_id JOIN services se ON se.id=a.service_id AND se.tenant_id=a.tenant_id JOIN tenants t ON t.id=a.tenant_id LEFT JOIN manual_reminder_tasks m ON m.appointment_id=a.id AND m.tenant_id=a.tenant_id AND m.schedule_version=a.schedule_version LEFT JOIN auth_user u ON u.id=m.requested_by WHERE a.tenant_id=$1 AND ($2::text IS NULL OR a.professional_id=$2) AND a.status IN ('scheduled','confirmed') AND a.source='booking' AND a.starts_at>now() AND a.starts_at>=($3::date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND a.starts_at<($4::date::timestamp AT TIME ZONE 'America/Sao_Paulo') ORDER BY CASE WHEN m.requested_at IS NOT NULL AND m.state<>'done' THEN 0 ELSE 1 END,a.starts_at,a.id LIMIT 200",
        [s.tenant_id, professional, start, end],
      )
    ).rows;
    const shop = (
      await db.query("SELECT phone FROM tenants WHERE id=$1", [s.tenant_id])
    ).rows[0];
    return Response.json(
      {
        appointments,
        start,
        end,
        shopPhone: shop?.phone || "",
        canSend: s.role !== "barber",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const s = await requireSession(undefined, true);
    const input = z
      .object({
        action: z.enum(["request", "opened", "done", "reopen"]),
        appointmentId: z.uuid(),
        version: z.number().int().nonnegative(),
        confirmed: z.boolean().optional(),
      })
      .strict()
      .parse(await request.json());
    if (s.role === "barber" && input.action !== "request")
      throw new HttpError(
        "O envio é realizado pelo gestor ou pela recepção no WhatsApp do salão.",
        403,
      );
    if (input.action === "done" && !input.confirmed)
      throw new HttpError(
        "Confirme que você enviou a mensagem pelo WhatsApp do salão.",
      );
    const result = await transaction(async (c) => {
      await c.query("SELECT set_config('app.user_id',$1,true)", [s.user_id]);
      const a = await lockRemindableAppointment(
        c,
        s,
        input.appointmentId,
        input.version,
      );
      if (
        input.action === "request" &&
        +new Date(a.starts_at) > Date.now() + 7 * 86400000
      )
        throw new HttpError(
          "Solicite o lembrete nos sete dias anteriores ao atendimento.",
          409,
        );
      await c.query(
        "INSERT INTO manual_reminder_tasks(tenant_id,appointment_id,schedule_version) VALUES($1,$2,$3) ON CONFLICT(appointment_id,schedule_version) DO NOTHING",
        [s.tenant_id, a.id, a.schedule_version],
      );
      if (input.action === "request")
        await c.query(
          "UPDATE manual_reminder_tasks SET requested_by=COALESCE(requested_by,$1),requested_at=COALESCE(requested_at,now()) WHERE appointment_id=$2 AND schedule_version=$3",
          [s.user_id, a.id, a.schedule_version],
        );
      if (input.action === "opened")
        await claimManualReminder(c, s, a.id, a.schedule_version);
      if (input.action === "done")
        await c.query(
          "UPDATE manual_reminder_tasks SET state='done',done_by=$1,done_at=COALESCE(done_at,now()) WHERE appointment_id=$2 AND schedule_version=$3",
          [s.user_id, a.id, a.schedule_version],
        );
      if (input.action === "reopen")
        await c.query(
          "UPDATE manual_reminder_tasks SET state='pending',opened_by=NULL,opened_at=NULL,done_by=NULL,done_at=NULL WHERE appointment_id=$1 AND schedule_version=$2",
          [a.id, a.schedule_version],
        );
      await audit(c, s.tenant_id, "manual_reminder_" + input.action, a.id);
      return (
        await c.query(
          "SELECT state,requested_at,opened_at,done_at FROM manual_reminder_tasks WHERE appointment_id=$1 AND schedule_version=$2",
          [a.id, a.schedule_version],
        )
      ).rows[0];
    });
    return Response.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
