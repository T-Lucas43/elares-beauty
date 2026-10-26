"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  X,
  Clock3,
  MessageCircle,
  ArrowRight,
  CheckCheck,
} from "lucide-react";
import type { AppNotice } from "@/lib/in-app-notices";
import { updateManualReminder } from "@/lib/client-reminders";
import type { Data } from "./types";

export default function InAppNotifications({
  data,
  activeTab,
  suspended = false,
  onOpenAppointment,
  onOpenReminders,
  onOpenCuts,
}: {
  data: Data;
  activeTab: string;
  suspended?: boolean;
  onOpenAppointment: (id: string) => void;
  onOpenReminders: () => void;
  onOpenCuts: () => void;
}) {
  const [items, setItems] = useState<AppNotice[]>([]),
    [open, setOpen] = useState(false),
    [active, setActive] = useState<AppNotice>(),
    [enabled, setEnabled] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const seen = useRef(new Set<string>()),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    async function load() {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/notices", { signal: controller.signal });
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!disposed) {
          setItems(d.items);
          setError("");
        }
      } catch (e) {
        if (!disposed && (e as Error).name !== "AbortError")
          setError("Não foi possível atualizar os avisos.");
      }
    }
    void load();
    const timer = setInterval(() => void load(), 30000);
    const visible = () => void load();
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [data.role, data.professionalId, refresh]);
  useEffect(() => {
    if (!enabled || suspended) {
      setActive(undefined);
      if (suspended) setOpen(false);
      return;
    }
    if (active) return;
    const next = items.find((n) => !seen.current.has(n.key));
    if (next) {
      seen.current.add(next.key);
      if (next.kind !== "cut" && activeTab === "messages") return;
      setActive(next);
    }
  }, [items, active, enabled, activeTab, suspended]);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(undefined), 20000);
    return () => clearTimeout(timer);
  }, [active]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  async function act(n: AppNotice) {
    if (
      n.kind === "reminder" &&
      data.role === "barber" &&
      n.appointmentId &&
      n.version !== undefined
    ) {
      setBusy(true);
      try {
        await updateManualReminder("request", n.appointmentId, n.version);
        setActive(undefined);
        setRefresh((v) => v + 1);
        onOpenReminders();
        setOpen(false);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (n.kind === "cut") {
      if (n.appointmentId) onOpenAppointment(n.appointmentId);
      else onOpenCuts();
    } else onOpenReminders();
    setOpen(false);
    setActive(undefined);
  }
  const action = (n: AppNotice) =>
    n.kind === "cut"
      ? "Ver atendimento"
      : n.kind === "reminder" && data.role === "barber"
        ? "Solicitar à recepção"
        : "Abrir central";
  return (
    <div className="in-app-notifications" ref={root}>
      <button
        className="icon-button notification-trigger"
        aria-label={`Avisos${items.length ? `, ${items.length} pendentes` : ""}`}
        aria-expanded={open}
        aria-controls="in-app-notice-center"
        ref={trigger}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={21} />
        {items.length > 0 && (
          <span className="notification-dot">{items.length}</span>
        )}
      </button>
      {open && (
        <section
          className="notification-center"
          id="in-app-notice-center"
          role="dialog"
          aria-label="Central de avisos"
        >
          <header>
            <div>
              <span className="eyebrow">NO SEU RITMO</span>
              <h2>Seus avisos</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Fechar avisos"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={19} />
            </button>
          </header>
          <p className="form-note">
            Avisos atualizados enquanto o sistema estiver aberto. Nenhuma
            mensagem é enviada automaticamente.
          </p>
          <label className="check-field notice-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Pop-ups nesta sessão
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="notification-center-list">
            {items.map((n) => (
              <button
                className="notice-list-item"
                key={n.key}
                disabled={busy}
                onClick={() => void act(n)}
              >
                {n.kind === "cut" ? (
                  <Clock3 size={19} />
                ) : (
                  <MessageCircle size={19} />
                )}
                <span>
                  <strong>{n.title}</strong>
                  <small>{n.message}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          {!items.length && (
            <div className="empty">
              <CheckCheck size={26} />
              <h3>Tudo em dia por aqui.</h3>
              <p>
                Você será avisado 10 minutos antes do próximo corte e quando
                houver um lembrete pendente.
              </p>
            </div>
          )}
          <button
            className="text-button notification-preview"
            onClick={() => {
              setOpen(false);
              setActive({
                key: "preview",
                kind: "cut",
                title: "Exemplo: próximo corte em 10 min",
                message:
                  "Cliente de exemplo · Corte masculino. Esta é apenas uma prévia do aviso.",
              });
            }}
          >
            Testar pop-up de exemplo
          </button>
        </section>
      )}
      {active && (
        <aside
          className="appointment-notice"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="appointment-notice-icon">
            {active.kind === "cut" ? (
              <Clock3 size={22} />
            ) : (
              <MessageCircle size={22} />
            )}
          </span>
          <button
            className="icon-button appointment-notice-close"
            aria-label="Dispensar aviso"
            onClick={() => setActive(undefined)}
          >
            <X size={18} />
          </button>
          <span className="eyebrow">
            {active.key === "preview"
              ? "PRÉVIA DO AVISO"
              : active.kind === "cut"
                ? "PRÓXIMO ATENDIMENTO"
                : "WHATSAPP DO SALÃO"}
          </span>
          <h3>{active.title}</h3>
          <p>{active.message}</p>
          {error && <p className="error">{error}</p>}
          <button
            className="primary"
            disabled={busy}
            onClick={() => void act(active)}
          >
            {busy ? "Aguarde…" : action(active)}
            <ArrowRight size={16} />
          </button>
        </aside>
      )}
    </div>
  );
}
