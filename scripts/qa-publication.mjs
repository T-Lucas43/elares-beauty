import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { parse } from "dotenv";
const env = parse(await readFile(".env.shard.local"));
const base = env.APP_URL;
const expected = process.argv[3] || "1070c0afea82f9f8c7d4160128cb59004b0e752b";
const mode = process.argv[2] || "prepare";
async function get(path, cookie) {
  return fetch(base + path, {
    headers: cookie ? { Cookie: cookie } : {},
    signal: AbortSignal.timeout(25000),
  });
}
async function post(path, body, cookie, origin = base) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
}
const healthResponse = await get("/api/health");
const home = await (await get("/")).text();
const sources = [...home.matchAll(/src="([^\"]+\.js)"/g)].map(match => match[1]);
const bundles = await Promise.all(sources.filter(src => src.startsWith("/_next/")).map(async src => (await get(src)).text()));
assert.ok(bundles.some(code => code.includes("Gestor e profissional") && code.includes("Registrar avulso")), "O HTML público ainda aponta para a interface anterior.");
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.release, expected);
assert.equal(health.database, "postgresql");
assert.equal(health.demo, true);
if (mode === "inspect") {
  console.log(JSON.stringify({health, interface: "gestor, profissional e registro avulso presentes nos bundles referenciados pelo HTML"}));
} else if (mode === "prepare") {
  const login = await post("/api/session", {
    email: "dono@beauty.local",
    password: env.INITIAL_LOCAL_PASSWORD,
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  const demoLogin = await post("/api/session", {
    email: "demo@beauty.local",
    password: "DemoBeauty2026!",
  });
  assert.equal(demoLogin.status, 200);
  const demoCookie = demoLogin.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.equal((await get("/api/data")).status, 401);
  const dataResponse = await get("/api/data", demoCookie);
  assert.equal(dataResponse.status, 200);
  const data = await dataResponse.json();
  assert.equal(data.readOnly, false);
  assert.equal(data.isDemo, true);
  assert.equal(data.role, "owner");
  assert.equal(data.professionalId, "rafa");
  assert.equal(
    (await post("/api/settings", { action: "user_create" }, demoCookie)).status,
    403,
  );
  const proLogin = await post("/api/session", {
    email: "profissional@beauty.local",
    password: "DemoBeauty2026!",
  });
  assert.equal(proLogin.status, 200);
  const proCookie = proLogin.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const proData = await (await get("/api/data", proCookie)).json();
  assert.equal(proData.role, "barber");
  assert.equal(proData.professionalId, "leo");
  assert.equal(proData.isDemo, true);
  assert.equal(proData.readOnly, false);
  assert.ok(
    proData.professionals.length === 1 && proData.professionals[0].id === "leo",
  );
  assert.ok(proData.appointments.every((a) => a.professional_id === "leo"));
  assert.ok(proData.notifications.every((n) => n.professional_id === "leo"));
  assert.equal((await get("/api/settings", proCookie)).status, 403);
  assert.equal(
    (await get("/api/cuts?professionalId=rafa", proCookie)).status,
    403,
  );
  assert.equal((await get("/api/my-profile", proCookie)).status, 200);
  const ownFinance = await (await get("/api/finance", proCookie)).json();
  assert.ok(
    ownFinance.balances.length === 1 &&
      ownFinance.balances[0].professional_id === "leo",
  );
  assert.equal(
    (await post("/api/data", {}, cookie, "https://example.invalid")).status,
    403,
  );
  const pdf = await get("/api/finance?export=pdf", demoCookie);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get("content-type"), /application\/pdf/);
  const bytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  await mkdir("output/pdf", { recursive: true });
  await writeFile("output/pdf/relatorio-publicado.pdf", bytes);
  const manifest = await (await get("/manifest.webmanifest")).json();
  assert.equal(manifest.display, "standalone");
  for (const file of ["/sw.js", "/icons/icon-192.png", "/icons/icon-512.png"])
    assert.equal((await get(file)).status, 200);
  const tv = await get("/api/tv", cookie);
  assert.equal(tv.status, 200);
  assert.ok(!/"(?:phone|commission|price|paid)"/.test(await tv.text()));
  const day = new Date(Date.now() + 9 * 86400000).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const publicData = await (
    await get(
      "/api/public?slug=elares-beauty&serviceId=corte&professionalId=rafa&date=" +
        day,
    )
  ).json();
  assert.ok(publicData.slots.length);
  const slot = publicData.slots[0];
  const bookingResponse = await post("/api/data", {
    action: "book",
    professionalId: slot.professional_id,
    serviceId: "corte",
    quotedPrice: slot.price,
    quotedDuration: slot.duration,
    customer: "QA persistência - fictício",
    phone: "11900009999",
    date: day,
    hour: slot.hour,
    consent: false,
    internal: false,
    slug: "elares-beauty",
    idempotencyKey: randomUUID(),
  });
  assert.equal(bookingResponse.status, 200);
  const booking = await bookingResponse.json();
  assert.ok(booking.id);
  await mkdir("tmp", { recursive: true });
  await writeFile(
    "tmp/publication-check.local.json",
    JSON.stringify({ cookie, id: booking.id }),
  );
  console.log(
    JSON.stringify({
      health,
      checks:
        "duas demonstrações interativas, isolamento, permissões, PDF, PWA, TV, reserva",
      bookingCreated: true,
      fictionalAppointments: data.appointments.length,
      pdfBytes: bytes.length,
    }),
  );
} else if (mode === "verify") {
  const saved = JSON.parse(await readFile("tmp/publication-check.local.json"));
  const detail = await get("/api/appointments/" + saved.id, saved.cookie);
  assert.equal(detail.status, 200);
  const body = await detail.json();
  assert.equal(body.appointment?.id ?? body.id, saved.id);
  const cancel = await post(
    "/api/data",
    {
      action: "status",
      id: saved.id,
      status: "cancelled",
      idempotencyKey: randomUUID(),
    },
    saved.cookie,
  );
  assert.equal(cancel.status, 200);
  console.log(
    "Persistência após reinício confirmada; reserva fictícia de QA cancelada sem apagar histórico.",
  );
} else throw Error("Modo inválido.");
