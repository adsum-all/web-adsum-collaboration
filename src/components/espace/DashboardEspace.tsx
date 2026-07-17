import { useEffect, useState } from "react";

import { statsEspace } from "../../lib/store.js";
import type { Priorite } from "../../lib/types.js";

interface Stats {
  tableaux: number;
  cartes: number;
  parPriorite: Record<Priorite, number>;
  parEtiquette: Array<{ id: string; nom: string; couleur: string; count: number }>;
  parAssigne: Array<{ id: string; nom: string; count: number }>;
}

interface Props { espaceId: string; }

export function DashboardEspace({ espaceId }: Props): JSX.Element {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setS(null);
    setErr(null);
    statsEspace(espaceId)
      .then(setS)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Statistiques indisponibles"));
  }, [espaceId]);
  if (err) return <p className="muted" style={{ color: "var(--danger, #c0392b)" }}>{err}</p>;
  if (!s) return <p className="muted">Chargement…</p>;

  const total = s.cartes || 1;
  const prios: Priorite[] = ["urgente", "haute", "normale", "basse"];

  return (
    <div className="dashboard">
      <div className="stat-grid">
        <div className="stat-tile"><span className="stat-val">{s.tableaux}</span><span className="muted small">Tableaux actifs</span></div>
        <div className="stat-tile"><span className="stat-val">{s.cartes}</span><span className="muted small">Cartes actives</span></div>
        <div className="stat-tile"><span className="stat-val">{s.parPriorite.urgente + s.parPriorite.haute}</span><span className="muted small">Prioritaires</span></div>
      </div>

      <section className="section">
        <h3>Répartition par priorité</h3>
        <ul className="repart">
          {prios.map((p) => (
            <li key={p}>
              <span className="repart-lbl">{p}</span>
              <div className="repart-bar"><span className={`repart-fill repart-${p}`} style={{ width: `${(s.parPriorite[p] / total) * 100}%` }} /></div>
              <span className="repart-val">{s.parPriorite[p]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h3>Répartition par étiquette</h3>
        <ul className="repart">
          {s.parEtiquette.map((e) => (
            <li key={e.id}>
              <span className="repart-lbl"><span className="et-dot" style={{ background: e.couleur }} aria-hidden="true" />{e.nom}</span>
              <div className="repart-bar"><span className="repart-fill" style={{ width: `${(e.count / total) * 100}%`, background: e.couleur }} /></div>
              <span className="repart-val">{e.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h3>Charge par membre</h3>
        <ul className="repart">
          {s.parAssigne.map((m) => (
            <li key={m.id}>
              <span className="repart-lbl">{m.nom}</span>
              <div className="repart-bar"><span className="repart-fill repart-haute" style={{ width: `${(m.count / total) * 100}%` }} /></div>
              <span className="repart-val">{m.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
