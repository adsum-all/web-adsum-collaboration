import type { ModeleColonne } from "../../lib/store.js";

interface Props {
  colonnes: ModeleColonne[];
  onChange: (colonnes: ModeleColonne[]) => void;
}

// Curated palette (matches the built-in templates) plus a free colour picker, so a
// column colour is always a valid #rrggbb the server accepts.
const PALETTE = ["#94a3b8", "#3b82f6", "#f59e0b", "#8b5cf6", "#22c55e", "#ef4444", "#14b8a6", "#ec4899"];
const MAX = 12;

export function ColonnesEditor({ colonnes, onChange }: Readonly<Props>): JSX.Element {
  function set(i: number, patch: Partial<ModeleColonne>): void {
    onChange(colonnes.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function retirer(i: number): void {
    onChange(colonnes.filter((_, idx) => idx !== i));
  }
  function deplacer(i: number, sens: -1 | 1): void {
    const j = i + sens;
    if (j < 0 || j >= colonnes.length) return;
    const copie = colonnes.slice();
    const a = copie[i];
    const b = copie[j];
    if (!a || !b) return;
    copie[i] = b;
    copie[j] = a;
    onChange(copie);
  }
  function ajouter(): void {
    if (colonnes.length >= MAX) return;
    const couleur = PALETTE[colonnes.length % PALETTE.length] ?? "#94a3b8";
    onChange([...colonnes, { nom: "Nouvelle colonne", couleur, wip: null }]);
  }

  return (
    <div className="colonnes-editeur">
      <div className="colonnes-tete">
        <span className="champ-legende">Colonnes ({colonnes.length}/{MAX})</span>
        <button type="button" className="btn btn-sm" onClick={ajouter} disabled={colonnes.length >= MAX}>
          Ajouter une colonne
        </button>
      </div>

      <ul className="colonnes-liste">
        {colonnes.map((c, i) => (
          <li key={i} className="colonne-ligne">
            <span className="colonne-rang">{i + 1}</span>
            <input
              className="colonne-nom"
              value={c.nom}
              maxLength={80}
              placeholder="Nom de la colonne"
              onChange={(e) => set(i, { nom: e.target.value })}
            />
            <span className="colonne-couleurs">
              {PALETTE.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`colonne-swatch${c.couleur === p ? " is-on" : ""}`}
                  style={{ background: p }}
                  onClick={() => set(i, { couleur: p })}
                  aria-label={`Couleur ${p}`}
                />
              ))}
              <input
                type="color"
                className="colonne-color-input"
                value={c.couleur ?? "#94a3b8"}
                onChange={(e) => set(i, { couleur: e.target.value })}
                title="Couleur personnalisée"
              />
            </span>
            <label className="colonne-wip" title="Limite d'encours (nombre maximal de cartes)">
              <span>WIP</span>
              <input
                type="number"
                min={1}
                max={999}
                value={c.wip ?? ""}
                placeholder="-"
                onChange={(e) => set(i, { wip: e.target.value ? Math.max(1, Number(e.target.value)) : null })}
              />
            </label>
            <span className="colonne-outils">
              <button type="button" className="colonne-ico" onClick={() => deplacer(i, -1)} disabled={i === 0} aria-label="Monter">↑</button>
              <button type="button" className="colonne-ico" onClick={() => deplacer(i, 1)} disabled={i === colonnes.length - 1} aria-label="Descendre">↓</button>
              <button type="button" className="colonne-ico colonne-ico-suppr" onClick={() => retirer(i)} disabled={colonnes.length <= 1} aria-label="Retirer">×</button>
            </span>
          </li>
        ))}
      </ul>

      <div className="colonnes-apercu" aria-label="Aperçu du tableau">
        <span className="champ-legende">Aperçu</span>
        <div className="apercu-rail">
          {colonnes.map((c, i) => (
            <div key={i} className="apercu-colonne">
              <span className="apercu-barre" style={{ background: c.couleur ?? "var(--adsum-line)" }} />
              <span className="apercu-nom">{c.nom || "Sans nom"}</span>
              {c.wip ? <span className="apercu-wip">WIP {c.wip}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
