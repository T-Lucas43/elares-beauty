"use client";
import { useEffect, useState } from "react";
import { Check, Clock, CalendarDays } from "lucide-react";
import { money, time, localDay } from "@/lib/domain";
import type { Appointment } from "./types";
type Payment = {
  id: string;
  kind: string;
  service_amount: number;
  tip: number;
  fee: number;
  method: string;
  original_id: string | null;
  created_at: string;
  reason: string;
};
type Detail = Appointment & {
  service_id: string;
  list_price: number;
  discount: number;
};
const labels: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};
export default function AppointmentPanel({
  id,
  role,
  onChanged,
  readOnly = false,
}: {
  id: string;
  role: string;
  onChanged: () => Promise<void>;
  readOnly?: boolean;
}) {
  const [a, setA] = useState<Detail>();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("");
  const [slots, setSlots] = useState<{ hour: string }[]>([]);
  async function load(dateArg = "") {
    const r = await fetch(
      `/api/appointments/${id}${dateArg ? "?date=" + dateArg : ""}`,
    );
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setA(d.appointment);
    setPayments(d.payments);
    setSlots(d.slots || []);
  }
  useEffect(() => {
    load(date).catch((e) => setError(e.message));
    setHour("");
  }, [id, date]);
  async function execute(body: object) {
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
      await load(date);
      await onChanged();
      setNotice("Operação registrada com sucesso.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const cents = (f: FormData, n: string) =>
    Math.round(Number(f.get(n) || 0) * 100);
  const open = a && !["completed", "cancelled", "no_show"].includes(a.status);
  const canReceive = a && !["cancelled", "no_show"].includes(a.status);
  return (
    <div className="appointment-detail">
      <span className="eyebrow">
        {a?.source === "walk_in" ? "CORTE AVULSO" : "ATENDIMENTO"}
      </span>
      <h2>{a?.customer || "Carregando…"}</h2>
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
      {a && (
        <>
          <span className={`status ${a.status}`}>{labels[a.status]}</span>
          <dl className="detail-list">
            <div>
              <dt>Serviço</dt>
              <dd>{a.service_name}</dd>
            </div>
            <div>
              <dt>Profissional</dt>
              <dd>{a.professional_name}</dd>
            </div>
            <div>
              <dt>Data e horário</dt>
              <dd>
                {new Date(a.starts_at).toLocaleDateString("pt-BR")} ·{" "}
                {time(a.starts_at)}–{time(a.ends_at)}
              </dd>
            </div>
            <div>
              <dt>Valor original</dt>
              <dd>{money(a.list_price)}</dd>
            </div>
            <div>
              <dt>Desconto</dt>
              <dd>{money(a.discount)}</dd>
            </div>
            <div>
              <dt>Total do serviço</dt>
              <dd>{money(a.price)}</dd>
            </div>
            <div>
              <dt>Já recebido</dt>
              <dd>{money(a.paid)}</dd>
            </div>
            <div>
              <dt>Saldo pendente</dt>
              <dd>{money(a.price - a.paid)}</dd>
            </div>
            {role !== "receptionist" && (
              <div>
                <dt>Parte do profissional neste serviço</dt>
                <dd>{money(a.commission)}</dd>
              </div>
            )}
            {role !== "receptionist" && (
              <div>
                <dt>Parte do salão (antes de despesas)</dt>
                <dd>{money(a.price - a.commission)}</dd>
              </div>
            )}
            <div>
              <dt>WhatsApp</dt>
              <dd>{a.phone}</dd>
            </div>
          </dl>
          {open && (
            <div className="detail-status-actions">
              {a.status === "scheduled" && (
                <button
                  className="secondary"
                  disabled={readOnly || busy}
                  onClick={() =>
                    execute({ action: "status", id, status: "confirmed" })
                  }
                >
                  Confirmar presença
                </button>
              )}
              {a.status !== "in_progress" && (
                <button
                  className="secondary"
                  disabled={readOnly || busy}
                  onClick={() =>
                    execute({ action: "status", id, status: "in_progress" })
                  }
                >
                  <Clock size={16} />
                  Iniciar atendimento
                </button>
              )}
              <button
                className="primary"
                disabled={readOnly || busy}
                onClick={() =>
                  execute({
                    action: "status",
                    id,
                    status: "completed",
                    collect: false,
                  })
                }
              >
                <Check size={16} />
                Concluir atendimento
              </button>
              <p className="form-note">
                A conclusão não cobra o cliente automaticamente. Registre os
                pagamentos abaixo; a parte do profissional fica disponível
                proporcionalmente ao recebido.
              </p>
            </div>
          )}
          {canReceive && (
            <form
              key={"payment" + a.paid + payments.length}
              className="detail-section"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void execute({
                  action: "receive",
                  id,
                  amount: cents(f, "amount"),
                  tip: cents(f, "tip"),
                  fee: cents(f, "fee"),
                  method: f.get("method"),
                });
              }}
            >
              <h3>Registrar pagamento</h3>
              <p className="form-note">
                Para dividir o pagamento, registre cada parte e sua forma. Não
                há transferência ou cobrança online.
              </p>
              <div className="form-grid">
                <label className="field">
                  Valor do serviço (R$)
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    max={(a.price - a.paid) / 100}
                    step="0.01"
                    required
                    defaultValue={(a.price - a.paid) / 100}
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
                <label className="field">
                  Gorjeta (R$)
                  <input
                    name="tip"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                  />
                </label>
                <label className="field">
                  Taxa de cartão (R$)
                  <input
                    name="fee"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                  />
                </label>
              </div>
              <button className="primary" disabled={readOnly || busy}>
                Salvar recebimento
              </button>
            </form>
          )}
          {open && role !== "barber" && (
            <form
              className="detail-section"
              onSubmit={(e) => {
                e.preventDefault();
                void execute({
                  action: "discount",
                  id,
                  amount: cents(new FormData(e.currentTarget), "discount"),
                });
              }}
            >
              <h3>Desconto no serviço</h3>
              <label className="field">
                Desconto total (R$)
                <input
                  name="discount"
                  type="number"
                  min="0"
                  max={a.list_price / 100}
                  step="0.01"
                  defaultValue={a.discount / 100}
                />
              </label>
              <button className="secondary" disabled={readOnly || busy}>
                Aplicar desconto
              </button>
            </form>
          )}
          {["scheduled", "confirmed"].includes(a.status) && (
            <div className="detail-section">
              <h3>
                <CalendarDays size={16} />
                Reagendar
              </h3>
              <label className="field">
                Nova data
                <input
                  type="date"
                  value={date}
                  min={localDay()}
                  onInput={(e) => setDate(e.currentTarget.value)}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <div className="slots">
                {slots.map((s) => (
                  <button
                    key={s.hour}
                    className={hour === s.hour ? "selected" : ""}
                    onClick={() => setHour(s.hour)}
                  >
                    {s.hour}
                  </button>
                ))}
              </div>
              <button
                className="secondary"
                disabled={readOnly || busy || !date || !hour}
                onClick={() =>
                  execute({ action: "reschedule", id, date, hour })
                }
              >
                Salvar novo horário
              </button>
            </div>
          )}
          <div className="detail-section">
            <h3>Histórico de recebimentos</h3>
            {payments.map((p) => (
              <div className="detail-payment" key={p.id}>
                <strong>
                  {p.kind === "receipt" ? "Recebimento" : "Estorno"} ·{" "}
                  {money(p.service_amount + p.tip)}
                </strong>
                <small>
                  {p.method} · {new Date(p.created_at).toLocaleString("pt-BR")}
                </small>
                <small>
                  Serviço {money(p.service_amount)} · gorjeta {money(p.tip)} ·
                  taxa {money(p.fee)}
                </small>
                {p.reason && <small>{p.reason}</small>}
              </div>
            ))}
            {!payments.length && (
              <p className="form-note">Nenhum pagamento registrado.</p>
            )}
          </div>
          {role === "owner" && payments.some((p) => p.kind === "receipt") && (
            <form
              className="detail-section"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  confirm(
                    "Registrar este estorno? O histórico e os repasses já pagos serão preservados.",
                  )
                )
                  void execute({
                    action: "refund",
                    paymentId: f.get("paymentId"),
                    amount: cents(f, "amount"),
                    tip: cents(f, "tip"),
                    fee: cents(f, "fee"),
                    reason: f.get("reason"),
                  });
              }}
            >
              <h3>Registrar estorno</h3>
              <label className="field">
                Recebimento original
                <select name="paymentId">
                  {payments
                    .filter((p) => p.kind === "receipt")
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.method} · serviço {money(p.service_amount)} ·{" "}
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </option>
                    ))}
                </select>
              </label>
              <div className="form-grid">
                <label className="field">
                  Serviço a estornar (R$)
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                  />
                </label>
                <label className="field">
                  Gorjeta a estornar (R$)
                  <input
                    name="tip"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                  />
                </label>
                <label className="field">
                  Taxa devolvida pela operadora (R$)
                  <input
                    name="fee"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                  />
                </label>
              </div>
              <label className="field">
                Motivo
                <input name="reason" minLength={3} required />
              </label>
              <p className="form-note">
                O sistema registra o estorno; a devolução ao cliente deve ser
                feita pelo salão. Valores já repassados geram ajuste no
                saldo do profissional.
              </p>
              <button className="secondary danger" disabled={readOnly || busy}>
                Registrar estorno
              </button>
            </form>
          )}
          {open && (
            <div className="detail-actions">
              <button
                className="text-button danger"
                disabled={readOnly || busy || a.status === "in_progress"}
                onClick={() => {
                  if (
                    confirm(
                      "Cancelar este atendimento? Valores recebidos devem ser estornados separadamente.",
                    )
                  )
                    void execute({ action: "status", id, status: "cancelled" });
                }}
              >
                Cancelar atendimento
              </button>
              <button
                className="text-button"
                disabled={readOnly || busy}
                onClick={() =>
                  execute({ action: "status", id, status: "no_show" })
                }
              >
                Não compareceu
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
