import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3018";
test(
  "demonstrações de gestor e profissional preservam credenciais e isolam dados",
  { skip: process.env.DEMO_MODE !== "true" },
  async () => {
    const login = await fetch(base + "/api/session", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "demo@beauty.local",
        password: "DemoBeauty2026!",
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
    const data = await (
      await fetch(base + "/api/data", { headers: { Cookie: cookie } })
    ).json();
    assert.equal(data.readOnly, false);
    assert.equal(data.isDemo, true);
    assert.equal(data.role, "owner");
    assert.equal(data.professionalId, "rafa");
    const forbidden = await fetch(base + "/api/settings", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "user_create",
      }),
    });
    assert.equal(forbidden.status, 403);
    const change = await fetch(base + "/api/auth/change-password", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "DemoBeauty2026!",
        newPassword: "not-a-new-password",
      }),
    });
    assert.equal(change.status, 403);
    const settings = await (
      await fetch(base + "/api/settings", { headers: { Cookie: cookie } })
    ).json();
    assert.deepEqual(settings.users, []);
    const professionalLogin = await fetch(base + "/api/session", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "profissional@beauty.local",
        password: "DemoBeauty2026!",
      }),
    });
    assert.equal(professionalLogin.status, 200);
    const professionalCookie = professionalLogin.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
    const ownGet = (path: string) =>
      fetch(base + path, { headers: { Cookie: professionalCookie } });
    const ownData = await (await ownGet("/api/data")).json();
    assert.equal(ownData.role, "barber");
    assert.equal(ownData.isDemo, true);
    assert.equal(ownData.readOnly, false);
    assert.equal(ownData.professionalId, "leo");
    assert.deepEqual(
      ownData.professionals.map((p: { id: string }) => p.id),
      ["leo"],
    );
    assert.ok(
      ownData.appointments.every(
        (a: { professional_id: string }) => a.professional_id === "leo",
      ),
    );
    assert.ok(
      ownData.notifications.every(
        (n: { professional_id: string }) => n.professional_id === "leo",
      ),
    );
    assert.equal((await ownGet("/api/settings")).status, 403);
    assert.equal((await ownGet("/api/my-profile")).status, 200);
    assert.equal((await ownGet("/api/cuts?professionalId=rafa")).status, 403);
    assert.equal(
      (await ownGet("/api/walk-ins?professionalId=rafa")).status,
      403,
    );
    const ownPdf = await ownGet("/api/finance?export=pdf");
    assert.equal(ownPdf.status, 200);
    const pdf = await fetch(base + "/api/finance?export=pdf", {
      headers: { Cookie: cookie },
    });
    assert.equal(pdf.status, 200);
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
  },
);
