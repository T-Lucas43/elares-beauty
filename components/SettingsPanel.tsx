"use client";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  Plus,
  Save,
  Copy,
  Monitor,
  Check,
  Settings,
  Users,
  Scissors,
  CalendarDays,
  UserRound,
  MessageCircle,
  Building2,
} from "lucide-react";
import { money, localDay } from "@/lib/domain";
import { hourOf, minuteOf } from "@/lib/time-input";
import type { Professional, Service } from "./types";
type Schedule = {
  professional_id: string;
  weekday: number;
  enabled: boolean;
  start_minute: number;
  end_minute: number;
  break_start: number | null;
  break_end: number | null;
};
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  professional_id: string | null;
  active: boolean;
};
type Config = {
  tenant: {
    name: string;
    slug: string;
    address: string;
    phone: string;
    cancellation_minutes: number;
    reminder_minutes: number;
  };
  professionals: Professional[];
  services: Service[];
  schedules: Schedule[];
  blocks: {
    id: string;
    professional_id: string;
    starts_at: string;
    ends_at: string;
    reason: string;
  }[];
  users: User[];
  devices: {
    id: string;
    name: string;
    expires_at: string;
    revoked_at: string | null;
    last_seen: string | null;
  }[];
  rules: {
    professional_id: string;
    service_id: string;
    enabled: boolean;
    price: number | null;
    duration: number | null;
    commission_bps: number | null;
  }[];
  whatsapp: { enabled: boolean; missing: string[] };
  self: string;
};
const sections = [
  { id: "shop", label: "Salão", icon: Building2 },
  { id: "pros", label: "Profissionais", icon: Users },
  { id: "services", label: "Serviços", icon: Scissors },
  { id: "schedule", label: "Jornadas e folgas", icon: CalendarDays },
  { id: "users", label: "Usuários", icon: UserRound },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "tv", label: "TV", icon: Monitor },
];
function Field({
  label,
  name,
  value,
  type = "text",
  required = false,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  step?: string;
  min?: number | string;
  max?: number | string;
}) {
  return (
    <label className="field">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        step={step}
        min={min}
        max={max}
      />
    </label>
  );
}
function ProSelect({
  pros,
  name = "professionalId",
  value,
}: {
  pros: Professional[];
  name?: string;
  value?: string;
}) {
  return (
    <label className="field">
      Profissional
      <select name={name} defaultValue={value}>
        {pros.map((p) => (
          <option value={p.id} key={p.id}>
            {p.name}
            {p.active === false ? " (desativado)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
export default function SettingsPanel({
  onChanged,
  readOnly = false,
  demo = false,
}: {
  onChanged: () => Promise<void>;
  readOnly?: boolean;
  demo?: boolean;
}) {
  const [data, setData] = useState<Config>();
  const [section, setSection] = useState("shop");
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [section]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [proId, setProId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [schedulePro, setSchedulePro] = useState("");
  const [userId, setUserId] = useState("");
  const [nonce, setNonce] = useState(0);
  const [tvLink, setTVLink] = useState("");
  const [percentage, setPercentage] = useState(60);
  const [splitModel, setSplitModel] = useState("percent");
  useEffect(() => {
    const p = data?.professionals.find((p) => p.id === proId);
    setPercentage((p?.commission_bps ?? 6000) / 100);
    setSplitModel(p?.commission_kind || "percent");
  }, [proId, data]);
  const load = useCallback(async () => {
    const r = await fetch("/api/settings");
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setData(d);
    setSchedulePro((p) => p || d.professionals[0]?.id || "");
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function save(body: object) {
    if (readOnly) {
      setError("A demonstração é somente para consulta.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.token) setTVLink(`${location.origin}/tv#device=${d.token}`);
      setNotice("Alterações salvas. O histórico existente foi preservado.");
      setNonce((n) => n + 1);
      await load();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function form(action: string, build: (f: FormData) => object) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void save({ action, ...build(new FormData(e.currentTarget)) });
    };
  }
  const num = (f: FormData, key: string) => Number(f.get(key));
  const cents = (f: FormData, key: string) => Math.round(num(f, key) * 100);
  const nullable = (f: FormData, key: string, multiplier = 1) =>
    String(f.get(key) || "").trim() === ""
      ? null
      : Math.round(num(f, key) * multiplier);
  if (!data)
    return (
      <section className="panel">
        <p className="empty">{error || "Carregando configurações…"}</p>
      </section>
    );
  const pro = data.professionals.find((p) => p.id === proId);
  const service = data.services.find((s) => s.id === serviceId);
  const user = data.users.find((u) => u.id === userId);
  return (
    <section className="panel settings-panel">
      <div
        className="settings-navigation"
        role="group"
        aria-label="Seções de configuração"
      >
        {sections
          .filter((s) => !demo || s.id !== "users")
          .map((s) => (
            <button
              key={s.id}
              className={section === s.id ? "selected" : ""}
              onClick={() => {
                setSection(s.id);
                setError("");
                setNotice("");
              }}
            >
              <s.icon size={16} />
              {s.label}
            </button>
          ))}
      </div>
      <div className="settings-content">
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
        {section === "shop" && (
          <form
            onSubmit={form("tenant", (f) => ({
              name: f.get("name"),
              slug: f.get("slug"),
              address: f.get("address"),
              phone: f.get("phone"),
              cancellationMinutes: num(f, "cancel"),
              reminderMinutes: num(f, "remind"),
            }))}
          >
            <h2>Suo salão</h2>
            <p className="muted">Identidade pública e regras de atendimento.</p>
            <div className="form-grid">
              <Field
                label="Nome"
                name="name"
                value={data.tenant.name}
                required
              />
              <Field
                label="Endereço do link (slug)"
                name="slug"
                value={data.tenant.slug}
                required
              />
              <Field
                label="Endereço"
                name="address"
                value={data.tenant.address}
              />
              <Field
                label="WhatsApp do salão (com DDD)"
                name="phone"
                value={data.tenant.phone}
              />
              <Field
                label="Antecedência para cancelar/reagendar (min)"
                name="cancel"
                value={data.tenant.cancellation_minutes}
                type="number"
                min={0}
                max={10080}
              />
              <Field
                label="Mostrar aviso de lembrete (min antes)"
                name="remind"
                value={data.tenant.reminder_minutes}
                type="number"
                min={15}
                max={10080}
              />
            </div>
            <p className="form-note">
              O fuso desta instalação é America/Sao_Paulo. Alterar o slug muda o
              endereço de novos agendamentos.
            </p>
            <button className="primary" disabled={readOnly || busy}>
              <Save size={16} />
              Salvar salão
            </button>
          </form>
        )}
        {section === "pros" && (
          <div className="settings-split">
            <div className="settings-records">
              <button className="secondary wide" onClick={() => setProId("")}>
                <Plus size={16} />
                Novo profissional
              </button>
              {data.professionals.map((p) => (
                <button
                  key={p.id}
                  className={proId === p.id ? "selected" : ""}
                  onClick={() => setProId(p.id)}
                >
                  <span className="avatar" style={{ background: p.color }}>
                    {p.name[0]}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.active ? "Ativo" : "Desativado"} ·{" "}
                      {p.commission_kind === "fixed"
                        ? money(p.commission_fixed || 0)
                        : `${(p.commission_bps || 0) / 100}%`}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <form
              key={"pro" + proId + nonce}
              onSubmit={form("professional", (f) => ({
                ...(pro ? { id: pro.id } : {}),
                name: f.get("name"),
                specialty: f.get("specialty"),
                color: f.get("color"),
                commissionBps: Math.round(num(f, "commission") * 100),
                commissionKind: f.get("kind"),
                commissionFixed: cents(f, "fixed"),
                active: f.get("active") === "on",
              }))}
            >
              <h2>{pro ? "Editar profissional" : "Novo profissional"}</h2>
              <Field label="Nome" name="name" value={pro?.name} required />
              <Field
                label="Especialidade"
                name="specialty"
                value={pro?.specialty}
              />
              <div className="form-grid">
                <Field
                  label="Cor na agenda"
                  name="color"
                  value={pro?.color || "#899f8e"}
                  type="color"
                />
                <label className="field">
                  Modelo de divisão do serviço
                  <select
                    name="kind"
                    value={splitModel}
                    onChange={(e) => setSplitModel(e.target.value)}
                  >
                    <option value="percent">
                      Percentual contratado do profissional
                    </option>
                    <option value="fixed">Valor fixo por serviço</option>
                  </select>
                </label>
                <label className="field">
                  Profissional (%)
                  <input
                    name="commission"
                    value={percentage}
                    onChange={(e) => setPercentage(Number(e.target.value))}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                  />
                </label>
                {splitModel === "percent" && (
                  <label className="field">
                    Salão (%)
                    <input
                      value={Math.round((100 - percentage) * 100) / 100}
                      readOnly
                      aria-label="Percentual que fica para o salão"
                    />
                  </label>
                )}
                <Field
                  label="Parte fixa do profissional (R$) — usada só no modelo fixo"
                  name="fixed"
                  value={(pro?.commission_fixed || 0) / 100}
                  type="number"
                  step="0.01"
                  min={0}
                />
              </div>
              {splitModel === "percent" && (
                <div className="split-preview">
                  <strong>Exemplo em um corte de R$ 50,00</strong>
                  <span>
                    Profissional: {money(Math.round((5000 * percentage) / 100))} (
                    {percentage}%)
                  </span>
                  <span>
                    Salão:{" "}
                    {money(5000 - Math.round((5000 * percentage) / 100))} (
                    {Math.round((100 - percentage) * 100) / 100}%)
                  </span>
                  <small>
                    A parte do salão ainda está sujeita às despesas e taxas.
                    Gorjetas são extras opcionais separados.
                  </small>
                </div>
              )}
              <label className="check-field">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={pro?.active ?? true}
                />
                Profissional ativo para novas reservas
              </label>
              <p className="form-note">
                Desativar preserva o histórico e os agendamentos existentes.
                Novos profissionais começam com jornada de segunda a sábado,
                09h–18h.
              </p>
              <button className="primary" disabled={readOnly || busy}>
                <Save size={16} />
                Salvar profissional
              </button>
            </form>
          </div>
        )}
        {section === "services" && (
          <>
            <div className="settings-split">
              <div className="settings-records">
                <button
                  className="secondary wide"
                  onClick={() => setServiceId("")}
                >
                  <Plus size={16} />
                  Novo serviço
                </button>
                {data.services.map((s) => (
                  <button
                    key={s.id}
                    className={serviceId === s.id ? "selected" : ""}
                    onClick={() => setServiceId(s.id)}
                  >
                    <Scissors size={20} />
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        {money(s.price)} · {s.duration} min ·{" "}
                        {s.active ? "Ativo" : "Desativado"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
              <form
                key={"service" + serviceId + nonce}
                onSubmit={form("service", (f) => ({
                  ...(service ? { id: service.id } : {}),
                  name: f.get("name"),
                  description: f.get("description"),
                  price: cents(f, "price"),
                  duration: num(f, "duration"),
                  commissionBps: nullable(f, "commission", 100),
                  active: f.get("active") === "on",
                }))}
              >
                <h2>{service ? "Editar serviço" : "Novo serviço"}</h2>
                <Field
                  label="Nome"
                  name="name"
                  value={service?.name}
                  required
                />
                <Field
                  label="Descrição"
                  name="description"
                  value={service?.description}
                />
                <div className="form-grid">
                  <Field
                    label="Preço (R$)"
                    name="price"
                    value={(service?.price || 0) / 100}
                    type="number"
                    min={0}
                    step="0.01"
                    required
                  />
                  <Field
                    label="Duração (minutos)"
                    name="duration"
                    value={service?.duration || 45}
                    type="number"
                    min={5}
                    max={480}
                    required
                  />
                  <Field
                    label="Parte do profissional no serviço (%) — vazio usa profissional"
                    name="commission"
                    value={
                      service?.commission_bps == null
                        ? ""
                        : service.commission_bps / 100
                    }
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                  />
                </div>
                <label className="check-field">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={service?.active ?? true}
                  />
                  Serviço ativo
                </label>
                <p className="form-note">
                  Mudanças de preço e comissão valem para novas reservas. O
                  histórico mantém os valores acordados.
                </p>
                <button className="primary" disabled={readOnly || busy}>
                  <Save size={16} />
                  Salvar serviço
                </button>
              </form>
            </div>
            <hr />
            <form
              key={"rule" + nonce}
              onSubmit={form("service_rule", (f) => ({
                professionalId: f.get("professionalId"),
                serviceId: f.get("serviceId"),
                enabled: f.get("enabled") === "on",
                price: nullable(f, "price", 100),
                duration: nullable(f, "duration"),
                commissionBps: nullable(f, "commission", 100),
              }))}
            >
              <h2>Personalizar serviço por profissional</h2>
              <p className="muted">
                Defina habilitação, preço e duração específicos. Campos vazios
                usam o padrão.
              </p>
              <div className="form-grid">
                <ProSelect pros={data.professionals} />
                <label className="field">
                  Serviço
                  <select name="serviceId">
                    {data.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Preço específico (R$)"
                  name="price"
                  type="number"
                  min={0}
                  step="0.01"
                />
                <Field
                  label="Duração específica (min)"
                  name="duration"
                  type="number"
                  min={5}
                  max={480}
                />
                <Field
                  label="Parte do profissional no serviço (%)"
                  name="commission"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                />
              </div>
              <label className="check-field">
                <input type="checkbox" name="enabled" defaultChecked />
                Profissional realiza este serviço
              </label>
              <button className="primary" disabled={readOnly || busy}>
                Salvar regra
              </button>
            </form>
            {data.rules.map((r) => (
              <div
                className="ledger-row"
                key={r.professional_id + r.service_id}
              >
                <span>
                  {
                    data.professionals.find((p) => p.id === r.professional_id)
                      ?.name
                  }{" "}
                  · {data.services.find((s) => s.id === r.service_id)?.name}
                  <small>
                    {r.enabled ? "Habilitado" : "Não realiza"} ·{" "}
                    {r.price == null ? "Preço padrão" : money(r.price)} ·{" "}
                    {r.duration == null
                      ? "Duração padrão"
                      : r.duration + " min"}{" "}
                    ·{" "}
                    {r.commission_bps == null
                      ? "Divisão padrão"
                      : r.commission_bps / 100 + "%"}
                  </small>
                </span>
              </div>
            ))}
          </>
        )}
        {section === "schedule" && (
          <>
            <h2>Jornada semanal</h2>
            <p className="muted">
              Novas reservas respeitam horários, intervalos e bloqueios.
              Atendimentos já marcados não são apagados ao mudar a jornada.
            </p>
            <label className="field">
              Profissional
              <select
                value={schedulePro}
                onChange={(e) => setSchedulePro(e.target.value)}
              >
                {data.professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <form
              key={"schedule" + schedulePro + nonce}
              onSubmit={form("schedule", (f) => ({
                professionalId: schedulePro,
                days: Array.from({ length: 7 }, (_, weekday) => ({
                  weekday,
                  enabled: f.get("enabled" + weekday) === "on",
                  startMinute: minuteOf(String(f.get("start" + weekday))),
                  endMinute: minuteOf(String(f.get("end" + weekday))),
                  breakStart: f.get("breakstart" + weekday)
                    ? minuteOf(String(f.get("breakstart" + weekday)))
                    : null,
                  breakEnd: f.get("breakend" + weekday)
                    ? minuteOf(String(f.get("breakend" + weekday)))
                    : null,
                })),
              }))}
            >
              <div className="schedule-table">
                {[
                  "Domingo",
                  "Segunda",
                  "Terça",
                  "Quarta",
                  "Quinta",
                  "Sexta",
                  "Sábado",
                ].map((label, i) => {
                  const row = data.schedules.find(
                    (s) => s.professional_id === schedulePro && s.weekday === i,
                  );
                  return (
                    <div className="schedule-row" key={label}>
                      <label className="check-field">
                        <input
                          type="checkbox"
                          name={"enabled" + i}
                          defaultChecked={row?.enabled ?? false}
                        />
                        {label}
                      </label>
                      <Field
                        label="Início"
                        name={"start" + i}
                        type="time"
                        value={hourOf(row?.start_minute ?? 540)}
                        required
                      />
                      <Field
                        label="Fim"
                        name={"end" + i}
                        type="time"
                        value={hourOf(row?.end_minute ?? 1080)}
                        required
                      />
                      <Field
                        label="Intervalo de"
                        name={"breakstart" + i}
                        type="time"
                        value={
                          row?.break_start == null
                            ? ""
                            : hourOf(row.break_start)
                        }
                      />
                      <Field
                        label="Até"
                        name={"breakend" + i}
                        type="time"
                        value={
                          row?.break_end == null ? "" : hourOf(row.break_end)
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <button className="primary" disabled={readOnly || busy}>
                Salvar jornada
              </button>
            </form>
            <hr />
            <h2>Folgas e bloqueios</h2>
            <form
              key={"block" + nonce}
              onSubmit={form("block", (f) => ({
                professionalId: f.get("professionalId"),
                date: f.get("date"),
                start: f.get("start"),
                endDate: f.get("endDate"),
                end: f.get("end"),
                reason: f.get("reason"),
              }))}
            >
              <div className="form-grid">
                <ProSelect pros={data.professionals} />
                <Field label="Motivo" name="reason" required />
                <Field
                  label="Data inicial"
                  name="date"
                  type="date"
                  value={localDay()}
                  required
                />
                <Field
                  label="Horário inicial"
                  name="start"
                  type="time"
                  value="09:00"
                  required
                />
                <Field
                  label="Data final"
                  name="endDate"
                  type="date"
                  value={localDay()}
                  required
                />
                <Field
                  label="Horário final"
                  name="end"
                  type="time"
                  value="18:00"
                  required
                />
              </div>
              <p className="form-note">
                Um bloqueio não pode sobrepor reservas existentes. Reagende ou
                cancele os atendimentos antes.
              </p>
              <button className="primary" disabled={readOnly || busy}>
                Adicionar bloqueio
              </button>
            </form>
            {data.blocks.map((b) => (
              <div className="ledger-row" key={b.id}>
                <span>
                  <strong>
                    {
                      data.professionals.find((p) => p.id === b.professional_id)
                        ?.name
                    }{" "}
                    · {b.reason}
                  </strong>
                  <small>
                    {new Date(b.starts_at).toLocaleString("pt-BR")} —{" "}
                    {new Date(b.ends_at).toLocaleString("pt-BR")}
                  </small>
                </span>
                <button
                  className="text-button danger"
                  disabled={readOnly || busy}
                  onClick={() => save({ action: "unblock", id: b.id })}
                >
                  Remover bloqueio
                </button>
              </div>
            ))}
          </>
        )}
        {section === "users" && (
          <>
            <h2>Contas e permissões</h2>
            <p className="muted">
              Cada pessoa entra com seu email e senha. O profissional vê seu
              financeiro; a recepção opera agenda e caixa; o dono administra a
              salão.
            </p>
            <div className="settings-split">
              <div className="settings-records">
                <button
                  className="secondary wide"
                  onClick={() => setUserId("")}
                >
                  <Plus size={16} />
                  Nova conta
                </button>
                {data.users.map((u) => (
                  <button
                    key={u.id}
                    className={userId === u.id ? "selected" : ""}
                    onClick={() => setUserId(u.id)}
                  >
                    <UserRound size={21} />
                    <span>
                      <strong>{u.name}</strong>
                      <small>
                        {u.email} · {u.active ? "Ativo" : "Desativado"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
              <form
                key={"user" + userId + nonce}
                onSubmit={form(user ? "user_access" : "user_create", (f) => ({
                  ...(user
                    ? { id: user.id, active: f.get("active") === "on" }
                    : {
                        name: f.get("name"),
                        email: f.get("email"),
                        password: f.get("password"),
                      }),
                  role: f.get("role"),
                  professionalId: String(f.get("professionalId") || "") || null,
                }))}
              >
                <h3>{user ? "Editar acesso" : "Criar conta individual"}</h3>
                {!user && (
                  <>
                    <Field label="Nome" name="name" required />
                    <Field label="Email" name="email" type="email" required />
                    <Field
                      label="Senha inicial (mínimo 10 caracteres)"
                      name="password"
                      type="password"
                      required
                    />
                  </>
                )}
                <label className="field">
                  Perfil
                  <select name="role" defaultValue={user?.role || "barber"}>
                    <option value="owner">Proprietário</option>
                    <option value="receptionist">Recepção</option>
                    <option value="barber">Profissional</option>
                  </select>
                </label>
                <label className="field">
                  Profissional vinculado (obrigatório para profissional)
                  <select
                    name="professionalId"
                    defaultValue={user?.professional_id || ""}
                  >
                    <option value="">Sem vínculo</option>
                    {data.professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                {user && (
                  <label className="check-field">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={user.active}
                    />
                    Conta ativa
                  </label>
                )}
                <button className="primary" disabled={readOnly || busy}>
                  Salvar conta
                </button>
              </form>
            </div>
          </>
        )}
        {section === "whatsapp" && (
          <>
            <h2>Um WhatsApp para o salão</h2>
            <p className="muted">
              Os profissionais solicitam o lembrete. O gestor ou a recepção abre
              a mensagem pronta e envia usando o WhatsApp do salão.
            </p>
            <form
              key={"wa" + nonce}
              onSubmit={form("tenant", (f) => ({
                name: data.tenant.name,
                slug: data.tenant.slug,
                address: data.tenant.address,
                phone: f.get("phone"),
                cancellationMinutes: data.tenant.cancellation_minutes,
                reminderMinutes: num(f, "remind"),
              }))}
            >
              <div className="form-grid">
                <Field
                  label="WhatsApp do salão (com DDD)"
                  name="phone"
                  value={data.tenant.phone}
                />
                <Field
                  label="Mostrar aviso de lembrete (min antes)"
                  name="remind"
                  value={data.tenant.reminder_minutes}
                  type="number"
                  min={15}
                  max={10080}
                />
              </div>
              <p className="form-note">
                Conecte a conta do salão no WhatsApp deste dispositivo. O
                atalho não escolhe o número que envia: ele utiliza a conta
                conectada. O envio depende de um toque em enviar no WhatsApp.
              </p>
              <button className="primary" disabled={readOnly || busy}>
                <Save size={16} />
                Salvar configuração
              </button>
            </form>
            <div className="whatsapp-workflow">
              <p>
                <strong>1. O cliente agenda</strong> e autoriza o contato.
              </p>
              <p>
                <strong>2. O profissional recebe o aviso</strong> e pode solicitar à
                recepção.
              </p>
              <p>
                <strong>3. A equipe envia</strong> pelo número do salão e
                informa o envio na central.
              </p>
            </div>
            <details className="automatic-notifications">
              <summary>Integração automática opcional</summary>
              <span className="pill">
                {data.whatsapp.enabled
                  ? "Envio real habilitado no servidor"
                  : "Modo simulado"}
              </span>
              <p className="muted">
                Confirmação, lembrete, cancelamento e reagendamento usam modelos
                aprovados na Meta. Credenciais ficam somente no servidor.
              </p>
              <div className="integration-note">
                <h3>
                  {data.whatsapp.missing.length
                    ? "Configuração necessária"
                    : "Credenciais preenchidas"}
                </h3>
                <p>
                  Para ativar o envio real, configure o provedor na conta da
                  Meta, aprove os modelos e preencha o arquivo de ambiente do
                  servidor. Nenhuma mensagem é enviada apenas por abrir esta
                  tela.
                </p>
                {data.whatsapp.missing.map((key) => (
                  <code key={key}>{key}</code>
                ))}
              </div>
              <p className="form-note">
                Webhook: /api/webhooks/whatsapp · assinatura HMAC validada ·
                estados desconhecidos exigem conciliação antes de reenviar. Veja
                docs/WHATSAPP.md.
              </p>
            </details>
          </>
        )}
        {section === "tv" && (
          <>
            <h2>Telas da recepção</h2>
            <p className="muted">
              Crie acesso exclusivo à TV, sem liberar agenda administrativa,
              contatos ou financeiro. O link é exibido uma única vez; qualquer
              pessoa com ele pode abrir o painel até a revogação.
            </p>
            <form
              key={"tv" + nonce}
              onSubmit={form("tv_create", (f) => ({
                name: f.get("name"),
                days: num(f, "days"),
              }))}
            >
              <div className="form-grid">
                <Field
                  label="Nome do aparelho"
                  name="name"
                  required
                  value="TV da recepção"
                />
                <Field
                  label="Validade (dias)"
                  name="days"
                  type="number"
                  value={30}
                  min={1}
                  max={90}
                />
              </div>
              <button className="primary" disabled={readOnly || busy}>
                <Monitor size={17} />
                Gerar acesso para TV
              </button>
            </form>
            {tvLink && (
              <div className="integration-note">
                <strong>Link exclusivo gerado</strong>
                <input
                  value={tvLink}
                  readOnly
                  aria-label="Link de pareamento da TV"
                />
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(tvLink);
                      setNotice("Link copiado.");
                    } catch {
                      setError("Selecione e copie o link.");
                    }
                  }}
                >
                  <Copy size={15} />
                  Copiar link
                </button>
                <p>
                  Abra o link no navegador da TV para parear este aparelho. Use
                  a opção de tela cheia para deixar o painel em exibição.
                </p>
              </div>
            )}
            {data.devices.map((d) => (
              <div className="ledger-row" key={d.id}>
                <span>
                  <strong>{d.name}</strong>
                  <small>
                    {d.revoked_at
                      ? "Revogado"
                      : `Expira em ${new Date(d.expires_at).toLocaleDateString("pt-BR")}`}{" "}
                    ·{" "}
                    {d.last_seen
                      ? "Último acesso " +
                        new Date(d.last_seen).toLocaleString("pt-BR")
                      : "Ainda não pareado"}
                  </small>
                </span>
                {!d.revoked_at && (
                  <button
                    className="text-button danger"
                    disabled={readOnly || busy}
                    onClick={() => save({ action: "tv_revoke", id: d.id })}
                  >
                    Revogar acesso
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
