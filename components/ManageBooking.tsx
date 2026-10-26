"use client";
import { useEffect, useState } from "react";
import { Scissors, CalendarDays, Check, ArrowLeft } from "lucide-react";
import { money, time, localDay } from "@/lib/domain";
import Brand from "./Brand";
type Reservation = {
  id: string;
  customer: string;
  professional_name: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  price: number;
  paid: number;
  status: string;
  shop_name: string;
  slug: string;
  address: string;
  cancellation_minutes: number;
};
export default function ManageBooking({ id }: { id: string }) {
  const [token, setToken] = useState("");
  const [a, setA] = useState<Reservation>();
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("");
  const [slots, setSlots] = useState<{ hour: string }[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setToken(location.hash.slice(1));
  }, []);
  async function call(action: string, dateArg?: string, hourArg?: string) {
    const r = await fetch("/api/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, token, action, date: dateArg, hour: hourArg }),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  useEffect(() => {
    if (!token) return;
    let active = true;
    setError("");
    call("get", date || undefined)
      .then((d) => {
        if (active) {
          setA(d.appointment);
          setSlots(d.slots);
          setHour("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token, date, id]);
  async function act(action: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await call(action, date || undefined, hour || undefined);
      const d = await call("get");
      setA(d.appointment);
      setDate("");
      setHour("");
      setNotice(
        action === "cancel"
          ? "Reserva cancelada. Se houve pagamento antecipado, fale com a recepção sobre o estorno."
          : "Agendamento atualizado com sucesso.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const editable = a && ["scheduled", "confirmed"].includes(a.status);
  const labels: Record<string, string> = {
    scheduled: "Agendado",
    confirmed: "Confirmado",
    in_progress: "Em atendimento",
    completed: "Concluído",
    cancelled: "Cancelado",
    no_show: "Não compareceu",
  };
  return (
    <main className="manage-page">
      <header className="booking-header">
        <a href="/" className="brand">
          <Brand />
        </a>
        <span className="pill">Minha reserva</span>
      </header>
      <section className="panel manage-card">
        <span className="eyebrow">SEU ATENDIMENTO</span>
        <h1>{a?.shop_name || "Gerenciar agendamento"}</h1>
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
        {!token && !error && (
          <p className="form-note">
            Abra o link completo recebido ao confirmar seu agendamento. O código
            após # faz parte do acesso pessoal.
          </p>
        )}
        {!a && token && !error && (
          <p className="empty">Carregando sua reserva…</p>
        )}
        {a && (
          <>
            <span className={`status ${a.status}`}>{labels[a.status]}</span>
            <h2>{a.service_name}</h2>
            <p className="muted">
              Olá, {a.customer}. Seu profissional é {a.professional_name}.
            </p>
            <div className="booking-summary">
              <CalendarDays />
              <div>
                <strong>
                  {new Date(a.starts_at).toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}{" "}
                  às {time(a.starts_at)}
                </strong>
                <p>
                  {money(a.price)} · já recebido: {money(a.paid)}
                </p>
              </div>
            </div>
            {a.address && <p className="form-note">{a.address}</p>}
            {editable && (
              <>
                <h3>Escolher outro horário</h3>
                <p className="form-note">
                  Você pode reagendar com o mesmo profissional ou cancelar com{" "}
                  {a.cancellation_minutes} minutos de antecedência.
                </p>
                <label className="field">
                  Nova data
                  <input
                    type="date"
                    min={localDay()}
                    value={date}
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
                {date && !slots.length && (
                  <p className="form-note">
                    Nenhum horário disponível nesta data.
                  </p>
                )}
                <div className="detail-actions">
                  <button
                    className="primary"
                    disabled={busy || !date || !hour}
                    onClick={() => act("reschedule")}
                  >
                    Confirmar novo horário
                  </button>
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Deseja cancelar esta reserva?"))
                        void act("cancel");
                    }}
                  >
                    Cancelar reserva
                  </button>
                </div>
              </>
            )}
            <a className="inline-link" href={"/agendar/" + a.slug}>
              <ArrowLeft size={16} />
              Página do salão
            </a>
          </>
        )}
      </section>
    </main>
  );
}
