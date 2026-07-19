import { useCallback, useEffect, useState } from "react";

import {
  type Corbeille,
  listCorbeille,
  listEspacesArchives,
  peutEcrireCollaboration,
  restaurerEspace,
  restaurerTableau,
  toggleArchiveEspace,
} from "../../lib/store.js";
import type { Espace } from "../../lib/types.js";
import { EmptyState } from "../common/EmptyState.js";

interface Props {
  onOuvrirEspace: (id: string) => void;
}

/** Recovery hub for the collaboration app: workspaces archived (reversible) and items
 * sent to the trash (recoverable until their retention window ends). Everyone with
 * collaboration.superviser sees this; only a writer (collaboration.gerer) can restore or
 * unarchive, so the actions are gated and the server re-checks the per-space role. */
export function CorbeillePage({ onOuvrirEspace }: Props): JSX.Element {
  const [archives, setArchives] = useState<Espace[]>([]);
  const [corbeille, setCorbeille] = useState<Corbeille | null>(null);
  const [etat, setEtat] = useState<"loading" | "ok" | "error">("loading");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const peutEcrire = peutEcrireCollaboration();

  const reload = useCallback((): void => {
    setEtat("loading");
    void Promise.all([listEspacesArchives(), listCorbeille()])
      .then(([a, c]) => { setArchives(a); setCorbeille(c); setEtat("ok"); })
      .catch((e: unknown) => { setErreur(e instanceof Error ? e.message : "Chargement impossible"); setEtat("error"); });
  }, []);
  useEffect(reload, [reload]);

  async function agir(cle: string, action: () => Promise<unknown>): Promise<void> {
    setBusy(cle);
    setErreur(null);
    try {
      await action();
      reload();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(null);
    }
  }

  if (etat === "loading") return <div className="page"><p className="muted">Chargement...</p></div>;
  if (etat === "error") {
    return (
      <div className="page">
        <EmptyState titre="Chargement impossible" description={erreur ?? "Réessayez dans un instant."}
          action={<button type="button" className="btn btn-primary" onClick={reload}>Réessayer</button>} />
      </div>
    );
  }

  const c = corbeille!;
  const rien = archives.length === 0 && c.espaces.length === 0 && c.tableaux.length === 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Corbeille et archives</h1>
          <p className="muted">Retrouvez et restaurez les espaces archivés et les éléments supprimés. La suppression est réversible pendant {c.retention_jours} jour{c.retention_jours > 1 ? "s" : ""} avant purge définitive.</p>
        </div>
      </header>

      {erreur && <p className="banner banner-error">{erreur}</p>}

      {rien && (
        <EmptyState titre="Rien à récupérer" description="Aucun espace archivé et aucun élément dans la corbeille." />
      )}

      {archives.length > 0 && (
        <section className="card">
          <h2 className="card-titre">Espaces archivés<span className="corbeille-compte">{archives.length}</span></h2>
          <ul className="corbeille-liste">
            {archives.map((e) => (
              <li key={e.id} className="corbeille-item">
                <span className="corbeille-item-nom">
                  <span className="espace-avatar espace-avatar-sm" style={{ background: e.couleur }} aria-hidden="true">{e.initiale}</span>
                  {e.nom}
                </span>
                <span className="corbeille-item-meta muted small">Archivé</span>
                <span className="corbeille-item-actions">
                  <button type="button" className="btn btn-ghost btn-inline" onClick={() => onOuvrirEspace(e.id)}>Ouvrir</button>
                  {peutEcrire && (
                    <button type="button" className="btn btn-primary btn-inline" disabled={busy === `a-${e.id}`}
                      onClick={() => void agir(`a-${e.id}`, () => toggleArchiveEspace(e.id, false))}>Désarchiver</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(c.espaces.length > 0 || c.tableaux.length > 0) && (
        <section className="card">
          <h2 className="card-titre">Corbeille<span className="corbeille-compte">{c.espaces.length + c.tableaux.length}</span></h2>
          <ul className="corbeille-liste">
            {c.espaces.map((e) => (
              <li key={`e-${e.id}`} className="corbeille-item">
                <span className="corbeille-item-nom"><span className="corbeille-type">{e.sous_espace ? "Sous-espace" : "Espace"}</span>{e.nom}</span>
                <span className="corbeille-item-meta muted small">Purge dans {e.jours_restants} j</span>
                <span className="corbeille-item-actions">
                  {peutEcrire && (
                    <button type="button" className="btn btn-primary btn-inline" disabled={busy === `re-${e.id}`}
                      onClick={() => void agir(`re-${e.id}`, () => restaurerEspace(e.id))}>Restaurer</button>
                  )}
                </span>
              </li>
            ))}
            {c.tableaux.map((t) => (
              <li key={`t-${t.id}`} className="corbeille-item">
                <span className="corbeille-item-nom"><span className="corbeille-type">Tableau</span>{t.nom}</span>
                <span className="corbeille-item-meta muted small">Purge dans {t.jours_restants} j</span>
                <span className="corbeille-item-actions">
                  {peutEcrire && (
                    <button type="button" className="btn btn-primary btn-inline" disabled={busy === `rt-${t.id}`}
                      onClick={() => void agir(`rt-${t.id}`, () => restaurerTableau(t.id))}>Restaurer</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!peutEcrire && !rien && (
        <p className="muted small">Vous consultez la corbeille en lecture seule. La restauration requiert un rôle de gestion.</p>
      )}
    </div>
  );
}
