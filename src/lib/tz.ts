// Time-zone conversion helpers shared with the back office (adsum-back-office/src/
// lib/tz.ts). An activity's times are typed in the activity's own IANA zone, then
// stored as an absolute UTC instant so every member sees them in their own zone.

/** Offset (ms) of an IANA zone at a given UTC instant, via Intl. */
function offsetMs(zone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const n = (k: string): number => Number(p[k] ?? 0);
  const asIfUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asIfUtc - utcMs;
}

/** Interpret a naive "YYYY-MM-DDTHH:mm" as local to `zone`, return the UTC ISO instant. */
export function zonedToUtc(local: string, zone: string): string {
  const [d = "", t = ""] = local.split("T");
  const [y = 0, mo = 1, da = 1] = d.split("-").map(Number);
  const [h = 0, mi = 0] = t.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  // Two passes handle the DST boundary correctly.
  let off = offsetMs(zone, guess);
  off = offsetMs(zone, guess - off);
  return new Date(guess - off).toISOString();
}

/** Inverse of zonedToUtc: render a UTC ISO instant as a naive "YYYY-MM-DDTHH:mm"
 * local to `zone`, ready to fill a <input type="datetime-local"> when editing. */
export function utcToZoned(utcIso: string, zone: string): string {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return "";
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(d)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
