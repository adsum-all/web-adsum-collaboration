import { useMemo, useState } from "react";

import {
  type Information,
  type InformationPriorite,
  type InformationStatut,
  getCiblesReference,
  listInformations,
} from "../../api.js";
import { InformationEditor } from "./InformationEditor.js";
import { useResource } from "../../useResource.js";

const PRIO: { value: InformationPriorite; label: string; cls: string }[] = [
  { value: "normale", label: "INFO", cls: "info-badge-info" },
  { value: "importante", label: "IMPORTANT", cls: "info-badge-important" },
  { value: "urgente", label: "URGENT", cls: "info-badge-urgent" },
];
function prioMeta(p: InformationPriorite): { label: string; cls: string } {
  return PRIO.find((x) => x.value === p) ?? { label: "INFO", cls: "info-badge-info" };
}

const STATUT_LABEL: Record<InformationStatut, string> = {
  brouillon: "Brouillon",
  programme: "Programmé",
  envoye: "Envoyé",
  archive: "Archivé",
};

const FILTRES: { id: InformationStatut | "toutes"; label: string }[] = [
  { id: "toutes", label: "Toutes" },
  { id: "brouillon", label: "Brouillons" },
  { id: "envoye", label: "Envoyées" },
  { id: "archive", label: "Archivées" },
];

/** Back-office home of the Information broadcasts: filtered list plus the full
 * editor (rich text, voice note, media, enriched targeting, delivery stats). */
export function InformationsAdmin({ token }: Readonly<{ token: string }>): JSX.Element {
  const [filtre, setFiltre] = useState<InformationStatut | "toutes">("toutes");
  const [rev, setRev] = useState(0);
  const [editing, setEditing] = useState<Information | null | "new">(null);
  const liste = useResource(() => listInformations(token, filtre === "toutes" ? undefined : filtre), [token, filtre, rev]);
  const cibles = useResource(() => getCiblesReference(token), [token]);
  const reload = (): void => setRev((r) => r + 1);
  const items = useMemo(() => liste.data ?? [], [liste.data]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Informations importantes</h1>
          <p className="muted">Diffusez des communications institutionnelles aux membres, ciblées et suivies (envoyé, lu, confirmé).</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>+ Nouvelle information</button>
      </header>

      <div className="info-filtres">
        {FILTRES.map((f) => (
          <button key={f.id} type="button" className={`chip ${filtre === f.id ? "chip-active" : ""}`} onClick={() => setFiltre(f.id)}>{f.label}</button>
        ))}
      </div>

      {liste.loading ? (
        <p className="muted">Chargement...</p>
      ) : liste.error ? (
        <div className="banner banner-error" role="alert">
          {liste.error}
          <button type="button" className="link" onClick={reload} style={{ marginLeft: 12 }}>Réessayer</button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-card"><p>Aucune information pour ce filtre.</p></div>
      ) : (
        <div className="info-list">
          {items.map((i) => {
            const m = prioMeta(i.priorite);
            return (
              <button key={i.id} type="button" className="info-row" onClick={() => setEditing(i)}>
                <span className={`info-badge ${m.cls}`}>{m.label}</span>
                <div className="info-row-main">
                  <strong>{i.titre}</strong>
                  <span className="muted small">{[i.auteur, STATUT_LABEL[i.statut], i.envoye_le ? new Date(i.envoye_le).toLocaleString("fr-FR") : new Date(i.cree_le ?? "").toLocaleDateString("fr-FR")].filter(Boolean).join(" · ")}</span>
                </div>
                <span className={`info-statut info-statut-${i.statut}`}>{STATUT_LABEL[i.statut]}</span>
              </button>
            );
          })}
        </div>
      )}

      {editing && (
        <InformationEditor
          token={token}
          info={editing === "new" ? null : editing}
          cibles={cibles.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
