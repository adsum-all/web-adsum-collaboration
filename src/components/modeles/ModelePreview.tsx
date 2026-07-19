import type { ModeleColonne } from "../../lib/store.js";

interface Apercu {
  libelle: string;
  description?: string;
  source?: "systeme" | "personnalise";
  visibilite?: "partage" | "prive";
  colonnes: ModeleColonne[];
}

interface Props {
  modele: Apercu;
  onClose: () => void;
  onUtiliser?: () => void;
}

// Read-only preview of a board template: shows exactly the columns (name, colour, WIP)
// a board created from it would have, with a couple of placeholder cards so it reads
// like a real board. Reused by the library and by the workspace board-creation flow.
export function ModelePreview({ modele, onClose, onUtiliser }: Readonly<Props>): JSX.Element {
  const badge = modele.source === "personnalise" ? "Personnalisé" : "Standard";
  return (
    <div className="modele-preview-scrim" role="dialog" aria-modal="true" aria-label={`Aperçu du modèle ${modele.libelle}`} onClick={onClose}>
      <div className="modele-preview" onClick={(e) => e.stopPropagation()}>
        <header className="modele-preview-tete">
          <div>
            <span className={`modele-tag modele-tag-${modele.source === "personnalise" ? "perso" : "std"}`}>{badge}</span>
            {modele.visibilite === "prive" && <span className="modele-tag modele-tag-prive">Privé</span>}
            <h3>{modele.libelle}</h3>
            {modele.description && <p className="muted">{modele.description}</p>}
          </div>
          <button type="button" className="modele-preview-fermer" onClick={onClose} aria-label="Fermer l'aperçu">×</button>
        </header>

        <div className="modele-preview-board" aria-label="Aperçu du tableau">
          {modele.colonnes.map((c, i) => (
            <div key={i} className="mpv-colonne">
              <div className="mpv-colonne-tete">
                <span className="mpv-barre" style={{ background: c.couleur ?? "var(--adsum-line)" }} />
                <span className="mpv-nom">{c.nom || "Sans nom"}</span>
                {c.wip ? <span className="mpv-wip">WIP {c.wip}</span> : null}
              </div>
              <div className="mpv-carte" />
              <div className="mpv-carte mpv-carte-court" />
            </div>
          ))}
        </div>

        <footer className="modele-preview-actions">
          <span className="muted small">{modele.colonnes.length} colonne{modele.colonnes.length > 1 ? "s" : ""}</span>
          <div className="modele-preview-boutons">
            <button type="button" className="btn" onClick={onClose}>Fermer</button>
            {onUtiliser && (
              <button type="button" className="btn btn-primary" onClick={onUtiliser}>Utiliser ce modèle</button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
