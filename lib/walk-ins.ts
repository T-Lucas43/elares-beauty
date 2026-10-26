import { randomBytes, createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { Session } from "./auth";
import { serviceFor } from "./availability";
import { commission } from "./domain";
import { receipt, audit } from "./finance";
import { HttpError } from "./http";

export async function registerWalkIn(
  c: PoolClient,
  s: Session,
  input: {
    professionalId: string;
    serviceId: string;
    customer: string;
    price?: number;
    quotedPrice?: number;
    received: boolean;
    method: string;
    tip: number;
    fee: number;
  },
) {
  if (s.role === "barber" && input.professionalId !== s.professional_id)
    throw new HttpError(
      "Você pode registrar apenas seus próprios atendimentos.",
      403,
    );
  await c.query(
    "SELECT id FROM professionals WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
    [s.tenant_id, input.professionalId],
  );
  const service = await serviceFor(
    c,
    s.tenant_id,
    input.professionalId,
    input.serviceId,
  );
  if (
    input.quotedPrice !== undefined &&
    input.quotedPrice !== service.actual_price
  )
    throw new HttpError(
      "O preço do serviço foi atualizado. Confira o valor antes de registrar.",
      409,
    );
  if (
    s.role === "barber" &&
    input.price !== undefined &&
    input.price !== service.actual_price
  )
    throw new HttpError(
      "Somente a recepção ou o proprietário podem alterar o valor do serviço.",
      403,
    );
  const price = input.price ?? service.actual_price;
  const share =
    service.commission_kind === "fixed"
      ? service.commission_fixed
      : commission(price, service.actual_bps);
  if (share > price)
    throw new HttpError(
      "A participação fixa do profissional excede o valor do corte.",
    );
  if (!input.received && (input.tip > 0 || input.fee > 0))
    throw new HttpError(
      "Gorjeta e taxa só podem ser registradas com o recebimento.",
    );
  const ended = new Date(),
    started = new Date(+ended - service.actual_duration * 60000);
  const a = (
    await c.query(
      "INSERT INTO appointments(tenant_id,professional_id,service_id,customer,phone,starts_at,ends_at,price,list_price,discount,service_name_snapshot,commission_bps,commission_kind,commission_fixed,commission,consent,manage_hash,manage_expires_at,status,completed_at,source) VALUES($1,$2,$3,$4,'',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,$15,$6,'completed',$6,'walk_in') RETURNING id",
      [
        s.tenant_id,
        input.professionalId,
        input.serviceId,
        input.customer || "Cliente avulso",
        started,
        ended,
        price,
        service.actual_price,
        Math.max(0, service.actual_price - price),
        service.name,
        service.actual_bps,
        service.commission_kind,
        service.commission_fixed,
        share,
        createHash("sha256").update(randomBytes(32)).digest("hex"),
      ],
    )
  ).rows[0];
  if (input.received && (price > 0 || input.tip > 0))
    await receipt(c, s, a.id, {
      amount: price,
      tip: input.tip,
      fee: input.fee,
      method: input.method,
    });
  await audit(c, s.tenant_id, "walk_in", a.id);
  return { ok: true, id: a.id };
}
