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

// ===========================================================================
// Informations importantes: ported verbatim from the back-office so this app
// offers the SAME feature against the SAME endpoints. Token-based helpers are
// local here (distinct from lib/http.ts) so the ported components stay unchanged.
// ===========================================================================
export interface MembreProfile {
  id: string;
  matricule: string;
  code_membre?: string | null;
  email: string;
  nom: string | null;
  prenoms: string | null;
  nom_affichage?: string;
  nom_naissance?: string | null;
  nom_marital?: string | null;
  nom_affiche?: string | null;
  est_berger?: boolean;
  nom_pastoral?: string | null;
  nom_pastoral_affiche?: string | null;
  fonction_perimetre?: string | null;
  fonctions?: { libelle: string; perimetre: string | null }[];
  telephone: string | null;
  groupe: string | null;
  statut: string;
  verifie: boolean;
  genre: string | null;
  date_naissance: string | null;
  pays: string | null;
  ville: string | null;
  date_entree: string | null;
  cheminement_pastoral: string | null;
  statut_administratif: string | null;
  type_membre: string | null;
  promotion: string | null;
  situation_matrimoniale: string | null;
  type_mariage: string | null;
  profession: string | null;
  niveau_etudes: string | null;
  baptise: boolean | null;
  confirme: boolean | null;
  premiere_communion: boolean | null;
  commission: string | null;
  intendance: string | null;
  intendance_id: string | null;
  berger: string | null;
  berger_referent_id: string | null;
  tribu: string | null;
  tribu_id: string | null;
  patriarche: string | null;
  coordination: string | null;
  coordinateur: string | null;
  fonction_cle?: string | null;
  fonction_confirmee?: boolean;
  titre?: string | null;
  photo_focus_x?: number | null;
  photo_focus_y?: number | null;
}

export interface Intendance {
  id: string;
  nom: string;
  description: string | null;
  pays_code: string | null;
  pays: string | null;
  continent: string | null;
  ville: string | null;
  statut: string;
  coordination_id: string | null;
  coordination: string | null;
  publie: boolean;
  parent_id: string | null;
  parent: string | null;
  responsable: string | null;
  responsable_titre: string | null;
}

export interface Coordination {
  id: string;
  nom: string;
  description: string | null;
  pays_code: string | null;
  pays: string | null;
  continent: string | null;
  ville: string | null;
  statut: string;
  publie: boolean;
  parent_id: string | null;
  parent: string | null;
  responsable: string | null;
  responsable_titre: string | null;
}

// Optional fields accept null so an edit can explicitly CLEAR a value (e.g.
// detach a parent). Sending undefined omits the field (leaves it unchanged);
// sending null sets it to empty on the server.

export interface SousCommission {
  id: string;
  nom: string;
  commission_id: string | null;
  commission: string | null;
  publie: boolean;
}

export interface Tribu {
  id: string;
  nom: string;
  description?: string | null;
  publie?: boolean;
  patriarche: string | null;
  patriarche_membre_id: string | null;
  patriarche_nom: string | null;
}

export interface Statistiques {
  membres_total: number;
  membres_actifs: number;
  membres_verifies: number;
  membres_en_attente: number;
  evenements_total: number;
  presences_total: number;
  commissions_total: number;
  missions_total: number;
  intendances_total: number;
  par_commission: { commission: string; total: number }[];
  par_cheminement: { cheminement: string; total: number }[];
  entrees_mensuelles: { mois: string; total: number }[];
  membres_a_verifier: { id: string; matricule: string; prenoms: string | null; nom: string | null }[];
  par_type_evenement: { nom: string; couleur: string; total: number; pourcentage: number }[];
}

export interface Commission {
  id: string;
  nom: string;
  description: string | null;
  publie: boolean;
  type_organisation: string;
}

/** URL segment for the organization management endpoints. */

export interface MembreListQuery {
  limit?: number;
  offset?: number;
  q?: string;
  pays?: string;
  commission_id?: string;
  intendance_id?: string;
  coordination_id?: string;
  tribu_id?: string;
  /** Directory compartment (validation/operational status): actifs, en_attente,
   * corrections, refuses, incomplets, inactifs, suspendus, tous. */
  statut?: string;
  /** Sort order: nom (default, alphabetical), nom_desc, inscription, maj, matricule. */
  tri?: string;
}

function messageForStatus(status: number, fallback: string): string {
  if (status === 401) return "Session expirée";
  if (status === 403) return "Accès refusé";
  if (status === 404) return "Ressource indisponible";
  if (status === 409) return "Action impossible en l'état : cette entité est encore utilisée.";
  return fallback;
}

/** Read the server-provided reason (FastAPI `detail`) so an actionable message,
 * e.g. a 409 "still referenced" refusal, is shown instead of an opaque fallback.
 * A plain string detail is surfaced as-is; a 422 validation error returns `detail`
 * as a list of {loc, msg, type}, whose `msg` fields are concatenated so the reason
 * is actionable; anything else falls back to the status-based message. */

async function detailOr(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    const detail = body?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : ""))
        .filter((m) => m.trim());
      if (msgs.length > 0) return msgs.join("; ");
    }
  } catch {
    /* body not JSON: keep the status-based message */
  }
  return messageForStatus(res.status, fallback);
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit,
  onError: string,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new ApiError(await detailOr(res, onError), res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function authedGet<T>(path: string, token: string, onError: string): Promise<T> {
  return request<T>(path, token, { method: "GET" }, onError);
}

function authedSend<T>(
  path: string,
  token: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body: unknown,
  onError: string,
): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) init.body = JSON.stringify(body);
  return request<T>(path, token, init, onError);
}

function buildQuery(query: MembreListQuery): string {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.q) params.set("q", query.q);
  if (query.pays) params.set("pays", query.pays);
  if (query.commission_id) params.set("commission_id", query.commission_id);
  if (query.intendance_id) params.set("intendance_id", query.intendance_id);
  if (query.coordination_id) params.set("coordination_id", query.coordination_id);
  if (query.tribu_id) params.set("tribu_id", query.tribu_id);
  if (query.statut) params.set("statut", query.statut);
  if (query.tri) params.set("tri", query.tri);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function getMembres(token: string, query: MembreListQuery = {}): Promise<MembreProfile[]> {
  return authedGet<MembreProfile[]>(
    `/api/v1/admin/membres${buildQuery(query)}`,
    token,
    "Membres indisponibles",
  );
}

export function getCommissions(token: string): Promise<Commission[]> {
  return authedGet<Commission[]>("/api/v1/admin/commissions", token, "Commissions indisponibles");
}

export async function exportInformationCSV(token: string, infoId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/admin/informations/${infoId}/export`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Export impossible");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `diffusion-${infoId}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Re-send a sent Information on its relay channels to the recipients who have not read it. */

export function relanceInformation(token: string, infoId: string): Promise<{ non_lus: number; telegram: { envoyes: number }; email: { envoyes: number } }> {
  return authedSend(`/api/v1/admin/informations/${infoId}/relance`, token, "POST", {}, "Relance impossible");
}

export function getIntendances(token: string): Promise<Intendance[]> {
  return authedGet<Intendance[]>("/api/v1/admin/intendances", token, "Intendances indisponibles");
}

export function getCoordinations(token: string): Promise<Coordination[]> {
  return authedGet<Coordination[]>("/api/v1/admin/coordinations", token, "Coordinations indisponibles");
}

export function getSousCommissions(token: string): Promise<SousCommission[]> {
  return authedGet<SousCommission[]>("/api/v1/admin/sous-commissions", token, "Sous-commissions indisponibles");
}

export function getTribus(token: string): Promise<Tribu[]> {
  return authedGet<Tribu[]>("/api/v1/admin/tribus", token, "Tribus indisponibles");
}

/** Assign (membreId set) or revoke (membreId null) the human patriarche of a tribe. */

export type InformationPriorite = "normale" | "importante" | "urgente";

export type InformationStatut = "brouillon" | "programme" | "envoye" | "archive";

export interface InfoCroisement {
  commission_id?: string | null;
  intendance_id?: string | null;
  coordination_id?: string | null;
  groupe?: string | null;
}

export interface InfoCibleRef {
  code: string;
  cible_id?: string | null;
  /** Manual selection: explicit member ids, used with the reserved code "selection". */
  membre_ids?: string[];
  /** Crossed targeting (commission inside a coordination/stewardship, sub-group). */
  croisement?: InfoCroisement;
  /** Display label kept client side (unit or member names) so chips stay readable. */
  libelle?: string;
}

/** Connected account's own member profile, used to prefill the author field. */

export interface MonProfilAuteur {
  nom_affiche?: string | null;
  prenoms?: string | null;
  nom?: string | null;
  fonction_cle?: string | null;
  fonctions?: { cle: string; libelle?: string | null; principale?: boolean }[];
}

export function getMonProfilAuteur(token: string): Promise<MonProfilAuteur> {
  return authedGet("/api/v1/membres/me", token, "Profil indisponible");
}

export interface Information {
  id: string;
  titre: string;
  sous_titre: string | null;
  contenu: string;
  priorite: InformationPriorite;
  auteur: string | null;
  signature: string | null;
  signature_url: string | null;
  protege: boolean;
  institutionnelle: boolean;
  affiche_entete: boolean;
  canaux: string[];
  statut: InformationStatut;
  requiert_accuse: boolean;
  lecture_vocale_auto: boolean;
  lien_url: string | null;
  action_label: string | null;
  action_url: string | null;
  audio_url: string | null;
  image_url: string | null;
  document_url: string | null;
  expire_le: string | null;
  epingle_jusqu: string | null;
  cibles: InfoCibleRef[];
  cree_le: string | null;
  envoye_le: string | null;
}

export interface InformationInput {
  titre: string;
  sous_titre?: string | null;
  contenu: string;
  priorite: InformationPriorite;
  auteur?: string | null;
  signature?: string | null;
  signature_url?: string | null;
  protege?: boolean;
  institutionnelle?: boolean;
  affiche_entete?: boolean;
  canaux?: string[];
  requiert_accuse?: boolean;
  lecture_vocale_auto?: boolean;
  lien_url?: string | null;
  action_label?: string | null;
  action_url?: string | null;
  expire_le?: string | null;
  epingle_jusqu?: string | null;
  cibles: InfoCibleRef[];
}

export interface InformationStats {
  destinataires: number;
  lus: number;
  confirmes: number;
  non_lus: number;
  taux_lecture: number;
  taux_confirmation: number;
}

/** A reusable targeting segment from the shared destination referential. */

export interface CibleReference {
  code: string;
  libelle: string;
  description: string | null;
  categorie: string | null;
  type_regle: string;
}

export function listInformations(token: string, statut?: InformationStatut): Promise<Information[]> {
  const q = statut ? `?statut=${statut}` : "";
  return authedGet(`/api/v1/admin/informations${q}`, token, "Informations indisponibles");
}

export function createInformation(token: string, input: InformationInput): Promise<Information> {
  return authedSend("/api/v1/admin/informations", token, "POST", input, "Création de l'information impossible");
}

export function updateInformation(token: string, id: string, input: Partial<InformationInput>): Promise<Information> {
  return authedSend(`/api/v1/admin/informations/${id}`, token, "PATCH", input, "Modification impossible");
}

export function deleteInformation(token: string, id: string): Promise<void> {
  return authedSend(`/api/v1/admin/informations/${id}`, token, "DELETE", undefined, "Suppression impossible");
}

export function publishInformation(token: string, id: string): Promise<{ ok: boolean; destinataires: number }> {
  return authedSend(`/api/v1/admin/informations/${id}/publier`, token, "POST", undefined, "Publication impossible");
}

export function archiveInformation(token: string, id: string): Promise<Information> {
  return authedSend(`/api/v1/admin/informations/${id}/archiver`, token, "POST", undefined, "Archivage impossible");
}

export function apercuDestinataires(token: string, id: string): Promise<{ destinataires_uniques: number; segments: number }> {
  return authedSend(`/api/v1/admin/informations/${id}/apercu-destinataires`, token, "POST", undefined, "Aperçu impossible");
}

export function getInformationStats(token: string, id: string): Promise<InformationStats> {
  return authedGet(`/api/v1/admin/informations/${id}/statistiques`, token, "Statistiques indisponibles");
}

export function getCiblesReference(token: string): Promise<CibleReference[]> {
  return authedGet("/api/v1/reference/cibles-activite", token, "Destinations indisponibles");
}

/** Attach (or clear with an empty data URL) a voice note, cover image or document
 * on an Information draft. The payload is a base64 data URL, stored inline. */

export function uploadInformationMedia(
  token: string,
  id: string,
  kind: "audio" | "image" | "document",
  dataUrl: string,
): Promise<Information> {
  return authedSend(`/api/v1/admin/informations/${id}/media`, token, "POST", { kind, data_url: dataUrl }, "Envoi du média impossible");
}
