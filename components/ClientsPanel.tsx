"use client";
import { useEffect, useState } from "react";
type Client = {
  name: string;
  phone: string;
  visits: number;
  last_visit: string;
};
export default function ClientsPanel() {
  const [clients, setClients] = useState<Client[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/clients")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (active) setClients(d.clients);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="panel clients-panel">
      <div className="panel-heading">
        <h2>Clientes do salão</h2>
        <span className="pill">Histórico de atendimentos</span>
      </div>
      <label className="field">
        Buscar por nome ou telefone
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente"
        />
      </label>
      <p className="muted">
        Clientes identificados pelos atendimentos. Cada profissional consulta
        apenas seu próprio histórico.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="client-list">
        {clients
          .filter((c) =>
            (c.name + " " + c.phone)
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()),
          )
          .map((c) => (
            <article className="client-card" key={c.name + c.phone}>
              <strong>{c.name}</strong>
              <span>{c.phone}</span>
              <small>
                {c.visits} atendimento(s) · Último registro:{" "}
                {new Date(c.last_visit).toLocaleDateString("pt-BR")}
              </small>
            </article>
          ))}
      </div>
      {!clients.length && !error && (
        <p className="muted">Nenhum cliente com atendimento registrado.</p>
      )}
    </section>
  );
}
