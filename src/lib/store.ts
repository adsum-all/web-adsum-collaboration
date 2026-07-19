// Real collaboration data layer. Same function surface as the prototype's
// the localStorage store, but every call reaches the ADSUM collaboration API. No seed, no
// localStorage, no mock, no localStorage prototype layer. Split across store-tableaux and store-cartes
// to stay small; this module re-exports them so components import one path.
import type { Session } from "../api.js";
import type {
  CarteProto,
  Espace,
  Etiquette,
  Membre,
  Notification,
  Priorite,
  RoleEspace,
  TypeEspace,
} from "./types.js";
import { cachedMe, jbody, request, resetToken, resolveMe, setMe, setToken } from "./http.js";

const B = "/api/v1/collaboration";

// Session lifecycle. Caches the token immediately and resolves the current
// member, returning it so the caller can put it in state (call this once from an
// effect, never on every render).
export function initStore(session: Session): Promise<Membre | null> {
  setToken(session.token);
  // Load the platform permissions and the member in parallel, but only surface the
  // member (which triggers the first render) once the permissions are known. Otherwise
  // the write-permission gates (peutEcrireCollaboration) evaluate against a null cache
  // on the first paint and hide every write control until a later tick, even for a
  // super_admin. chargerPermissions never rejects (it fails closed to an empty set).
  const permissionsPrete = chargerPermissions();
  return resolveMe(session)
    .then(async (m) => {
      await permissionsPrete;
      setMe(m);
      return m;
    })
    .catch(() => {
      setMe(null);
      return null;
    });
}

export function resetStore(): void {
  resetToken();
}

export function currentMembre(): Membre {
  const m = cachedMe();
  if (!m) throw new Error("Membre courant non resolu");
  return m;
}

// Spaces
export function listEspaces(): Promise<Espace[]> {
  return request(`${B}/espaces`, { method: "GET" }, "Espaces indisponibles");
}
export function getEspace(id: string): Promise<Espace | null> {
  return request(`${B}/espaces/${id}`, { method: "GET" }, "Espace indisponible");
}
export function listMembres(): Promise<Membre[]> {
  return request(`${B}/membres`, { method: "GET" }, "Membres indisponibles");
}
export function createEspace(
  input: Pick<Espace, "nom" | "description" | "type" | "couleur"> & { parent_id?: string },
): Promise<Espace> {
  return request(`${B}/espaces`, { method: "POST", body: jbody(input) }, "Espace non cree");
}
export function updateEspace(
  id: string,
  patch: Partial<Pick<Espace, "nom" | "description" | "observateurs_commentent" | "archive">>,
): Promise<Espace> {
  return request(`${B}/espaces/${id}`, { method: "PATCH", body: jbody(patch) }, "Espace non mis a jour");
}
export function toggleArchiveEspace(id: string, archive: boolean): Promise<void> {
  return request(`${B}/espaces/${id}`, { method: "PATCH", body: jbody({ archive }) }, "Archivage impossible").then(
    () => undefined,
  );
}
// Deletion policy for a workspace (and its sub-spaces):
//  corbeille = reversible trash (or immediate if retention is 0)
//  definitif = erase the workspace AND all its canal instructions/boards/files
//  definitif_garder_canal = erase the workspace but keep its canal as detached archives
//  archiver = archive instead of deleting (reversible)
export type PolitiqueSuppression = "corbeille" | "definitif" | "definitif_garder_canal" | "archiver";
export function supprimerEspace(id: string, politique: PolitiqueSuppression = "corbeille"): Promise<Record<string, unknown>> {
  return request(`${B}/espaces/${id}?politique=${politique}`, { method: "DELETE" }, "Suppression impossible");
}

// Archived (reversible) workspaces the caller belongs to, listed apart from the active
// ones so an unarchive action can be offered without polluting the main Home grid.
export function listEspacesArchives(): Promise<Espace[]> {
  return request(`${B}/espaces/archives`, { method: "GET" }, "Espaces archivés indisponibles");
}

// Trash: soft-deleted workspaces and boards recoverable until the retention window ends.
export interface CorbeilleEspace { id: string; nom: string; sous_espace: boolean; supprime_le: string | null; jours_restants: number; }
export interface CorbeilleTableau { id: string; nom: string; espace_id: string; supprime_le: string | null; jours_restants: number; }
export interface Corbeille { retention_jours: number; espaces: CorbeilleEspace[]; tableaux: CorbeilleTableau[]; }
export function listCorbeille(): Promise<Corbeille> {
  return request(`${B}/corbeille`, { method: "GET" }, "Corbeille indisponible");
}
export function restaurerEspace(id: string): Promise<void> {
  return request(`${B}/espaces/${id}/restaurer`, { method: "POST" }, "Restauration impossible").then(() => undefined);
}
export function restaurerTableau(id: string): Promise<void> {
  return request(`${B}/tableaux-espace/${id}/restaurer`, { method: "POST" }, "Restauration impossible").then(() => undefined);
}

// Members and access requests
export function addMembreEspace(espaceId: string, membreId: string, role: RoleEspace): Promise<Espace> {
  return request(`${B}/espaces/${espaceId}/membres`, { method: "POST", body: jbody({ membre_id: membreId, role }) }, "Ajout impossible");
}
export function changeRoleMembre(espaceId: string, membreId: string, role: RoleEspace): Promise<Espace> {
  return request(`${B}/espaces/${espaceId}/membres/${membreId}`, { method: "PATCH", body: jbody({ role }) }, "Role non change");
}
export function removeMembreEspace(espaceId: string, membreId: string): Promise<Espace> {
  return request(`${B}/espaces/${espaceId}/membres/${membreId}`, { method: "DELETE" }, "Retrait impossible");
}
export function demanderAcces(espaceId: string, membreId: string): Promise<Espace> {
  return request(`${B}/espaces/${espaceId}/demandes`, { method: "POST", body: jbody({ membre_id: membreId }) }, "Demande impossible");
}
export function accepterDemande(espaceId: string, demandeId: string, role: RoleEspace = "membre"): Promise<Espace> {
  return request(`${B}/espaces/${espaceId}/demandes/${demandeId}/accepter`, { method: "POST", body: jbody({ role }) }, "Action impossible");
}
export function refuserDemande(espaceId: string, demandeId: string): Promise<Espace> {
  return request(`${B}/espaces/${espaceId}/demandes/${demandeId}`, { method: "DELETE" }, "Action impossible");
}

export interface RejoindreResultat {
  espace_id: string;
  espace_nom: string;
  statut: string;
}

/** Follow an invitation link: files an access request for the current member
 * (or reports they are already a member). */
export function rejoindreEspace(jeton: string): Promise<RejoindreResultat> {
  return request(`${B}/rejoindre/${encodeURIComponent(jeton)}`, { method: "POST" }, "Invitation invalide");
}

// Labels
export function createEtiquette(espaceId: string, input: Omit<Etiquette, "id">): Promise<Etiquette> {
  return request(`${B}/espaces/${espaceId}/etiquettes`, { method: "POST", body: jbody(input) }, "Etiquette non creee");
}
export function updateEtiquette(espaceId: string, id: string, patch: Partial<Etiquette>): Promise<Etiquette> {
  return request(`${B}/espaces/${espaceId}/etiquettes/${id}`, { method: "PATCH", body: jbody(patch) }, "Etiquette non mise a jour");
}
export function deleteEtiquette(espaceId: string, id: string): Promise<void> {
  return request(`${B}/espaces/${espaceId}/etiquettes/${id}`, { method: "DELETE" }, "Etiquette non supprimee");
}

// Current member profile (read-only: identity is managed centrally in the back
// office and governed by the civil-identity rules, so collaboration only reads it).
export function getMoi(): Promise<Membre> {
  return request<Membre>(`${B}/moi`, { method: "GET" }, "Profil indisponible").then((m) => {
    setMe(m);
    return m;
  });
}

// Display preferences: reuse the member-level endpoints (permission membres.self, held by
// every collaboration user). They persist the choice server-side so it follows the member
// across all apps; the theme is also applied and cached locally for instant effect.
export function setThemePref(theme: "light" | "dark" | "system"): Promise<void> {
  return request(`/api/v1/membres/me/theme`, { method: "PUT", body: jbody({ theme }) }, "Changement de thème impossible").then(() => undefined);
}
export function setLanguePref(langue: "fr" | "en"): Promise<void> {
  return request(`/api/v1/membres/me/langue`, { method: "PUT", body: jbody({ langue }) }, "Changement de langue impossible").then(() => undefined);
}

// Notifications
export function listNotifications(): Promise<Notification[]> {
  return request(`${B}/notifications`, { method: "GET" }, "Notifications indisponibles");
}
export function marquerNotifLue(id: string): Promise<void> {
  return request(`${B}/notifications/${id}/lue`, { method: "POST" }, "Action impossible");
}
export function marquerToutesNotifsLues(): Promise<void> {
  return request(`${B}/notifications/toutes-lues`, { method: "POST" }, "Action impossible");
}

// Calendar / my cards with a due date
export function listCartesAvecEcheance(): Promise<Array<CarteProto & { espace_id: string | null }>> {
  return request(`${B}/cartes-echeance`, { method: "GET" }, "Echeances indisponibles");
}

// Real activities published from the visible spaces (same rows as the member
// agenda and the back office), so the collaboration calendar stays aligned.
export interface ActivitePubliee {
  id: string;
  carte_id: string | null;
  tableau_id: string | null;
  espace_id: string | null;
  titre: string;
  type: string | null;
  type_evenement_nom?: string | null;
  couleur?: string | null;
  cible_type: string | null;
  debut: string | null;
  lieu: string | null;
}
export function listActivitesPubliees(): Promise<ActivitePubliee[]> {
  return request(`${B}/activites`, { method: "GET" }, "Activités indisponibles");
}

/** The FULL event payload, identical to the back-office event form: the same
 * fields, targeting, diffusion, response window and recurrence, so an activity
 * created from collaboration is exactly like one created from the back office. */
export interface EvenementPayload {
  titre: string;
  volet?: string;
  debut: string;
  fin?: string;
  lieu?: string;
  type?: string;
  type_evenement_id?: string | null;
  mode?: string;
  lien_session?: string;
  liens?: string[];
  type_diffusion?: "aucun" | "embed" | "externe";
  visibilite?: "public" | "membres" | "prive";
  cible_type?: "general" | "coordination" | "commission" | "intendance" | "tribu" | "bergers" | "responsables" | "liste";
  cible_id?: string | null;
  cible_genre?: "homme" | "femme" | null;
  cible_age_min?: number | null;
  cible_age_max?: number | null;
  cible_emails?: string[];
  fenetre_reponse_heures?: number | null;
  fuseau_horaire?: string;
  occurrences?: { debut: string; fin?: string | null; mode?: string | null }[];
  description?: string | null;
  intervenant_principal?: string | null;
  intervenants?: string[];
}

export function creerActivite(input: EvenementPayload): Promise<{ id: string }> {
  return request(`${B}/activites`, { method: "POST", body: jbody(input) }, "Activité non créée");
}

/** One activity's full details (same shape as the back office), to pre-fill the
 * collaboration edit form with every field. */
export interface EvenementDetail {
  id: string;
  titre: string;
  type: string | null;
  type_evenement_id: string | null;
  volet: string;
  debut: string;
  fin: string | null;
  lieu: string | null;
  mode: string | null;
  lien_session: string | null;
  liens: string[];
  type_diffusion: string;
  visibilite: string;
  cible_type: string;
  cible_id: string | null;
  cible_genre: string | null;
  cible_age_min: number | null;
  cible_age_max: number | null;
  cible_emails: string[];
  fenetre_reponse_heures: number | null;
  fuseau_horaire: string;
  serie_id: string | null;
  annule: boolean;
  description: string | null;
  intervenant_principal: string | null;
  intervenants: string[];
  cible_libelle?: string | null;
  tags?: { id: string; cle: string; libelle: string }[];
}
export function detailActivite(id: string): Promise<EvenementDetail> {
  return request(`${B}/activites/${id}`, { method: "GET" }, "Activité indisponible");
}
export function modifierActivite(
  id: string,
  payload: EvenementPayload,
  portee?: "toute_la_serie",
): Promise<EvenementDetail> {
  const q = portee ? "?portee=toute_la_serie" : "";
  return request(`${B}/activites/${id}${q}`, { method: "PUT", body: jbody(payload) }, "Activité non modifiée");
}
export function annulerActivite(id: string): Promise<{ id: string }> {
  return request(`${B}/activites/${id}/annuler`, { method: "POST" }, "Annulation impossible");
}

// Organisational units an activity can target, for the audience picker.
export interface CibleUnite { id: string; nom: string }
export interface Cibles {
  coordinations: CibleUnite[];
  commissions: CibleUnite[];
  intendances: CibleUnite[];
  tribus: CibleUnite[];
}
export function listCibles(): Promise<Cibles> {
  return request(`${B}/cibles`, { method: "GET" }, "Unités indisponibles");
}

// Administrable destinations referential (cible_activite): the audience picker
// loads its list from here, so a destination added, renamed or deactivated by an
// administrator is reflected in this form without any code change.
export interface CibleActiviteRef {
  code: string;
  libelle: string;
  description: string | null;
  categorie: string;
  type_regle: string;
  besoin_unite: boolean;
  ordre: number;
  statut: string;
  parametres: { table?: string; attribut?: string; fonction_cles?: string[]; toutes_fonctions?: boolean };
}
export function listCiblesActivite(): Promise<CibleActiviteRef[]> {
  return request(`/api/v1/reference/cibles-activite`, { method: "GET" }, "Destinations indisponibles");
}

// Published event types (catalogue) with their unique colour, for the planning
// dropdown. Read from the shared reference endpoint (any authenticated member).
export interface TypeEvenementRef { id: string; code: string; nom: string; couleur: string; description?: string | null }
export function listTypesEvenements(): Promise<TypeEvenementRef[]> {
  return request(`/api/v1/reference/types-evenements`, { method: "GET" }, "Types d'événements indisponibles");
}

// Read-only published organisation chart, for consultation in collaboration.
export interface OrgNoeud {
  id: string;
  type_noeud: string;
  nom: string | null;
  sous_titre?: string | null;
  membre_nom?: string | null;
  photo_url?: string | null;
  couleur?: string | null;
  effectif?: number | null;
}
export interface OrgLien { id: string; source_id: string; cible_id: string; type_lien: string; libelle?: string | null }
export interface OrganigrammePublie {
  version: { id: string; libelle: string; publie_le?: string | null } | null;
  noeuds: OrgNoeud[];
  liens: OrgLien[];
}
export function getOrganigrammePublie(): Promise<OrganigrammePublie> {
  return request(`/api/v1/organigramme/publie`, { method: "GET" }, "Organigramme indisponible");
}

// Activity attachments (images and files), shared with the back office.
export interface PieceEvenement {
  id: string;
  nom: string;
  type: string;
  taille: number;
  url: string;
  cree_le?: string | null;
}
export function listPiecesActivite(id: string): Promise<PieceEvenement[]> {
  return request(`${B}/activites/${id}/pieces`, { method: "GET" }, "Pièces indisponibles");
}
export function ajouterPieceActivite(id: string, piece: { nom: string; type: string; taille: number; data_url: string }): Promise<PieceEvenement> {
  return request(`${B}/activites/${id}/pieces`, { method: "POST", body: jbody(piece) }, "Pièce non ajoutée");
}
export function supprimerPieceActivite(pieceId: string): Promise<void> {
  return request(`${B}/activites/pieces/${pieceId}`, { method: "DELETE" }, "Suppression impossible");
}

// Additively append dates to an activity's series (a one-off becomes a series on
// the first append). Same shared engine as the back office.
export function ajouterOccurrences(id: string, occurrences: { debut: string; fin?: string }[]): Promise<{ ajoutees: number; total: number }> {
  return request(`${B}/activites/${id}/occurrences`, { method: "POST", body: jbody({ occurrences }) }, "Ajout des dates impossible");
}

// The signed-in account's platform permissions, cached, so the UI knows whether it
// may create/edit activities (collaboration.gerer) rather than guessing from a role.
let _permissions: string[] | null = null;
export async function chargerPermissions(): Promise<void> {
  try {
    const d = await request<{ permissions?: string[] }>(
      "/api/v1/membres/me/permissions",
      { method: "GET" },
      "Permissions indisponibles",
    );
    _permissions = d.permissions ?? [];
  } catch {
    _permissions = [];
  }
}
export function peutGererActivites(): boolean {
  return (_permissions ?? []).includes("collaboration.gerer");
}
// The Informations page (ported from the back-office) is gated by the read permission,
// same as the back-office menu; the API still enforces informations.gerer on mutations.
export function peutConsulterInformations(): boolean {
  return (_permissions ?? []).includes("informations.consulter");
}
// The custom board-template builder is gated by a dedicated permission granted via a
// governance group, so only that special role sees and uses the page.
export function peutCreerModeles(): boolean {
  return (_permissions ?? []).includes("collaboration.modeles");
}

// Any collaboration write (create/edit a board, a card, a comment, a checklist, a
// piece) requires the platform permission collaboration.gerer on the server, ON TOP
// of the space role. A space member holding only collaboration.superviser (e.g. the
// direction role) must therefore see read-only surfaces: the UI gates every write
// action with this so it never offers a button that the API will refuse with 403.
export function peutEcrireCollaboration(): boolean {
  return (_permissions ?? []).includes("collaboration.gerer");
}

// Stats
export interface StatsGlobales {
  espaces: number;
  tableaux: number;
  cartes: number;
  enRetard: number;
  termineesSemaine: number;
}
export function statsGlobales(): Promise<StatsGlobales> {
  return request(`${B}/stats`, { method: "GET" }, "Statistiques indisponibles");
}
export interface StatsEspace {
  tableaux: number;
  cartes: number;
  parPriorite: Record<Priorite, number>;
  parEtiquette: Array<{ id: string; nom: string; couleur: string; count: number }>;
  parAssigne: Array<{ id: string; nom: string; count: number }>;
}
export function statsEspace(espaceId: string): Promise<StatsEspace> {
  return request(`${B}/espaces/${espaceId}/stats`, { method: "GET" }, "Statistiques indisponibles");
}

// Search
export type ResultatRecherche =
  | { kind: "espace"; id: string; titre: string; sous_titre: string }
  | { kind: "tableau"; id: string; espace_id: string; titre: string; sous_titre: string }
  | { kind: "carte"; id: string; tableau_id: string; espace_id: string; titre: string; sous_titre: string };

export function rechercher(q: string): Promise<ResultatRecherche[]> {
  const query = q.trim();
  if (query.length === 0) return Promise.resolve([]);
  return request(`${B}/recherche?q=${encodeURIComponent(query)}`, { method: "GET" }, "Recherche indisponible");
}

export const PRIORITES: Priorite[] = ["urgente", "haute", "normale", "basse"];
export const TYPES_ESPACE: TypeEspace[] = ["coordination", "intendance", "commission", "direction", "autre"];

export * from "./store-tableaux.js";
export * from "./store-cartes.js";
