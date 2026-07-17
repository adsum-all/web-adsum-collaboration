// Session persistence for the ADSUM committee collaboration prototype.
// Stores only the token and role. Purged when the user clicks "Quitter".

import type { Session } from "./api.js";

const KEY = "adsum.collab.session";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    if (!parsed || typeof parsed.token !== "string" || typeof parsed.role !== "string") return null;
    return { token: parsed.token, role: parsed.role };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* ignore quota errors */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
