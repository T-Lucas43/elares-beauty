import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db";
const base = "http://127.0.0.1:3018";
async function post(path: string, body: object, cookie?: string) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), ...body }),
  });
}
async function login(profile: string) {
  const r = await post("/api/session", {
    email:
      profile === "owner"
        ? "dono@beauty.local"
        : profile === "receptionist"
          ? "recepcao@beauty.local"
          : "rafael@beauty.local",
    password: process.env.INITIAL_LOCAL_PASSWORD || "demo-local-2026",
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie")!.split(";")[0];
}
after(async () => {
  await db.end();
});
test("agenda por período mantém permissões e TV não expõe financeiro ou telefone", async () => {
  const owner = await login("owner");
  const barber = await login("rafa");
  const d = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const end = new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);
  const get = (path: string, cookie?: string) =>
    fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} });
  assert.equal((await get(`/api/agenda?start=${d}&end=${end}`)).status, 401);
  assert.equal(
    (await get("/api/agenda?start=2026-02-31&end=2026-03-04", owner)).status,
    400,
  );
  assert.equal(
    (await get("/api/agenda?start=2026-01-01&end=2026-12-31", owner)).status,
    400,
  );
  const agenda = await (
    await get(`/api/agenda?start=${d}&end=${end}`, barber)
  ).json();
  assert.ok(
    agenda.appointments.every(
      (a: { professional_id: string }) => a.professional_id === "rafa",
    ),
  );
  assert.equal((await get("/api/tv")).status, 401);
  assert.equal((await get("/api/tv", barber)).status, 403);
  const tv = await (await get("/api/tv", owner)).json();
  assert.ok(tv.professionals.length >= 3);
  for (const a of tv.appointments) {
    assert.equal(a.phone, undefined);
    assert.equal(a.price, undefined);
    assert.equal(a.commission, undefined);
    assert.ok(a.customer.split(" ").length <= 2);
  }
});
test("profissionais diferentes podem receber cortes simultâneos", async () => {
  const date = new Date(Date.now() + 31 * 86400000).toISOString().slice(0, 10);
  const ids: string[] = [];
  try {
    const results = await Promise.all(
      ["rafa", "bruno"].map((professionalId) =>
        post("/api/data", {
          action: "book",
          professionalId,
          serviceId: "corte",
          customer: "Teste simultâneo",
          phone: "11988886666",
          date,
          hour: "13:00",
          consent: false,
        }),
      ),
    );
    for (const r of results) {
      const result = await r.json();
      if (result.id) ids.push(result.id);
      assert.equal(r.status, 200);
    }
  } finally {
    for (const id of ids) {
      await db.query("DELETE FROM audit_log WHERE entity_id=$1", [id]);
      await db.query("DELETE FROM payments WHERE appointment_id=$1", [id]);
      await db.query("DELETE FROM appointments WHERE id=$1", [id]);
    }
  }
});
test("rotas privadas exigem sessão e rejeitam origem externa", async () => {
  assert.equal((await fetch(base + "/api/data")).status, 401);
  const r = await fetch(base + "/api/data", {
    method: "POST",
    headers: {
      Origin: "https://invalid.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(r.status, 403);
});
test("profissional só recebe agenda própria e não registra despesas", async () => {
  const cookie = await login("rafa");
  const r = await fetch(base + "/api/data", { headers: { Cookie: cookie } });
  const d = await r.json();
  assert.ok(
    d.appointments.every(
      (a: { professional_id: string }) => a.professional_id === "rafa",
    ),
  );
  assert.equal(d.professionals.length, 1);
  assert.equal(d.expenses.length, 0);
  assert.equal(
    (
      await post(
        "/api/data",
        { action: "expense", description: "Teste", amount: 100 },
        cookie,
      )
    ).status,
    403,
  );
});
test("reserva concorrente, conclusão idempotente, snapshot e repasse concorrente", async () => {
  const owner = await login("owner");
  const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const phone = "11988887777";
  const body = {
    action: "book",
    professionalId: "leo",
    serviceId: "corte",
    customer: "Teste automatizado",
    phone,
    date,
    hour: "16:00",
    consent: true,
  };
  let id: string | undefined;
  let payoutId: string | undefined;
  try {
    const rs = await Promise.all([
      post("/api/data", body),
      post("/api/data", body),
    ]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
    const win = rs.find((r) => r.status === 200)!;
    id = (await win.json()).id;
    assert.ok(id);
    const a = (await db.query("SELECT * FROM appointments WHERE id=$1", [id]))
      .rows[0];
    assert.equal(a.price, 6000);
    assert.equal(a.commission, Math.round(a.price * a.commission_bps / 10000));
    const r1 = await post(
      "/api/data",
      { action: "status", id, status: "completed", method: "Pix" },
      owner,
    );
    assert.equal(r1.status, 200);
    assert.equal(
      (
        await post(
          "/api/data",
          { action: "status", id, status: "completed", method: "Pix" },
          owner,
        )
      ).status,
      200,
    );
    const row = (
      await db.query("SELECT paid,commission FROM appointments WHERE id=$1", [
        id,
      ])
    ).rows[0];
    assert.equal(row.paid, 6000);
    assert.equal(row.commission, a.commission);
    const pending = await db.query(
      "SELECT count(*)::int n FROM notifications WHERE appointment_id=$1 AND status='pending'",
      [id],
    );
    assert.equal(
      pending.rows[0].n,
      0,
      "conclusão invalida lembretes pendentes",
    );
    const balance = (
      await db.query(
        "SELECT ((SELECT COALESCE(sum(commission),0) FROM appointments WHERE professional_id='leo' AND tenant_id='demo' AND status='completed')-(SELECT COALESCE(sum(amount),0) FROM payouts WHERE professional_id='leo' AND tenant_id='demo'))::int n",
      )
    ).rows[0].n;
    const before = (
      await db.query("SELECT id FROM payouts WHERE professional_id='leo'")
    ).rows.map((r: { id: string }) => r.id);
    const ps = await Promise.all([
      post(
        "/api/data",
        { action: "payout", professionalId: "leo", amount: balance },
        owner,
      ),
      post(
        "/api/data",
        { action: "payout", professionalId: "leo", amount: balance },
        owner,
      ),
    ]);
    assert.deepEqual(ps.map((r) => r.status).sort(), [200, 400]);
    const added = (
      await db.query("SELECT id FROM payouts WHERE professional_id='leo'")
    ).rows.find((r: { id: string }) => !before.includes(r.id));
    payoutId = added?.id;
  } finally {
    // Remove apenas registros fictícios criados por este teste, por IDs conhecidos.
    if (payoutId) {
      await db.query("DELETE FROM audit_log WHERE entity_id=$1", [payoutId]);
      await db.query("DELETE FROM payouts WHERE id=$1", [payoutId]);
    }
    if (id) {
      await db.query("DELETE FROM notifications WHERE appointment_id=$1", [id]);
      await db.query("DELETE FROM audit_log WHERE entity_id=$1", [id]);
      await db.query("DELETE FROM payments WHERE appointment_id=$1", [id]);
      await db.query("DELETE FROM appointments WHERE id=$1", [id]);
    }
  }
});
