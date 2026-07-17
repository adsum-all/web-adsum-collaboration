import { useEffect, useMemo, useRef, useState } from "react";

import { rechercher, type ResultatRecherche } from "../../lib/store.js";

interface Props {
  onClose: () => void;
  onOuvrirEspace: (id: string) => void;
  onOuvrirTableau: (espaceId: string, tableauId: string) => void;
  onOuvrirCarte: (espaceId: string, tableauId: string, carteId: string) => void;
  initialQuery?: string;
}

export function GlobalSearch({ onClose, onOuvrirEspace, onOuvrirTableau, onOuvrirCarte, initialQuery = "" }: Props): JSX.Element {
  const [q, setQ] = useState(initialQuery);
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    let cancel = false;
    void rechercher(q).then((rows) => {
      if (!cancel) {
        setResultats(rows);
        setCursor(0);
      }
    });
    return () => {
      cancel = true;
    };
  }, [q]);

  const groups = useMemo(() => {
    const g: Record<"espace" | "tableau" | "carte", ResultatRecherche[]> = { espace: [], tableau: [], carte: [] };
    resultats.forEach((r) => g[r.kind].push(r));
    return g;
  }, [resultats]);

  function activer(r: ResultatRecherche): void {
    if (r.kind === "espace") onOuvrirEspace(r.id);
    else if (r.kind === "tableau") onOuvrirTableau(r.espace_id, r.id);
    else onOuvrirCarte(r.espace_id, r.tableau_id, r.id);
    onClose();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, resultats.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else {
      const cible = resultats[cursor];
      if (e.key === "Enter" && cible) {
        e.preventDefault();
        activer(cible);
      }
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-label="Recherche globale">
      <div className="modal modal-search" onClick={(e) => e.stopPropagation()}>
        <div className="search-head">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Rechercher un espace, un tableau, une carte…"
            aria-label="Requête"
          />
          <button type="button" className="btn btn-ghost btn-inline" onClick={onClose} aria-label="Fermer">Esc</button>
        </div>
        <div className="search-results">
          {q.trim() === "" && (
            <p className="muted small" style={{ padding: 12 }}>
              Tapez pour rechercher. ↑↓ pour naviguer, Entrée pour ouvrir.
            </p>
          )}
          {q.trim() !== "" && resultats.length === 0 && (
            <p className="muted small" style={{ padding: 12 }}>Aucun résultat.</p>
          )}
          {(["espace", "tableau", "carte"] as const).map((kind) => {
            const items = groups[kind] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={kind} className="search-group">
                <div className="search-group-title">
                  {kind === "espace" ? "Espaces" : kind === "tableau" ? "Tableaux" : "Cartes"}
                </div>
                {items.map((r) => {
                  const idx = resultats.indexOf(r);
                  return (
                    <button
                      key={`${r.kind}-${r.id}`}
                      type="button"
                      className={`search-item${idx === cursor ? " search-item-active" : ""}`}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => activer(r)}
                    >
                      <span className="search-item-titre">{r.titre}</span>
                      {r.sous_titre && <span className="search-item-sub">{r.sous_titre}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
