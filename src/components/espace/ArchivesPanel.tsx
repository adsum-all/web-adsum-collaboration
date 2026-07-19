import { useEffect, useState } from "react";

import { listTableauxArchives, toggleArchiveTableau, deleteTableauProto } from "../../lib/store.js";
import type { Espace, TableauProto } from "../../lib/types.js";

interface Props {
  espace: Espace;
  // Reactivating or deleting an archived board are server writes (collaboration.gerer):
  // the parent computes this as collaboration.gerer AND a managing space role.
  peutGerer: boolean;
  onChanged: () => void;
}

export function ArchivesPanel({ espace, peutGerer, onChanged }: Props): JSX.Element {
  const [rows, setRows] = useState<TableauProto[]>([]);

  async function reload(): Promise<void> {
    const r = await listTableauxArchives(espace.id);
    setRows(r);
  }

  useEffect(() => {
    void reload();
  }, [espace.id]);

  if (rows.length === 0) {
    return <p className="muted small">Aucun tableau archivé.</p>;
  }

  return (
    <ul className="mini-list">
      {rows.map((t) => (
        <li key={t.id}>
          <span>{t.nom} <span className="muted small">- {t.compteur_cartes} carte(s)</span></span>
          {peutGerer && (
            <span style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-inline"
                onClick={async () => {
                  await toggleArchiveTableau(t.id, false);
                  await reload();
                  onChanged();
                }}
              >
                Réactiver
              </button>
              <button
                type="button"
                className="btn btn-danger btn-inline"
                onClick={async () => {
                  if (window.confirm(`Mettre le tableau « ${t.nom} » à la corbeille ? Il restera récupérable depuis « Corbeille et archives » pendant la durée de rétention (sauf si celle-ci est de 0 jour).`)) {
                    await deleteTableauProto(t.id);
                    await reload();
                    onChanged();
                  }
                }}
              >
                Mettre à la corbeille
              </button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
