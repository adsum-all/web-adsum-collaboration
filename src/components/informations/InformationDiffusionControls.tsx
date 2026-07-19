/** Mandatory priority display duration (computes expire_le) and the diffusion
 * channels selection for an Information. The in-app feed is always the official
 * source; Telegram and e-mail are relays. Split from InformationEditor to keep
 * each file under the size threshold. */
import { useEffect } from "react";

// Mandatory display-duration presets: an Information is never active indefinitely.
const DUREES: { id: string; label: string; heures: number | null }[] = [
  { id: "6h", label: "6 heures", heures: 6 },
  { id: "12h", label: "12 heures", heures: 12 },
  { id: "24h", label: "24 heures", heures: 24 },
  { id: "48h", label: "48 heures", heures: 48 },
  { id: "72h", label: "72 heures", heures: 72 },
  { id: "7j", label: "7 jours", heures: 168 },
  { id: "date", label: "Jusqu'à une date précise", heures: null },
];
const CANAUX: { id: string; label: string; verrou?: boolean }[] = [
  { id: "application", label: "Application membre", verrou: true },
  { id: "push", label: "Notification push" },
  { id: "telegram", label: "Telegram" },
  { id: "email", label: "E-mail" },
];

export function DiffusionControls({
  editable,
  expireLe,
  duree,
  onDuree,
  onExpire,
  canaux,
  onCanaux,
}: Readonly<{
  editable: boolean;
  expireLe: string | undefined;
  duree: string;
  onDuree: (v: string) => void;
  onExpire: (iso: string | undefined) => void;
  canaux: string[];
  onCanaux: (next: string[]) => void;
}>): JSX.Element {
  // Back the shown preset (24h by default) with a real expire_le the moment the form
  // opens, when none is set yet. Without this, the select displays "24 heures" but no
  // value exists behind it (a fresh draft, or a saved draft with a null expire_le), so
  // Publier stays disabled until the user re-picks a duration, which never fires the
  // select's onChange when the shown option is already selected. This removes that trap.
  useEffect(() => {
    if (!editable || expireLe) return;
    const p = DUREES.find((x) => x.id === duree);
    onExpire(new Date(Date.now() + (p && p.heures != null ? p.heures : 24) * 3600 * 1000).toISOString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <p className="field-group-title">Durée d&apos;affichage prioritaire (obligatoire)</p>
      <div className="info-two">
        <label className="field">
          <span>Durée</span>
          <select
            value={duree}
            disabled={!editable}
            onChange={(e) => {
              const d = e.target.value;
              onDuree(d);
              const p = DUREES.find((x) => x.id === d);
              if (p && p.heures != null) onExpire(new Date(Date.now() + p.heures * 3600 * 1000).toISOString());
              else if (d === "date" && !expireLe) onExpire(new Date(Date.now() + 24 * 3600 * 1000).toISOString());
            }}
          >
            {DUREES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
        {duree === "date" && (
          <label className="field">
            <span>Fin d&apos;activation</span>
            <input type="datetime-local" disabled={!editable} value={(expireLe ?? "").slice(0, 16)} onChange={(e) => onExpire(e.target.value ? new Date(e.target.value).toISOString() : undefined)} />
          </label>
        )}
      </div>
      <p className="muted small">Après cette échéance, l&apos;information sort du bloc prioritaire mais reste consultable dans l&apos;historique. Une information ne peut pas rester active indéfiniment.</p>

      <p className="field-group-title">Canaux de diffusion</p>
      <div className="info-canaux">
        {CANAUX.map((c) => {
          const on = c.verrou || canaux.includes(c.id);
          return (
            <label key={c.id} className="field-check">
              <input
                type="checkbox"
                disabled={!editable || c.verrou}
                checked={on}
                onChange={(e) => {
                  const cur = new Set(canaux);
                  if (e.target.checked) cur.add(c.id); else cur.delete(c.id);
                  cur.add("application");
                  onCanaux([...cur]);
                }}
              />
              <span>{c.label}{c.verrou ? " (toujours actif)" : c.id === "telegram" ? " (par défaut)" : ""}</span>
            </label>
          );
        })}
      </div>
      <p className="muted small">L&apos;application membre est la source officielle. Telegram et e-mail relaient l&apos;information avec un lien vers ADSUM.</p>
    </>
  );
}
