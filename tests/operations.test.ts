import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, transaction } from "../lib/db";
import { auth } from "../lib/auth-engine";
import { localDay } from "../lib/domain";
import { addDays } from "../lib/calendar";
const base = "http://127.0.0.1:3018";
const tenant = "qa-" + randomUUID();
const slug = tenant;
const email = tenant + "@beauty.local";
const password = "Teste-local-2026!";
let cookie = "";
let pro = "";
let service = "";
async function post(path: string, body: object, session?: string) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(session ? { Cookie: session } : {}),
    },
    body: JSON.stringify({
      ...(path === "/api/data" ? { idempotencyKey: randomUUID() } : {}),
      ...body,
    }),
  });
}
async function ok(path: string, body: object, session = cookie) {
  const r = await post(path, body, session);
  const result = await r.json();
  assert.equal(r.status, 200, JSON.stringify(result));
  return result;
}
async function get(path: string, session = cookie) {
  const r = await fetch(base + path, {
    headers: session ? { Cookie: session } : {},
  });
  const result = await r.json();
  assert.equal(r.status, 200, JSON.stringify(result));
  return result;
}
async function login(mail: string) {
  const r = await post("/api/session", {
    email: mail,
    password,
    profile: "owner",
  });
  assert.equal(r.status, 200);
  return r.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
}
before(async () => {
  await db.query("INSERT INTO tenants(id,name,slug) VALUES ($1,$2,$3)", [
    tenant,
    "Salão de teste isolada",
    slug,
  ]);
  const u = await auth.api.signUpEmail({
    body: { email, password, name: "Dono QA" },
  });
  await db.query(
    "INSERT INTO memberships(user_id,tenant_id,role) VALUES ($1,$2,'owner')",
    [u.user.id, tenant],
  );
  cookie = await login(email);
  pro = (
    await ok("/api/settings", {
      action: "professional",
      name: "Profissional QA",
      specialty: "Cortes",
      color: "#aabbcc",
      commissionBps: 6000,
      commissionKind: "percent",
      commissionFixed: 0,
      active: true,
    })
  ).id;
  service = (
    await ok("/api/settings", {
      action: "service",
      name: "Corte QA",
      description: "Serviço de teste",
      price: 6000,
      duration: 45,
      commissionBps: null,
      active: true,
    })
  ).id;
  await ok("/api/settings", {
    action: "schedule",
    professionalId: pro,
    days: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      enabled: true,
      startMinute: 540,
      endMinute: 1080,
      breakStart: 720,
      breakEnd: 780,
    })),
  });
});
after(async () => {
  await transaction(async (c) => {
    const users = (
      await c.query("SELECT user_id FROM memberships WHERE tenant_id=$1", [
        tenant,
      ])
    ).rows.map((r) => r.user_id);
    await c.query("DELETE FROM cash_movements WHERE tenant_id=$1", [tenant]);
    await c.query("DELETE FROM cash_sessions WHERE tenant_id=$1", [tenant]);
    await c.query(
      "DELETE FROM notifications WHERE appointment_id IN (SELECT id FROM appointments WHERE tenant_id=$1)",
      [tenant],
    );
    await c.query("DELETE FROM payments WHERE tenant_id=$1", [tenant]);
    await c.query("DELETE FROM appointments WHERE tenant_id=$1", [tenant]);
    for (const table of [
      "time_blocks",
      "professional_services",
      "working_schedules",
      "payouts",
      "advances",
      "expenses",
      "request_records",
      "audit_log",
      "tv_devices",
      "memberships",
    ])
      await c.query(`DELETE FROM ${table} WHERE tenant_id=$1`, [tenant]);
    await c.query("DELETE FROM services WHERE tenant_id=$1", [tenant]);
    await c.query("DELETE FROM professionals WHERE tenant_id=$1", [tenant]);
    for (const id of users) {
      await c.query('DELETE FROM auth_session WHERE "userId"=$1', [id]);
      await c.query('DELETE FROM auth_account WHERE "userId"=$1', [id]);
      await c.query("DELETE FROM auth_user WHERE id=$1", [id]);
    }
    await c.query("DELETE FROM tenants WHERE id=$1", [tenant]);
  });
  await db.end();
});
test("cadastros, divisão 60/40, desconto, pagamentos parciais, estorno, adiantamento e caixa conciliam", async () => {
  await ok("/api/settings", {
    action: "service_rule",
    professionalId: pro,
    serviceId: service,
    enabled: true,
    price: 8000,
    duration: 60,
    commissionBps: 6000,
  });
  const date = addDays(localDay(), 30);
  const a = await ok("/api/data", {
    action: "book",
    internal: true,
    professionalId: pro,
    serviceId: service,
    customer: "Cliente QA financeiro",
    phone: "11987654321",
    date,
    hour: "10:00",
    consent: false,
  });
  let row = (await get("/api/appointments/" + a.id)).appointment;
  assert.equal(row.price, 8000);
  assert.equal(row.commission, 4800);
  assert.equal(+new Date(row.ends_at) - +new Date(row.starts_at), 3600000);
  await ok("/api/settings", {
    action: "service",
    id: service,
    name: "Corte QA atualizado",
    description: "Novo cadastro",
    price: 20000,
    duration: 120,
    commissionBps: null,
    active: true,
  });
  row = (await get("/api/appointments/" + a.id)).appointment;
  assert.equal(row.price, 8000);
  assert.equal(row.service_name, "Corte QA");
  await ok("/api/data", { action: "discount", id: a.id, amount: 1000 });
  row = (await get("/api/appointments/" + a.id)).appointment;
  assert.equal(row.price, 7000);
  assert.equal(row.commission, 4200);
  assert.equal(row.price - row.commission, 2800);
  const key = randomUUID();
  const payment = {
    action: "receive",
    id: a.id,
    amount: 3000,
    tip: 500,
    fee: 0,
    method: "Pix",
    idempotencyKey: key,
  };
  await ok("/api/data", payment);
  await ok("/api/data", payment);
  assert.equal((await get("/api/appointments/" + a.id)).appointment.paid, 3000);
  assert.equal(
    (await post("/api/data", { ...payment, amount: 3100 }, cookie)).status,
    409,
  );
  await ok("/api/data", {
    action: "status",
    id: a.id,
    status: "completed",
    collect: false,
  });
  let finance = await get("/api/finance");
  let b = finance.balances[0];
  assert.equal(b.generated, 4200);
  assert.equal(b.released, 1800);
  assert.equal(b.tips, 500);
  assert.equal(b.available, 2300);
  assert.equal(b.shop_generated, 2800);
  await ok("/api/data", {
    action: "payout",
    professionalId: pro,
    amount: 2300,
    method: "Pix",
  });
  const receipt = finance.payments.find(
    (p: { appointment_id: string; kind: string }) =>
      p.appointment_id === a.id && p.kind === "receipt",
  );
  await ok("/api/data", {
    action: "refund",
    paymentId: receipt.id,
    amount: 1000,
    tip: 250,
    fee: 0,
    reason: "Estorno de teste",
  });
  finance = await get("/api/finance");
  assert.equal(finance.balances[0].available, -850);
  assert.equal(
    (
      await post(
        "/api/data",
        { action: "payout", professionalId: pro, amount: 100, method: "Pix" },
        cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/api/data",
        {
          action: "refund",
          paymentId: receipt.id,
          amount: 5000,
          tip: 0,
          fee: 0,
          reason: "Inválido",
        },
        cookie,
      )
    ).status,
    400,
  );
  await ok("/api/data", {
    action: "receive",
    id: a.id,
    amount: 5000,
    tip: 250,
    fee: 150,
    method: "Cartão",
  });
  finance = await get("/api/finance");
  assert.equal(finance.balances[0].available, 2400);
  await ok("/api/data", { action: "cash_open", amount: 10000 });
  await ok("/api/data", {
    action: "expense",
    description: "Produtos QA",
    amount: 2000,
    method: "Dinheiro",
  });
  await ok("/api/data", {
    action: "advance",
    professionalId: pro,
    amount: 1000,
    method: "Dinheiro",
    reason: "Adiantamento QA",
  });
  await ok("/api/data", {
    action: "payout",
    professionalId: pro,
    amount: 1400,
    method: "Dinheiro",
  });
  finance = await get("/api/finance");
  assert.equal(finance.cash.expected_balance, 5600);
  assert.equal(finance.balances[0].available, 0);
  assert.equal(
    (
      await post(
        "/api/data",
        { action: "cash_close", amount: 5500, note: "" },
        cookie,
      )
    ).status,
    400,
  );
  await ok("/api/data", {
    action: "cash_close",
    amount: 5500,
    note: "Diferença de contagem do teste",
  });
  finance = await get("/api/finance");
  assert.equal(finance.cash, null);
  assert.equal(finance.cashHistory[0].difference, -100);
  assert.equal(
    (
      await post(
        "/api/data",
        {
          action: "receive",
          id: a.id,
          amount: 0,
          tip: 100,
          fee: 0,
          method: "Dinheiro",
        },
        cookie,
      )
    ).status,
    400,
  );
  const report = finance.report;
  assert.equal(report.received, 7000);
  assert.equal(report.tips, 500);
  assert.equal(report.commissions, 4200);
  assert.equal(report.shopShare, 2800);
  assert.equal(report.fees, 150);
  assert.equal(report.expenses, 2000);
  assert.equal(report.result, 650);
  const pdf = await fetch(base + "/api/finance?export=pdf", {
    headers: { Cookie: cookie },
  });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get("content-type") || "", /application\/pdf/);
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    "%PDF",
  );
});
test("jornada, bloqueio, remarcação atômica e gestão pelo link pessoal", async () => {
  const date = addDays(localDay(), 32);
  await ok("/api/settings", {
    action: "block",
    professionalId: pro,
    date,
    start: "09:00",
    endDate: date,
    end: "10:00",
    reason: "Folga parcial QA",
  });
  const book = {
    action: "book",
    internal: true,
    professionalId: pro,
    serviceId: service,
    customer: "Cliente QA agenda",
    phone: "11987654322",
    date,
    consent: true,
  };
  assert.equal(
    (await post("/api/data", { ...book, hour: "09:00" }, cookie)).status,
    409,
  );
  assert.equal(
    (await post("/api/data", { ...book, hour: "11:45" }, cookie)).status,
    400,
  );
  const a = await ok("/api/data", { ...book, hour: "10:00" });
  assert.equal(
    (
      await post(
        "/api/data",
        { action: "reschedule", id: a.id, date, hour: "09:00" },
        cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (await post("/api/data", { ...book, hour: "10:00" }, cookie)).status,
    409,
  );
  const own = (await get("/api/appointments/" + a.id)).appointment;
  assert.match(own.starts_at, /T13:00/);
  const manage = { id: a.id, token: a.manageToken };
  assert.equal(
    (
      await post("/api/manage", {
        ...manage,
        token: "0".repeat(64),
        action: "get",
      })
    ).status,
    404,
  );
  let personal = await ok("/api/manage", { ...manage, action: "get" }, "");
  assert.equal(personal.appointment.customer, "Cliente QA agenda");
  const next = addDays(date, 1);
  await ok(
    "/api/manage",
    { ...manage, action: "reschedule", date: next, hour: "10:00" },
    "",
  );
  personal = await ok("/api/manage", { ...manage, action: "get" }, "");
  assert.equal(personal.appointment.starts_at.slice(0, 10), next);
  const old = (
    await db.query(
      "SELECT status FROM notifications WHERE appointment_id=$1 AND version=0",
      [a.id],
    )
  ).rows;
  assert.ok(old.every((n) => n.status === "cancelled"));
  await ok("/api/manage", { ...manage, action: "cancel" }, "");
  personal = await ok("/api/manage", { ...manage, action: "get" }, "");
  assert.equal(personal.appointment.status, "cancelled");
  assert.equal(
    (
      await db.query("SELECT id FROM resource_slots WHERE appointment_id=$1", [
        a.id,
      ])
    ).rowCount,
    0,
  );
});
test("atendimento avulso mantém histórico, divisão, recebimento idempotente e limites do profissional", async () => {
  const p = (
    await ok("/api/settings", {
      action: "professional",
      name: "Avulso QA",
      specialty: "Cortes",
      color: "#aabbcc",
      commissionBps: 6000,
      commissionKind: "percent",
      commissionFixed: 0,
      active: true,
    })
  ).id;
  const svc = (
    await ok("/api/settings", {
      action: "service",
      name: "Avulso QA",
      description: "Teste",
      price: 5000,
      duration: 30,
      commissionBps: null,
      active: true,
    })
  ).id;
  const body = {
    action: "walk_in",
    professionalId: p,
    serviceId: svc,
    customer: "Avulso fictício QA",
    quotedPrice: 5000,
    received: true,
    method: "Cartão",
    tip: 300,
    fee: 100,
    idempotencyKey: randomUUID(),
  };
  const first = await ok("/api/data", body);
  assert.equal((await ok("/api/data", body)).id, first.id);
  const row = (await get("/api/appointments/" + first.id)).appointment;
  assert.equal(row.source, "walk_in");
  assert.equal(row.status, "completed");
  assert.equal(row.price, 5000);
  assert.equal(row.commission, 3000);
  assert.equal(row.paid, 5000);
  assert.equal(row.consent, false);
  assert.equal(
    (
      await db.query("SELECT id FROM resource_slots WHERE appointment_id=$1", [
        first.id,
      ])
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await db.query("SELECT id FROM notifications WHERE appointment_id=$1", [
        first.id,
      ])
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await db.query("SELECT id FROM payments WHERE appointment_id=$1", [
        first.id,
      ])
    ).rowCount,
    1,
  );
  let finance = await get("/api/finance");
  let balance = finance.balances.find(
    (b: { professional_id: string }) => b.professional_id === p,
  );
  assert.equal(balance.released, 3000);
  assert.equal(balance.tips, 300);
  assert.equal(balance.available, 3300);
  const unpaid = await ok("/api/data", {
    ...body,
    received: false,
    tip: 0,
    fee: 0,
    idempotencyKey: randomUUID(),
  });
  assert.equal(
    (await get("/api/appointments/" + unpaid.id)).appointment.paid,
    0,
  );
  finance = await get("/api/finance");
  balance = finance.balances.find(
    (b: { professional_id: string }) => b.professional_id === p,
  );
  assert.equal(balance.generated, 6000);
  assert.equal(balance.released, 3000);
  const count = (
    await db.query(
      "SELECT count(*)::int n FROM appointments WHERE tenant_id=$1",
      [tenant],
    )
  ).rows[0].n;
  assert.equal(
    (
      await post(
        "/api/data",
        { ...body, method: "Dinheiro", idempotencyKey: randomUUID() },
        cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int n FROM appointments WHERE tenant_id=$1",
        [tenant],
      )
    ).rows[0].n,
    count,
  );
  // A completed walk-in is historical: it cannot reserve time or bypass booking conflicts.
  const planned = (
    await db.query(
      "INSERT INTO appointments(tenant_id,professional_id,service_id,customer,phone,starts_at,ends_at,price,list_price,commission_bps,commission,manage_hash) VALUES($1,$2,$3,'Reserva QA','',now()-interval '10 minutes',now()+interval '20 minutes',5000,5000,6000,3000,$4) RETURNING id",
      [tenant, p, svc, randomUUID()],
    )
  ).rows[0];
  await assert.rejects(
    db.query(
      "INSERT INTO appointments(tenant_id,professional_id,service_id,customer,phone,starts_at,ends_at,price,list_price,commission_bps,commission,manage_hash) VALUES($1,$2,$3,'Conflito QA','',now()-interval '5 minutes',now()+interval '15 minutes',5000,5000,6000,3000,$4)",
      [tenant, p, svc, randomUUID()],
    ),
    (e: unknown) => (e as { code: string }).code === "23P01",
  );
  const mail = "avulso-" + email;
  await ok("/api/settings", {
    action: "user_create",
    name: "Avulso QA",
    email: mail,
    password,
    role: "barber",
    professionalId: p,
  });
  const barber = await login(mail);
  assert.equal(
    (
      await post(
        "/api/data",
        { ...body, professionalId: pro, idempotencyKey: randomUUID() },
        barber,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        "/api/data",
        { ...body, price: 100, idempotencyKey: randomUUID() },
        barber,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/cuts?professionalId=" + pro, {
        headers: { Cookie: barber },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/walk-ins?professionalId=" + pro, {
        headers: { Cookie: barber },
      })
    ).status,
    403,
  );
  const own = await get("/api/my-profile", barber);
  assert.equal(own.professional.id, p);
  assert.equal(
    (
      await post(
        "/api/my-profile",
        {
          name: "Tentativa QA",
          specialty: "Cortes",
          color: "#aabbcc",
          commissionBps: 10000,
        },
        barber,
      )
    ).status,
    400,
  );
  await ok(
    "/api/my-profile",
    { name: "Avulso QA atualizado", specialty: "Cortes", color: "#aabbcc" },
    barber,
  );
  await db.query(
    "INSERT INTO notifications(appointment_id,kind,due_at,status) VALUES($1,'confirmation',now(),'simulated')",
    [planned.id],
  );
  const otherAppointment = (
    await db.query(
      "SELECT id FROM appointments WHERE tenant_id=$1 AND professional_id=$2 LIMIT 1",
      [tenant, pro],
    )
  ).rows[0];
  await db.query(
    "INSERT INTO notifications(appointment_id,kind,due_at,status) VALUES($1,'qa_isolation',now(),'simulated')",
    [otherAppointment.id],
  );
  const ownData = await get("/api/data", barber);
  assert.ok(ownData.notifications.length > 0);
  assert.ok(
    ownData.notifications.every(
      (n: { professional_id: string }) => n.professional_id === p,
    ),
  );
  assert.ok(
    (await get("/api/cuts", barber)).appointments.every(
      (a: { professional_id: string }) => a.professional_id === p,
    ),
  );
  assert.ok(
    (await get("/api/finance", barber)).balances.every(
      (b: { professional_id: string }) => b.professional_id === p,
    ),
  );
  await ok(
    "/api/data",
    { ...body, received: false, tip: 0, fee: 0, idempotencyKey: randomUUID() },
    barber,
  );
  await ok("/api/settings", {
    action: "professional",
    id: p,
    name: "Avulso QA",
    specialty: "Cortes",
    color: "#aabbcc",
    commissionBps: 5000,
    commissionKind: "percent",
    commissionFixed: 0,
    active: true,
  });
  assert.equal(
    (await get("/api/appointments/" + first.id)).appointment.commission,
    3000,
  );
});

test("lembretes manuais usam agenda atual e isolam telefone por profissional", async () => {
  const p = (
    await ok("/api/settings", {
      action: "professional",
      name: "Lembretes QA",
      specialty: "Cortes",
      color: "#aabbcc",
      commissionBps: 6000,
      commissionKind: "percent",
      commissionFixed: 0,
      active: true,
    })
  ).id;
  const mail = "lembrete-" + email;
  await ok("/api/settings", {
    action: "user_create",
    name: "Lembretes QA",
    email: mail,
    password,
    role: "barber",
    professionalId: p,
  });
  const barber = await login(mail);
  const ids: string[] = [];
  for (const [pid, offset, consent, status] of [
    [p, 24, true, "scheduled"],
    [pro, 24, true, "confirmed"],
    [p, 26, false, "scheduled"],
    [p, 28, true, "cancelled"],
  ] as const) {
    const a = (
      await db.query(
        "INSERT INTO appointments(tenant_id,professional_id,service_id,customer,phone,starts_at,ends_at,price,list_price,commission_bps,commission,manage_hash,consent,status) VALUES($1,$2,$3,'Lembrete fictício QA','11900000001',now()+($4*interval '1 hour'),now()+(($4+0.5)*interval '1 hour'),5000,5000,6000,3000,$5,$6,$7) RETURNING id",
        [tenant, pid, service, offset, randomUUID(), consent, status],
      )
    ).rows[0];
    ids.push(a.id);
  }
  assert.equal((await fetch(base + "/api/reminders")).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/reminders?professionalId=" + pro, {
        headers: { Cookie: barber },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/reminders?period=invalid", {
        headers: { Cookie: barber },
      })
    ).status,
    400,
  );
  const response = await fetch(base + "/api/reminders", {
    headers: { Cookie: barber },
  });
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("cache-control") || "",
    /private, no-store/,
  );
  const own = await response.json();
  assert.deepEqual(
    own.appointments.map((a: { id: string }) => a.id),
    [ids[0], ids[2]],
  );
  assert.equal(own.appointments[0].phone, "11900000001");
  assert.equal(own.appointments[1].consent, false);
  assert.ok(
    own.appointments.every(
      (a: {
        professional_id: string;
        manage_hash?: string;
        commission?: number;
      }) =>
        a.professional_id === p &&
        a.manage_hash === undefined &&
        a.commission === undefined,
    ),
  );
  const all = await get("/api/reminders");
  assert.ok(all.appointments.some((a: { id: string }) => a.id === ids[1]));
  assert.ok(!all.appointments.some((a: { id: string }) => a.id === ids[3]));
  const other = (
    await db.query(
      "SELECT id FROM professionals WHERE tenant_id='demo' LIMIT 1",
    )
  ).rows[0];
  assert.deepEqual(
    (await get("/api/reminders?professionalId=" + other.id)).appointments,
    [],
  );
  const task = { appointmentId: ids[0], version: 0 };
  const openChat = (session = cookie, version = 0) =>
    fetch(base + "/api/reminders/open", {
      method: "POST",
      redirect: "manual",
      headers: { Origin: base, Cookie: session },
      body: new URLSearchParams({
        appointmentId: ids[0],
        version: String(version),
        message: "Olá! Lembrete fictício de teste.",
      }),
    });
  assert.equal((await openChat("")).status, 401);
  assert.equal((await openChat(barber)).status, 403);
  assert.equal(
    (await post("/api/reminders", { action: "request", ...task }, "")).status,
    401,
  );
  assert.equal(
    (
      await post(
        "/api/reminders",
        { action: "request", appointmentId: ids[1], version: 0 },
        barber,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        "/api/reminders",
        { action: "request", appointmentId: ids[2], version: 0 },
        barber,
      )
    ).status,
    409,
  );
  await ok("/api/reminders", { action: "request", ...task }, barber);
  await ok("/api/reminders", { action: "request", ...task }, barber);
  assert.equal(
    (
      await db.query(
        "SELECT id FROM manual_reminder_tasks WHERE appointment_id=$1",
        [ids[0]],
      )
    ).rowCount,
    1,
  );
  const chat = await openChat();
  assert.equal(chat.status, 303);
  const destination = new URL(chat.headers.get("location")!);
  assert.equal(destination.origin, "https://wa.me");
  assert.equal(
    destination.searchParams.get("text"),
    "Olá! Lembrete fictício de teste.",
  );
  const receptionEmail = "central-" + email;
  await ok("/api/settings", {
    action: "user_create",
    name: "Recepção Central QA",
    email: receptionEmail,
    password,
    role: "receptionist",
    professionalId: null,
  });
  const reception = await login(receptionEmail);
  const duplicate = await openChat(reception);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.headers.get("location"), null);
  assert.match(await duplicate.text(), /Outra pessoa da equipe/);
  assert.ok(
    (await get("/api/notices")).items.some(
      (n: { kind: string }) => n.kind === "central",
    ),
  );
  assert.equal(
    (
      await post(
        "/api/reminders",
        { action: "done", confirmed: true, ...task },
        barber,
      )
    ).status,
    403,
  );
  assert.equal(
    (await post("/api/reminders", { action: "done", ...task }, cookie)).status,
    400,
  );
  const opened = await ok("/api/reminders", { action: "opened", ...task });
  assert.equal(opened.state, "opened");
  assert.equal(opened.done_at, null);
  const finished = await ok("/api/reminders", {
    action: "done",
    confirmed: true,
    ...task,
  });
  assert.equal(finished.state, "done");
  const repeated = await openChat();
  assert.equal(repeated.status, 409);
  assert.equal(repeated.headers.get("location"), null);
  assert.equal(
    (await ok("/api/reminders", { action: "opened", ...task })).state,
    "done",
  );
  await ok("/api/reminders", { action: "reopen", ...task });
  const nearIds: string[] = [];
  for (const pid of [p, pro])
    nearIds.push(
      (
        await db.query(
          "INSERT INTO appointments(tenant_id,professional_id,service_id,customer,phone,starts_at,ends_at,price,list_price,commission_bps,commission,manage_hash,consent) VALUES($1,$2,$3,'Próximo corte QA','11900000002',now()+interval '7 minutes',now()+interval '37 minutes',5000,5000,6000,3000,$4,true) RETURNING id",
          [tenant, pid, service, randomUUID()],
        )
      ).rows[0].id,
    );
  assert.equal((await fetch(base + "/api/notices")).status, 401);
  const ownNotices = await get("/api/notices", barber);
  assert.deepEqual(
    ownNotices.items
      .filter((n: { kind: string }) => n.kind === "cut")
      .map((n: { appointmentId: string }) => n.appointmentId),
    [nearIds[0]],
  );
  assert.ok(
    ownNotices.items.some(
      (n: { kind: string; appointmentId: string }) =>
        n.kind === "reminder" && n.appointmentId === nearIds[0],
    ),
  );
  assert.equal(JSON.stringify(ownNotices).includes("11900000002"), false);
  await db.query(
    "UPDATE appointments SET starts_at=starts_at+interval '30 days',ends_at=ends_at+interval '30 days',schedule_version=schedule_version+1 WHERE id=$1",
    [ids[0]],
  );
  const changed = await get("/api/reminders", barber);
  assert.ok(!changed.appointments.some((a: { id: string }) => a.id === ids[0]));
  assert.equal(
    (
      await post(
        "/api/reminders",
        { action: "done", confirmed: true, ...task },
        cookie,
      )
    ).status,
    409,
  );
  const staleChat = await openChat();
  assert.equal(staleChat.status, 409);
  assert.equal(staleChat.headers.get("location"), null);
  assert.equal(
    (
      await db.query(
        "SELECT id FROM notifications WHERE appointment_id=ANY($1::uuid[])",
        [ids],
      )
    ).rowCount,
    0,
  );
});

test("perfis individuais, isolamento entre salões de beleza e TV revogável", async () => {
  const accounts = [
    {
      name: "Recepção QA",
      email: "recepcao-" + email,
      role: "receptionist",
      professionalId: null,
    },
    {
      name: "Profissional QA",
      email: "profissional-" + email,
      role: "barber",
      professionalId: pro,
    },
  ];
  for (const user of accounts)
    await ok("/api/settings", { action: "user_create", ...user, password });
  const receptionist = await login(accounts[0].email),
    barber = await login(accounts[1].email);
  assert.equal(
    (await fetch(base + "/api/settings", { headers: { Cookie: receptionist } }))
      .status,
    403,
  );
  const f = await get("/api/finance", receptionist);
  assert.equal(f.report, null);
  assert.equal(f.balances.length, 0);
  const data = await get("/api/data", barber);
  assert.equal(data.role, "barber");
  assert.equal(data.professionals.length, 1);
  assert.equal(data.professionals[0].id, pro);
  assert.equal(
    (
      await post(
        "/api/data",
        { action: "expense", description: "Teste", amount: 100, method: "Pix" },
        barber,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post("/api/auth/sign-up/email", {
        name: "Não autorizado",
        email: "no-" + email,
        password,
      })
    ).status,
    404,
  );
  const other = (
    await db.query("SELECT id FROM appointments WHERE tenant_id='demo' LIMIT 1")
  ).rows[0];
  if (other)
    assert.equal(
      (
        await fetch(base + "/api/appointments/" + other.id, {
          headers: { Cookie: cookie },
        })
      ).status,
      404,
    );
  assert.equal(
    (
      await post(
        "/api/settings",
        {
          action: "professional",
          id: "rafa",
          name: "Invasão",
          specialty: "x",
          color: "#aabbcc",
          commissionBps: 10000,
          commissionKind: "percent",
          commissionFixed: 0,
          active: true,
        },
        cookie,
      )
    ).status,
    404,
  );
  const device = await ok("/api/settings", {
    action: "tv_create",
    name: "TV QA",
    days: 1,
  });
  const paired = await post("/api/tv/pair", { token: device.token });
  assert.equal(paired.status, 200);
  const tvCookie = paired.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const tv = await get("/api/tv", tvCookie);
  assert.equal(tv.mode, "device");
  assert.equal(tv.tenant.name, "Salão de teste isolada");
  assert.equal(
    (await fetch(base + "/api/data", { headers: { Cookie: tvCookie } })).status,
    401,
  );
  assert.ok(
    tv.appointments.every(
      (a: { phone?: string; price?: number }) =>
        a.phone === undefined && a.price === undefined,
    ),
  );
  const config = await get("/api/settings");
  const id = config.devices.find(
    (d: { name: string }) => d.name === "TV QA",
  ).id;
  await ok("/api/settings", { action: "tv_revoke", id });
  assert.equal(
    (await fetch(base + "/api/tv", { headers: { Cookie: tvCookie } })).status,
    401,
  );
  const barberUser = config.users.find(
    (u: { email: string }) => u.email === accounts[1].email,
  );
  await ok("/api/settings", {
    action: "user_access",
    id: barberUser.id,
    active: false,
    role: "barber",
    professionalId: pro,
  });
  assert.equal(
    (await fetch(base + "/api/data", { headers: { Cookie: barber } })).status,
    401,
  );
});
