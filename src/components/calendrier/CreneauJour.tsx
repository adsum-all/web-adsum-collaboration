/** Per-day slot editor for the activity EDIT form: a DATE plus a start time and an
 * end time, separated (never a fused datetime), so the end is always explicit and
 * lands on the SAME day (an end at or before the start is treated as an overnight
 * session ending the next calendar day). Mirrors the create planner's single-day
 * mode, so editing one occurrence is as clear as creating one. Emits local
 * "YYYY-MM-DDTHH:mm" strings for debut and fin. */
function ajouterJour(date: string): string {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CreneauJour({
  debut,
  fin,
  onChange,
}: Readonly<{ debut: string; fin: string; onChange: (debut: string, fin: string) => void }>): JSX.Element {
  const date = debut.slice(0, 10);
  const hDebut = debut.slice(11, 16) || "18:00";
  // Default the end two hours after the start when no end was set.
  const hFin = fin.slice(11, 16) || `${String((Number(hDebut.slice(0, 2)) + 2) % 24).padStart(2, "0")}${hDebut.slice(2)}`;

  function recompute(d: string, hd: string, hf: string): void {
    const finDate = hf > hd ? d : ajouterJour(d);
    onChange(`${d}T${hd}`, `${finDate}T${hf}`);
  }

  return (
    <>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Date *</span>
        <input type="date" value={date} onChange={(e) => recompute(e.target.value || date, hDebut, hFin)} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Heure de début *</span>
        <input type="time" value={hDebut} onChange={(e) => recompute(date, e.target.value || hDebut, hFin)} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Heure de fin *</span>
        <input type="time" value={hFin} onChange={(e) => recompute(date, hDebut, e.target.value || hFin)} />
      </label>
    </>
  );
}
