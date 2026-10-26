"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, Wallet, Check, Receipt } from "lucide-react";
import { money, localDay } from "@/lib/domain";
import { addDays } from "@/lib/calendar";
import type { Data, Professional } from "./types";
type Payment = {
  id: string;
  appointment_id: string;
  kind: string;
  customer: string;
  professional_name: string;
  service_name: string;
  service_amount: number;
  tip: number;
  fee: number;
  method: string;
  created_at: string;
  reason: string;
};
type Cash = {
  id: string;
  opening: number;
  opened_at: string;
  closed_at: string | null;
  expected_balance: number;
  expected: number;
  counted: number;
  difference: number;
  note: string;
};
type Finance = {
  role: string;
  report: Data["finance"];
  balances: Data["totals"];
  payments: Payment[];
  cash: Cash | null;
  cashHistory: Cash[];
  advances: {
    id: string;
    professional_name: string;
    amount: number;
    reason: string;
    created_at: string;
  }[];
};
export default function FinancePanel({
  professionals,
  role,
  onChanged,
  onAppointment,
  readOnly = false,
}: {
  professionals: Professional[];
  role: string;
  readOnly?: boolean;
  onChanged: () => Promise<void>;
  onAppointment: (id: string) => void;
}) {
  const [start, setStart] = useState(localDay().slice(0, 8) + "01");
  const [end, setEnd] = useState(localDay());
  const [data, setData] = useState<Finance>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState("expense");
  const [nonce, setNonce] = useState(0);
  const load = useCallback(async () => {
    const r = await fetch(`/api/finance?start=${start}&end=${addDays(end, 1)}`);
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setData(d);
  }, [start, end]);
  useEffect(() => {
    if (!start || !end) return;
    load().catch((e) => setError(e.message));
  }, [load, start, end]);
  async function save(body: object) {
    if (readOnly) {
      setError("A demonstração é somente para consulta.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, idempotencyKey: crypto.randomUUID() }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
      await onChanged();
      setNonce((n) => n + 1);
      setNotice("Lançamento registrado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const cents = (f: FormData, key: string) =>
    Math.round(Number(f.get(key)) * 100);
  const owner = role === "owner";
  const report = data?.report;
  return (
    <div className="finance-workspace">
      <section className="panel period-panel">
        <div>
          <h2>
            {role === "receptionist"
              ? "Caixa e recebimentos"
              : "Financeiro por período"}
          </h2>
          <p className="muted">
            Movimentos de caixa e banco nas datas selecionadas. O saldo de
            comissão abaixo é acumulado.
          </p>
        </div>
        <div className="period-fields">
          <label className="field">
            De
            <input
              type="date"
              value={start}
              onInput={(e) => setStart(e.currentTarget.value)}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field">
            Até (inclusive)
            <input
              type="date"
              value={end}
              onInput={(e) => setEnd(e.currentTarget.value)}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {role !== "receptionist" && (
            <a
              className="primary"
              href={`/api/finance?start=${start}&end=${end ? addDays(end, 1) : end}&export=pdf`}
            >
              <Download size={16} />
              Exportar PDF
            </a>
          )}
          {role !== "receptionist" && (
            <a
              className="secondary"
              href={`/api/finance?start=${start}&end=${end ? addDays(end, 1) : end}&export=csv`}
            >
              <Download size={16} />
              Exportar CSV
            </a>
          )}
        </div>
        <div className="chips">
          <button
            onClick={() => {
              setStart(localDay());
              setEnd(localDay());
            }}
          >
            Hoje
          </button>
          <button
            onClick={() => {
              setStart(localDay().slice(0, 8) + "01");
              setEnd(localDay());
            }}
          >
            Este mês
          </button>
          <button
            onClick={() => {
              setStart(addDays(localDay(), -29));
              setEnd(localDay());
            }}
          >
            Últimos 30 dias
          </button>
        </div>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success-note" role="status">
          <Check size={16} />
          {notice}
        </p>
      )}
      {report && (
        <div className="stats">
          <section className="stat-card">
            <div>
              Recebimentos líquidos
              <Wallet size={18} />
            </div>
            <strong>{money(report.received + report.tips)}</strong>
            <small>Inclui gorjetas e desconta estornos</small>
          </section>
          <section className="stat-card">
            <div>
              Parte dos profissionais e extras
              <Receipt size={18} />
            </div>
            <strong>{money(report.commissions + report.tipsReleased)}</strong>
            <small>Liberadas no período pelo valor recebido</small>
          </section>
          <section className="stat-card">
            <div>{owner ? "Despesas e taxas" : "Gorjetas liberadas"}</div>
            <strong>
              {money(
                owner ? report.expenses + report.fees : report.tipsReleased,
              )}
            </strong>
            <small>
              {owner
                ? "Despesas pagas e taxas de cartão"
                : "Pertencem integralmente ao profissional"}
            </small>
          </section>
          <section className="stat-card accent">
            <div>{owner ? "Resultado operacional" : "Meu saldo acumulado"}</div>
            <strong>
              {money(
                owner
                  ? report.result || 0
                  : data?.balances.reduce((s, b) => s + b.available, 0) || 0,
              )}
            </strong>
            <small>
              {owner
                ? "Recebido − comissões − despesas − taxas"
                : "Considera repasses e adiantamentos"}
            </small>
          </section>
        </div>
      )}
      {report && owner && (
        <section className="panel split-period">
          <div>
            <span>Parte dos profissionais liberada no período</span>
            <strong>{money(report.commissions)}</strong>
          </div>
          <div>
            <span>Parte do salão no período, antes de despesas</span>
            <strong>{money(report.shopShare)}</strong>
          </div>
          <small>
            Divisão contratual dos serviços concluídos e recebidos. Gorjetas são
            extras separados. Descontos reduzem a base; taxas e despesas são
            apuradas à parte.
          </small>
        </section>
      )}
      {data && role !== "receptionist" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Divisão dos serviços por profissional</h2>
              <p>
                Acumulado de todos os períodos. Estornos após repasse podem
                gerar saldo a compensar.
              </p>
            </div>
          </div>
          <div className="professional-grid">
            {data.balances.map((b) => (
              <article className="professional-card" key={b.professional_id}>
                <h3>
                  {professionals.find((p) => p.id === b.professional_id)?.name}
                </h3>
                <dl>
                  <div>
                    <dt>Parte do profissional gerada</dt>
                    <dd>{money(b.generated)}</dd>
                  </div>
                  <div>
                    <dt>Parte do profissional liberada</dt>
                    <dd>{money(b.released)}</dd>
                  </div>
                  <div>
                    <dt>Gorjetas liberadas</dt>
                    <dd>{money(b.tips)}</dd>
                  </div>
                  <div>
                    <dt>Repasses</dt>
                    <dd>{money(b.paid)}</dd>
                  </div>
                  <div>
                    <dt>Adiantamentos</dt>
                    <dd>{money(b.advances)}</dd>
                  </div>
                  <div className="balance">
                    <dt>
                      {b.available < 0
                        ? "Ajuste a compensar"
                        : "Disponível para repasse"}
                    </dt>
                    <dd className={b.available < 0 ? "negative" : ""}>
                      {money(b.available)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="finance-grid">
        {owner && (
          <section className="panel finance-form">
            <h2>Novo lançamento</h2>
            <label className="field">
              Tipo
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="expense">Despesa paga</option>
                <option value="payout">Repasse ao profissional</option>
                <option value="advance">Adiantamento ao profissional</option>
              </select>
            </label>
            <form
              key={action + nonce}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save({
                  action,
                  amount: cents(f, "amount"),
                  method: f.get("method"),
                  ...(action === "expense"
                    ? { description: f.get("description") }
                    : {
                        professionalId: f.get("professionalId"),
                        reason: f.get("reason") || "Adiantamento",
                      }),
                });
              }}
            >
              {action === "expense" ? (
                <label className="field">
                  Descrição
                  <input name="description" minLength={2} required />
                </label>
              ) : (
                <label className="field">
                  Profissional
                  <select name="professionalId">
                    {professionals.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="form-grid">
                <label className="field">
                  Valor (R$)
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>
                <label className="field">
                  Forma
                  <select name="method">
                    <option>Pix</option>
                    <option>Dinheiro</option>
                    <option>Cartão</option>
                  </select>
                </label>
              </div>
              {action === "advance" && (
                <label className="field">
                  Motivo
                  <input name="reason" required />
                </label>
              )}
              <p className="form-note">
                O registro não transfere dinheiro automaticamente. Repasses são
                limitados ao saldo disponível.
              </p>
              <button className="primary" disabled={readOnly || busy}>
                Registrar lançamento
              </button>
            </form>
          </section>
        )}
        {role !== "barber" && (
          <section className="panel finance-form">
            <h2>Caixa físico</h2>
            <p className="form-note">
              Somente dinheiro entra no saldo da gaveta. Pix e cartão ficam no
              resumo financeiro.
            </p>
            {data?.cash ? (
              <>
                <div className="cash-balance">
                  <span>Saldo esperado na gaveta</span>
                  <strong>{money(data.cash.expected_balance)}</strong>
                  <small>
                    Aberto em{" "}
                    {new Date(data.cash.opened_at).toLocaleString("pt-BR")} com{" "}
                    {money(data.cash.opening)}
                  </small>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (confirm("Fechar este caixa e registrar a contagem?"))
                      void save({
                        action: "cash_close",
                        amount: cents(f, "counted"),
                        note: f.get("note"),
                      });
                  }}
                >
                  <label className="field">
                    Valor contado (R$)
                    <input
                      name="counted"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                    />
                  </label>
                  <label className="field">
                    Justificativa (obrigatória se houver diferença)
                    <input name="note" />
                  </label>
                  <button className="primary" disabled={readOnly || busy}>
                    Fechar caixa
                  </button>
                </form>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save({
                    action: "cash_open",
                    amount: cents(new FormData(e.currentTarget), "opening"),
                  });
                }}
              >
                <p className="empty">Nenhum caixa aberto.</p>
                <label className="field">
                  Saldo inicial em dinheiro (R$)
                  <input
                    name="opening"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                    required
                  />
                </label>
                <button className="primary" disabled={readOnly || busy}>
                  Abrir caixa
                </button>
              </form>
            )}
          </section>
        )}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recebimentos e estornos</h2>
            <p>
              Selecione um lançamento para abrir o atendimento. O proprietário
              pode registrar estornos nos detalhes.
            </p>
          </div>
        </div>
        {data?.payments.map((p) => (
          <button
            className="ledger-row ledger-button"
            key={p.id}
            onClick={() => onAppointment(p.appointment_id)}
          >
            <span className="ledger-icon">
              <Receipt size={18} />
            </span>
            <span>
              <strong>
                {p.customer} · {p.service_name}
              </strong>
              <small>
                {p.professional_name} · {p.method} ·{" "}
                {new Date(p.created_at).toLocaleString("pt-BR")}
              </small>
              <small>
                Serviço {money(p.service_amount)} · gorjeta {money(p.tip)} ·
                taxa {money(p.fee)}
                {p.reason ? " · " + p.reason : ""}
              </small>
            </span>
            <b className={p.kind === "refund" ? "negative" : ""}>
              {p.kind === "refund" ? "− " : ""}
              {money(p.service_amount + p.tip)}
            </b>
          </button>
        ))}
        {!data?.payments.length && (
          <p className="empty">Nenhum lançamento no período.</p>
        )}
      </section>
      {data && role !== "barber" && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Histórico de fechamento de caixa</h2>
          </div>
          {data.cashHistory
            .filter((c) => c.closed_at)
            .map((c) => (
              <div className="ledger-row" key={c.id}>
                <span>
                  <strong>
                    {new Date(c.closed_at!).toLocaleString("pt-BR")}
                  </strong>
                  <small>
                    Esperado {money(c.expected)} · contado {money(c.counted)} ·
                    diferença {money(c.difference)}
                    {c.note ? " · " + c.note : ""}
                  </small>
                </span>
              </div>
            ))}
          {!data.cashHistory.some((c) => c.closed_at) && (
            <p className="empty">Nenhum fechamento registrado.</p>
          )}
        </section>
      )}
      {data && role !== "receptionist" && data.advances.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Adiantamentos</h2>
          </div>
          {data.advances.map((a) => (
            <div className="ledger-row" key={a.id}>
              <span>
                {a.professional_name}
                <small>
                  {a.reason} ·{" "}
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </small>
              </span>
              <strong>{money(a.amount)}</strong>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
