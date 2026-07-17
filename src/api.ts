// Client for the ADSUM committee collaboration API. Reserved to committee roles.

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "https://adsum-api.vercel.app";

export type Role = "super_admin" | "admin" | "gestionnaire" | "direction" | string;

export interface Session {
  token: string;
  role: Role;
  email?: string;
}

export interface Tableau {
  id: string;
  nom: string;
  description: string | null;
  cartes_total: number;
  cree_le: string | null;
}

export interface Colonne {
  id: string;
  nom: string;
  position: number;
}

export interface Carte {
  id: string;
  tableau_id: string;
  colonne_id: string;
  titre: string;
  description: string | null;
  type_activite: string | null;
  date_prevue: string | null;
  lieu: string | null;
  position: number;
  publie: boolean;
  evenement_id: string | null;
}

export interface TableauDetail {
  id: string;
  nom: string;
  description: string | null;
  colonnes: Colonne[];
  cartes: Carte[];
}

export interface Commentaire {
  id: string;
  auteur_nom: string | null;
  corps: string;
  cree_le: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Stable per-device id kept in localStorage, sent as X-Device-Id so the server can
 * remember a trusted device for the two-factor window. A random UUID, never PII. */
export function deviceId(): string {
  if (typeof localStorage === "undefined") return "";
  let id = localStorage.getItem("adsum.device.id");
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("adsum.device.id", id);
  }
  return id;
}

export interface LoginResult {
  // When the second factor is required, otpRequired is true and token is empty;
  // the caller then collects the code and calls loginVerify.
  otpRequired: boolean;
  session: Session | null;
  canal: string | null;
}

function loginError(status: number): ApiError {
  if (status === 401) return new ApiError("Identifiants invalides ou mot de passe temporaire expiré", status);
  if (status === 429) return new ApiError("Trop de tentatives. Patientez quelques minutes, puis réessayez.", status);
  if (status === 400) return new ApiError("Code incorrect ou expiré. Vérifiez et réessayez.", status);
  return new ApiError("Service momentanément indisponible.", status);
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Device-Id": deviceId() },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw loginError(res.status);
  const data = (await res.json()) as { otp_required?: boolean; access_token?: string | null; role?: Role; canal?: string | null };
  return {
    otpRequired: Boolean(data.otp_required),
    session: data.access_token ? { token: data.access_token, role: data.role ?? "", email } : null,
    canal: data.canal ?? null,
  };
}

/** Second step of a 2FA login: submit the one-time code (optionally trust this
 * device) to obtain the session token. */
export async function loginVerify(email: string, password: string, code: string, faireConfiance: boolean): Promise<Session> {
  const res = await fetch(`${BASE}/api/v1/auth/login-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Device-Id": deviceId() },
    body: JSON.stringify({ email, password, code, faire_confiance: faireConfiance }),
  });
  if (!res.ok) throw loginError(res.status);
  const data = (await res.json()) as { access_token?: string | null; role?: Role };
  if (!data.access_token) throw loginError(401);
  return { token: data.access_token, role: data.role ?? "", email };
}

/** Effective permissions of the signed-in account, used to gate access to the app
 * by capability (collaboration.superviser) rather than by a hard-coded role. */
export async function getMesPermissions(token: string): Promise<string[]> {
  const res = await fetch(`${BASE}/api/v1/membres/me/permissions`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError("Impossible de vérifier vos accès", res.status);
  const data = (await res.json()) as { permissions?: string[] };
  return data.permissions ?? [];
}

// The legacy board/card endpoints (/api/v1/collaboration/tableaux and /cartes)
// were removed: they bypassed per-space membership and leaked cards across spaces.
// The space-scoped flow (lib/store + /espaces/... endpoints) is the only path now.

export function apiBaseUrl(): string {
  return BASE;
}
