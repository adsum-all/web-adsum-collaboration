import { useEffect, useMemo, useState } from "react";

/**
 * Planification d'activite: separe clairement les DATES des HORAIRES.
 *
 * Le calendrier ne sert qu'aux dates; l'heure de debut et l'heure de fin sont
 * saisies a part, par jour. Une activite qui dure plusieurs jours n'est PAS
 * continue: chaque jour devient une seance reelle (une occurrence) avec sa propre
 * heure de debut et de fin sur le MEME jour, donc un pointage et un questionnaire
 * par jour. Modes couverts: jour unique, plusieurs jours a horaires identiques,
 * plusieurs jours a horaires differents (intermittent, creneaux multiples), et
 * recurrence hebdomadaire simple.
 *
 * La sortie est une liste de creneaux en heure locale (le parent la convertit en
 * UTC). Le premier creneau est le "maitre" (debut/fin), les suivants sont les
 * occurrences de la serie.
 */

export interface Creneau {
  date: string; // YYYY-MM-DD
  debut: string; // HH:mm
  fin: string; // HH:mm
  mode?: string;
}

export interface Plan {
  debut: string; // local YYYY-MM-DDTHH:mm (premier creneau)
  fin: string; // local YYYY-MM-DDTHH:mm
  occurrences: { debut: string; fin: string; mode?: string }[];
}

type ModePlan = "unique" | "multi_meme" | "multi_diff" | "hebdo";

const MODES: { id: ModePlan; label: string; aide: string }[] = [
  { id: "unique", label: "Jour unique", aide: "Une seule date, une plage horaire." },
  { id: "multi_meme", label: "Plusieurs jours, mêmes horaires", aide: "Une période, mêmes heures chaque jour. Retirez les jours sans séance." },
  { id: "multi_diff", label: "Plusieurs jours, horaires différents", aide: "Chaque séance a sa date et ses heures. Répétez une date pour plusieurs créneaux le même jour." },
  { id: "hebdo", label: "Récurrence hebdomadaire", aide: "Le même jour de semaine, mêmes heures, sur plusieurs semaines." },
];

const JOURS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function toLocal(date: string, heure: string): string {
  return `${date}T${heure}`;
}
// End on the same day, unless the end time is at or before the start (an overnight
// session), in which case the end is explicitly the next calendar day.
function finLocale(date: string, hDebut: string, hFin: string): string {
  if (hFin > hDebut) return toLocal(date, hFin);
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() + 1);
  const j = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return toLocal(j, hFin);
}
function jourDeSemaine(date: string): number {
  return new Date(`${date}T00:00`).getDay();
}
function ajouterJours(date: string, n: number): string {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function frDate(date: string): string {
  const d = new Date(`${date}T00:00`);
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function PlanificationActivite({ modeDefaut, onChange }: Readonly<{ modeDefaut?: string; onChange: (plan: Plan | null) => void }>): JSX.Element {
  const [mode, setMode] = useState<ModePlan>("unique");
  const [date, setDate] = useState("");
  const [hDebut, setHDebut] = useState("18:00");
  const [hFin, setHFin] = useState("20:00");
  // multi_meme: a period, minus removed days.
  const [dateFin, setDateFin] = useState("");
  const [joursRetires, setJoursRetires] = useState<Set<string>>(new Set());
  // multi_diff: explicit list of slots.
  const [creneaux, setCreneaux] = useState<Creneau[]>([{ date: "", debut: "18:00", fin: "20:00", mode: modeDefaut }]);
  // hebdo: number of weeks.
  const [semaines, setSemaines] = useState(4);

  // Compute the ordered list of slots for the chosen mode.
  const slots: Creneau[] = useMemo(() => {
    if (mode === "unique") {
      return date ? [{ date, debut: hDebut, fin: hFin }] : [];
    }
    if (mode === "multi_meme") {
      if (!date) return [];
      const out: Creneau[] = [];
      const fin = dateFin && dateFin >= date ? dateFin : date;
      let cur = date;
      let garde = 0;
      while (cur <= fin && garde < 400) {
        if (!joursRetires.has(cur)) out.push({ date: cur, debut: hDebut, fin: hFin });
        cur = ajouterJours(cur, 1);
        garde += 1;
      }
      return out;
    }
    if (mode === "multi_diff") {
      return creneaux
        .filter((c) => c.date && c.debut && c.fin)
        .slice()
        .sort((a, b) => (a.date + a.debut).localeCompare(b.date + b.debut));
    }
    // hebdo
    if (!date) return [];
    const out: Creneau[] = [];
    const n = Math.min(Math.max(1, Math.floor(semaines)), 104);
    for (let k = 0; k < n; k += 1) out.push({ date: ajouterJours(date, k * 7), debut: hDebut, fin: hFin });
    return out;
  }, [mode, date, hDebut, hFin, dateFin, joursRetires, creneaux, semaines]);

  // Emit the plan (or null when nothing valid yet).
  useEffect(() => {
    const tete = slots[0];
    if (!tete) { onChange(null); return; }
    const reste = slots.slice(1);
    onChange({
      debut: toLocal(tete.date, tete.debut),
      fin: finLocale(tete.date, tete.debut, tete.fin),
      occurrences: reste.map((c) => ({ debut: toLocal(c.date, c.debut), fin: finLocale(c.date, c.debut, c.fin), mode: c.mode })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const periodeJours: string[] = useMemo(() => {
    if (mode !== "multi_meme" || !date) return [];
    const fin = dateFin && dateFin >= date ? dateFin : date;
    const out: string[] = [];
    let cur = date;
    let garde = 0;
    while (cur <= fin && garde < 400) { out.push(cur); cur = ajouterJours(cur, 1); garde += 1; }
    return out;
  }, [mode, date, dateFin]);

  return (
    <div className="full plan-box">
      <label>
        <span>Type de planification</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as ModePlan)}>
          {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <span className="muted small" style={{ fontWeight: 400 }}>{MODES.find((m) => m.id === mode)?.aide}</span>
      </label>

      {(mode === "unique" || mode === "hebdo") && (
        <div className="plan-row">
          <label><span>{mode === "hebdo" ? "Première date *" : "Date *"}</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <label><span>Heure de début *</span><input type="time" value={hDebut} onChange={(e) => setHDebut(e.target.value)} required /></label>
          <label><span>Heure de fin *</span><input type="time" value={hFin} onChange={(e) => setHFin(e.target.value)} required /></label>
          {mode === "hebdo" && <label><span>Nombre de semaines</span><input type="number" min={1} max={104} value={semaines} onChange={(e) => setSemaines(Number(e.target.value))} /></label>}
        </div>
      )}

      {mode === "multi_meme" && (
        <>
          <div className="plan-row">
            <label><span>Du (première date) *</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
            <label><span>Au (dernière date) *</span><input type="date" value={dateFin} min={date} onChange={(e) => setDateFin(e.target.value)} required /></label>
            <label><span>Heure de début *</span><input type="time" value={hDebut} onChange={(e) => setHDebut(e.target.value)} required /></label>
            <label><span>Heure de fin *</span><input type="time" value={hFin} onChange={(e) => setHFin(e.target.value)} required /></label>
          </div>
          {periodeJours.length > 1 && (
            <div className="plan-jours">
              <span className="muted small">Jours actifs (décochez un jour sans séance) :</span>
              <div className="plan-chips">
                {periodeJours.map((j) => {
                  const actif = !joursRetires.has(j);
                  return (
                    <button key={j} type="button" className={`plan-chip ${actif ? "is-on" : ""}`}
                      onClick={() => setJoursRetires((s) => { const c = new Set(s); if (c.has(j)) c.delete(j); else c.add(j); return c; })}>
                      {frDate(j)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {mode === "multi_diff" && (
        <div className="plan-diff">
          <span className="muted small" style={{ display: "block", marginBottom: 6 }}>Ajoutez chaque séance. Répétez une date pour plusieurs créneaux le même jour (ex. matin puis soir).</span>
          {creneaux.map((c, i) => (
            <div key={i} className="plan-row plan-diff-row">
              <label><span>Date</span><input type="date" value={c.date} onChange={(e) => setCreneaux((r) => r.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} /></label>
              <label><span>Début</span><input type="time" value={c.debut} onChange={(e) => setCreneaux((r) => r.map((x, j) => (j === i ? { ...x, debut: e.target.value } : x)))} /></label>
              <label><span>Fin</span><input type="time" value={c.fin} onChange={(e) => setCreneaux((r) => r.map((x, j) => (j === i ? { ...x, fin: e.target.value } : x)))} /></label>
              <label><span>Mode</span>
                <select value={c.mode ?? "presentiel"} onChange={(e) => setCreneaux((r) => r.map((x, j) => (j === i ? { ...x, mode: e.target.value } : x)))}>
                  <option value="presentiel">Présentiel</option>
                  <option value="en_ligne">En ligne</option>
                  <option value="hybride">Hybride</option>
                </select>
              </label>
              <button type="button" className="btn btn-ghost btn-inline" disabled={creneaux.length <= 1} onClick={() => setCreneaux((r) => r.filter((_, j) => j !== i))}>Retirer</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-inline" onClick={() => setCreneaux((r) => [...r, { date: r[r.length - 1]?.date ?? "", debut: "18:00", fin: "20:00", mode: modeDefaut }])}>+ Ajouter une séance</button>
        </div>
      )}

      <div className="plan-resume">
        {slots.length === 0 ? (
          <span className="muted small">Renseignez au moins une date et ses heures.</span>
        ) : (
          <>
            <strong>{slots.length} séance{slots.length > 1 ? "s" : ""}</strong>
            <span className="muted small"> ({slots.length > 1 ? "un pointage et un questionnaire par jour" : "pointage et questionnaire"})</span>
            <ul className="plan-liste">
              {slots.slice(0, 6).map((c, i) => (
                <li key={i}>{frDate(c.date)} · {c.debut} - {c.fin}{jourDeSemaine(c.date) >= 0 && mode === "hebdo" ? ` (${JOURS_FR[jourDeSemaine(c.date)]})` : ""}</li>
              ))}
              {slots.length > 6 && <li className="muted">… et {slots.length - 6} autre(s)</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
