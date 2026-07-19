import { useState } from "react";

import { ajouterOccurrences } from "../../lib/store.js";
import { utcToZoned, zonedToUtc } from "../../lib/tz.js";

type Ajout = "reguliere" | "dates";

/** Add whole days to a naive "YYYY-MM-DDTHH:mm", keeping the same wall-clock time. */
function addDaysLocal(local: string, days: number): string {
  const [d = "", t = "00:00"] = local.split("T");
  const [y = 0, mo = 1, da = 1] = d.split("-").map(Number);
  const [h = 0, mi = 0] = t.split(":").map(Number);
  const dt = new Date(y, mo - 1, da + days, h, mi);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

interface Props {
  activiteId: string;
  debut: string;
  fin: string | null;
  zone: string;
  estSerie: boolean;
  onChanged: () => void;
}

// Additive occurrence editor (identical to the back office): append dates to an
// activity's series without touching the existing ones. A one-off becomes a series
// on the first append.
export function SerieOccurrences({ activiteId, debut, fin, zone, estSerie, onChanged }: Props): JSX.Element {
  const dureeMs = fin ? new Date(fin).getTime() - new Date(debut).getTime() : 0;
  const [ajout, setAjout] = useState<Ajout>("reguliere");
  const [freq, setFreq] = useState<"quotidienne" | "hebdomadaire">("hebdomadaire");
  const [premiere, setPremiere] = useState(() => addDaysLocal(utcToZoned(debut, zone), 7));
  const [nombre, setNombre] = useState(1);
  const [dates, setDates] = useState<string[]>([addDaysLocal(utcToZoned(debut, zone), 1)]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function withFin(debutU: string): { debut: string; fin?: string } {
    const occ: { debut: string; fin?: string } = { debut: debutU };
    if (dureeMs > 0) occ.fin = new Date(new Date(debutU).getTime() + dureeMs).toISOString();
    return occ;
  }

  function build(): { debut: string; fin?: string }[] {
    if (ajout === "dates") return dates.filter(Boolean).map((d) => withFin(zonedToUtc(d, zone)));
    const step = freq === "hebdomadaire" ? 7 : 1;
    const n = Math.min(Math.max(1, Math.floor(nombre)), 104);
    const out: { debut: string; fin?: string }[] = [];
    for (let k = 0; k < n; k += 1) out.push(withFin(zonedToUtc(addDaysLocal(premiere, k * step), zone)));
    return out;
  }

  async function submit(): Promise<void> {
    const occurrences = build();
    if (occurrences.length === 0) { setError("Ajoutez au moins une date."); return; }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await ajouterOccurrences(activiteId, occurrences);
      setNote(r.ajoutees > 0
        ? `${r.ajoutees} date(s) ajoutée(s). La série compte désormais ${r.total} date(s).`
        : "Aucune date ajoutée (dates déjà programmées ou limite de 104 atteinte).");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ajout des dates impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: "1px dashed var(--adsum-line, #e2e2e2)", marginTop: 12, paddingTop: 12 }}>
      <span className="muted small" style={{ fontWeight: 600 }}>Répétition et dates de la série</span>
      <p className="muted small" style={{ margin: "4px 0 8px" }}>
        {estSerie
          ? "Cette activité fait partie d'une série. Ajoutez d'autres dates : chaque date devient une activité réelle."
          : "Activité unique. Ajoutez des dates pour en faire une série récurrente, sans rien perdre de l'actuelle."}
      </p>
      {note && <p className="small" style={{ color: "var(--ok, #1a7f37)" }}>{note}</p>}
      {error && <p className="small" style={{ color: "var(--danger, #c0392b)" }}>{error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted small">Ajouter par</span>
          <select value={ajout} onChange={(e) => setAjout(e.target.value as Ajout)}>
            <option value="reguliere">Rythme régulier</option>
            <option value="dates">Dates précises</option>
          </select>
        </label>
        {ajout === "reguliere" ? (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted small">Fréquence</span>
              <select value={freq} onChange={(e) => setFreq(e.target.value as "quotidienne" | "hebdomadaire")}>
                <option value="quotidienne">Quotidienne</option>
                <option value="hebdomadaire">Hebdomadaire</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted small">Première nouvelle date</span>
              <input type="datetime-local" value={premiere} onChange={(e) => setPremiere(e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="muted small">Nombre à ajouter (max 104)</span>
              <input type="number" min={1} max={104} value={nombre} onChange={(e) => setNombre(Number(e.target.value))} />
            </label>
          </>
        ) : (
          <div style={{ width: "100%" }}>
            {dates.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input type="datetime-local" value={row} style={{ flex: 1 }} onChange={(e) => setDates((rows) => rows.map((x, j) => (j === i ? e.target.value : x)))} />
                <button type="button" className="btn btn-ghost btn-inline" onClick={() => setDates((rows) => rows.filter((_, j) => j !== i))}>Retirer</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => setDates((rows) => [...rows, addDaysLocal(utcToZoned(debut, zone), 1)])}>+ Ajouter une date</button>
          </div>
        )}
      </div>
      <button type="button" className="btn btn-primary btn-inline" style={{ marginTop: 8 }} disabled={busy} onClick={() => void submit()}>
        {busy ? "Ajout..." : "Ajouter les dates à la série"}
      </button>
    </div>
  );
}
