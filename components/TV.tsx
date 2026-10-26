"use client";
import { useEffect, useState } from "react";
import {
  Scissors,
  Maximize,
  Minimize,
  ArrowLeft,
  RefreshCw,
  Clock,
  ArrowRight,
} from "lucide-react";
import { appointmentDay } from "@/lib/calendar";
import { time } from "@/lib/domain";
import { professionalQueue } from "@/lib/tv";
import Brand from "./Brand";
import type { Professional } from "./types";
type TVBooking = {
  id: string;
  professional_id: string;
  customer: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
};
type TVData = {
  mode: "owner" | "device";
  tenant: { name: string };
  professionals: Professional[];
  appointments: TVBooking[];
  updatedAt: string;
};
export default function TV() {
  const [data, setData] = useState<TVData>();
  const [error, setError] = useState("");
  const [now, setNow] = useState<Date>();
  const [full, setFull] = useState(false);
  const [reload, setReload] = useState(0);
  const [access, setAccess] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    setNow(new Date());
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const change = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    async function load() {
      if (running) return;
      running = true;
      try {
        const deviceToken = new URLSearchParams(location.hash.slice(1)).get(
          "device",
        );
        if (deviceToken) {
          const paired = await fetch("/api/tv/pair", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: deviceToken }),
            signal: controller.signal,
          });
          const result = await paired.json();
          if (!paired.ok) {
            setAccess(true);
            throw Error(result.error);
          }
          history.replaceState(null, "", location.pathname);
        }
        const r = await fetch("/api/tv", {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = await r.json();
        if (!r.ok) {
          setAccess([401, 403].includes(r.status));
          throw Error(result.error);
        }
        setData(result);
        setAccess(false);
        setError("");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        running = false;
      }
    }
    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [reload]);
  const today = now ? appointmentDay(now.toISOString()) : "";
  const live =
    data?.appointments.filter((a) => a.status === "in_progress") || [];
  const total =
    data?.appointments.filter((a) => appointmentDay(a.starts_at) === today)
      .length || 0;
  const finished =
    data?.appointments.filter(
      (a) => appointmentDay(a.starts_at) === today && a.status === "completed",
    ).length || 0;
  const stale = !!(data && now && +now - +new Date(data.updatedAt) > 45000);
  return (
    <main className="tv-page">
      <header className="tv-header">
        <div>
          <a href="/" className="brand">
            <Brand light />
          </a>
          <span className="tv-shop">
            {data?.tenant.name.toUpperCase() || "SEU SALÃO"}
          </span>
        </div>
        <div className="tv-clock">
          <strong>
            {now?.toLocaleTimeString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              hour: "2-digit",
              minute: "2-digit",
            }) || "--:--"}
          </strong>
          <span>
            {now?.toLocaleDateString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
        </div>
      </header>
      <div className="tv-heading">
        <div>
          <span className="eyebrow light">ACOMPANHE SEU ATENDIMENTO</span>
          <h1>
            Seu momento está chegando<span>.</span>
          </h1>
          <p>Uma cadeira, um profissional, todo cuidado com você.</p>
        </div>
        <div className="tv-totals">
          <span>
            <b>{live.length}</b>em atendimento
          </span>
          <span>
            <b>
              {finished}/{total}
            </b>
            concluídos hoje
          </span>
        </div>
      </div>
      {error && (
        <div className="tv-alert" role="alert">
          <span>
            {error}
            {data ? " Os horários abaixo podem estar desatualizados." : ""}
          </span>
          {access ? (
            <a href="/">
              Entrar no painel
              <ArrowRight size={16} />
            </a>
          ) : (
            <button onClick={() => setReload(reload + 1)}>
              <RefreshCw size={16} />
              Tentar novamente
            </button>
          )}
        </div>
      )}
      {!data && !error && (
        <div className="tv-wait" role="status">
          Carregando os atendimentos…
        </div>
      )}
      {data && !access && (
        <div className="tv-team">
          {data.professionals.map((p) => {
            const { current, expected, active, next, overdue } =
              professionalQueue(
                data.appointments,
                p.id,
                now || new Date(data.updatedAt),
              );
            return (
              <section
                className={`tv-professional ${current ? "attending" : ""}`}
                key={p.id}
              >
                <div className="tv-professional-heading">
                  <span className="avatar big" style={{ background: p.color }}>
                    {p.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <h2>{p.name}</h2>
                    <p>{p.specialty}</p>
                  </div>
                  <span className={`tv-availability ${current ? "busy" : ""}`}>
                    {current
                      ? "Em atendimento"
                      : expected
                        ? "Horário previsto"
                        : "Livre agora"}
                  </span>
                </div>
                <div className="tv-current">
                  <span className="tv-caption">
                    <i />
                    {current
                      ? "EM ATENDIMENTO"
                      : expected
                        ? "PREVISTO AGORA"
                        : "NESTE MOMENTO"}
                  </span>
                  <strong>
                    {active?.customer || "Aguardando atendimento"}
                  </strong>
                  {active && (
                    <p className="tv-current-service">{active.service_name}</p>
                  )}
                  <span className="tv-current-time">
                    {active ? (
                      <>
                        <Clock size={18} />
                        {time(active.starts_at)} — {time(active.ends_at)}{" "}
                        {current ? "· término previsto" : ""}
                      </>
                    ) : (
                      <>
                        <Scissors size={18} />
                        Seu próximo atendimento aparece aqui
                      </>
                    )}
                  </span>
                  {expected && (
                    <small>
                      Início ainda não confirmado pelo profissional.
                    </small>
                  )}
                </div>
                <div className="tv-next">
                  <span className="tv-caption">PRÓXIMOS ATENDIMENTOS</span>
                  {next.length ? (
                    next.map((a, i) => (
                      <div
                        className={`tv-queue-row ${i === 0 ? "first" : ""}`}
                        key={a.id}
                      >
                        <span className="tv-queue-order">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong>{a.customer}</strong>
                          <small>
                            {a.service_name} ·{" "}
                            {appointmentDay(a.starts_at) !== today
                              ? new Date(a.starts_at).toLocaleDateString(
                                  "pt-BR",
                                  {
                                    timeZone: "America/Sao_Paulo",
                                    day: "2-digit",
                                    month: "2-digit",
                                  },
                                )
                              : "Hoje"}
                          </small>
                        </div>
                        <b>{time(a.starts_at)}</b>
                      </div>
                    ))
                  ) : (
                    <p className="tv-no-next">
                      Nenhuma reserva futura nos próximos 7 dias.
                    </p>
                  )}
                </div>
                {overdue > 0 && (
                  <small className="tv-overdue">
                    {overdue} atendimento(s) do dia aguardando atualização.
                  </small>
                )}
              </section>
            );
          })}
        </div>
      )}
      <footer className="tv-footer">
        <span className={stale || error ? "tv-disconnected" : "tv-connected"}>
          <i />
          {stale || error
            ? "Conexão indisponível · confira os horários na recepção"
            : data
              ? `Atualizado às ${time(data.updatedAt)} · atualização a cada 15 segundos`
              : "Conectando…"}
        </span>
        <span>Nomes abreviados para preservar sua privacidade.</span>
        <div>
          {data?.mode !== "device" && (
            <a href="/">
              <ArrowLeft size={16} />
              Painel
            </a>
          )}
          <button
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
              } catch {
                setError(
                  "Tela cheia indisponível neste navegador. Use o modo de tela cheia da TV.",
                );
              }
            }}
          >
            {full ? <Minimize size={17} /> : <Maximize size={17} />}{" "}
            {full ? "Sair da tela cheia" : "Tela cheia"}
          </button>
        </div>
      </footer>
    </main>
  );
}
