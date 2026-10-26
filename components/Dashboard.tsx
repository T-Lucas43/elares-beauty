"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Scissors,
  LayoutDashboard,
  CalendarDays,
  Users,
  Wallet,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  Link as LinkIcon,
  Check,
  Clock,
  MoreHorizontal,
  LogOut,
  X,
  Menu,
  MessageCircle,
  Receipt,
  ExternalLink,
  Copy,
  Monitor,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { money, localDay, time } from "@/lib/domain";
import type { Data, Appointment } from "./types";
import Booking from "./Booking";
import ClientsPanel from "./ClientsPanel";
import ReportsPanel from "./ReportsPanel";
import Calendar from "./Calendar";
import SettingsPanel from "./SettingsPanel";
import AccountPanel from "./AccountPanel";
import FinancePanel from "./FinancePanel";
import AppointmentPanel from "./AppointmentPanel";
import NotificationsPanel from "./NotificationsPanel";
import InstallAppButton from "./InstallAppButton";
import WalkInForm from "./WalkInForm";
import CutsPanel from "./CutsPanel";
import ProfessionalSettings from "./ProfessionalSettings";
import Brand from "./Brand";
import { beauty } from "@/lib/beauty";
import InAppNotifications from "./InAppNotifications";
const tabs: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "cuts", label: "Atendimentos", icon: Scissors },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "team", label: "Profissionais", icon: Users },
  { id: "services", label: "Serviços", icon: Scissors },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "reports", label: "Relatórios", icon: Receipt },
  { id: "finance", label: "Financeiro", icon: Wallet },
  { id: "messages", label: "Lembretes", icon: MessageCircle },
  { id: "settings", label: "Configurações", icon: Settings },
  { id: "account", label: "Minha conta", icon: Users },
];
const labels: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};
const pageCopy: Record<string, [string, string]> = {
  cuts: [
    "Seus atendimentos, no seu ritmo.",
    "Próximo atendimento, agendamentos e registros avulsos.",
  ],
  overview: [
    "Tudo pronto para um bom dia.",
    "Acompanhe o movimento e cuide do que faz seu negócio crescer.",
  ],
  agenda: ["Sua agenda, organizada.", "Um dia bem planejado começa por aqui."],
  team: [
    "Talento que faz a diferença.",
    "Acompanhe sua equipe e a divisão dos serviços.",
  ],
  services: ["Cuidado em cada detalhe.", "Serviços e preços do seu salão."],
  clients: ["Relações que florescem.", "Conheça o histórico de atendimento dos seus clientes."],
  reports: ["Seu salão em números.", "Relatórios com a identidade Elares Beauty."],
  finance: [
    "Cada valor, no seu lugar.",
    "Recebimentos, participação dos profissionais e despesas com clareza.",
  ],
  messages: [
    "Seu cliente bem informado.",
    "Confirmações, alterações e lembretes de agendamento.",
  ],
  settings: [
    "Do seu jeito.",
    "Personalize o salão, a equipe e as regras do atendimento.",
  ],
  account: ["Seu acesso, protegido.", "Gerencie sua senha individual."],
};
export default function Dashboard() {
  const [data, setData] = useState<Data>();
  const [login, setLogin] = useState(false);
  const [tab, setTab] = useState("overview");
  const [day, setDay] = useState(localDay());
  const [pro, setPro] = useState("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    "booking" | "walk_in" | "expense" | "payout" | null
  >(null);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("Pix");
  const [menu, setMenu] = useState(false);
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [tab]);
  useLayoutEffect(() => {
    if (data?.role === "barber") setTab("cuts");
  }, [data?.role]);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuClose = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuClose.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenu(false);
      }
      if (event.key === "Tab") {
        const items = menuPanel.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled)",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const desktop = matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenu(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      desktop.removeEventListener("change", closeOnDesktop);
      menuTrigger.current?.focus();
    };
  }, [menu]);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/data?day=${day}`);
      if (r.status === 401) {
        setLogin(true);
        return;
      }
      if (!r.ok) throw Error("Não foi possível carregar os dados");
      setData(await r.json());
      setLogin(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [day]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  async function mutate(body: object) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, idempotencyKey: crypto.randomUUID() }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      await load();
      setNotice("Alteração salva com sucesso");
      setModal(null);
      setDetail(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function enter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: f.get("password"),
          email: f.get("email"),
        }),
      });
      if (!r.ok) throw Error("Senha incorreta");
      setError("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function enterDemo(profile: "owner" | "barber") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:
            profile === "barber"
              ? beauty.demo.professional
              : beauty.demo.owner,
          password: beauty.demo.password,
        }),
      });
      if (!r.ok) throw Error("Demonstração indisponível no momento.");
      await load();
      setTab(profile === "barber" ? "cuts" : "overview");
      setMenu(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function shift(n: number) {
    const d = new Date(`${day}T12:00:00`);
    d.setDate(d.getDate() + n);
    setDay(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/agendar/${data?.tenant.slug || "elares-beauty"}`,
      );
      setNotice("Link de agendamento copiado");
    } catch {
      setNotice("Abra a página pública e copie o endereço.");
    }
  };
  if (login)
    return (
      <main className="login-page">
        <div className="login-story">
          <div className="brand">
            <Brand light />
          </div>
          <span className="eyebrow light">MAIS TEMPO PARA O QUE IMPORTA</span>
          <h1>
            Seu talento
            <br />
            transforma.
            <br />
            <em>
              A gente cuida
              <br />
              da gestão.
            </em>
          </h1>
          <p>
            Agenda, equipe e financeiro.
            <br />
            Tudo no ritmo do seu salão.
          </p>
          <span className="login-foot">
            FEITO PARA A ROTINA REAL DO SALÃO
          </span>
        </div>
        <section className="login-box">
          <InstallAppButton />
          <span className="eyebrow">BEM-VINDO AO ELARES BEAUTY</span>
          <h2>Seu dia começa aqui.</h2>
          <p className="muted">Entre com sua conta do salão.</p>
          <form onSubmit={enter}>
            <label className="field">
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="voce@salao.com"
              />
            </label>
            <label className="field">
              Senha
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <button className="primary wide" disabled={busy}>
              {busy ? "Entrando…" : "Entrar no painel"}
              <ArrowRight size={18} />
            </button>
          </form>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
            <>
              <div className="demo-profiles">
                <button
                  type="button"
                  className="demo-profile"
                  disabled={busy}
                  onClick={() => enterDemo("owner")}
                >
                  <Users size={21} />
                  <span>
                    <strong>Gestor e profissional</strong>
                    <small>Gestão do salão e seus próprios atendimentos</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
                <button
                  type="button"
                  className="demo-profile"
                  disabled={busy}
                  onClick={() => enterDemo("barber")}
                >
                  <Scissors size={21} />
                  <span>
                    <strong>Profissional</strong>
                    <small>Atendimentos, agenda e financeiro individuais</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              </div>
              <p className="demo-note">
                Contas compartilhadas para testar com dados fictícios. As senhas
                da demonstração são fixas.
              </p>
            </>
          )}
          <a
            className="inline-link"
            href={"/agendar/" + (data?.tenant.slug || "elares-beauty")}
          >
            Ver página de agendamento
            <ArrowUpRight size={16} />
          </a>
        </section>
      </main>
    );
  if (!data)
    return (
      <main className="loading">
        <Scissors />
        <p>{error || "Preparando suo salão…"}</p>
        {error && <button onClick={load}>Tentar novamente</button>}
      </main>
    );
  const owner = data.role === "owner";
  const appointments = data.appointments.filter(
    (a) =>
      (pro === "all" || a.professional_id === pro) &&
      `${a.customer} ${a.service_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const active = data.appointments.filter(
    (a) => !["cancelled", "no_show"].includes(a.status),
  );
  const completed = data.appointments.filter((a) => a.status === "completed");
  const received = (data.finance?.received || 0) + (data.finance?.tips || 0);
  const earned =
    (data.finance?.commissions || 0) + (data.finance?.tipsReleased || 0);
  const expensesDay = data.expenses.filter(
    (e) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date(e.paid_at)) === day,
  );
  const expenses = expensesDay.reduce((s, e) => s + e.amount, 0);
  const dateText = new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="app-shell">
      {menu && (
        <button
          type="button"
          className="menu-backdrop"
          aria-label="Fechar menu tocando fora"
          onClick={() => setMenu(false)}
          tabIndex={-1}
        />
      )}
      <aside
        ref={menuPanel}
        id="navigation-menu"
        aria-label="Menu principal"
        className={`sidebar ${menu ? "open" : ""}`}
      >
        <button
          ref={menuClose}
          type="button"
          className="mobile-menu-close icon-button"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        >
          <X size={21} />
        </button>
        <a href="/" className="brand">
          <Brand light />
        </a>
        <div className="workspace">
          <span className="workspace-icon">EB</span>
          <div>
            <strong>{data.tenant.name}</strong>
            <small>Ambiente de demonstração</small>
          </div>
        </div>
        <span className="nav-label">ESPAÇO DE TRABALHO</span>
        <nav>
          {tabs
            .filter((t) =>
              data.role === "barber"
                ? [
                    "cuts",
                    "agenda",
                    "finance",
                    "clients",
                    "reports",
                    "messages",
                    "settings",
                  ].includes(t.id)
                : data.role === "receptionist"
                  ? !["cuts", "team", "settings"].includes(t.id)
                  : true,
            )
            .map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "active" : ""}
                onClick={() => {
                  setTab(t.id);
                  setMenu(false);
                }}
              >
                <t.icon size={19} />
                {t.label}
                {t.id === "agenda" && (
                  <span className="count">{active.length}</span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="tiny-label">SUA AGENDA, SEM COMPLICAÇÃO</span>
            <strong>
              Um link.
              <br />
              Novos clientes.
            </strong>
            <button onClick={copy}>
              Copiar meu link
              <ArrowUpRight size={16} />
            </button>
          </div>
          <button
            className="sidebar-logout"
            onClick={async () => {
              await fetch("/api/session", { method: "DELETE" });
              setData(undefined);
              setMenu(false);
              setLogin(true);
            }}
          >
            <LogOut size={17} />
            Sair da conta
          </button>
          <div className="account">
            <span className="avatar small">
              {data.name
                .split(/\s+/)
                .filter((word) => /[A-Za-zÀ-ú]/.test(word))
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </span>
            <div>
              <strong>{data.name}</strong>
              <small>
                {owner
                  ? "Proprietário"
                  : data.role === "receptionist"
                    ? "Recepção"
                    : "Profissional"}
              </small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={menu}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuTrigger}
              className="mobile-menu icon-button"
              aria-label={menu ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menu}
              aria-controls="navigation-menu"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <Brand compact />
            <span>Meu espaço</span>
            <ChevronRight size={14} />
            <strong>{tabs.find((t) => t.id === tab)?.label}</strong>
          </div>
          <div className="topbar-right">
            <InstallAppButton />
            {owner && (
              <a
                href="/tv"
                target="_blank"
                className="tv-launch"
                title="Abrir painel para TV"
              >
                <Monitor size={18} />
                <span>Modo TV</span>
              </a>
            )}
            <span className="local-badge">
              <span />
              {process.env.NEXT_PUBLIC_DEMO_MODE === "true"
                ? "Demonstração"
                : "Seu espaço"}
            </span>
            <InAppNotifications
              data={data}
              activeTab={tab}
              suspended={menu || !!modal || !!detail}
              onOpenAppointment={(id) => setDetail({ id } as Appointment)}
              onOpenReminders={() => setTab("messages")}
              onOpenCuts={() => setTab("cuts")}
            />
            <span className="avatar small">
              {data.name
                .split(/\s+/)
                .filter((word) => /[A-Za-zÀ-ú]/.test(word))
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </span>
          </div>
        </header>
        <main className="content">
          {(data.readOnly || data.isDemo) && (
            <details className="demo-banner demo-notice">
              <summary>Demonstração compartilhada · dados fictícios</summary>
              <p>
                {data.readOnly
                  ? "Esta conta permite somente consulta."
                  : "Você pode testar os lançamentos. Use somente dados fictícios; a demonstração é compartilhada."}
              </p>
            </details>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">{data.tenant.name.toUpperCase()}</span>
              <h1>{pageCopy[tab]?.[0]}</h1>
              <p>{pageCopy[tab]?.[1]}</p>
            </div>
            {["overview", "agenda"].includes(tab) && (
              <div className="page-actions">
                <button
                  className="secondary"
                  aria-label="Registrar atendimento avulso"
                  disabled={data.readOnly}
                  onClick={() => setModal("walk_in")}
                >
                  <Scissors size={17} />
                  Registrar avulso
                </button>
                <button
                  className="primary"
                  disabled={data.readOnly}
                  onClick={() => setModal("booking")}
                >
                  <Plus size={18} />
                  Novo agendamento
                </button>
              </div>
            )}
          </div>
          {["overview", "agenda", "team"].includes(tab) && (
            <div className="toolbar">
              <div className="date-control">
                <button aria-label="Dia anterior" onClick={() => shift(-1)}>
                  <ChevronLeft size={17} />
                </button>
                <CalendarDays size={17} />
                <input
                  aria-label="Data selecionada"
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
                <button aria-label="Próximo dia" onClick={() => shift(1)}>
                  <ChevronRight size={17} />
                </button>
              </div>
              <span className="date-label">{dateText}</span>
              <button
                className="text-button today"
                onClick={() => setDay(localDay())}
              >
                Hoje
              </button>
              <button className="secondary share" onClick={copy}>
                <LinkIcon size={16} />
                Link de agendamento
              </button>
            </div>
          )}
          {tab === "overview" && data.role !== "receptionist" && (
            <div className="stats">
              <Stat
                label={
                  owner ? "Recebimentos do dia" : "Meus serviços concluídos"
                }
                value={money(received)}
                note={`${completed.length} atendimentos concluídos`}
                icon={Wallet}
              />
              <Stat
                label="Agendamentos"
                value={String(active.length).padStart(2, "0")}
                note={`${active.filter((a) => a.status === "confirmed").length} confirmados · ${completed.length} concluídos`}
                icon={CalendarDays}
              />
              <Stat
                label={
                  owner
                    ? "Parte dos profissionais no dia"
                    : "Minha parte dos serviços"
                }
                value={money(earned)}
                note="Disponíveis conforme os pagamentos recebidos"
                icon={Scissors}
              />
              <Stat
                label={owner ? "Resultado do dia" : "Ticket médio"}
                value={money(
                  owner
                    ? data.finance?.result || 0
                    : completed.length
                      ? Math.round(received / completed.length)
                      : 0,
                )}
                note={
                  owner
                    ? "Recebido − participações − despesas − taxas"
                    : "Valor médio por atendimento"
                }
                icon={ArrowUpRight}
                accent
              />
            </div>
          )}
          {(tab === "overview" || tab === "agenda") && (
            <div className={tab === "overview" ? "dashboard-grid" : ""}>
              <section className="panel agenda-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      {tab === "agenda"
                        ? "Agenda de atendimentos"
                        : "Agenda do dia"}{" "}
                      <span className="soft-count">{active.length}</span>
                    </h2>
                    <p>Seu próximo atendimento está aqui.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setTab("agenda");
                      setPro("all");
                    }}
                  >
                    Ver agenda
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="agenda-filters">
                  <div className="chips">
                    <button
                      className={pro === "all" ? "selected" : ""}
                      onClick={() => setPro("all")}
                    >
                      Todos
                    </button>
                    {data.professionals.map((p) => (
                      <button
                        className={pro === p.id ? "selected" : ""}
                        key={p.id}
                        onClick={() => setPro(p.id)}
                      >
                        <i style={{ background: p.color }} />
                        {p.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                  <label className="search">
                    <Search size={16} />
                    <input
                      aria-label="Buscar cliente"
                      placeholder="Buscar cliente"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                </div>
                {tab === "agenda" ? (
                  <Calendar
                    day={day}
                    professionals={data.professionals}
                    professional={pro}
                    query={query}
                    revision={data.appointments}
                    onDay={setDay}
                    onSelect={(a) => {
                      setDetail(a);
                      setMethod("Pix");
                    }}
                  />
                ) : (
                  <div className="appointment-table">
                    <div className="table-head">
                      <span>HORÁRIO / CLIENTE</span>
                      <span>SERVIÇO</span>
                      <span>PROFISSIONAL</span>
                      <span>STATUS</span>
                      <span>VALOR</span>
                    </div>
                    {appointments.map((a) => (
                      <button
                        className="appointment-row"
                        key={a.id}
                        onClick={() => {
                          setDetail(a);
                          setMethod("Pix");
                        }}
                      >
                        <div className="customer-cell">
                          <strong className="time">{time(a.starts_at)}</strong>
                          <div>
                            <strong>{a.customer}</strong>
                            <small>Até {time(a.ends_at)}</small>
                          </div>
                        </div>
                        <span className="service-cell">
                          {a.service_name}
                          {a.source === "walk_in" && (
                            <small className="walk-in-badge">Avulso</small>
                          )}
                        </span>
                        <span className="professional-cell">
                          <i style={{ background: a.color }} />
                          {a.professional_name.split(" ")[0]}
                        </span>
                        <span className={`status ${a.status}`}>
                          <i />
                          {labels[a.status]}
                        </span>
                        <strong className="price-cell">{money(a.price)}</strong>
                      </button>
                    ))}
                    {!appointments.length && (
                      <div className="empty">
                        <CalendarDays size={28} />
                        <h3>Espaço para novos encontros.</h3>
                        <p>Nenhum atendimento encontrado neste dia.</p>
                        <button
                          className="secondary"
                          onClick={() => setModal("booking")}
                        >
                          Agendar atendimento
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="panel-footer">
                  <span>
                    <span className="online-dot" />
                    Horários e atendimentos do dia
                  </span>
                  <small>{appointments.length} atendimentos</small>
                </div>
              </section>
              {tab === "overview" && (
                <aside className="right-column">
                  <section className="link-card">
                    <div className="link-card-icon">
                      <LinkIcon size={23} />
                    </div>
                    <span className="eyebrow light">AGENDA SEM FRONTEIRAS</span>
                    <h2>
                      Seu próximo cliente
                      <br />
                      está a um link.
                    </h2>
                    <p>
                      Compartilhe sua página e receba agendamentos de um jeito
                      simples.
                    </p>
                    <div className="link-preview">
                      /agendar/{data.tenant.slug}
                      <button aria-label="Copiar link" onClick={copy}>
                        <Copy size={15} />
                      </button>
                    </div>
                    <a
                      href={
                        "/agendar/" + (data?.tenant.slug || "elares-beauty")
                      }
                      target="_blank"
                      className="light-button"
                    >
                      Ver minha página
                      <ArrowUpRight size={17} />
                    </a>
                  </section>
                  <section className="panel team-summary">
                    <div className="panel-heading">
                      <h2>{owner ? "Seu time hoje" : "Meu movimento"}</h2>
                      <Users size={18} />
                    </div>
                    {data.professionals.map((p) => {
                      const rows = completed.filter(
                        (a) => a.professional_id === p.id,
                      );
                      return (
                        <div className="team-summary-row" key={p.id}>
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
                          <div>
                            <strong>{p.name.split(" ")[0]}</strong>
                            <small>
                              {rows.length} atendimento
                              {rows.length !== 1 ? "s" : ""} concluído
                              {rows.length !== 1 ? "s" : ""}
                            </small>
                          </div>
                          <b>{money(rows.reduce((s, a) => s + a.paid, 0))}</b>
                        </div>
                      );
                    })}
                    <button
                      className="text-button wide"
                      onClick={() => setTab("team")}
                    >
                      Ver profissionais
                      <ArrowRight size={15} />
                    </button>
                  </section>
                </aside>
              )}
            </div>
          )}
          {tab === "clients" && <ClientsPanel />}
          {tab === "reports" && <ReportsPanel />}
          {tab === "services" && (
            <div className="service-grid">
              {data.services.map((s, i) => (
                <section className="panel service-card" key={s.id}>
                  <span className="service-number">0{i + 1}</span>
                  <Scissors size={30} strokeWidth={1.4} />
                  <h2>{s.name}</h2>
                  <p>{s.description}</p>
                  <div>
                    <span>
                      <Clock size={15} />
                      {s.duration} min
                    </span>
                    <strong>{money(s.price)}</strong>
                  </div>
                  <button
                    className="secondary wide"
                    onClick={() => setModal("booking")}
                  >
                    Agendar serviço
                    <ArrowUpRight size={16} />
                  </button>
                </section>
              ))}
            </div>
          )}
          {tab === "team" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {owner ? "Participações e repasses" : "Meu financeiro"}
                  </h2>
                  <p>
                    Saldo acumulado de todos os períodos · valores recebidos
                    proporcionalmente aos pagamentos. Comissões fixas e gorjetas
                    constam no financeiro.
                  </p>
                </div>
                {owner && (
                  <button
                    className="secondary"
                    onClick={() => setModal("payout")}
                  >
                    <Plus size={16} />
                    Registrar repasse
                  </button>
                )}
              </div>
              <div className="professional-grid">
                {data.professionals.map((p) => {
                  const total =
                    data.totals.find((t) => t.professional_id === p.id)
                      ?.earned || 0;
                  const paid = data.payouts
                    .filter((x) => x.professional_id === p.id)
                    .reduce((s, x) => s + x.amount, 0);
                  return (
                    <article className="professional-card" key={p.id}>
                      <div className="professional-top">
                        <span
                          className="avatar big"
                          style={{ background: p.color }}
                        >
                          {p.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span className="pill">
                          {p.commission_kind === "fixed"
                            ? money(p.commission_fixed || 0) + " por serviço"
                            : (p.commission_bps || 0) / 100 +
                              "% para o profissional"}
                        </span>
                      </div>
                      <h3>{p.name}</h3>
                      <p className="muted">{p.specialty}</p>
                      <dl>
                        <div>
                          <dt>Comissões geradas</dt>
                          <dd>{money(total)}</dd>
                        </div>
                        <div>
                          <dt>Repasses registrados</dt>
                          <dd>{money(paid)}</dd>
                        </div>
                        <div className="balance">
                          <dt>A receber</dt>
                          <dd>
                            {money(
                              data.totals.find(
                                (t) => t.professional_id === p.id,
                              )?.available || 0,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {tab === "cuts" && (
            <CutsPanel
              data={data}
              onSelect={setDetail}
              onWalkIn={() => setModal("walk_in")}
              onBooking={() => setModal("booking")}
              onReminders={() => setTab("messages")}
            />
          )}
          {tab === "finance" && (
            <FinancePanel
              readOnly={data.readOnly}
              professionals={data.professionals}
              role={data.role}
              onChanged={load}
              onAppointment={(id) => setDetail({ id } as Appointment)}
            />
          )}
          {tab === "settings" && owner && (
            <SettingsPanel
              onChanged={load}
              readOnly={data.readOnly}
              demo={data.isDemo}
            />
          )}
          {tab === "settings" && data.role === "barber" && (
            <ProfessionalSettings data={data} onChanged={load} />
          )}
          {tab === "account" && (
            <AccountPanel
              name={data.name}
              readOnly={data.readOnly || data.isDemo}
            />
          )}
          {tab === "messages" && (
            <NotificationsPanel
              data={data}
              onChanged={load}
              readOnly={data.readOnly}
            />
          )}
          <footer className="app-footer">
            <span>
              <strong>Elares Beauty</strong>{" "}
              <small>Seu talento. Nossa tecnologia.</small>
            </span>
            <small>
              {process.env.NEXT_PUBLIC_DEMO_MODE === "true"
                ? "Demonstração"
                : "Elares Beauty"}{" "}
              ·{" "}
              {data.whatsappEnabled
                ? "WhatsApp habilitado"
                : "WhatsApp com envio manual"}
            </small>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav">
        {tabs
          .filter((t) =>
            (data.role === "barber"
              ? ["cuts", "agenda", "finance", "messages", "settings"]
              : data.role === "receptionist"
                ? ["overview", "agenda", "messages", "finance", "account"]
                : ["overview", "cuts", "agenda", "messages", "finance"]
            ).includes(t.id),
          )
          .map((t) => (
            <button
              className={tab === t.id ? "active" : ""}
              key={t.id}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={21} />
              <small>{t.label}</small>
            </button>
          ))}
      </nav>
      {notice && (
        <div role="status" className="toast">
          <Check size={18} />
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="error floating-error">
          {error}
          <button
            className="icon-button"
            aria-label="Fechar erro"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {(modal || detail) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) {
              setModal(null);
              setDetail(null);
            }
          }}
        >
          <section
            className={`modal ${modal === "booking" ? "booking-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              detail
                ? "Detalhes do atendimento"
                : modal === "booking"
                  ? "Novo agendamento"
                  : modal === "walk_in"
                    ? "Registrar atendimento avulso"
                    : modal === "expense"
                      ? "Nova despesa"
                      : "Registrar repasse"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Fechar"
              disabled={busy}
              onClick={() => {
                setModal(null);
                setDetail(null);
              }}
            >
              <X size={21} />
            </button>
            {modal === "booking" ? (
              <Booking
                internal
                slug={data.tenant.slug}
                fixedProfessional={
                  data.role === "barber"
                    ? data.professionalId || undefined
                    : undefined
                }
                onDone={() => {
                  setModal(null);
                  void load();
                  setNotice("Agendamento criado");
                }}
              />
            ) : modal === "walk_in" ? (
              <WalkInForm
                professionals={data.professionals}
                professionalId={data.professionalId}
                role={data.role}
                onBusyChange={setBusy}
                onDone={() => {
                  setModal(null);
                  if (day === localDay()) void load();
                  else setDay(localDay());
                  setTab(data.role === "barber" ? "cuts" : "agenda");
                  setNotice("Atendimento avulso registrado.");
                }}
              />
            ) : detail ? (
              <AppointmentPanel
                readOnly={data.readOnly}
                id={detail.id}
                role={data.role}
                onChanged={load}
              />
            ) : (
              <>
                <span className="eyebrow">FINANCEIRO</span>
                <h2>
                  {modal === "expense"
                    ? "Registrar despesa"
                    : "Registrar repasse"}
                </h2>
                <p className="muted">Confira os dados antes de salvar.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void mutate(
                      modal === "expense"
                        ? {
                            action: "expense",
                            description: f.get("description"),
                            amount: Math.round(Number(f.get("amount")) * 100),
                          }
                        : {
                            action: "payout",
                            professionalId: f.get("professionalId"),
                            amount: Math.round(Number(f.get("amount")) * 100),
                          },
                    );
                  }}
                >
                  {modal === "expense" ? (
                    <label className="field">
                      Descrição
                      <input
                        name="description"
                        required
                        minLength={2}
                        placeholder="Ex.: produtos de limpeza"
                      />
                    </label>
                  ) : (
                    <label className="field">
                      Profissional
                      <select name="professionalId">
                        {data.professionals.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="field">
                    Valor em reais
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0,00"
                    />
                  </label>
                  <button disabled={busy} className="primary wide">
                    {busy ? "Salvando…" : "Salvar lançamento"}
                    <Check size={17} />
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <section className={`stat-card ${accent ? "accent" : ""}`}>
      <div>
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}
