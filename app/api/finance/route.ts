import { requireSession } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { dateSchema, HttpError, errorResponse } from "@/lib/http";
import { localDay } from "@/lib/domain";
import { addDays } from "@/lib/calendar";
import { balances, financialReport } from "@/lib/finance";
import { financialPDF } from "@/lib/financial-pdf";
export async function GET(request: Request) {
  try {
    const s = await requireSession();
    const params = new URL(request.url).searchParams;
    const start = dateSchema.parse(
      params.get("start") || localDay().slice(0, 8) + "01",
    );
    const end = dateSchema.parse(params.get("end") || addDays(localDay(), 1));
    const days = (Date.parse(end) - Date.parse(start)) / 86400000;
    if (days < 1 || days > 366)
      throw new HttpError("Escolha um período de até 366 dias.");
    const pid = s.role === "barber" ? s.professional_id : null;
    const result = await transaction(async (c) => {
      await c.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const [report, totals, payments, cash, cashHistory, advances] =
        await Promise.all([
          s.role === "receptionist"
            ? Promise.resolve(null)
            : financialReport(c, s.tenant_id, start, end, pid),
          s.role === "receptionist"
            ? Promise.resolve([])
            : balances(c, s.tenant_id, pid),
          c.query(
            "SELECT p.*,a.customer,a.professional_id,a.service_name_snapshot service_name,pr.name professional_name,COALESCE((SELECT sum(service_amount) FROM payments r WHERE r.original_id=p.id),0)::int refunded,COALESCE((SELECT sum(tip) FROM payments r WHERE r.original_id=p.id),0)::int refunded_tip,COALESCE((SELECT sum(fee) FROM payments r WHERE r.original_id=p.id),0)::int refunded_fee FROM payments p JOIN appointments a ON a.id=p.appointment_id JOIN professionals pr ON pr.id=a.professional_id WHERE p.tenant_id=$1 AND p.created_at>=($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND p.created_at<($3::date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND ($4::text IS NULL OR a.professional_id=$4) ORDER BY p.created_at DESC",
            [s.tenant_id, start, end, pid],
          ),
          s.role === "barber"
            ? Promise.resolve({ rows: [] })
            : c.query(
                "SELECT c.*,c.opening+COALESCE((SELECT sum(amount) FROM cash_movements WHERE session_id=c.id),0)::int expected_balance FROM cash_sessions c WHERE tenant_id=$1 AND closed_at IS NULL",
                [s.tenant_id],
              ),
          s.role === "barber"
            ? Promise.resolve({ rows: [] })
            : c.query(
                "SELECT * FROM cash_sessions WHERE tenant_id=$1 ORDER BY opened_at DESC LIMIT 30",
                [s.tenant_id],
              ),
          s.role === "receptionist"
            ? Promise.resolve({ rows: [] })
            : c.query(
                "SELECT a.*,p.name professional_name FROM advances a JOIN professionals p ON p.id=a.professional_id WHERE a.tenant_id=$1 AND ($2::text IS NULL OR a.professional_id=$2) ORDER BY a.created_at DESC",
                [s.tenant_id, pid],
              ),
        ]);
      const [shop, expenses, payouts, pros] = await Promise.all([
        c.query("SELECT name,address FROM tenants WHERE id=$1", [s.tenant_id]),
        s.role === "owner"
          ? c.query(
              "SELECT description,amount,paid_at,method FROM expenses WHERE tenant_id=$1 AND paid_at>=($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND paid_at<($3::date::timestamp AT TIME ZONE 'America/Sao_Paulo') ORDER BY paid_at",
              [s.tenant_id, start, end],
            )
          : Promise.resolve({ rows: [] }),
        s.role !== "receptionist"
          ? c.query(
              "SELECT p.amount,p.method,p.created_at,pr.name professional_name FROM payouts p JOIN professionals pr ON pr.id=p.professional_id WHERE p.tenant_id=$1 AND p.created_at>=($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND p.created_at<($3::date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND ($4::text IS NULL OR p.professional_id=$4) ORDER BY p.created_at",
              [s.tenant_id, start, end, pid],
            )
          : Promise.resolve({ rows: [] }),
        c.query(
          "SELECT id,name FROM professionals WHERE tenant_id=$1 AND ($2::text IS NULL OR id=$2)",
          [s.tenant_id, pid],
        ),
      ]);
      return {
        role: s.role,
        report,
        balances: totals.map((b) => ({
          ...b,
          professional_name:
            pros.rows.find((p) => p.id === b.professional_id)?.name ||
            "Profissional",
        })),
        payments: payments.rows,
        cash: cash.rows[0] || null,
        cashHistory: cashHistory.rows,
        advances: advances.rows,
        start,
        end,
        shop: shop.rows[0],
        expenses: expenses.rows,
        payouts: payouts.rows,
      };
    });
    if (params.get("export") === "pdf") {
      if (s.role === "receptionist" || !result.report)
        throw new HttpError("Exportação disponível para dono e profissional.", 403);
      const bytes = await financialPDF({
        ...result,
        report: result.report,
        generatedBy: s.name,
      });
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="relatorio-financeiro-${start}.pdf"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (params.get("export") === "csv") {
      if (s.role === "receptionist")
        throw new HttpError("Exportação disponível para dono e profissional.", 403);
      const quote = (v: unknown) =>
        '"' +
        String(v ?? "")
          .replace(/^[=+\-@\t\r]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      const rows = [
        [
          "Data",
          "Tipo",
          "Cliente",
          "Profissional",
          "Serviço",
          "Valor serviço",
          "Gorjeta",
          "Taxa",
          "Forma",
        ],
        ...result.payments.map((p) => [
          new Date(p.created_at).toLocaleString("pt-BR"),
          p.kind === "receipt" ? "Recebimento" : "Estorno",
          p.customer,
          p.professional_name,
          p.service_name,
          (p.service_amount / 100).toFixed(2),
          (p.tip / 100).toFixed(2),
          (p.fee / 100).toFixed(2),
          p.method,
        ]),
      ];
      return new Response(
        "\uFEFF" + rows.map((row) => row.map(quote).join(";")).join("\r\n"),
        {
          headers: {
            "Content-Type": "text/csv;charset=utf-8",
            "Content-Disposition": `attachment; filename="financeiro-${start}.csv"`,
            "Cache-Control": "no-store",
          },
        },
      );
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
