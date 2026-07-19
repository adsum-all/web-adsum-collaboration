import { useCallback, useEffect, useState } from "react";

import { listEspaces, listMesCartes } from "../../lib/store.js";
import type { CarteProto, Espace } from "../../lib/types.js";
import { EmptyState } from "../common/EmptyState.js";

// The my-cards API returns each card with the id of the space it belongs to, so
// the badge and the "open space" action resolve the space from the loaded list.
type CarteAvecEspace = CarteProto & { espace_id?: string | null };

interface Props {
  moiId: string;
  onOuvrirEspace: (id: string) => void;
}

export function MesCartes({ moiId, onOuvrirEspace }: Props): JSX.Element {
  const [cartes, setCartes] = useState<CarteAvecEspace[]>([]);
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback((): void => {
    setLoading(true);
    setErreur(null);
    void Promise.all([listMesCartes(), listEspaces()])
      .then(([c, e]) => { setCartes(c as CarteAvecEspace[]); setEspaces(e); setLoading(false); })
      // Without this catch a rejected fetch (expired session, 403, 500) left the spinner
      // spinning forever: surface the error and offer a retry instead.
      .catch((err: unknown) => { setErreur(err instanceof Error ? err.message : "Chargement impossible"); setLoading(false); });
  }, []);
  useEffect(charger, [charger, moiId]);

  if (loading) return <div className="page"><p className="muted">Chargement...</p></div>;
  if (erreur) {
    return (
      <div className="page">
        <EmptyState titre="Chargement impossible" description={erreur}
          action={<button type="button" className="btn btn-primary" onClick={charger}>Réessayer</button>} />
      </div>
    );
  }

  const espaceDe = (c: CarteAvecEspace): Espace | undefined =>
    c.espace_id ? espaces.find((e) => e.id === c.espace_id) : undefined;
  const assignes = cartes.filter((c) => c.assignes.includes(moiId));
  const suivis = cartes.filter((c) => !c.assignes.includes(moiId) && c.suiveurs.includes(moiId));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Mes cartes</h1>
          <p className="muted">Les cartes qui vous sont assignées et celles que vous suivez.</p>
        </div>
      </header>

      <Section titre={`Assignées à moi (${assignes.length})`} cartes={assignes} espaceDe={espaceDe} onOuvrir={onOuvrirEspace} />
      <Section titre={`Que je suis (${suivis.length})`} cartes={suivis} espaceDe={espaceDe} onOuvrir={onOuvrirEspace} />

      {cartes.length === 0 && (
        <EmptyState
          titre="Aucune carte pour l'instant"
          description="Les cartes qui vous seront assignées apparaîtront ici."
        />
      )}
    </div>
  );
}

function Section({
  titre,
  cartes,
  espaceDe,
  onOuvrir,
}: {
  titre: string;
  cartes: CarteAvecEspace[];
  espaceDe: (c: CarteAvecEspace) => Espace | undefined;
  onOuvrir: (id: string) => void;
}): JSX.Element | null {
  if (cartes.length === 0) return null;
  return (
    <section className="card">
      <h2 className="card-title">{titre}</h2>
      <ul className="mini-list">
        {cartes.map((c) => {
          const esp = espaceDe(c);
          return (
            <li key={c.id}>
              <span>
                <strong>{c.titre}</strong>
                {esp && <span className="badge badge-mut" style={{ marginLeft: 8 }}>{esp.nom}</span>}
                {c.echeance && (
                  <span className="badge badge-mut" style={{ marginLeft: 6 }}>
                    {new Date(c.echeance).toLocaleDateString("fr-FR")}
                  </span>
                )}
                {c.priorite !== "normale" && (
                  <span className={`badge badge-prio badge-prio-${c.priorite}`} style={{ marginLeft: 6 }}>
                    {c.priorite}
                  </span>
                )}
              </span>
              {esp && (
                <button type="button" className="btn btn-ghost btn-inline" onClick={() => onOuvrir(esp.id)}>
                  Ouvrir l'espace
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
