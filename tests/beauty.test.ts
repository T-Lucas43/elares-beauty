import { test } from "node:test";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3018";
async function login(email: string) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "DemoBeauty2026!" }),
  });
  assert.equal(r.status, 200);
  const cookies = r.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith("elares-beauty.")));
  return cookies.map((c) => c.split(";")[0]).join("; ");
}
test("Beauty publica os seis serviços fictícios e a identidade PWA independente", async () => {
  const d = await (await fetch(base + "/api/public?slug=elares-beauty")).json();
  assert.equal(d.tenant.name, "Elares Beauty");
  for (const name of [
    "Corte",
    "Escova",
    "Hidratação",
    "Coloração",
    "Manicure",
    "Sobrancelhas",
  ])
    assert.ok(
      d.services.some(
        (s: { name: string; price: number; duration: number }) =>
          s.name === name && s.price > 0 && s.duration > 0,
      ),
      name,
    );
  const m = await (await fetch(base + "/manifest.webmanifest")).json();
  assert.equal(m.id, "/elares-beauty");
  assert.equal(m.theme_color, "#7C3AED");
  assert.match(m.name, /Beauty/);
});
test("clientes Beauty exigem login e profissional só consulta seu histórico", async () => {
  assert.equal((await fetch(base + "/api/clients")).status, 401);
  const cookie = await login("profissional@beauty.local");
  const data = await (
    await fetch(base + "/api/data", { headers: { Cookie: cookie } })
  ).json();
  const clients = await (
    await fetch(base + "/api/clients", { headers: { Cookie: cookie } })
  ).json();
  assert.equal(data.professionals.length, 1);
  assert.equal(data.professionalId, "leo");
  assert.ok(clients.clients.length > 0);
  const finance = await (
    await fetch(base + "/api/finance", { headers: { Cookie: cookie } })
  ).json();
  assert.ok(
    finance.payments.every(
      (p: { professional_id: string }) => p.professional_id === "leo",
    ),
  );
});
