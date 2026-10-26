"use client";
import { useState } from "react";
import { localDay } from "@/lib/domain";
import { addDays } from "@/lib/calendar";
export default function ReportsPanel() {
  const [start, setStart] = useState(localDay()),
    [end, setEnd] = useState(localDay());
  const valid = !!start && !!end && start <= end;
  const url =
    "/api/finance?start=" + start + "&end=" + (valid ? addDays(end, 1) : end);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Relatórios do Beauty</h2>
        <span className="pill">PDF e CSV</span>
      </div>
      <p className="muted">
        Recebimentos, despesas e participações por período. O acesso do
        profissional inclui somente seus próprios dados.
      </p>
      <div className="report-filters">
        <label className="field">
          Início
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="field">
          Fim
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {valid ? (
        <div className="cut-focus-actions">
          <a className="primary" href={url + "&export=pdf"}>
            Baixar PDF estilizado
          </a>
          <a className="secondary" href={url + "&export=csv"}>
            Baixar CSV
          </a>
        </div>
      ) : (
        <p role="alert" className="error">
          Informe um período válido.
        </p>
      )}
    </section>
  );
}
