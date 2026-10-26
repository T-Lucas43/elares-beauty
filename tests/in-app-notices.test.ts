import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildInAppNotices,
  type NoticeAppointment,
} from "../lib/in-app-notices";
const now = Date.parse("2026-10-26T12:00:00Z");
const appointment: NoticeAppointment = {
  id: "appointment-qa",
  schedule_version: 0,
  customer: "Cliente fictício",
  professional_name: "Profissional QA",
  service_name: "Corte masculino",
  starts_at: new Date(now + 10 * 60000).toISOString(),
};
test("aviso de corte só aparece na janela de dez minutos e não se duplica a cada minuto", () => {
  const first = buildInAppNotices([appointment], [], "barber", now);
  assert.equal(first.length, 1);
  assert.match(first[0].title, /10 min/);
  const later = buildInAppNotices([appointment], [], "barber", now + 2 * 60000);
  assert.equal(later[0].key, first[0].key);
  assert.match(later[0].title, /8 min/);
  assert.equal(
    buildInAppNotices(
      [{ ...appointment, starts_at: new Date(now + 11 * 60000).toISOString() }],
      [],
      "barber",
      now,
    ).length,
    0,
  );
  assert.equal(
    buildInAppNotices(
      [{ ...appointment, starts_at: new Date(now - 60000).toISOString() }],
      [],
      "barber",
      now,
    ).length,
    0,
  );
  assert.notEqual(
    buildInAppNotices(
      [{ ...appointment, schedule_version: 1 }],
      [],
      "barber",
      now,
    )[0].key,
    first[0].key,
  );
});
test("profissional solicita lembrete e gestor recebe uma central agregada", () => {
  const pro = buildInAppNotices([], [appointment], "barber", now);
  assert.equal(pro[0].kind, "reminder");
  assert.equal(pro[0].appointmentId, appointment.id);
  assert.match(pro[0].message, /WhatsApp do salão/);
  const owner = buildInAppNotices(
    [],
    [appointment, { ...appointment, id: "second" }],
    "owner",
    now,
  );
  assert.equal(owner.length, 1);
  assert.equal(owner[0].kind, "central");
  assert.match(owner[0].message, /2 lembretes/);
  assert.equal(owner[0].appointmentId, undefined);
});
