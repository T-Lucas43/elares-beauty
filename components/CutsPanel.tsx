"use client";
import { useEffect, useState } from "react";
import {
  Scissors,
  CalendarDays,
  ArrowRight,
  Clock,
  Plus,
  CheckCheck,
  Wallet,
  Send,
} from "lucide-react";
import type { Data, Appointment } from "./types";
import { money, time, localDay } from "@/lib/domain";
import { updateManualReminder } from "@/lib/client-reminders";
type Cut = Appointment & { completed_at?: string };
export default function CutsPanel({
  data,
  onSelect,
  onWalkIn,
  onBooking,
  onReminders,
}: {
  data: Data;
  onSelect: (a: Appointment) => void;
  onWalkIn: () => void;
  onBooking: () => void;
  onReminders: () => void;
}) {
  const [professional, setProfessional] = useState(
    data.professionalId ||
      data.professionals.find((p) => p.active !== false)?.id ||
      "",
  );
  const [cuts, setCuts] = useState<Cut[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now()),
    [requesting, setRequesting] = useState(false),
    [requested, setRequested] = useState<string[]>([]),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    async function load() {
      if (!professional) {
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(
          "/api/cuts?professionalId=" + encodeURIComponent(professional),
          { signal: controller.signal },
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!disposed) {
          setCuts(d.appointments);
          setNow(Date.now());
          setError("");
        }
      } catch (e) {
        if (!disposed && (e as Error).name !== "AbortError")
          setError((e as Error).message);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    setLoading(true);
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [professional, data.appointments]);
  const current = cuts.find((a) => a.status === "in_progress");
  const upcoming = cuts.filter((a) =>
    ["scheduled", "confirmed"].includes(a.status),
  );
  const today = localDay();
  const done = cuts.filter(
    (a) =>
      a.status === "completed" &&
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date(a.completed_at || a.ends_at)) === today,
  );
  const future = upcoming.filter((a) => +new Date(a.starts_at) > now);
  const overdue = upcoming.filter((a) => +new Date(a.starts_at) <= now);
  const next = future[0];
  async function requestReminder(a: Cut) {
    setRequesting(true);
    setError("");
    try {
      await updateManualReminder("request", a.id, a.schedule_version || 0);
      setRequested((ids) => [...ids, a.id]);
      setNotice(
        "A recepção foi avisada para enviar pelo WhatsApp do salão.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRequesting(false);
    }
  }
  const card = (a: Cut, label: string) => (
    <div
      className={
        "cut-focus-card " + (a.status === "in_progress" ? "current" : "next")
      }
    >
      <span className="eyebrow">{label}</span>
      <h2>{a.customer}</h2>
      <p>
        {a.service_name}
        {a.source === "walk_in" && (
          <small className="walk-in-badge">Avulso</small>
        )}
      </p>
      <div className="cut-time">
        <Clock size={17} />
        {new Date(a.starts_at).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "2-digit",
        })}{" "}
        · {time(a.starts_at)}–{time(a.ends_at)}
      </div>
      {a.status !== "in_progress" && (
        <span className="cut-countdown">
          <Clock size={14} />
          {Math.ceil((+new Date(a.starts_at) - now) / 60000) <= 60
            ? `Começa em ${Math.max(1, Math.ceil((+new Date(a.starts_at) - now) / 60000))} min`
            : "Próximo na sua agenda"}
        </span>
      )}
      <div className="cut-focus-actions">
        <button
          className={a.status === "in_progress" ? "primary" : "secondary"}
          onClick={() => onSelect(a)}
        >
          {a.status === "in_progress"
            ? "Finalizar corte"
            : "Ver ou iniciar corte"}
          <ArrowRight size={16} />
        </button>
        {a.status !== "in_progress" &&
          (data.role === "barber" &&
          a.consent &&
          +new Date(a.starts_at) - now <= 7 * 86400000 ? (
            <button
              className="secondary"
              disabled={requesting || requested.includes(a.id) || data.readOnly}
              onClick={() => void requestReminder(a)}
            >
              <Send size={15} />
              {requested.includes(a.id)
                ? "Recepção avisada"
                : "Solicitar lembrete"}
            </button>
          ) : (
            <button className="text-button" onClick={onReminders}>
              Ver lembretes
            </button>
          ))}
      </div>
    </div>
  );
  return (
    <div className="cuts-module">
      <div className="cuts-toolbar">
        <div className="barber-day-heading">
          <span>
            Hoje ·{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              timeZone: "America/Sao_Paulo",
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date(today + "T12:00:00-03:00"))}
          </span>
        </div>
        <div className="page-actions">
          <button
            className="secondary"
            onClick={onBooking}
            disabled={data.readOnly}
          >
            <CalendarDays size={17} />
            Agendar
          </button>
          <button
            className="primary"
            onClick={onWalkIn}
            disabled={data.readOnly}
          >
            <Plus size={17} />
            Registrar atendimento avulso
          </button>
        </div>
      </div>
      <div className="barber-summary">
        <div>
          <CheckCheck size={21} />
          <span>
            <strong>{done.length}</strong>
            <small>Cortes concluídos hoje</small>
          </span>
        </div>
        <div>
          <CalendarDays size={21} />
          <span>
            <strong>
              {
                future.filter(
                  (a) =>
                    new Intl.DateTimeFormat("en-CA", {
                      timeZone: "America/Sao_Paulo",
                    }).format(new Date(a.starts_at)) === today,
                ).length
              }
            </strong>
            <small>Próximos de hoje</small>
          </span>
        </div>
        <div>
          <Wallet size={21} />
          <span>
            <strong>
              {money(done.reduce((sum, a) => sum + a.commission, 0))}
            </strong>
            <small>Sua parte nos cortes de hoje</small>
          </span>
        </div>
      </div>
      {notice && (
        <p className="success-note" role="status">
          {notice}
        </p>
      )}
      {data.role === "owner" && (
        <label className="field cuts-professional">
          Profissional
          <select
            value={professional}
            onChange={(e) => setProfessional(e.target.value)}
          >
            {data.professionals
              .filter((p) => p.active !== false)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="empty">Carregando seus atendimentos…</p>
      ) : (
        <>
          <div
            className={"cut-focus-grid" + (!(current && next) ? " single" : "")}
          >
            {current && card(current, "EM ATENDIMENTO")}
            {next && card(next, "PRÓXIMO CORTE")}
            {!current && !next && (
              <div className="cut-focus-card quiet">
                <CalendarDays size={27} />
                <h2>Sua cadeira está livre.</h2>
                <p>
                  Agende um cliente ou registre um atendimento avulso já realizado.
                </p>
              </div>
            )}
          </div>
          {!current && (
            <p className="barber-status-note">
              <Scissors size={15} />
              Nenhum corte em andamento. Sua cadeira está pronta para o próximo
              cliente.
            </p>
          )}
          <section className="panel">
            <div className="panel-heading">
              <h2>Próximos agendamentos</h2>
              <span className="pill">{future.length}</span>
            </div>
            {future.slice(0, 12).map((a) => (
              <button
                className="cut-list-row"
                key={a.id}
                onClick={() => onSelect(a)}
              >
                <span className="cut-list-time">
                  {time(a.starts_at)}
                  <small>
                    {new Date(a.starts_at).toLocaleDateString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </small>
                </span>
                <span>
                  <strong>{a.customer}</strong>
                  <small>{a.service_name}</small>
                </span>
                <span className={"status " + a.status}>
                  {a.status === "confirmed" ? "Confirmado" : "Agendado"}
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
            {!future.length && (
              <p className="empty">Nenhum agendamento nos próximos 30 dias.</p>
            )}
            {!!overdue.length && (
              <details className="barber-overdue">
                <summary>
                  {overdue.length} horário(s) de hoje ainda sem atualização
                </summary>
                {overdue.map((a) => (
                  <button
                    className="cut-list-row overdue"
                    key={a.id}
                    onClick={() => onSelect(a)}
                  >
                    <span className="cut-list-time">{time(a.starts_at)}</span>
                    <span>
                      <strong>{a.customer}</strong>
                      <small>{a.service_name}</small>
                    </span>
                    <span className="pill">Verificar situação</span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </details>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Cortes concluídos hoje</h2>
              <span className="pill">{done.length}</span>
            </div>
            {done.map((a) => (
              <button
                key={a.id}
                className="cut-list-row"
                onClick={() => onSelect(a)}
              >
                <Scissors size={18} />
                <span>
                  <strong>{a.customer}</strong>
                  <small>
                    {a.service_name}
                    {a.source === "walk_in" ? " · Avulso" : ""}
                  </small>
                </span>
                <b>{money(a.price)}</b>
                <span className="pill">
                  {a.paid >= a.price ? "Recebido" : "Pendente"}
                </span>
              </button>
            ))}
            {!done.length && (
              <p className="empty">
                Os seus atendimentos concluídos e avulsos aparecerão aqui.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
