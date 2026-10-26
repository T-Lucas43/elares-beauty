import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:3018";
await mkdir("tmp/beauty-qa", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const width of [1440, 375]) {
    const context = await browser.newContext({
      viewport: { width, height: 960 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.getByRole("button", { name: "Gestor e profissional" }).click();
    await page
      .locator(".sidebar nav button")
      .filter({ hasText: "Visão geral" })
      .waitFor({ state: "attached" });
    async function tab(name) {
      if (width === 375)
        await page
          .getByRole("button", { name: "Abrir menu", exact: true })
          .click();
      await page
        .locator(".sidebar nav")
        .getByRole("button", { name: new RegExp("^" + name) })
        .click();
      await page.waitForTimeout(300);
    }
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page.getByRole("button", { name: "Ativar tema escuro" }).click();
      for (const name of [
        "Visão geral",
        "Agenda",
        "Profissionais",
        "Serviços",
        "Clientes",
        "Financeiro",
        "Relatórios",
        "Lembretes",
        "Configurações",
      ]) {
        await tab(name);
        if (name === "Agenda")
          for (const view of ["Lista", "Dia", "Semana", "Mês"]) {
            await page.getByRole("button", { name: view, exact: true }).click();
            await page.waitForTimeout(180);
          }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.equal(
          overflow,
          false,
          name + " overflow " + width + " " + theme,
        );
        results.push({ width, theme, module: name, overflow });
        console.log(width, theme, name, "OK");
        if (["Visão geral", "Agenda", "Lembretes"].includes(name))
          await page.screenshot({
            path:
              "tmp/beauty-qa/" +
              width +
              "-" +
              theme +
              "-" +
              name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replaceAll(" ", "-") +
              ".png",
            fullPage: true,
          });
      }
    }
    await page.reload();
    await page.waitForTimeout(400);
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    assert.deepEqual(errors, []);
    const clients = await context.request.get(base + "/api/clients");
    assert.equal(clients.status(), 200);
    const pdf = await context.request.get(base + "/api/finance?export=pdf");
    assert.equal(pdf.status(), 200);
    await writeFile("tmp/beauty-qa/report.pdf", await pdf.body());
    const csv = await context.request.get(base + "/api/finance?export=csv");
    assert.equal(csv.status(), 200);
    if (width === 1440) {
      await page.goto(base + "/tv");
      await page.locator(".tv-heading").waitFor();
      await page.waitForFunction(() =>
        document
          .querySelector(".tv-shop")
          ?.textContent?.includes("ELARES BEAUTY"),
      );
      await page.waitForTimeout(500);
      await page.screenshot({ path: "tmp/beauty-qa/tv.png", fullPage: true });
    }
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto(base);
  await page.getByRole("button", { name: /^Profissional/ }).click();
  await page
    .locator(".sidebar nav button")
    .filter({ hasText: "Atendimentos" })
    .waitFor({ state: "attached" });
  const data = await (await context.request.get(base + "/api/data")).json();
  assert.equal(data.role, "barber");
  assert.ok(
    data.appointments.every((a) => a.professional_id === data.professionalId),
  );
  assert.equal(data.professionals.length, 1);
  assert.equal(data.expenses.length, 0);
  assert.equal((await context.request.get(base + "/api/tv")).status(), 403);
  await page.screenshot({
    path: "tmp/beauty-qa/professional-mobile.png",
    fullPage: true,
  });
  await context.close();
  console.log(
    JSON.stringify(
      {
        checks: results.length,
        professionalIsolation: true,
        pdf: true,
        csv: true,
        results,
      },
      null,
      2,
    ),
  );
  await writeFile(
    "tmp/beauty-qa/results.json",
    JSON.stringify(
      {
        checks: results.length,
        professionalIsolation: true,
        pdf: true,
        csv: true,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
