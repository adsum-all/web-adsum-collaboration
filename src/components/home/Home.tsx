import { useEffect, useState } from "react";

import { createEspace, peutEcrireCollaboration, statsGlobales } from "../../lib/store.js";
import type { Espace, TypeEspace } from "../../lib/types.js";
import { EmptyState } from "../common/EmptyState.js";


interface HomeProps {
  espaces: Espace[];
  onOuvrir: (id: string) => void;
  onCree: () => void;
  currentNom: string;
}

const TYPES: [TypeEspace, string, string][] = [
  ["coordination", "Coordination", "#2a4fad"],
  ["intendance", "Intendance", "#1f8a5b"],
  ["commission", "Commission", "#7a4fbf"],
  ["direction", "Direction", "#1d3470"],
  ["autre", "Autre", "#5b6b8a"],
];

export function Home({ espaces, onOuvrir, onCree, currentNom }: HomeProps): JSX.Element {
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TypeEspace>("coordination");
  const [couleur, setCouleur] = useState("#2a4fad");
  const [stats, setStats] = useState<{ espaces: number; tableaux: number; cartes: number; enRetard: number; termineesSemaine: number } | null>(null);
  // Creating a space writes on the server (POST /collaboration/espaces requires
  // collaboration.gerer), so a supervise-only account must not see the button.
  const peutCreerEspace = peutEcrireCollaboration();

  useEffect(() => { void statsGlobales().then(setStats).catch(() => undefined); }, [espaces]);


  async function creer(): Promise<void> {
    if (!nom.trim()) return;
    const e = await createEspace({ nom: nom.trim(), description: description.trim(), type, couleur });
    setNom("");
    setDescription("");
    setCreation(false);
    onCree();
    onOuvrir(e.id);
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Bonjour, {currentNom}</h1>
          <p className="muted">Vos espaces de collaboration, vos échéances et l'activité récente.</p>
        </div>
        {!creation && peutCreerEspace && (
          <button type="button" className="btn btn-primary" onClick={() => setCreation(true)}>
            + Créer un espace
          </button>
        )}
      </header>

      {stats && (
        <section className="stat-grid">
          <div className="stat-tile"><span className="stat-val">{stats.espaces}</span><span className="muted small">Espaces</span></div>
          <div className="stat-tile"><span className="stat-val">{stats.tableaux}</span><span className="muted small">Tableaux</span></div>
          <div className="stat-tile"><span className="stat-val">{stats.cartes}</span><span className="muted small">Cartes actives</span></div>
          <div className="stat-tile stat-tile-alert"><span className="stat-val">{stats.enRetard}</span><span className="muted small">En retard</span></div>
          <div className="stat-tile"><span className="stat-val">{stats.termineesSemaine}</span><span className="muted small">Terminées / 7 j</span></div>
        </section>
      )}



      {creation && peutCreerEspace && (
        <section className="card">
          <h2 className="card-title">Nouvel espace de travail</h2>
          <div className="form-grid">
            <label>
              <span>Nom</span>
              <input value={nom} autoFocus onChange={(e) => setNom(e.target.value)} placeholder="Ex. Commission liturgie" />
            </label>
            <label>
              <span>Description</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Vocation de l'espace" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              <span>Type</span>
              <select
                value={type}
                onChange={(e) => {
                  const t = e.target.value as TypeEspace;
                  setType(t);
                  const preset = TYPES.find((x) => x[0] === t);
                  if (preset) setCouleur(preset[2]);
                }}
              >
                {TYPES.map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Couleur</span>
              <input type="color" value={couleur} onChange={(e) => setCouleur(e.target.value)} />
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" disabled={!nom.trim()} onClick={() => void creer()}>
              Créer l'espace
            </button>
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => setCreation(false)}>
              Annuler
            </button>
          </div>
        </section>
      )}

      {espaces.length === 0 && !creation ? (
        <EmptyState
          titre="Aucun espace pour le moment"
          description="Créez votre premier espace de travail ou attendez d'être invité par un administrateur."
        />
      ) : (
        <section className="card">
          <h2 className="card-title">Mes espaces</h2>
          <div className="board-grid">
            {espaces.map((e) => (
              <button key={e.id} type="button" className="board-tile" onClick={() => onOuvrir(e.id)}>
                <span className="board-tile-name">
                  <span className="espace-avatar espace-avatar-sm" style={{ background: e.couleur }} aria-hidden="true">
                    {e.initiale}
                  </span>
                  {e.nom}
                </span>
                <span className="board-tile-desc">{e.description}</span>
                <span className="board-tile-meta">{e.membres.length} membre(s)</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
