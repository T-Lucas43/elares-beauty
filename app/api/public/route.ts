import { db, transaction } from "@/lib/db";
import { dateSchema, errorResponse, HttpError } from "@/lib/http";
import { availableSlots } from "@/lib/availability";
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    const slug = p.get("slug") || "elares-beauty";
    const shop = (
      await db.query(
        "SELECT id,name,slug,address,phone,cancellation_minutes FROM tenants WHERE slug=$1",
        [slug],
      )
    ).rows[0];
    if (!shop) throw new HttpError("Salão não encontrado.", 404);
    const date = p.get("date");
    if (date) dateSchema.parse(date);
    const professional = p.get("professionalId");
    const service = p.get("serviceId");
    const [professionals, services, slots] = await Promise.all([
      db.query(
        "SELECT id,name,specialty,color FROM professionals WHERE tenant_id=$1 AND active ORDER BY name",
        [shop.id],
      ),
      db.query(
        "SELECT id,name,description,price,duration FROM services WHERE tenant_id=$1 AND active ORDER BY price",
        [shop.id],
      ),
      date && professional && service
        ? transaction((c) =>
            availableSlots(c, shop.id, date, professional, service),
          )
        : Promise.resolve([]),
    ]);
    return Response.json(
      {
        tenant: shop,
        professionals: professionals.rows,
        services: services.rows,
        slots,
        busy: [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
