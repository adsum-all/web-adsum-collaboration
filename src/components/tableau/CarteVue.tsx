import type { CarteProto, Espace, Membre } from "../../lib/types.js";

interface CarteVueProps {
  carte: CarteProto;
  espace: Espace;
  membres: Membre[];
  draggable: boolean;
  isDragging: boolean;
  dropBefore: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverIndex: (pos: "before" | "after") => void;
  onOpen: () => void;
}

// A single kanban card tile: labels, title, meta badges (number, priority, due date,
// checklist progress, comment count) and assignee avatars. Extracted from TableauPage
// to keep that screen under the size limit.
export function CarteVue({
  carte,
  espace,
  membres,
  draggable,
  isDragging,
  dropBefore,
  onDragStart,
  onDragEnd,
  onDragOverIndex,
  onOpen,
}: CarteVueProps): JSX.Element {
  const etiquettes = espace.etiquettes.filter((e) => carte.etiquettes.includes(e.id));
  const assignes = membres.filter((m) => carte.assignes.includes(m.id));
  const checklistsTotal = carte.checklists.reduce((s, cl) => s + cl.items.length, 0);
  const checklistsFait = carte.checklists.reduce((s, cl) => s + cl.items.filter((i) => i.fait).length, 0);

  return (
    <>
      {dropBefore && <div className="kanban-drop-zone kanban-drop-zone-over">Déposer ici</div>}
      <article
        className={`kanban-card${isDragging ? " kanban-card-dragging" : ""}`}
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", carte.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const before = e.clientY - rect.top < rect.height / 2;
          onDragOverIndex(before ? "before" : "after");
        }}
      >
        {etiquettes.length > 0 && (
          <div className="kanban-card-etiq">
            {etiquettes.map((et) => (
              <span key={et.id} className="et-pill" style={{ background: et.couleur }} title={et.nom}>
                {et.nom}
              </span>
            ))}
          </div>
        )}
        <button type="button" className="kanban-card-main" onClick={onOpen}>
          <span className="kanban-card-title">{carte.titre}</span>
          <span className="kanban-card-meta">
            <span className="muted small">#{carte.numero}</span>
            {carte.priorite !== "normale" && (
              <span className={`badge badge-prio badge-prio-${carte.priorite}`}>
                {libellePriorite(carte.priorite)}
              </span>
            )}
            {carte.echeance && (
              <span className={`badge ${echeanceLate(carte.echeance) ? "badge-warn" : "badge-mut"}`}>
                {formatDate(carte.echeance)}
              </span>
            )}
            {checklistsTotal > 0 && (
              <span className="badge badge-mut">
                {checklistsFait}/{checklistsTotal}
              </span>
            )}
            {carte.commentaires.length > 0 && (
              <span className="badge badge-mut" aria-label="commentaires">
                {carte.commentaires.length} comm.
              </span>
            )}
          </span>
          {assignes.length > 0 && (
            <span className="kanban-card-avatars">
              {assignes.map((a) => (
                <span key={a.id} className="avatar avatar-sm" title={a.nom} aria-hidden="true">
                  {a.initiales}
                </span>
              ))}
            </span>
          )}
        </button>
      </article>
    </>
  );
}

export function libellePriorite(p: string): string {
  switch (p) {
    case "urgente":
      return "Urgente";
    case "haute":
      return "Haute";
    case "basse":
      return "Basse";
    default:
      return "Normale";
  }
}

export function echeanceLate(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
