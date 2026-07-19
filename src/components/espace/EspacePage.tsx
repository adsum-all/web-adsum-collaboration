import { useEffect, useState } from "react";

import { createEspace, listMembres, peutEcrireCollaboration } from "../../lib/store.js";
import { libelleRole, peut, roleDansEspace } from "../../lib/permissions.js";
import type { Espace, Membre, RoleEspace } from "../../lib/types.js";
import { EmptyState } from "../common/EmptyState.js";
import { CalendrierPage } from "../calendrier/CalendrierPage.js";
import { DashboardEspace } from "./DashboardEspace.js";
import { TabMembres } from "./TabMembres.js";
import { TabReglages } from "./TabReglages.js";
import { TabTableaux } from "./TabTableaux.js";

type Onglet = "tableaux" | "calendrier" | "dashboard" | "membres" | "reglages";

interface EspacePageProps {
  espace: Espace;
  parent?: Espace | null;
  moiId: string;
  onChanged: () => void;
  onOuvrirEspace: (id: string) => void;
  onOuvrirTableau: (id: string) => void;
  onOuvrirCarte?: (espaceId: string, tableauId: string, carteId: string) => void;
}

export function EspacePage({ espace, parent, moiId, onChanged, onOuvrirEspace, onOuvrirTableau, onOuvrirCarte }: EspacePageProps): JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>("tableaux");
  const [membres, setMembres] = useState<Membre[]>([]);
  const [viewAs, setViewAs] = useState<RoleEspace | null>(null);
  const [creerSous, setCreerSous] = useState(false);
  const [nomSous, setNomSous] = useState("");
  const [busySous, setBusySous] = useState(false);
  const [errSous, setErrSous] = useState<string | null>(null);

  useEffect(() => {
    void listMembres().then(setMembres).catch(() => undefined);
  }, []);

  const roleReel = roleDansEspace(espace, moiId);
  const estGerant = roleReel === "proprietaire" || roleReel === "admin";
  // Creating a sub-space is a server write (POST /collaboration/espaces requires
  // collaboration.gerer): the space role alone is not enough, add the platform grant.
  const peutCreerSous = estGerant && peutEcrireCollaboration();
  const estTopLevel = !espace.parent_id;

  async function creerSousEspace(): Promise<void> {
    if (!nomSous.trim()) return;
    setBusySous(true);
    setErrSous(null);
    try {
      const sous = await createEspace({ nom: nomSous.trim(), description: "", type: espace.type, couleur: espace.couleur, parent_id: espace.id });
      setNomSous("");
      setCreerSous(false);
      onChanged();
      onOuvrirEspace(sous.id);
    } catch (e) {
      setErrSous(e instanceof Error ? e.message : "Création impossible");
    } finally {
      setBusySous(false);
    }
  }
  const roleEffectif: RoleEspace | null = viewAs ?? roleReel;

  if (!peut(espace, roleReel, "voir")) {
    return (
      <div className="page">
        <EmptyState
          titre="Accès refusé"
          description="Vous n'êtes pas membre de cet espace. Demandez un lien d'invitation à un administrateur."
        />
      </div>
    );
  }

  return (
    <div className="page page-wide">
      {/* Breadcrumb: a sub-space is a full page, so it must say where you are.
          "Espace général > Sous-espace", the parent being clickable to go up. */}
      {espace.parent_id && (
        <nav className="collab-fil" aria-label="Fil d'ariane" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", margin: "0 0 6px", fontSize: 13 }}>
          <button type="button" className="link" onClick={() => espace.parent_id && onOuvrirEspace(espace.parent_id)}>
            {parent ? parent.nom : "Espace parent"}
          </button>
          <span className="muted" aria-hidden="true">›</span>
          <span className="muted">Sous-espace</span>
          <span style={{ fontWeight: 600 }}>{espace.nom}</span>
        </nav>
      )}

      <header className="page-head">
        <div className="espace-head">
          <span className="espace-avatar" style={{ background: espace.couleur }} aria-hidden="true">
            {espace.initiale}
          </span>
          <div>
            <h1>{espace.nom}</h1>
            <p className="muted">
              {espace.parent_id && parent && (
                <span className="badge badge-mut" style={{ marginRight: 10 }}>
                  Sous-espace de {parent.nom}
                </span>
              )}
              {espace.description}
              <span className="badge badge-mut" style={{ marginLeft: 10 }}>
                {libelleRole(roleEffectif ?? roleReel!)}
                {viewAs && " (simulé)"}
              </span>
            </p>
          </div>
        </div>
      </header>

      {estTopLevel && (
        <section className="collab-sousespaces" style={{ margin: "4px 0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <h2 className="card-title" style={{ margin: 0, fontSize: 15 }}>Sous-espaces</h2>
            {peutCreerSous && !creerSous && (
              <button type="button" className="btn btn-ghost btn-inline" onClick={() => setCreerSous(true)}>+ Nouveau sous-espace</button>
            )}
          </div>
          <p className="muted small" style={{ margin: "0 0 10px" }}>
            Un sous-espace est un espace complet (tableaux, calendrier, membres, réglages), inclus dans celui-ci. Cliquez pour y entrer.
          </p>

          {peutCreerSous && creerSous && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <input
                autoFocus
                value={nomSous}
                placeholder="Nom du sous-espace"
                onChange={(e) => setNomSous(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void creerSousEspace(); if (e.key === "Escape") { setCreerSous(false); setNomSous(""); } }}
                style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--collab-line, #e2e6ef)", fontSize: 13, minWidth: 220 }}
              />
              <button type="button" className="btn btn-primary btn-inline" disabled={busySous || !nomSous.trim()} onClick={() => void creerSousEspace()}>
                {busySous ? "…" : "Créer"}
              </button>
              <button type="button" className="btn btn-ghost btn-inline" disabled={busySous} onClick={() => { setCreerSous(false); setNomSous(""); setErrSous(null); }}>Annuler</button>
              {errSous && <span style={{ fontSize: 12, color: "#c0392b" }}>{errSous}</span>}
            </div>
          )}

          {espace.sous_espaces.filter((s) => !s.archive).length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>Aucun sous-espace pour le moment.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {espace.sous_espaces.filter((s) => !s.archive).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOuvrirEspace(s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer",
                    padding: "12px 14px", borderRadius: 12, border: "1px solid var(--collab-line, #e2e6ef)",
                    background: "var(--collab-card, #fff)",
                  }}
                >
                  <span className="espace-avatar" aria-hidden="true"
                    style={{ background: s.couleur, width: 34, height: 34, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                    {s.initiale}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nom}</span>
                    <span className="muted small">Ouvrir l'espace →</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="tabs" role="tablist">
        {(
          [
            ["tableaux", "Tableaux"],
            ["calendrier", "Calendrier"],
            ["dashboard", "Tableau de bord"],
            ["membres", "Membres"],
            ["reglages", "Réglages"],
          ] as [Onglet, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={onglet === k}
            type="button"
            className={`tab${onglet === k ? " tab-active" : ""}`}
            onClick={() => setOnglet(k)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tab-panel">
        {onglet === "tableaux" && <TabTableaux espace={espace} moiId={moiId} onOuvrir={onOuvrirTableau} />}
        {onglet === "calendrier" && (
          <CalendrierPage scopeEspaceId={espace.id} onOuvrirCarte={onOuvrirCarte} />
        )}
        {onglet === "dashboard" && <DashboardEspace espaceId={espace.id} />}
        {onglet === "membres" && (
          <TabMembres
            espace={espace}
            membres={membres}
            moiId={moiId}
            onChanged={onChanged}
          />
        )}
        {onglet === "reglages" && (
          <TabReglages
            espace={espace}
            roleReel={roleReel}
            viewAs={viewAs}
            onViewAs={setViewAs}
            onChanged={onChanged}
          />
        )}
      </div>
    </div>
  );
}

