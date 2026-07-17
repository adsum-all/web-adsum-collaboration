// Real data layer for the collaboration spaces, replacing the prototype's
// localStorage store. Same function surface as the old localStorage store, but every
// call goes to the ADSUM collaboration API. No seed, no mock, no localStorage prototype layer.

import { ApiError, type Session } from "../api.js";
import type { Membre } from "./types.js";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "https://adsum-api.vercel.app";

// The signed-in session token and resolved member are cached at module level so
// the store functions keep the prototype's exact signatures (no token argument).
let token: string | null = null;
let me: Membre | null = null;

export function setToken(t: string | null): void {
  token = t;
}

export function resetToken(): void {
  token = null;
  me = null;
}

export function setMe(m: Membre | null): void {
  me = m;
}

export function cachedMe(): Membre | null {
  return me;
}

function initials(nom: string): string {
  return (
    nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "AD"
  );
}

function nameFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").trim();
  if (!local) return "Membre du comité";
  return local.replace(/[.\-_+]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Resolve the signed-in member from the collaboration profile endpoint, so the
 * shell shows the real display name (nom_affiche), not one fabricated from the
 * e-mail. Falls back to the auth account if the profile is unavailable. */
export async function resolveMe(session: Session): Promise<Membre> {
  const res = await fetch(`${BASE}/api/v1/collaboration/moi`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (res.ok) {
    return (await res.json()) as Membre;
  }
  // Fallback: the login account, name derived from the e-mail local part.
  const auth = await fetch(`${BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!auth.ok) throw new ApiError("Profil indisponible", auth.status);
  const u = (await auth.json()) as { id: string; email: string };
  const nom = nameFromEmail(u.email);
  return { id: u.id, nom, courriel: u.email, initiales: initials(nom) };
}

export async function request<T>(
  path: string,
  init: RequestInit,
  onError: string,
): Promise<T> {
  if (!token) throw new ApiError("Session absente", 401);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const message = res.status === 401 ? "Session expirée" : res.status === 403 ? "Accès refusé" : onError;
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function jbody(v: unknown): string {
  return JSON.stringify(v);
}
