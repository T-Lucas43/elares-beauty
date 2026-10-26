import { mkdir, writeFile } from "node:fs/promises";
import { localDay } from "../lib/domain";
import { addDays } from "../lib/calendar";
import { financialPDF, type PDFReport } from "../lib/financial-pdf";
const base = "http://127.0.0.1:3000";
const login = await fetch(base + "/api/session", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "dono@beauty.local",
    password: process.env.INITIAL_LOCAL_PASSWORD || "demo-local-2026",
  }),
});
if (!login.ok)
  throw Error(
    "Não foi possível autenticar a conta local para a conferência do relatório.",
  );
const cookie = login.headers
  .getSetCookie()
  .map((v) => v.split(";")[0])
  .join("; ");
const report = await fetch(
  base +
    `/api/finance?start=${localDay().slice(0, 8)}01&end=${addDays(localDay(), 1)}&export=pdf`,
  { headers: { Cookie: cookie } },
);
if (!report.ok) throw Error(await report.text());
await mkdir("output/pdf", { recursive: true });
await writeFile(
  "output/pdf/relatorio-financeiro.pdf",
  Buffer.from(await report.arrayBuffer()),
);
const qa: PDFReport = {
  shop: {
    name: "Salão QA - teste de paginação",
    address: "Dados fictícios para validação visual",
  },
  role: "owner",
  generatedBy: "Conferência de layout",
  start: "2026-10-01",
  end: "2026-11-01",
  report: {
    received: 400000,
    tips: 0,
    fees: 4000,
    commissions: 240000,
    tipsReleased: 0,
    expenses: 50000,
    result: 106000,
  },
  balances: [
    {
      professional_name:
        "Profissional com nome extenso para conferir quebra e alinhamento",
      generated: 240000,
      released: 240000,
      tips: 0,
      paid: 100000,
      advances: 20000,
      available: 120000,
      service_total: 400000,
      shop_generated: 160000,
    },
  ],
  payments: Array.from({ length: 80 }, (_, i) => ({
    created_at: "2026-10-25T12:00:00Z",
    kind: i % 9 === 0 ? "refund" : "receipt",
    customer:
      "Cliente com nome extenso para verificar a quebra de linha no detalhamento " +
      String(i + 1),
    service_name: "Corte e barba com acabamento completo",
    professional_name: "Profissional de teste",
    method: i % 2 ? "Pix" : "Cartão",
    service_amount: 5000,
    tip: 0,
    fee: i % 2 ? 0 : 50,
  })),
  expenses: [
    {
      description: "Despesa de teste para conferência",
      amount: 50000,
      paid_at: "2026-10-25T12:00:00Z",
      method: "Pix",
    },
  ],
  payouts: [],
};
await mkdir("tmp/pdfs", { recursive: true });
await writeFile("tmp/pdfs/qa-paginacao.pdf", await financialPDF(qa));
console.log("Relatório real local e PDF de paginação preparados.");
