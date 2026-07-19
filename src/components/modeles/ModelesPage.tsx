import { useEffect, useMemo, useState } from "react";

import {
  createModelePerso,
  deleteModelePerso,
  listModelesCatalogue,
  listModelesPerso,
  updateModelePerso,
  type ModeleCatalogue,
  type ModeleColonne,
  type ModelePerso,
} from "../../lib/store.js";
import { roleDansEspace } from "../../lib/permissions.js";
import type { Espace } from "../../lib/types.js";
import { EmptyState } from "../common/EmptyState.js";
import { ColonnesEditor } from "./ColonnesEditor.js";

interface Props {
  espaces: Espace[];
  moiId: string;
}

interface Draft {
  id: string | null;
  nom: string;
  description: string;
  visibilite: "espace" | "prive";
  colonnes: ModeleColonne[];
}

// Roles that may create/manage a workspace template server-side (require_espace_role).
const ROLES_REDACTEURS = new Set(["proprietaire", "admin", "membre"]);

function brouillonVierge(): Draft {
  return {
    id: null,
    nom: "",
    description: "",
    visibilite: "espace",
    colonnes: [
      { nom: "À faire", couleur: "#94a3b8", wip: null },
      { nom: "En cours", couleur: "#3b82f6", wip: null },
      { nom: "Terminé", couleur: "#22c55e", wip: null },
    ],
  };
}

export function ModelesPage({ espaces, moiId }: Readonly<Props>): JSX.Element {
  // A team may only build templates in a workspace where it is an active member; the
  // server enforces the same rule, this only keeps the picker honest.
  const eligibles = useMemo(
    () => espaces.filter((e) => !e.archive && ROLES_REDACTEURS.has(roleDansEspace(e, moiId) ?? "")),
    [espaces, moiId],
  );
  const [espaceId, setEspaceId] = useState<string>(() => eligibles[0]?.id ?? "");
  const [catalogue, setCatalogue] = useState<ModeleCatalogue[]>([]);
  const [perso, setPerso] = useState<ModelePerso[]>([]);
  const [draft, setDraft] = useState<Draft>(() => brouillonVierge());
  const [chargement, setChargement] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!espaceId && eligibles[0]) setEspaceId(eligibles[0].id);
  }, [eligibles, espaceId]);

  async function recharger(): Promise<void> {
    if (!espaceId) return;
    setChargement(true);
    try {
      const [cat, list] = await Promise.all([listModelesCatalogue(espaceId), listModelesPerso(espaceId)]);
      setCatalogue(cat);
      setPerso(list);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    void recharger();
    setDraft(brouillonVierge());
    setErreur(null);
    setOk(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espaceId]);

  function partirDeZero(): void {
    setDraft(brouillonVierge());
    setErreur(null);
    setOk(null);
  }

  function partirDe(sourceId: string): void {
    const src = catalogue.find((m) => m.id === sourceId);
    if (!src) return;
    setDraft({
      id: null,
      nom: `${src.libelle} (copie)`,
      description: src.description,
      visibilite: "espace",
      colonnes: src.colonnes.map((c) => ({ nom: c.nom, couleur: c.couleur, wip: c.wip })),
    });
    setErreur(null);
    setOk(null);
  }

  function editer(m: ModelePerso): void {
    setDraft({
      id: m.id,
      nom: m.libelle,
      description: m.description,
      visibilite: m.visibilite,
      colonnes: m.colonnes.map((c) => ({ nom: c.nom, couleur: c.couleur, wip: c.wip })),
    });
    setErreur(null);
    setOk(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function valider(): string | null {
    if (!draft.nom.trim()) return "Donnez un nom au modèle.";
    if (draft.colonnes.length < 1) return "Ajoutez au moins une colonne.";
    if (draft.colonnes.length > 12) return "Un modèle ne peut pas dépasser douze colonnes.";
    if (draft.colonnes.some((c) => !c.nom.trim())) return "Chaque colonne doit avoir un nom.";
    return null;
  }

  async function enregistrer(): Promise<void> {
    const probleme = valider();
    if (probleme) { setErreur(probleme); setOk(null); return; }
    setEnregistrement(true);
    setErreur(null);
    try {
      const payload = {
        nom: draft.nom.trim(),
        description: draft.description.trim(),
        visibilite: draft.visibilite,
        colonnes: draft.colonnes.map((c) => ({ nom: c.nom.trim(), couleur: c.couleur, wip: c.wip })),
      };
      const saved = draft.id
        ? await updateModelePerso(draft.id, payload)
        : await createModelePerso({ espace_id: espaceId, ...payload });
      setOk(draft.id ? "Modèle mis à jour." : "Modèle créé.");
      await recharger();
      editer(saved);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setEnregistrement(false);
    }
  }

  async function supprimer(m: ModelePerso): Promise<void> {
    if (typeof window !== "undefined" && !window.confirm(`Supprimer le modèle « ${m.libelle} » ? Les tableaux déjà créés à partir de ce modèle ne sont pas affectés.`)) return;
    try {
      await deleteModelePerso(m.id);
      if (draft.id === m.id) setDraft(brouillonVierge());
      setOk("Modèle supprimé.");
      await recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Suppression impossible");
    }
  }

  if (eligibles.length === 0) {
    return (
      <div className="page">
        <EmptyState
          titre="Aucun espace éligible"
          description="Vous devez être membre actif d'au moins un espace de travail pour y créer des modèles de tableaux."
        />
      </div>
    );
  }

  const seeds = catalogue;

  return (
    <div className="page modeles-page">
      <header className="modeles-intro">
        <h1>Modèles de tableaux</h1>
        <p>
          Concevez des modèles réutilisables pour lancer un tableau en un clic. Partez d'un modèle
          existant ou d'une page blanche, nommez vos colonnes, choisissez leurs couleurs et une
          limite d'encours (WIP). Les modèles sont rangés par espace de travail.
        </p>
      </header>

      <div className="modeles-barre">
        <label className="modeles-espace">
          <span>Espace de travail</span>
          <select value={espaceId} onChange={(e) => setEspaceId(e.target.value)}>
            {eligibles.map((e) => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="modeles-layout">
        <aside className="modeles-liste">
          <div className="modeles-liste-tete">
            <h2>Mes modèles</h2>
            <button type="button" className="btn btn-primary" onClick={partirDeZero}>Nouveau modèle</button>
          </div>
          {chargement && <p className="muted">Chargement…</p>}
          {!chargement && perso.length === 0 && (
            <p className="muted">Aucun modèle personnalisé dans cet espace pour l'instant.</p>
          )}
          <ul className="modeles-cartes">
            {perso.map((m) => (
              <li key={m.id} className={`modeles-carte${draft.id === m.id ? " is-active" : ""}`}>
                <button type="button" className="modeles-carte-corps" onClick={() => editer(m)}>
                  <span className="modeles-carte-nom">{m.libelle}</span>
                  <span className="modeles-carte-meta">
                    {m.colonnes.length} colonne{m.colonnes.length > 1 ? "s" : ""}
                    {m.visibilite === "prive" ? " · privé" : " · partagé"}
                  </span>
                  <span className="modeles-carte-cols">
                    {m.colonnes.map((c, i) => (
                      <span key={i} className="modeles-pastille" style={{ background: c.couleur ?? "var(--adsum-line)" }} title={c.nom} />
                    ))}
                  </span>
                </button>
                <button type="button" className="modeles-suppr" onClick={() => void supprimer(m)} aria-label={`Supprimer ${m.libelle}`}>Supprimer</button>
              </li>
            ))}
          </ul>

          <div className="modeles-seed">
            <span className="modeles-seed-titre">Partir d'un modèle existant</span>
            <div className="modeles-seed-grille">
              {seeds.map((m) => (
                <button key={m.id} type="button" className="modeles-seed-item" onClick={() => partirDe(m.id)} title={m.description}>
                  <span className="modeles-seed-nom">{m.libelle}</span>
                  <span className="modeles-carte-cols">
                    {m.colonnes.map((c, i) => (
                      <span key={i} className="modeles-pastille" style={{ background: c.couleur ?? "var(--adsum-line)" }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="modeles-atelier">
          <h2>{draft.id ? "Modifier le modèle" : "Nouveau modèle"}</h2>

          {erreur && <div className="banner banner-error" role="alert">{erreur}</div>}
          {ok && <div className="banner banner-ok" role="status">{ok}</div>}

          <label className="champ">
            <span>Nom du modèle</span>
            <input value={draft.nom} maxLength={120} placeholder="Ex. Sprint hebdomadaire"
              onChange={(e) => setDraft({ ...draft, nom: e.target.value })} />
          </label>

          <label className="champ">
            <span>Description (facultatif)</span>
            <textarea value={draft.description} rows={2} maxLength={400} placeholder="À quoi sert ce modèle ?"
              onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>

          <fieldset className="champ modeles-visibilite">
            <legend>Visibilité</legend>
            <label className="modeles-radio">
              <input type="radio" name="vis" checked={draft.visibilite === "espace"}
                onChange={() => setDraft({ ...draft, visibilite: "espace" })} />
              <span><strong>Partagé</strong> : visible par tout l'espace</span>
            </label>
            <label className="modeles-radio">
              <input type="radio" name="vis" checked={draft.visibilite === "prive"}
                onChange={() => setDraft({ ...draft, visibilite: "prive" })} />
              <span><strong>Privé</strong> : visible par vous seul</span>
            </label>
          </fieldset>

          <ColonnesEditor
            colonnes={draft.colonnes}
            onChange={(colonnes) => setDraft({ ...draft, colonnes })}
          />

          <div className="modeles-actions">
            <button type="button" className="btn btn-primary" disabled={enregistrement} onClick={() => void enregistrer()}>
              {enregistrement ? "Enregistrement…" : draft.id ? "Enregistrer les modifications" : "Créer le modèle"}
            </button>
            {draft.id && (
              <button type="button" className="btn" onClick={partirDeZero}>Annuler</button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
