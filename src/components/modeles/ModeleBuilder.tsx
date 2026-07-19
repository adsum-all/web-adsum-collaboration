import { useState } from "react";

import { createModelePerso, updateModelePerso, type ModeleColonne } from "../../lib/store.js";
import { ColonnesEditor } from "./ColonnesEditor.js";
import { ModelePreview } from "./ModelePreview.js";

export interface ModeleDraft {
  id: string | null;
  nom: string;
  description: string;
  visibilite: "partage" | "prive";
  colonnes: ModeleColonne[];
}

export function brouillonVierge(): ModeleDraft {
  return {
    id: null,
    nom: "",
    description: "",
    visibilite: "partage",
    colonnes: [
      { nom: "À faire", couleur: "#94a3b8", wip: null },
      { nom: "En cours", couleur: "#3b82f6", wip: null },
      { nom: "Terminé", couleur: "#22c55e", wip: null },
    ],
  };
}

interface Props {
  initial: ModeleDraft;
  onSaved: () => void;
  onCancel: () => void;
}

export function ModeleBuilder({ initial, onSaved, onCancel }: Readonly<Props>): JSX.Element {
  const [draft, setDraft] = useState<ModeleDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [apercu, setApercu] = useState(false);

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
    setBusy(true);
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
        : await createModelePerso(payload);
      setDraft((d) => ({ ...d, id: saved.id }));
      setOk(draft.id ? "Modèle mis à jour. Il est disponible dans tous les espaces." : "Modèle créé. Il est désormais disponible dans tous les espaces de travail.");
      onSaved();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="modeles-atelier">
      <div className="modeles-atelier-tete">
        <h2>{draft.id ? "Modifier le modèle" : "Nouveau modèle"}</h2>
        <button type="button" className="btn btn-sm" onClick={() => setApercu(true)}>Aperçu</button>
      </div>

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
          <input type="radio" name="vis" checked={draft.visibilite === "partage"}
            onChange={() => setDraft({ ...draft, visibilite: "partage" })} />
          <span><strong>Partagé</strong> : disponible pour tous les espaces et tous les collaborateurs</span>
        </label>
        <label className="modeles-radio">
          <input type="radio" name="vis" checked={draft.visibilite === "prive"}
            onChange={() => setDraft({ ...draft, visibilite: "prive" })} />
          <span><strong>Privé</strong> : visible et utilisable par vous seul</span>
        </label>
      </fieldset>

      <ColonnesEditor
        colonnes={draft.colonnes}
        onChange={(colonnes) => setDraft({ ...draft, colonnes })}
      />

      <div className="modeles-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void enregistrer()}>
          {busy ? "Enregistrement…" : draft.id ? "Enregistrer les modifications" : "Créer le modèle"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>Retour à la bibliothèque</button>
      </div>

      {apercu && (
        <ModelePreview
          modele={{ libelle: draft.nom || "Nouveau modèle", description: draft.description, source: "personnalise", visibilite: draft.visibilite, colonnes: draft.colonnes }}
          onClose={() => setApercu(false)}
        />
      )}
    </section>
  );
}
