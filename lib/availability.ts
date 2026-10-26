import { Temporal } from "@js-temporal/polyfill";
import type { PoolClient } from "pg";
import { HttpError, dateSchema } from "./http";
export function instant(
  date: string,
  hour: string,
  timezone = "America/Sao_Paulo",
) {
  dateSchema.parse(date);
  if (!/^\d{2}:\d{2}$/.test(hour)) throw new HttpError("Horário inválido.");
  try {
    return new Date(
      Temporal.ZonedDateTime.from(`${date}T${hour}:00[${timezone}]`, {
        disambiguation: "reject",
        overflow: "reject",
      }).epochMilliseconds,
    );
  } catch {
    throw new HttpError("Horário ou data inválidos.");
  }
}
export function minuteOf(hour: string) {
  return Number(hour.slice(0, 2)) * 60 + Number(hour.slice(3));
}
export function hourOf(minute: number) {
  return `${Math.floor(minute / 60)
    .toString()
    .padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
}
export async function availableSlots(
  c: PoolClient,
  tenant: string,
  date: string,
  professional: string,
  serviceId: string,
  exclude?: string,
  durationOverride?: number,
) {
  dateSchema.parse(date);
  const settings = (
    await c.query("SELECT timezone FROM tenants WHERE id=$1", [tenant])
  ).rows[0];
  if (!settings) return [];
  const pros =
    professional === "any"
      ? (
          await c.query(
            "SELECT id FROM professionals WHERE tenant_id=$1 AND active ORDER BY id",
            [tenant],
          )
        ).rows
      : [{ id: professional }];
  const result = new Map<
    string,
    { hour: string; professional_id: string; price: number; duration: number }
  >();
  for (const pro of pros) {
    let service;
    try {
      service = await serviceFor(c, tenant, pro.id, serviceId);
    } catch (e) {
      if (e instanceof HttpError) continue;
      throw e;
    }
    const weekday = Temporal.PlainDate.from(date).dayOfWeek % 7;
    const schedule = (
      await c.query(
        "SELECT * FROM working_schedules WHERE tenant_id=$1 AND professional_id=$2 AND weekday=$3",
        [tenant, pro.id, weekday],
      )
    ).rows[0];
    if (!schedule?.enabled) continue;
    const duration = durationOverride || service.actual_duration;
    const busy = (
      await c.query(
        "SELECT starts_at,ends_at FROM resource_slots WHERE tenant_id=$1 AND professional_id=$2 AND ends_at>($3::date::timestamp AT TIME ZONE $4) AND starts_at<(($3::date+1)::timestamp AT TIME ZONE $4) AND ($5::uuid IS NULL OR appointment_id IS DISTINCT FROM $5::uuid)",
        [tenant, pro.id, date, settings.timezone, exclude || null],
      )
    ).rows;
    for (
      let minute = Math.ceil(schedule.start_minute / 15) * 15;
      minute + duration <= schedule.end_minute;
      minute += 15
    ) {
      if (
        schedule.break_start !== null &&
        minute < schedule.break_end &&
        minute + duration > schedule.break_start
      )
        continue;
      const hour = hourOf(minute);
      const start = instant(date, hour, settings.timezone);
      const end = +start + duration * 60000;
      if (
        +start <= Date.now() ||
        +start > Date.now() + 60 * 86400000 ||
        busy.some(
          (b) => +start < +new Date(b.ends_at) && end > +new Date(b.starts_at),
        )
      )
        continue;
      if (!result.has(hour))
        result.set(hour, {
          hour,
          professional_id: pro.id,
          price: service.actual_price,
          duration,
        });
    }
  }
  return [...result.values()].sort((a, b) => a.hour.localeCompare(b.hour));
}
export async function serviceFor(
  c: PoolClient,
  tenant: string,
  professional: string,
  serviceId: string,
) {
  const s = (
    await c.query(
      "SELECT s.*,COALESCE(ps.price,s.price) actual_price,COALESCE(ps.duration,s.duration) actual_duration,COALESCE(ps.commission_bps,s.commission_bps,p.commission_bps) actual_bps,p.commission_kind,p.commission_fixed,p.name professional_name FROM services s JOIN professionals p ON p.tenant_id=s.tenant_id AND p.id=$2 LEFT JOIN professional_services ps ON ps.professional_id=p.id AND ps.service_id=s.id WHERE s.tenant_id=$1 AND s.id=$3 AND s.active AND p.active AND COALESCE(ps.enabled,true)",
      [tenant, professional, serviceId],
    )
  ).rows[0];
  if (!s)
    throw new HttpError(
      "O serviço não está disponível para este profissional.",
    );
  return s;
}
export async function checkAvailability(
  c: PoolClient,
  {
    tenant,
    professional,
    date,
    hour,
    duration,
    exclude,
    allowPast = false,
  }: {
    tenant: string;
    professional: string;
    date: string;
    hour: string;
    duration: number;
    exclude?: string;
    allowPast?: boolean;
  },
) {
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    "agenda:" + professional,
  ]);
  const settings = (
    await c.query("SELECT timezone FROM tenants WHERE id=$1", [tenant])
  ).rows[0];
  if (!settings) throw new HttpError("Salão não encontrado.");
  const starts = instant(date, hour, settings.timezone);
  const ends = new Date(+starts + duration * 60000);
  const minute = minuteOf(hour);
  if (
    minute % 15 !== 0 ||
    (!allowPast && +starts < Date.now()) ||
    +starts > Date.now() + 60 * 86400000
  )
    throw new HttpError(
      "Escolha um horário futuro em até 60 dias, em intervalos de 15 minutos.",
    );
  const weekday = Temporal.PlainDate.from(date).dayOfWeek % 7;
  const schedule = (
    await c.query(
      "SELECT * FROM working_schedules WHERE tenant_id=$1 AND professional_id=$2 AND weekday=$3",
      [tenant, professional, weekday],
    )
  ).rows[0];
  if (
    !schedule?.enabled ||
    minute < schedule.start_minute ||
    minute + duration > schedule.end_minute ||
    (schedule.break_start !== null &&
      minute < schedule.break_end &&
      minute + duration > schedule.break_start)
  )
    throw new HttpError(
      "Horário fora da jornada ou dentro do intervalo do profissional.",
    );
  const conflict = await c.query(
    "SELECT id FROM resource_slots WHERE tenant_id=$1 AND professional_id=$2 AND tstzrange(starts_at,ends_at,'[)') && tstzrange($3::timestamptz,$4::timestamptz,'[)') AND ($5::uuid IS NULL OR appointment_id IS DISTINCT FROM $5::uuid) LIMIT 1",
    [tenant, professional, starts, ends, exclude || null],
  );
  if (conflict.rowCount)
    throw new HttpError(
      "O profissional está ocupado ou bloqueado neste horário.",
      409,
    );
  return { starts, ends };
}
