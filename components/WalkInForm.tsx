"use client";
import { useEffect, useState, useRef } from "react";
import { Check } from "lucide-react";
import { money } from "@/lib/domain";
import type { Professional } from "./types";
type Quote = { id: string; name: string; price: number; duration: number };
export default function WalkInForm({
  professionals,
  professionalId,
  role,
  onDone,
  onBusyChange,
}: {
  professionals: Professional[];
  professionalId: string | null;
  role: string;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const active = professionals.filter((p) => p.active !== false);
  const [professional, setProfessional] = useState(
    professionalId || active[0]?.id || "",
  );
  const [quotes, setQuotes] = useState<Quote[]>([]),
    [service, setService] = useState(""),
    [price, setPrice] = useState("");
  const [received, setReceived] = useState(true),
    [method, setMethod] = useState("Pix");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const key = useRef(crypto.randomUUID());
  const selected = quotes.find((q) => q.id === service);
  useEffect(() => {
    if (!professional) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setQuotes([]);
    fetch("/api/walk-ins?professionalId=" + encodeURIComponent(professional), {
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        return d.services as Quote[];
      })
      .then((list) => {
        setQuotes(list);
        setService((old) =>
          list.some((q) => q.id === old) ? old : list[0]?.id || "",
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [professional, refresh]);
  useEffect(() => {
    if (selected) setPrice((selected.price / 100).toFixed(2));
  }, [selected]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const form = new FormData(event.currentTarget);
    const cents = (name: string) =>
      Math.round(Number(form.get(name) || 0) * 100);
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "walk_in",
          professionalId: professional,
          serviceId: service,
          customer: form.get("customer"),
          price:
            role === "barber" ? undefined : Math.round(Number(price) * 100),
          quotedPrice: selected.price,
          received,
          method,
          tip: received ? cents("tip") : 0,
          fee: received && method === "Cartão" ? cents("fee") : 0,
          idempotencyKey: key.current,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 409) setRefresh((v) => v + 1);
        throw Error(d.error || "Não foi possível registrar.");
      }
      onDone();
    } catch (e) {
      setError(
        (e as Error).message ||
          "Confira a agenda antes de tentar um novo registro.",
      );
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div className="walk-in-form">
      <span className="eyebrow">ATENDIMENTO SEM AGENDAMENTO</span>
      <h2>Registrar atendimento avulso</h2>
      <p className="muted">
        Para cortes já realizados. Se o cliente já estiver na agenda, finalize o
        atendimento por lá.
      </p>
      <form onSubmit={submit}>
        <label className="field">
          Profissional
          <select
            value={professional}
            onChange={(e) => setProfessional(e.target.value)}
            disabled={busy || role === "barber"}
            required
          >
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Serviço
          <select
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              setError("");
            }}
            disabled={busy || loading}
            required
          >
            {loading ? (
              <option value="">Carregando serviços…</option>
            ) : !quotes.length ? (
              <option value="">Nenhum serviço disponível</option>
            ) : (
              quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name} · {money(q.price)}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="field">
          Cliente <small>(opcional)</small>
          <input
            name="customer"
            maxLength={100}
            placeholder="Cliente avulso"
            disabled={busy}
          />
        </label>
        <label className="field">
          Valor do corte (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            readOnly={role === "barber"}
            disabled={busy || loading}
            required
          />
        </label>
        <label className="walk-in-paid">
          <input
            type="checkbox"
            checked={received}
            onChange={(e) => setReceived(e.target.checked)}
            disabled={busy}
          />
          <span>
            <strong>Pagamento recebido</strong>
            <small>
              {received
                ? "O valor entra no financeiro e na divisão do serviço."
                : "O atendimento fica anotado com valor pendente."}
            </small>
          </span>
        </label>
        {received && (
          <>
            <label className="field">
              Forma de pagamento
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={busy}
              >
                {["Pix", "Dinheiro", "Cartão"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            {method === "Dinheiro" && (
              <p className="walk-in-hint">
                O caixa deve estar aberto para receber em dinheiro.
              </p>
            )}
            <details className="walk-in-extras">
              <summary>Gorjeta e taxa (opcional)</summary>
              <label className="field">
                Gorjeta para o profissional (R$)
                <input
                  name="tip"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  disabled={busy}
                />
              </label>
              {method === "Cartão" && (
                <label className="field">
                  Taxa do cartão (R$)
                  <input
                    name="fee"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                    disabled={busy}
                  />
                </label>
              )}
            </details>
          </>
        )}
        <p className="walk-in-hint">
          O corte será registrado como concluído agora, sem reservar um horário.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary wide"
          disabled={busy || loading || !selected}
        >
          <Check size={17} />
          {busy ? "Registrando…" : "Registrar atendimento avulso"}
        </button>
      </form>
    </div>
  );
}
