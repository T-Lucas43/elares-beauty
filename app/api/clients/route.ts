import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";
export async function GET() {
  try {
    const s = await requireSession();
    const result = await db.query(
      "SELECT customer AS name,phone,count(*)::int AS visits,max(starts_at) AS last_visit FROM appointments WHERE tenant_id=$1 AND ($2::text IS NULL OR professional_id=$2) GROUP BY customer,phone ORDER BY customer LIMIT 1000",
      [s.tenant_id, s.role === "barber" ? s.professional_id : null],
    );
    return Response.json(
      { clients: result.rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
