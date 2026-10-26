"use client";
import { useEffect, useState } from "react";
import { Save, Check } from "lucide-react";
import { money } from "@/lib/domain";
import AccountPanel from "./AccountPanel";
import type { Data } from "./types";
type Profile = {
  professional: {
    id: string;
    name: string;
    specialty: string;
    color: string;
    commission_kind: string;
    commission_bps: number;
    commission_fixed: number;
  };
  schedules: {
    weekday: number;
    enabled: boolean;
    start_minute: number;
    end_minute: number;
  }[];
};
const weekdays = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const hour = (v: number) =>
  `${Math.floor(v / 60)
    .toString()
    .padStart(2, "0")}:${(v % 60).toString().padStart(2, "0")}`;
export default function ProfessionalSettings({
  data,
  onChanged,
}: {
  data: Data;
  onChanged: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Profile>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch("/api/my-profile");
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setProfile(d);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  const p = profile?.professional;
  return (
    <div className="own-settings">
      <section className="panel own-profile">
        <h2>Meu perfil profissional</h2>
        <p className="muted">
          Seu nome, sua especialidade e a identificação na agenda.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="success-note">
            <Check size={16} />
            {notice}
          </p>
        )}
        {p && (
          <form
            key={p.id}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setNotice("");
              const f = new FormData(e.currentTarget);
              try {
                const r = await fetch("/api/my-profile", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: f.get("name"),
                    specialty: f.get("specialty"),
                    color: f.get("color"),
                  }),
                });
                const d = await r.json();
                if (!r.ok) throw Error(d.error);
                await load();
                await onChanged();
                setNotice("Perfil atualizado.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Nome na agenda
              <input
                name="name"
                defaultValue={p.name}
                minLength={2}
                maxLength={80}
                required
              />
            </label>
            <label className="field">
              Especialidade
              <input
                name="specialty"
                defaultValue={p.specialty}
                maxLength={160}
              />
            </label>
            <label className="field">
              Cor na agenda
              <input name="color" type="color" defaultValue={p.color} />
            </label>
            <button className="primary" disabled={busy || data.readOnly}>
              <Save size={16} />
              {busy ? "Salvando…" : "Salvar meu perfil"}
            </button>
          </form>
        )}
      </section>
      {p && (
        <section className="panel own-profile">
          <h2>Minha divisão e jornada</h2>
          <p className="own-share">
            {p.commission_kind === "fixed"
              ? `${money(p.commission_fixed)} por serviço`
              : `${p.commission_bps / 100}% para você · ${(10000 - p.commission_bps) / 100}% para o salão`}
          </p>
          <p className="muted">
            Regras específicas por serviço podem se aplicar. A divisão e a
            jornada são definidas pela gestão.
          </p>
          <div className="own-schedule">
            {profile?.schedules.map((s) => (
              <div key={s.weekday}>
                <strong>{weekdays[s.weekday]}</strong>
                <span>
                  {s.enabled
                    ? `${hour(s.start_minute)}–${hour(s.end_minute)}`
                    : "Folga"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      <AccountPanel name={data.name} readOnly={data.readOnly || data.isDemo} />
    </div>
  );
}
