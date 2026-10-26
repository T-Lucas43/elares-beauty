"use client";
import { useEffect, useState } from "react";
import {
  Bell,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  Send,
  CheckCheck,
  Inbox,
  Phone,
  RotateCcw,
} from "lucide-react";
import {
  reminderMessage,
  whatsappLink,
  type ManualReminder,
} from "@/lib/manual-whatsapp";
import { updateManualReminder } from "@/lib/client-reminders";
import type { Data } from "./types";
export default function ManualRemindersPanel({ data }: { data: Data }) {
  const [period, setPeriod] = useState("week"),
    [professional, setProfessional] = useState(""),
    [view, setView] = useState("pending");
  const [rows, setRows] = useState<ManualReminder[]>([]),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [confirmations, setConfirmations] = useState<Record<string, boolean>>({}),
    [shopPhone, setShopPhone] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0);
  const canSend = data.role !== "barber";
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    async function load() {
      try {
        const r = await fetch(
          "/api/reminders?period=" +
            period +
            "&professionalId=" +
            encodeURIComponent(professional),
          { signal: controller.signal },
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!disposed) {
          setRows(d.appointments);
          setShopPhone(d.shopPhone);
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
  }, [period, professional, refresh]);
  async function act(
    action: "request" | "opened" | "done" | "reopen",
    a: ManualReminder,
  ) {
    setBusy(a.id);
    setError("");
    try {
      await updateManualReminder(
        action,
        a.id,
        a.schedule_version,
        !!confirmations[a.id],
      );
      if (action === "done" || action === "reopen")
        setConfirmations((c) => ({ ...c, [a.id]: false }));
      setNotice(
        action === "request"
          ? "Solicitação enviada à central do salão."
          : action === "done"
            ? "Envio informado pela equipe. A entrega não é verificada pelo sistema."
            : action === "reopen"
              ? "Lembrete reaberto."
              : "Atalho registrado. O envio ainda depende de você no WhatsApp.",
      );
      setRefresh((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const eligible = rows.filter(
    (a) => a.consent && whatsappLink(a.phone, "Lembrete"),
  );
  const pending = eligible.filter((a) => a.reminder_state !== "done"),
    done = eligible.filter((a) => a.reminder_state === "done");
  const visible = view === "done" ? done : pending;
  const due = pending.filter((a) => a.due || a.requested_at).length;
  return (
    <section className="panel manual-reminders">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">UM NÚMERO. UMA CENTRAL.</span>
          <h2>
            {canSend ? "Central do WhatsApp" : "Lembretes dos seus clientes"}
          </h2>
          <p>
            {canSend
              ? "Organize os pedidos da equipe e envie pelo WhatsApp do salão."
              : "Solicite o lembrete. O gestor ou a recepção envia pelo número do salão."}
          </p>
        </div>
        <span className="pill reminder-due">
          <Bell size={14} />
          {due} para lembrar agora
        </span>
      </div>
      <details className="whatsapp-desk-note">
        <summary>
          <Phone size={18} />
          <strong>
            WhatsApp do salão {shopPhone && <span>· {shopPhone}</span>}
          </strong>
        </summary>
        <p>
          {canSend
            ? "Use um dispositivo conectado à conta do salão. O atalho abre a conta de WhatsApp que estiver conectada neste aparelho; confira antes de enviar."
            : "Você não precisa usar o seu WhatsApp pessoal. Suas solicitações aparecem na central do gestor e da recepção."}
        </p>
      </details>
      {data.isDemo && (
        <details className="demo-banner demo-notice">
          <summary>Demonstração: use apenas seu próprio número</summary>
          <p>
            Os telefones de exemplo são fictícios. Nenhuma mensagem é enviada
            automaticamente.
          </p>
        </details>
      )}
      <div className="manual-reminder-filters">
        <label className="field">
          Período
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="today">Hoje</option>
            <option value="tomorrow">Amanhã</option>
            <option value="week">Próximos 7 dias</option>
          </select>
        </label>
        {canSend && (
          <label className="field">
            Profissional
            <select
              value={professional}
              onChange={(e) => setProfessional(e.target.value)}
            >
              <option value="">Todos os profissionais</option>
              {data.professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="secondary"
          disabled={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>
      <div
        className="reminder-view-tabs"
        role="group"
        aria-label="Situação dos lembretes"
      >
        <button
          className={view === "pending" ? "active" : ""}
          onClick={() => setView("pending")}
        >
          <Inbox size={16} />
          Pendentes <b>{pending.length}</b>
        </button>
        <button
          className={view === "done" ? "active" : ""}
          onClick={() => setView("done")}
        >
          <CheckCheck size={16} />
          Envios informados <b>{done.length}</b>
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success-note" role="status">
          {notice}
        </p>
      )}
      {loading && !rows.length ? (
        <p className="empty">Carregando lembretes…</p>
      ) : (
        <>
          <div className="manual-reminder-list">
            {visible.map((a) => {
              const key = a.id + ":" + a.starts_at;
              const message =
                drafts[key] ?? reminderMessage(a, data.tenant.name);
              const href = whatsappLink(a.phone, message);
              const completed = a.reminder_state === "done";
              return (
                <article
                  className={
                    "manual-reminder-card" +
                    (a.requested_at && !completed ? " requested" : "")
                  }
                  key={key}
                >
                  <div className="manual-reminder-heading">
                    <div>
                      <strong>{a.customer}</strong>
                      <span>
                        {a.service_name} · {a.professional_name}
                      </span>
                    </div>
                    <span
                      className={
                        "pill" + (a.due && !completed ? " reminder-due" : "")
                      }
                    >
                      {completed
                        ? "Envio informado"
                        : a.reminder_state === "opened"
                          ? "Em preparo pela equipe"
                          : a.requested_at
                            ? "Solicitado pela equipe"
                            : a.due
                              ? "Lembrar agora"
                              : "Próximo atendimento"}
                    </span>
                  </div>
                  <p className="manual-reminder-date">
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(a.starts_at))}
                    <span>{a.phone}</span>
                  </p>
                  {a.requested_at && (
                    <p className="reminder-requested-note">
                      <Send size={14} />
                      Solicitado por{" "}
                      {a.requested_by_name || a.professional_name}
                    </p>
                  )}
                  {!completed && (
                    <details>
                      <summary>
                        {canSend
                          ? "Ver ou editar mensagem"
                          : "Ver modelo da mensagem"}
                      </summary>
                      <label className="field">
                        Mensagem para {a.customer}
                        <textarea
                          value={message}
                          readOnly={!canSend}
                          maxLength={2000}
                          rows={6}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [key]: e.target.value }))
                          }
                        />
                      </label>
                    </details>
                  )}
                  <div className="manual-reminder-actions">
                    {completed ? (
                      <>
                        <p className="form-note">
                          Envio registrado pela equipe em{" "}
                          {new Date(a.done_at!).toLocaleString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })}
                          . O sistema não verifica entrega ou leitura.
                        </p>
                        {canSend && (
                          <button
                            className="secondary"
                            disabled={busy === a.id || data.readOnly}
                            onClick={() => void act("reopen", a)}
                          >
                            <RotateCcw size={15} />
                            Reabrir lembrete
                          </button>
                        )}
                      </>
                    ) : canSend ? (
                      <>
                        {href && !data.readOnly ? (
                          <form
                            action="/api/reminders/open"
                            method="post"
                            target="_blank"
                            rel="noopener"
                            onSubmit={() =>
                              setTimeout(() => setRefresh((n) => n + 1), 1000)
                            }
                          >
                            <input
                              type="hidden"
                              name="appointmentId"
                              value={a.id}
                            />
                            <input
                              type="hidden"
                              name="version"
                              value={a.schedule_version}
                            />
                            <input
                              type="hidden"
                              name="message"
                              value={message}
                            />
                            <button className="primary" type="submit">
                              <MessageCircle size={17} />
                              Abrir WhatsApp do salão{" "}
                              <ExternalLink size={14} />
                            </button>
                          </form>
                        ) : (
                          <p className="form-note">
                            Preencha a mensagem para abrir a conversa.
                          </p>
                        )}
                        <div className="manual-send-confirmation">
                          <label className="check-field">
                            <input
                              type="checkbox"
                              checked={!!confirmations[a.id]}
                              onChange={(e) =>
                                setConfirmations((c) => ({
                                  ...c,
                                  [a.id]: e.target.checked,
                                }))
                              }
                            />
                            Já enviei esta mensagem pelo WhatsApp do salão.
                          </label>
                          <button
                            className="secondary"
                            disabled={
                              !confirmations[a.id] ||
                              busy === a.id ||
                              data.readOnly
                            }
                            onClick={() => void act("done", a)}
                          >
                            <CheckCheck size={16} />
                            Registrar envio manual
                          </button>
                        </div>
                      </>
                    ) : a.requested_at ? (
                      <p className="reminder-requested-note">
                        <CheckCheck size={17} />
                        Solicitação na central. A equipe cuidará do envio.
                      </p>
                    ) : (
                      <button
                        className="primary"
                        disabled={busy === a.id || data.readOnly}
                        onClick={() => void act("request", a)}
                      >
                        <Send size={17} />
                        {busy === a.id
                          ? "Solicitando…"
                          : "Solicitar lembrete à recepção"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!visible.length && !error && (
            <div className="empty">
              <CheckCheck size={28} />
              <h3>
                {view === "done"
                  ? "Nenhum envio informado neste período."
                  : "A central está em dia."}
              </h3>
              <p>
                {eligible.length
                  ? "Os próximos lembretes aparecem aqui."
                  : "Ainda não há agendamentos futuros autorizados para WhatsApp neste período."}
              </p>
            </div>
          )}
          {rows.length > eligible.length && (
            <details className="reminder-unavailable">
              <summary>
                {rows.length - eligible.length} agendamento(s) sem autorização
                ou telefone válido
              </summary>
              <p className="form-note">
                O atalho e a solicitação ficam disponíveis quando o cliente
                autoriza o contato no agendamento e informa um telefone
                brasileiro com DDD.
              </p>
              {rows
                .filter((a) => !eligible.includes(a))
                .map((a) => (
                  <p key={a.id}>
                    {a.customer} · {a.professional_name} —{" "}
                    {!a.consent
                      ? "contato não autorizado"
                      : "confira o telefone"}
                  </p>
                ))}
            </details>
          )}
          <p className="form-note reminder-footer-note">
            Abrir o atalho não confirma envio. Apenas a equipe pode informar que
            enviou. Atualização a cada 30 segundos com a tela aberta; até 200
            agendamentos por período.
          </p>
        </>
      )}
    </section>
  );
}
