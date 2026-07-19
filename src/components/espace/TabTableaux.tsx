import { useEffect, useState } from "react";

import {
  createTableauDepuisModele,
  listModelesCatalogue,
  listTableauxEspace,
  peutEcrireCollaboration,
  updateTableauProto,
  type ModeleCatalogue,
} from "../../lib/store.js";
import { peut, roleDansEspace } from "../../lib/permissions.js";
import type { Espace, TableauProto, VisibiliteTableau } from "../../lib/types.js";
import { EmptyState } from "../common/EmptyState.js";

interface Props {
  espace: Espace;
  moiId: string;
  onOuvrir: (id: string) => void;
}

export function TabTableaux({ espace, moiId, onOuvrir }: Props): JSX.Element {
  const [tableaux, setTableaux] = useState<TableauProto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [visibilite, setVisibilite] = useState<VisibiliteTableau>("espace");
  const [modele, setModele] = useState<string>("vide");
  const [catalogue, setCatalogue] = useState<ModeleCatalogue[]>([]);

  const role = roleDansEspace(espace, moiId);
  // Creating a board writes on the server (require collaboration.gerer), so the
  // button needs the platform write permission AND the space role, not the role alone.
  const ecritCollab = peutEcrireCollaboration();
  const peutCreer = ecritCollab && peut(espace, role, "creer_carte");

  async function reload(): Promise<void> {
    setLoading(true);
    const rows = await listTableauxEspace(espace.id);
    setTableaux(rows);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [espace.id]);

  useEffect(() => {
    // Pass the space id so the picker also offers this workspace custom templates,
    // not only the built-in catalogue.
    void listModelesCatalogue(espace.id).then(setCatalogue).catch(() => undefined);
  }, [espace.id]);

  async function creer(): Promise<void> {
    if (!nom.trim()) return;
    const t = await createTableauDepuisModele({ espace_id: espace.id, nom: nom.trim(), visibilite, modele });
    if (description.trim()) await updateTableauProto(t.id, { description: description.trim() });
    setNom(""); setDescription(""); setVisibilite("espace"); setModele("vide"); setCreation(false);
    await reload();
    onOuvrir(t.id);
  }


  async function toggleFavori(t: TableauProto): Promise<void> {
    await updateTableauProto(t.id, { favori: !t.favori });
    await reload();
  }

  if (loading) return <p className="muted">Chargement des tableaux...</p>;

  return (
    <div>
      {peutCreer && !espace.parent_id && (
        <p className="muted" style={{ fontSize: 12.5, margin: "0 0 10px", padding: "8px 12px", background: "var(--collab-tint, #eef3fc)", borderRadius: 10 }}>
          Astuce d'organisation : dans un espace principal, préférez créer un <strong>sous-espace</strong> (bouton « + Sous-espace » en haut) pour regrouper des tableaux liés, plutôt que d'accumuler tous les tableaux ici.
        </p>
      )}
      {peutCreer && (
        <section className="card">
          {creation ? (
            <>
              <h2 className="card-title">Nouveau tableau</h2>
              <div className="form-grid">
                <label>
                  <span>Nom</span>
                  <input value={nom} autoFocus onChange={(e) => setNom(e.target.value)} placeholder="Ex. Assemblée générale 2026" />
                </label>
                <label>
                  <span>Description</span>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Objectif du tableau" />
                </label>
              </div>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={visibilite === "prive"}
                  onChange={(e) => setVisibilite(e.target.checked ? "prive" : "espace")}
                />
                <span>Tableau privé (visible seulement pour ses participants)</span>
              </label>
              <div style={{ marginTop: 10 }}>
                <span className="modal-section-titre">Partir d'un modèle ou de zéro</span>
                <div className="modele-grid">
                  {catalogue.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`modele-carte${modele === m.id ? " modele-carte-on" : ""}`}
                      onClick={() => setModele(m.id)}
                    >
                      <span className="modele-libelle">{m.libelle}</span>
                      <span className="modele-desc">{m.description}</span>
                      <span className="modele-colonnes">
                        {m.colonnes.map((c, i) => (
                          <span key={i} className="modele-col" title={c.wip ? `${c.nom} (WIP ${c.wip})` : c.nom}>
                            <span className="modele-col-dot" style={{ background: c.couleur ?? "var(--adsum-line)" }} />
                            {c.nom}{c.wip ? ` · ${c.wip}` : ""}
                          </span>
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-primary" disabled={!nom.trim()} onClick={() => void creer()}>
                  Créer le tableau
                </button>
                <button type="button" className="btn btn-ghost btn-inline" onClick={() => setCreation(false)}>
                  Annuler
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setCreation(true)}>
              + Créer un tableau
            </button>
          )}
        </section>
      )}

      {tableaux.length === 0 ? (
        <EmptyState
          titre="Aucun tableau visible"
          description={peutCreer ? "Créez le premier tableau ci-dessus." : "Aucun tableau ne vous est encore partagé."}
        />
      ) : (
        <div className="board-grid">
          {tableaux
            .slice()
            .sort((a, b) => (b.favori ? 1 : 0) - (a.favori ? 1 : 0))
            .map((t) => (
              <div key={t.id} className="board-tile-wrap">
                <button type="button" className="board-tile" onClick={() => onOuvrir(t.id)}>
                  <span className="board-tile-name">
                    {t.favori && <span aria-label="Favori" title="Favori" className="favori-star">★</span>} {t.nom}
                  </span>
                  {t.description && <span className="board-tile-desc">{t.description}</span>}
                  <span className="board-tile-meta">
                    {t.compteur_cartes} carte(s)
                    <span className={`badge ${t.visibilite === "prive" ? "badge-warn" : "badge-mut"}`} style={{ marginLeft: 8 }}>
                      {t.visibilite === "prive" ? "Privé" : "Visible espace"}
                    </span>
                  </span>
                </button>
                {ecritCollab && (
                  <button
                    type="button"
                    className="tile-fav"
                    aria-pressed={t.favori}
                    aria-label={t.favori ? "Retirer des favoris" : "Ajouter aux favoris"}
                    onClick={() => void toggleFavori(t)}
                  >
                    {t.favori ? "★" : "☆"}
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
