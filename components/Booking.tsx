"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Scissors,
  MapPin,
  Clock,
  CalendarDays,
  Link as LinkIcon,
} from "lucide-react";
import { money, localDay } from "@/lib/domain";
import { addDays } from "@/lib/calendar";
import InstallAppButton from "./InstallAppButton";
import Brand from "./Brand";
import type { Professional, Service } from "./types";
type Slot = {
  hour: string;
  professional_id: string;
  price: number;
  duration: number;
};
type PublicData = {
  tenant: {
    name: string;
    address: string;
    phone: string;
    cancellation_minutes: number;
  };
  professionals: Professional[];
  services: Service[];
  slots: Slot[];
};
export default function Booking({
  internal = false,
  onDone,
  slug = "elares-beauty",
  fixedProfessional,
}: {
  internal?: boolean;
  onDone?: () => void;
  slug?: string;
  fixedProfessional?: string;
}) {
  const [data, setData] = useState<PublicData>();
  const [service, setService] = useState("");
  const [professional, setProfessional] = useState(fixedProfessional || "");
  const [date, setDate] = useState(localDay());
  const [hour, setHour] = useState("");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [done, setDone] = useState(false);
  const [manageLink, setManageLink] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [refresh, setRefresh] = useState(0);
  const contentRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (internal)
      contentRef.current
        ?.closest(".modal")
        ?.scrollTo({ top: 0, behavior: "instant" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, done, internal]);
  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    setHour("");
    setLoadingSlots(true);
    setError("");
    fetch(
      `/api/public?slug=${encodeURIComponent(slug)}&date=${date}&professionalId=${encodeURIComponent(professional)}&serviceId=${encodeURIComponent(service)}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        return d;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false);
      });
    return () => controller.abort();
  }, [date, professional, service, slug, refresh]);
  const selectedBase = data?.services.find((s) => s.id === service);
  const slot = data?.slots.find((s) => s.hour === hour);
  const selected = selectedBase
    ? {
        ...selectedBase,
        price: slot?.price ?? selectedBase.price,
        duration: slot?.duration ?? selectedBase.duration,
      }
    : undefined;
  const pro = data?.professionals.find(
    (p) => p.id === (slot?.professional_id || professional),
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const f = new FormData(event.currentTarget);
    const key = requestKey || crypto.randomUUID();
    setRequestKey(key);
    try {
      if (!slot) throw Error("Escolha novamente um horário disponível.");
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "book",
          professionalId: slot.professional_id,
          serviceId: service,
          quotedPrice: slot.price,
          quotedDuration: slot.duration,
          customer: f.get("customer"),
          phone: String(f.get("phone")).replace(/\D/g, ""),
          date,
          hour,
          consent: f.get("consent") === "on",
          internal,
          slug,
          idempotencyKey: key,
        }),
      });
      const result = await r.json();
      if (!r.ok) {
        if (r.status === 409) {
          setStep(2);
          setRefresh((n) => n + 1);
          setRequestKey("");
        }
        throw Error(result.error);
      }
      setManageLink(`/meu-agendamento/${result.id}#${result.manageToken}`);
      setDone(true);
      if (internal) onDone?.();
    } catch (e) {
      setError((e as Error).message);
      setRequestKey("");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className={internal ? "booking embedded" : "booking"}>
      {!internal && (
        <header className="booking-header">
          <a className="brand" href="/">
            <Brand />
          </a>
          <InstallAppButton />
        </header>
      )}
      <main className="booking-layout">
        <aside className="shop-card">
          <span className="eyebrow light">SEU PRÓXIMO MOMENTO DE CUIDADO</span>
          <div className="shop-symbol">
            <Scissors size={60} strokeWidth={1} />
          </div>
          <h1>
            {data?.tenant.name || "Suo salão"}
            <span>.</span>
          </h1>
          <p>
            Mais que um corte.
            <br />
            Seu estilo, em boas mãos.
          </p>
          <div className="shop-meta">
            <span>
              <MapPin size={16} />
              {data?.tenant.address || "Consulte o endereço com a recepção"}
            </span>
            <span>
              <Clock size={16} />
              Horários conforme o profissional
            </span>
          </div>
          <small>Agendamento e cuidado em um só lugar</small>
        </aside>
        <section className="booking-content" ref={contentRef}>
          {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
            <p className="demo-banner">
              Demonstração compartilhada: use dados fictícios. O envio
              automático está desligado; confira o destinatário antes de usar os
              atalhos de WhatsApp.
            </p>
          )}
          {done ? (
            <div className="success">
              <span className="success-icon">
                <Check size={32} />
              </span>
              <span className="eyebrow">TUDO CERTO</span>
              <h2>Seu horário está reservado!</h2>
              <p>
                {selected?.name} com {pro?.name}
              </p>
              <strong>
                {date.split("-").reverse().join("/")} às {hour}
              </strong>
              <p>
                Guarde o link abaixo para consultar, cancelar ou reagendar sua
                reserva, respeitando a antecedência do salão.
              </p>
              <a className="primary" href={manageLink}>
                <LinkIcon size={17} />
                Gerenciar meu agendamento
              </a>
              <p className="form-note">
                O link é pessoal: qualquer pessoa com acesso pode gerenciar esta
                reserva. Nenhuma cobrança online é realizada.
              </p>
              <button
                className="text-button"
                onClick={() => {
                  setDone(false);
                  setStep(0);
                  setRequestKey("");
                  setHour("");
                }}
              >
                Fazer outro agendamento
              </button>
            </div>
          ) : (
            <>
              <div className="steps">
                {["Serviço", "Profissional", "Horário", "Seus dados"].map(
                  (s, i) => (
                    <span key={s} className={step >= i ? "active" : ""}>
                      <b>{i + 1}</b>
                      <small>{s}</small>
                    </span>
                  ),
                )}
              </div>
              <span className="eyebrow">PASSO {step + 1} DE 4</span>
              <h2>
                {
                  [
                    "Como podemos cuidar de você?",
                    "Escolha seu profissional",
                    "Qual o melhor momento?",
                    "Só falta confirmar",
                  ][step]
                }
              </h2>
              <p className="muted">
                {
                  [
                    "Selecione o serviço. O preço final aparece antes de confirmar.",
                    "Gente que entende do seu estilo.",
                    "Horários calculados pela jornada, intervalos e folgas.",
                    "Confira o profissional, horário e valor da sua reserva.",
                  ][step]
                }
              </p>
              {!data && <p>Carregando serviços…</p>}
              {step === 0 && (
                <div className="choice-list">
                  {data?.services.map((s) => (
                    <button
                      key={s.id}
                      className={`choice ${service === s.id ? "selected" : ""}`}
                      onClick={() => {
                        setService(s.id);
                        setRequestKey("");
                      }}
                    >
                      <span className="choice-icon">
                        <Scissors size={22} />
                      </span>
                      <span>
                        <strong>{s.name}</strong>
                        <small>{s.description}</small>
                        <small>
                          <Clock size={12} />
                          {s.duration} min · valor base
                        </small>
                      </span>
                      <b>{money(s.price)}</b>
                      <span className="radio">
                        {service === s.id && <Check size={12} />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {step === 1 && (
                <div className="choice-list">
                  {!fixedProfessional && (
                    <button
                      className={`choice ${professional === "any" ? "selected" : ""}`}
                      onClick={() => setProfessional("any")}
                    >
                      <span className="choice-icon">
                        <Scissors size={22} />
                      </span>
                      <span>
                        <strong>Qualquer profissional disponível</strong>
                        <small>
                          O profissional e o valor são definidos ao escolher o
                          horário.
                        </small>
                      </span>
                      <span className="radio">
                        {professional === "any" && <Check size={12} />}
                      </span>
                    </button>
                  )}
                  {data?.professionals
                    .filter(
                      (p) => !fixedProfessional || p.id === fixedProfessional,
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        className={`choice ${professional === p.id ? "selected" : ""}`}
                        onClick={() => setProfessional(p.id)}
                      >
                        <span
                          className="avatar"
                          style={{ background: p.color }}
                        >
                          {p.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.specialty}</small>
                        </span>
                        <span className="radio">
                          {professional === p.id && <Check size={12} />}
                        </span>
                      </button>
                    ))}
                </div>
              )}
              {step === 2 && (
                <>
                  <div className="chips">
                    <button type="button" onClick={() => setDate(localDay())}>
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(addDays(localDay(), 1))}
                    >
                      Amanhã
                    </button>
                  </div>
                  <label className="field">
                    Data do atendimento
                    <input
                      type="date"
                      value={date}
                      min={localDay()}
                      max={addDays(localDay(), 59)}
                      onInput={(e) => setDate(e.currentTarget.value)}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  {loadingSlots ? (
                    <p className="empty" role="status">
                      Consultando horários…
                    </p>
                  ) : (
                    <>
                      <div className="slots">
                        {data?.slots.map((s) => (
                          <button
                            key={s.hour}
                            className={hour === s.hour ? "selected" : ""}
                            onClick={() => setHour(s.hour)}
                          >
                            {s.hour}
                          </button>
                        ))}
                      </div>
                      {!data?.slots.length && (
                        <p className="empty">
                          Sem horários nesta data. Escolha outro dia ou
                          profissional.
                        </p>
                      )}
                    </>
                  )}
                  {slot && (
                    <p className="form-note">
                      {pro?.name} · {slot.duration} min · {money(slot.price)}
                    </p>
                  )}
                </>
              )}
              {step === 3 && (
                <form onSubmit={submit}>
                  <div className="booking-summary">
                    <CalendarDays size={24} />
                    <div>
                      <strong>
                        {selected?.name} · {money(selected?.price || 0)}
                      </strong>
                      <p>
                        {pro?.name} · {date.split("-").reverse().join("/")} às{" "}
                        {hour} · {selected?.duration} min
                      </p>
                    </div>
                  </div>
                  <label className="field">
                    Seu nome
                    <input
                      name="customer"
                      required
                      minLength={2}
                      maxLength={100}
                      placeholder="Como podemos chamar você?"
                      autoComplete="name"
                    />
                  </label>
                  <label className="field">
                    WhatsApp com DDD
                    <input
                      name="phone"
                      required
                      maxLength={20}
                      placeholder="(11) 99999-9999"
                      type="tel"
                      autoComplete="tel"
                      pattern="[0-9() +\-]{10,20}"
                    />
                  </label>
                  <label className="consent">
                    <input type="checkbox" name="consent" />
                    Aceito receber confirmações, alterações e lembretes deste
                    agendamento pelo WhatsApp.
                  </label>
                  <small className="muted">
                    Usamos seus dados para organizar seu atendimento.
                    Cancelamentos e reagendamentos online exigem{" "}
                    {data?.tenant.cancellation_minutes} minutos de antecedência.
                  </small>
                  <button
                    className="primary wide"
                    disabled={loading || loadingSlots}
                  >
                    {loading ? "Reservando…" : "Confirmar agendamento"}
                    <Check size={18} />
                  </button>
                </form>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="booking-actions">
                {step > 0 ? (
                  <button
                    className="text-button"
                    onClick={() => setStep(step - 1)}
                  >
                    <ArrowLeft size={16} />
                    Voltar
                  </button>
                ) : (
                  <span />
                )}
                {step < 3 && (
                  <button
                    className="primary"
                    disabled={
                      step === 0
                        ? !service
                        : step === 1
                          ? !professional
                          : !hour || loadingSlots
                    }
                    onClick={() => setStep(step + 1)}
                  >
                    Continuar
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </main>
      {!internal && (
        <footer className="booking-footer">
          Agendamento simples. Cuidado de verdade.
          <span>feito com Elares Beauty</span>
        </footer>
      )}
    </div>
  );
}
