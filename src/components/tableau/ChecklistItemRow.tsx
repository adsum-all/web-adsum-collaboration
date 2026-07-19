import { useRef, useState } from "react";

import {
  convertirItemEnCarte,
  modifierChecklistItem,
  supprimerChecklistItem,
  toggleChecklistItem,
} from "../../lib/store.js";
import type { ChecklistItem, Membre } from "../../lib/types.js";
import { Popover } from "./Popover.js";

interface Props {
  item: ChecklistItem;
  carteId: string;
  checklistId: string;
  membres: Membre[];
  peutEditer: boolean;
  onChanged: () => Promise<void> | void;
  onDragStartItem?: () => void;
  onDragOverItem?: () => void;
  onDropItem?: () => void;
  survole?: boolean;
}

// A single checklist item: completion, inline title, assignee avatars (multiple,
// toggled from an avatar picker) and an overflow "..." menu holding the due date,
// convert-to-card and delete actions. Keeps the row uncluttered and ergonomic.
export function ChecklistItemRow({ item, carteId, checklistId, membres, peutEditer, onChanged, onDragStartItem, onDragOverItem, onDropItem, survole }: Props): JSX.Element {
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const pickerBtn = useRef<HTMLButtonElement | null>(null);
  const menuBtn = useRef<HTMLButtonElement | null>(null);
  const assignes = item.assignes ?? [];

  async function run(p: Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await p;
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  function toggleAssigne(id: string): void {
    const next = assignes.includes(id) ? assignes.filter((x) => x !== id) : [...assignes, id];
    void run(modifierChecklistItem(item.id, { assignes: next }));
  }

  const assignesMembres = membres.filter((m) => assignes.includes(m.id));

  return (
    <li
      onDragOver={(e) => { if (onDragOverItem) { e.preventDefault(); onDragOverItem(); } }}
      onDrop={(e) => { if (onDropItem) { e.preventDefault(); onDropItem(); } }}
      style={{
        display: "flex", alignItems: "flex-start", gap: 8, padding: "3px 0", flexWrap: "wrap",
        borderTop: survole ? "2px solid var(--adsum-acc, #0EA5E9)" : "2px solid transparent",
      }}
    >
      {peutEditer && onDragStartItem && (
        <span draggable title="Déplacer" onDragStart={onDragStartItem}
          style={{ cursor: "grab", color: "var(--adsum-mut, #9aa4b2)", padding: "0 2px", userSelect: "none", lineHeight: "20px" }}>≡</span>
      )}
      <label className="switch-row" style={{ flex: "1 1 55%", minWidth: 0, alignItems: "flex-start" }}>
        <input type="checkbox" checked={item.fait} disabled={!peutEditer || busy}
          onChange={() => void run(toggleChecklistItem(carteId, checklistId, item.id))} />
        <span className={item.fait ? "checklist-fait" : ""}>{item.texte}</span>
      </label>

      {/* Assignee avatars ("petits bonhommes") */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {assignesMembres.slice(0, 3).map((m) => (
          <span key={m.id} className="avatar avatar-sm" title={m.nom}
            style={{ marginLeft: -6, border: "2px solid var(--surface, #fff)" }}>{m.initiales}</span>
        ))}
        {assignesMembres.length > 3 && <span className="muted small" style={{ marginLeft: 2 }}>+{assignesMembres.length - 3}</span>}
        {peutEditer && (
          <button ref={pickerBtn} type="button" className="btn btn-ghost btn-inline" title="Assigner des personnes" disabled={busy}
            style={{ marginLeft: 4, padding: "0 6px", fontSize: 13, lineHeight: "20px" }}
            onClick={() => { setPicker((v) => !v); setMenu(false); }}>
            {assignesMembres.length === 0 ? "+ qui ?" : "+"}
          </button>
        )}
        <Popover open={picker} anchor={pickerBtn.current} onClose={() => setPicker(false)} align="right" minWidth={200}>
          <span className="muted small" style={{ display: "block", padding: "4px 10px" }}>Assigner (plusieurs possibles)</span>
          {membres.length === 0 && <span className="muted small" style={{ display: "block", padding: "4px 10px" }}>Aucun membre dans cet espace.</span>}
          {membres.map((m) => {
            const on = assignes.includes(m.id);
            return (
              <button key={m.id} type="button" className="mention-item" disabled={busy} onClick={() => toggleAssigne(m.id)}
                style={on ? { fontWeight: 600 } : undefined}>
                <span className="avatar avatar-sm">{m.initiales}</span>
                <span>{m.nom}</span>
                {on && <span style={{ marginLeft: "auto" }}>OK</span>}
              </button>
            );
          })}
        </Popover>
      </div>

      {/* Overflow "..." menu: due date, convert, delete */}
      {peutEditer && (
        <div style={{ display: "flex", alignItems: "center" }}>
          <button ref={menuBtn} type="button" className="btn btn-ghost btn-inline" title="Actions" disabled={busy}
            style={{ padding: "0 8px", fontSize: 16, lineHeight: "20px" }}
            onClick={() => { setMenu((v) => !v); setPicker(false); }}>...</button>
          <Popover open={menu} anchor={menuBtn.current} onClose={() => setMenu(false)} align="right" minWidth={220}>
            <div style={{ padding: 8 }}>
              <label className="muted small" style={{ display: "block", marginBottom: 6 }}>
                Echeance
                <input type="date" style={{ display: "block", width: "100%", marginTop: 2 }}
                  value={item.echeance ? item.echeance.slice(0, 10) : ""}
                  onChange={(e) => void run(modifierChecklistItem(item.id, { echeance: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
              </label>
              <button type="button" className="mention-item" style={{ width: "100%" }}
                onClick={() => { setMenu(false); void run(convertirItemEnCarte(item.id)); }}>Convertir en carte</button>
              <button type="button" className="mention-item" style={{ width: "100%", color: "var(--danger, #c0392b)" }}
                onClick={() => { setMenu(false); void run(supprimerChecklistItem(item.id)); }}>Supprimer</button>
            </div>
          </Popover>
        </div>
      )}
    </li>
  );
}
