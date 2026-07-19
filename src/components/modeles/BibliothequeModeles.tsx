import type { ModeleCatalogue, ModeleColonne, ModelePerso } from "../../lib/store.js";

interface Seed {
  libelle: string;
  description: string;
  colonnes: ModeleColonne[];
}

interface Props {
  perso: ModelePerso[];
  standards: ModeleCatalogue[];
  moiId: string;
  chargement: boolean;
  onNouveau: () => void;
  onApercu: (m: { libelle: string; description?: string; source?: "systeme" | "personnalise"; visibilite?: "partage" | "prive"; colonnes: ModeleColonne[] }) => void;
  onDupliquer: (m: Seed) => void;
  onEditer: (m: ModelePerso) => void;
  onSupprimer: (m: ModelePerso) => void;
}

function Pastilles({ colonnes }: Readonly<{ colonnes: ModeleColonne[] }>): JSX.Element {
  return (
    <span className="modeles-carte-cols">
      {colonnes.map((c, i) => (
        <span key={i} className="modeles-pastille" style={{ background: c.couleur ?? "var(--adsum-line)" }} title={c.nom} />
      ))}
    </span>
  );
}

// The template library: every template available to build a board, grouped as custom vs
// built-in. Read-only here (no workspace), with a preview and a "duplicate" action to
// start a new custom template from any existing one. Using a template happens in a
// workspace, from the board-creation picker.
export function BibliothequeModeles({
  perso, standards, moiId, chargement, onNouveau, onApercu, onDupliquer, onEditer, onSupprimer,
}: Readonly<Props>): JSX.Element {
  return (
    <div className="modeles-biblio">
      <section className="modeles-groupe">
        <div className="modeles-groupe-tete">
          <div>
            <h2>Modèles personnalisés</h2>
            <p className="muted small">Créés par les équipes, disponibles dans tous les espaces de travail.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={onNouveau}>Nouveau modèle</button>
        </div>
        {chargement && <p className="muted">Chargement…</p>}
        {!chargement && perso.length === 0 && (
          <p className="muted">Aucun modèle personnalisé pour l'instant. Créez-en un : il sera disponible partout.</p>
        )}
        <div className="modeles-grille">
          {perso.map((m) => (
            <article key={m.id} className="modele-vignette">
              <div className="modele-vignette-corps">
                <div className="modele-vignette-tete">
                  <span className={`modele-tag modele-tag-${m.visibilite === "prive" ? "prive" : "perso"}`}>
                    {m.visibilite === "prive" ? "Privé" : "Partagé"}
                  </span>
                </div>
                <h3>{m.libelle}</h3>
                {m.description && <p className="muted small">{m.description}</p>}
                <Pastilles colonnes={m.colonnes} />
                <span className="muted small">{m.colonnes.length} colonne{m.colonnes.length > 1 ? "s" : ""}</span>
              </div>
              <div className="modele-vignette-actions">
                <button type="button" className="btn btn-sm" onClick={() => onApercu({ ...m })}>Aperçu</button>
                <button type="button" className="btn btn-sm" onClick={() => onDupliquer({ libelle: m.libelle, description: m.description, colonnes: m.colonnes })}>Dupliquer</button>
                {m.cree_par === moiId && (
                  <>
                    <button type="button" className="btn btn-sm" onClick={() => onEditer(m)}>Modifier</button>
                    <button type="button" className="btn btn-sm modele-suppr-btn" onClick={() => onSupprimer(m)}>Supprimer</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="modeles-groupe">
        <div className="modeles-groupe-tete">
          <div>
            <h2>Modèles standards</h2>
            <p className="muted small">Les modèles fournis avec l'application. Utilisez-les tels quels ou dupliquez-en un pour le personnaliser.</p>
          </div>
        </div>
        <div className="modeles-grille">
          {standards.map((m) => (
            <article key={m.id} className="modele-vignette">
              <div className="modele-vignette-corps">
                <div className="modele-vignette-tete">
                  <span className="modele-tag modele-tag-std">Standard</span>
                </div>
                <h3>{m.libelle}</h3>
                {m.description && <p className="muted small">{m.description}</p>}
                <Pastilles colonnes={m.colonnes} />
                <span className="muted small">{m.colonnes.length} colonne{m.colonnes.length > 1 ? "s" : ""}</span>
              </div>
              <div className="modele-vignette-actions">
                <button type="button" className="btn btn-sm" onClick={() => onApercu({ ...m })}>Aperçu</button>
                <button type="button" className="btn btn-sm" onClick={() => onDupliquer({ libelle: m.libelle, description: m.description, colonnes: m.colonnes })}>Dupliquer</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
