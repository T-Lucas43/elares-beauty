import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import assert from "node:assert/strict";
const env = parse(await readFile(".env.shard.local"));
const base = env.APP_URL;
const sha = process.argv[2];
const get = (path, cookie) =>
  fetch(base + path, {
    headers: cookie ? { Cookie: cookie } : {},
    signal: AbortSignal.timeout(25000),
  });
const health = await (await get("/api/health")).json();
assert.equal(health.status, "ready");
assert.equal(health.release, sha);
const html = await (await get("/")).text();
assert.match(html, /Elares Beauty/);
const sources = [...html.matchAll(/src="([^\"]+\.js)"/g)]
  .map((m) => m[1])
  .filter((s) => s.startsWith("/_next/"));
const bundles = await Promise.all(
  sources.map(async (s) => (await get(s)).text()),
);
assert.ok(bundles.some((s) => s.includes("Gestor e profissional")));
assert.ok(bundles.some((s) => s.includes("Central do WhatsApp")));
assert.ok(bundles.some((s) => s.includes("Testar pop-up de exemplo")));
const manifest = await (await get("/manifest.webmanifest")).json();
assert.match(manifest.name, /Elares Beauty/);
for (const asset of [
  "/brand/elares-barber-dark.svg",
  "/brand/elares-barber-light.svg",
  "/icons/elares-192.png",
  "/icons/elares-512.png",
  "/icons/elares-180.png",
])
  assert.equal((await get(asset)).status, 200);
assert.equal((await get("/api/reminders")).status, 401);
assert.equal((await get("/api/notices")).status, 401);
for (const [email, role, id] of [
  ["demo@beauty.local", "owner", "rafa"],
  ["profissional@beauty.local", "barber", "leo"],
]) {
  const login = await fetch(base + "/api/session", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "DemoBeauty2026!" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const data = await (await get("/api/data", cookie)).json();
  assert.equal(data.role, role);
  assert.equal(data.professionalId, id);
  const remindersResponse = await get("/api/reminders", cookie);
  assert.equal(remindersResponse.status, 200);
  assert.match(remindersResponse.headers.get("cache-control"), /no-store/);
  const reminders = await remindersResponse.json();
  assert.equal(reminders.canSend, role === "owner");
  if (role === "barber") {
    assert.ok(reminders.appointments.every((a) => a.professional_id === id));
    assert.equal(
      (await get("/api/reminders?professionalId=rafa", cookie)).status,
      403,
    );
  }
  assert.equal((await get("/api/notices", cookie)).status, 200);
  const pdf = await get("/api/finance?export=pdf", cookie);
  assert.equal(pdf.status, 200);
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
}
console.log(
  JSON.stringify({
    health,
    checks:
      "marca, bundles, PWA, dois perfis, central, avisos, isolamento e PDF; somente leituras e logins, sem reservas ou mensagens externas",
  }),
);
