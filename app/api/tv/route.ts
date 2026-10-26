import { session } from "@/lib/auth";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { localDay } from "@/lib/domain";
import { HttpError, errorResponse } from "@/lib/http";
export async function GET() {
  try {
    const token = (await cookies()).get("elares_beauty_tv")?.value;
    let tenant: string;
    let mode: "owner" | "device";
    if (token) {
      const d = (
        await db.query(
          "UPDATE tv_devices SET last_seen=now() WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() RETURNING tenant_id",
          [createHash("sha256").update(token).digest("hex")],
        )
      ).rows[0];
      if (!d)
        throw new HttpError(
          "Acesso da TV expirado ou revogado. Solicite um novo pareamento.",
          401,
        );
      tenant = d.tenant_id;
      mode = "device";
    } else {
      const s = await session();
      if (!s)
        throw new HttpError(
          "Entre como proprietário ou use o link de pareamento da TV.",
          401,
        );
      if (s.role !== "owner")
        throw new HttpError(
          "Acesso exclusivo do proprietário ou aparelho pareado.",
          403,
        );
      tenant = s.tenant_id;
      mode = "owner";
    }
    const [team, bookings, shop] = await Promise.all([
      db.query(
        "SELECT id,name,color,specialty FROM professionals p WHERE tenant_id=$1 AND (active OR EXISTS(SELECT 1 FROM appointments a WHERE a.professional_id=p.id AND a.status='in_progress')) ORDER BY name",
        [tenant],
      ),
      db.query(
        "SELECT a.id,a.professional_id,a.customer,a.starts_at,a.ends_at,a.status,COALESCE(a.service_name_snapshot,s.name) service_name FROM appointments a JOIN services s ON s.id=a.service_id AND s.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.starts_at>=($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND a.starts_at<now()+interval '7 days' AND a.status NOT IN ('cancelled','no_show') ORDER BY a.starts_at",
        [tenant, localDay()],
      ),
      db.query("SELECT name FROM tenants WHERE id=$1", [tenant]),
    ]);
    return Response.json(
      {
        mode,
        tenant: shop.rows[0],
        professionals: team.rows,
        appointments: bookings.rows.map((a) => {
          const names = a.customer.trim().split(/\s+/);
          return {
            ...a,
            customer:
              names[0] + (names.length > 1 ? ` ${names.at(-1)![0]}.` : ""),
          };
        }),
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
