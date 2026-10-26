import PDFDocument from "pdfkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beauty } from "./beauty";
import { money } from "./domain";
import { addDays } from "./calendar";
type FinancialReport = {
  received: number;
  tips: number;
  fees: number;
  commissions: number;
  tipsReleased: number;
  expenses: number;
  result: number | null;
};
export type PDFReport = {
  shop: { name: string; address?: string };
  role: string;
  generatedBy: string;
  start: string;
  end: string;
  report: FinancialReport;
  balances: {
    professional_name: string;
    generated: number;
    released: number;
    tips: number;
    paid: number;
    advances: number;
    available: number;
    service_total: number;
    shop_generated: number;
  }[];
  payments: {
    created_at: string;
    kind: string;
    customer: string;
    service_name: string;
    professional_name: string;
    method: string;
    service_amount: number;
    tip: number;
    fee: number;
  }[];
  expenses: {
    description: string;
    amount: number;
    paid_at: string;
    method: string;
  }[];
  payouts: {
    professional_name: string;
    amount: number;
    created_at: string;
    method: string;
  }[];
};
export async function financialPDF(input: PDFReport): Promise<Buffer> {
  const logo = await readFile(join(process.cwd(), "public/brand/elares-beauty-light.png"));
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
    info: {
      Title: `Relatório financeiro - ${input.shop.name}`,
      Author: input.shop.name,
      Subject: "Gestão de salões de beleza",
      Creator: beauty.name,
    },
  });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const W = doc.page.width,
    H = doc.page.height,
    left = 40,
    width = W - 80;
  const green = "#211432",
    gold = beauty.colors.primary,
    ink = "#202630",
    muted = "#677589",
    line = "#E5E9EF";
  let y = 0;
  const fmt = (value: number) => money(value).replace(/\u00a0/g, " ");
  const date = (value: string) =>
    new Date(value).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  const labelDate = (value: string) => value.split("-").reverse().join("/");
  function text(
    value: string,
    x: number,
    top: number,
    options: PDFKit.Mixins.TextOptions = {},
    size = 9,
    color = ink,
    bold = false,
  ) {
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(size)
      .fillColor(color)
      .text(value, x, top, { width, ...options });
  }
  function header(first = false) {
    doc.rect(0, 0, W, first ? 140 : 66).fill(green);
    doc.image(logo, left, first ? 22 : 12, { width: 140 });
    text(
      input.shop.name,
      W - 285,
      first ? 34 : 25,
      { width: 245, align: "right" },
      11,
      "#E4D7F5",
      true,
    );
    if (first) {
      text(
        input.role === "barber"
          ? "Seu financeiro, com clareza."
          : "Relatório financeiro",
        left,
        72,
        { width: 450 },
        25,
        "#F6F5E9",
        true,
      );
      text(
        `${labelDate(input.start)} a ${labelDate(addDays(input.end, -1))}  |  ${input.role === "barber" ? "Visão individual" : "Visão geral do salão"}`,
        left,
        111,
        { width: 480 },
        9,
        "#D8C9EA",
      );
      y = 163;
    } else {
      y = 88;
    }
  }
  function ensure(height: number) {
    if (y + height > H - 65) {
      doc.addPage();
      header();
      return true;
    }
    return false;
  }
  function section(title: string, subtitle?: string) {
    // Reserve espaço para o título, cabeçalho e a primeira linha da seção.
    ensure(165);
    text(title, left, y, {}, 15, ink, true);
    y += 23;
    if (subtitle) {
      text(subtitle, left, y, {}, 8, muted);
      y += doc.heightOfString(subtitle, { width }) + 12;
    }
  }
  function table(
    headers: string[],
    sizes: number[],
    rows: string[][],
    right: number[] = [],
  ) {
    const heading = () => {
      const top = y;
      const height = 30;
      doc.rect(left, top, width, height).fill("#F3EEFF");
      let x = left;
      headers.forEach((cell, i) => {
        text(
          cell,
          x + 6,
          top + 8,
          { width: sizes[i] - 12, align: right.includes(i) ? "right" : "left" },
          7,
          green,
          true,
        );
        x += sizes[i];
      });
      y += height;
    };
    doc.font("Helvetica").fontSize(8);
    const firstHeight = rows[0]
      ? Math.max(
          30,
          ...rows[0].map(
            (cell, i) =>
              doc.heightOfString(cell, { width: sizes[i] - 12 }) + 14,
          ),
        )
      : 0;
    ensure(30 + firstHeight + 30);
    heading();
    rows.forEach((row, index) => {
      doc.font("Helvetica").fontSize(8);
      const height = Math.max(
        30,
        ...row.map(
          (cell, i) => doc.heightOfString(cell, { width: sizes[i] - 12 }) + 14,
        ),
      );
      if (ensure(height + 30)) heading();
      if (index % 2 === 0) doc.rect(left, y, width, height).fill("#FAF9FC");
      let x = left;
      row.forEach((cell, i) => {
        text(
          cell,
          x + 6,
          y + 7,
          { width: sizes[i] - 12, align: right.includes(i) ? "right" : "left" },
          8,
          i === 0 ? ink : muted,
          i === 0,
        );
        x += sizes[i];
      });
      doc
        .moveTo(left, y + height)
        .lineTo(left + width, y + height)
        .strokeColor(line)
        .lineWidth(0.4)
        .stroke();
      y += height;
    });
    y += 22;
  }
  header(true);
  const r = input.report;
  const balance = input.balances.reduce((s, b) => s + b.available, 0);
  const cards =
    input.role === "barber"
      ? [
          ["Serviços recebidos", fmt(r.received)],
          ["Parte do profissional liberada no período", fmt(r.commissions)],
          ["Gorjetas liberadas", fmt(r.tipsReleased)],
          ["Saldo acumulado a receber", fmt(balance)],
          [
            "Repasses acumulados",
            fmt(input.balances.reduce((s, b) => s + b.paid, 0)),
          ],
          ["Lançamentos no período", String(input.payments.length)],
        ]
      : [
          ["Recebimentos líquidos", fmt(r.received + r.tips)],
          [
            "Parte dos profissionais e extras liberadas",
            fmt(r.commissions + r.tipsReleased),
          ],
          ["Despesas pagas", fmt(r.expenses)],
          ["Taxas de pagamento", fmt(r.fees)],
          ["Resultado operacional", fmt(r.result || 0)],
          ["Lançamentos no período", String(input.payments.length)],
        ];
  const gap = 9;
  const cw = (width - gap * 2) / 3;
  const top = y;
  cards.forEach(([label, value], i) => {
    const x = left + (i % 3) * (cw + gap),
      cy = top + Math.floor(i / 3) * 75;
    doc
      .roundedRect(x, cy, cw, 65, 6)
      .fillAndStroke(i === 4 ? "#F3EEFF" : "#FAF9FC", line);
    text(label, x + 11, cy + 12, { width: cw - 22 }, 7, muted);
    text(value, x + 11, cy + 31, { width: cw - 22 }, 17, ink, true);
  });
  y = top + 165;
  const explanation =
    input.role === "barber"
      ? "O período considera as datas dos recebimentos e estornos. Seu saldo acumulado considera participações dos profissionais liberadas, gorjetas, repasses e adiantamentos de todos os períodos."
      : "Resultado operacional = recebimentos líquidos (incluindo gorjetas) - participações dos profissionais e gorjetas liberadas - despesas pagas - taxas. Repasses e adiantamentos não são descontados novamente. Este indicador não substitui uma apuração contábil.";
  ensure(80);
  doc.font("Helvetica").fontSize(8);
  const noteHeight =
    doc.heightOfString(explanation, { width: width - 28 }) + 24;
  doc.roundedRect(left, y, width, noteHeight, 5).fill("#F4F0E5");
  doc.rect(left, y, 3, noteHeight).fill(gold);
  text(explanation, left + 14, y + 12, { width: width - 28 }, 8, "#7B7155");
  y += noteHeight + 25;
  section(
    "Divisão contratual dos serviços",
    "Saldos de serviços concluídos em todos os períodos. A parte do salão está antes de despesas e taxas.",
  );
  if (input.balances.length)
    table(
      [
        "Profissional",
        "Total dos serviços",
        "Parte do profissional",
        "Parte do salão",
      ],
      [200, 105, 105, width - 410],
      input.balances.map((b) => [
        b.professional_name,
        fmt(b.service_total),
        fmt(b.generated),
        fmt(b.shop_generated),
      ]),
      [1, 2, 3],
    );
  section(
    "Repasses e saldos por profissional",
    "Saldos acumulados de todos os períodos. Valores negativos indicam ajuste a compensar.",
  );
  if (input.balances.length)
    table(
      [
        "Profissional",
        "Gerada",
        "Liberada",
        "Gorjetas",
        "Repasses",
        "Adiant.",
        "Saldo",
      ],
      [125, 65, 65, 55, 65, 60, width - 435],
      input.balances.map((b) => [
        b.professional_name,
        fmt(b.generated),
        fmt(b.released),
        fmt(b.tips),
        fmt(b.paid),
        fmt(b.advances),
        fmt(b.available),
      ]),
      [1, 2, 3, 4, 5, 6],
    );
  else {
    text("Nenhuma participação registrada.", left, y, {}, 9, muted);
    y += 30;
  }
  section(
    "Recebimentos e estornos",
    "Valores positivos representam recebimentos; negativos representam estornos.",
  );
  if (input.payments.length)
    table(
      [
        "Data / tipo",
        "Cliente / serviço / profissional",
        "Forma",
        "Serviço",
        "Gorjeta",
        "Taxa",
      ],
      [68, 190, 56, 67, 67, width - 448],
      input.payments.map((p) => {
        const sign = p.kind === "refund" ? -1 : 1;
        return [
          date(p.created_at) +
            "\n" +
            (p.kind === "refund" ? "Estorno" : "Recebimento"),
          `${p.customer}\n${p.service_name || "Serviço"}\n${p.professional_name}`,
          p.method,
          fmt(sign * p.service_amount),
          fmt(sign * p.tip),
          fmt(sign * p.fee),
        ];
      }),
      [3, 4, 5],
    );
  else {
    text("Nenhum lançamento no período selecionado.", left, y, {}, 9, muted);
    y += 30;
  }
  if (input.role === "owner") {
    section("Despesas pagas", "Movimentos registrados no período selecionado.");
    if (input.expenses.length)
      table(
        ["Data", "Descrição", "Forma", "Valor"],
        [75, 270, 75, width - 420],
        input.expenses.map((e) => [
          date(e.paid_at),
          e.description,
          e.method,
          fmt(e.amount),
        ]),
        [3],
      );
    else {
      text("Nenhuma despesa paga no período.", left, y, {}, 9, muted);
      y += 30;
    }
  }
  section(
    "Repasses realizados",
    "Liquidações registradas no período, sem nova dedução no resultado operacional.",
  );
  if (input.payouts.length)
    table(
      ["Data", "Profissional", "Forma", "Valor"],
      [75, 270, 75, width - 420],
      input.payouts.map((p) => [
        date(p.created_at),
        p.professional_name,
        p.method,
        fmt(p.amount),
      ]),
      [3],
    );
  else {
    text("Nenhum repasse registrado no período.", left, y, {}, 9, muted);
    y += 30;
  }
  section("Como ler este relatório");
  const guidance =
    "A participação do profissional é gerada quando o atendimento é concluído e liberada proporcionalmente ao valor recebido pelo serviço. Gorjetas pertencem ao profissional. Um estorno após um repasse preserva o pagamento anterior e ajusta o saldo a compensar. O registro de um recebimento ou repasse não realiza uma transferência bancária automaticamente.";
  ensure(90);
  text(guidance, left, y, { width }, 9, muted);
  y += doc.heightOfString(guidance, { width }) + 18;
  if (input.shop.address) {
    ensure(35);
    text(input.shop.address, left, y, {}, 8, muted);
  }
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc
      .moveTo(left, H - 43)
      .lineTo(W - left, H - 43)
      .lineWidth(0.4)
      .strokeColor(line)
      .stroke();
    text(
      `Elares Beauty | Gerado por ${input.generatedBy}`,
      left,
      H - 32,
      { width: 330, lineBreak: false },
      7,
      muted,
    );
    text(
      `${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}  |  Página ${i + 1} de ${pages.count}`,
      W - 220,
      H - 32,
      { width: 180, align: "right", lineBreak: false },
      7,
      muted,
    );
  }
  doc.end();
  return completed;
}
