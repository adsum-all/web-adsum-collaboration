// Cards, columns, checklists, comments and reactions: real API calls that mirror
// the prototype store surface. Endpoints live under /api/v1/collaboration.
import type { CarteProto, ColonneProto, CommentaireProto, PieceJointe } from "./types.js";
import { request, jbody } from "./http.js";

export interface PieceInput { nom: string; type: string; taille: number; data_url: string }

const B = "/api/v1/collaboration";

// Columns
export function listColonnes(tableauId: string): Promise<ColonneProto[]> {
  return request(`${B}/tableaux/${tableauId}/colonnes`, { method: "GET" }, "Colonnes indisponibles");
}
export function createColonne(tableauId: string, nom: string): Promise<ColonneProto> {
  return request(`${B}/tableaux/${tableauId}/colonnes`, { method: "POST", body: jbody({ nom }) }, "Colonne non creee");
}
export function updateColonne(id: string, patch: Partial<ColonneProto>): Promise<ColonneProto> {
  return request(`${B}/colonnes/${id}`, { method: "PATCH", body: jbody(patch) }, "Colonne non mise a jour");
}
export function deleteColonne(id: string): Promise<void> {
  return request(`${B}/colonnes/${id}`, { method: "DELETE" }, "Colonne non supprimee");
}
export function reordonnerColonnes(tableauId: string, ordre: string[]): Promise<void> {
  return request(`${B}/tableaux/${tableauId}/colonnes/ordre`, { method: "POST", body: jbody({ ordre }) }, "Reordonnancement impossible");
}

// Live presence: heartbeat while a card is open, returns the other current viewers.
export interface Presence { utilisateur_id: string; nom: string; initiales: string }
export function battementPresence(carteId: string): Promise<Presence[]> {
  return request(`${B}/cartes-espace/${carteId}/presence`, { method: "POST" }, "Presence indisponible");
}
export function quitterPresence(carteId: string): Promise<void> {
  return request(`${B}/cartes-espace/${carteId}/presence`, { method: "DELETE" }, "Presence indisponible");
}

// Cards
export function listCartes(tableauId: string): Promise<CarteProto[]> {
  return request(`${B}/tableaux/${tableauId}/cartes`, { method: "GET" }, "Cartes indisponibles");
}
export function listMesCartes(): Promise<CarteProto[]> {
  return request(`${B}/mes-cartes`, { method: "GET" }, "Cartes indisponibles");
}
export function createCarteProto(input: { tableau_id: string; colonne_id: string; titre: string }): Promise<CarteProto> {
  return request(`${B}/cartes-espace`, { method: "POST", body: jbody(input) }, "Carte non creee");
}
export function updateCarteProto(id: string, patch: Partial<CarteProto>): Promise<CarteProto> {
  return request(`${B}/cartes-espace/${id}`, { method: "PATCH", body: jbody(patch) }, "Carte non mise a jour");
}
export function deleteCarteProto(id: string): Promise<void> {
  return request(`${B}/cartes-espace/${id}`, { method: "DELETE" }, "Carte non supprimee");
}
export function moveCarte(carteId: string, toColonneId: string, toIndex: number): Promise<CarteProto> {
  return request(
    `${B}/cartes-espace/${carteId}/deplacer`,
    { method: "POST", body: jbody({ colonne_id: toColonneId, position: toIndex }) },
    "Deplacement impossible",
  );
}
export function duplicateCarte(carteId: string): Promise<CarteProto> {
  return request(`${B}/cartes-espace/${carteId}/dupliquer`, { method: "POST" }, "Duplication impossible");
}

/** Options for publishing a card as a real activity (evenement). The audience is
 * chosen explicitly; the date falls back to the card's due date server-side. */
export interface PublicationActivite {
  cible_type: "general" | "coordination" | "commission" | "intendance" | "tribu";
  cible_id?: string | null;
  debut?: string | null;
  lieu?: string | null;
  type?: string | null;
  visibilite?: "public" | "membres" | "prive";
}

/** Publish a card as a real activity fed to the member agenda through the shared
 * back-office activity engine. Space members are notified server-side. */
export function publierCarteEnActivite(carteId: string, options: PublicationActivite): Promise<CarteProto> {
  return request(
    `${B}/cartes-espace/${carteId}/publier`,
    { method: "POST", body: jbody(options) },
    "Publication impossible",
  );
}
export function deplacerCarteVersTableau(carteId: string, tableauCibleId: string): Promise<CarteProto> {
  return request(
    `${B}/cartes-espace/${carteId}/deplacer-tableau`,
    { method: "POST", body: jbody({ tableau_id: tableauCibleId }) },
    "Deplacement impossible",
  );
}
export function toggleArchiveCarte(carteId: string, archive: boolean): Promise<void> {
  return request(
    `${B}/cartes-espace/${carteId}/archive`,
    { method: "POST", body: jbody({ archive }) },
    "Archivage impossible",
  );
}
export function listCartesArchivees(tableauId: string): Promise<CarteProto[]> {
  return request(`${B}/tableaux/${tableauId}/cartes-archivees`, { method: "GET" }, "Cartes indisponibles");
}

// Checklists
export function toggleChecklistItem(carteId: string, checklistId: string, itemId: string): Promise<void> {
  return request(
    `${B}/checklist-items/${itemId}/basculer`,
    { method: "POST", body: jbody({ carte_id: carteId, checklist_id: checklistId }) },
    "Action impossible",
  );
}
export function ajouterChecklist(carteId: string, titre: string): Promise<void> {
  return request(`${B}/cartes-espace/${carteId}/checklists`, { method: "POST", body: jbody({ titre }) }, "Ajout impossible");
}
export function ajouterChecklistItem(carteId: string, checklistId: string, texte: string): Promise<void> {
  return request(
    `${B}/checklists/${checklistId}/items`,
    { method: "POST", body: jbody({ carte_id: carteId, texte }) },
    "Ajout impossible",
  );
}

// Comments and reactions
export function ajouterCommentaire(carteId: string, corps: string): Promise<CommentaireProto> {
  return request(`${B}/cartes-espace/${carteId}/commentaires`, { method: "POST", body: jbody({ corps }) }, "Envoi impossible");
}
export function marquerCommentairesLus(carteId: string): Promise<void> {
  return request(`${B}/cartes-espace/${carteId}/lu`, { method: "POST" }, "Action impossible");
}
export function reagirCommentaire(carteId: string, commentaireId: string, type: "pouce" | "coche"): Promise<void> {
  return request(
    `${B}/commentaires/${commentaireId}/reaction`,
    { method: "POST", body: jbody({ carte_id: carteId, type }) },
    "Reaction impossible",
  );
}
export function modifierCommentaire(commentaireId: string, corps: string): Promise<CommentaireProto> {
  return request(`${B}/commentaires/${commentaireId}`, { method: "PATCH", body: jbody({ corps }) }, "Modification impossible");
}
export function supprimerCommentaire(commentaireId: string): Promise<void> {
  return request(`${B}/commentaires/${commentaireId}`, { method: "DELETE" }, "Suppression impossible");
}

// Attachments (cards and comments)
export function uploadCartePiece(carteId: string, piece: PieceInput): Promise<PieceJointe> {
  return request(`${B}/cartes-espace/${carteId}/pieces`, { method: "POST", body: jbody(piece) }, "Ajout de piece impossible");
}
export function uploadCommentPiece(commentaireId: string, piece: PieceInput): Promise<PieceJointe> {
  return request(`${B}/commentaires/${commentaireId}/pieces`, { method: "POST", body: jbody(piece) }, "Ajout de piece impossible");
}
export function supprimerPiece(pieceId: string): Promise<void> {
  return request(`${B}/pieces/${pieceId}`, { method: "DELETE" }, "Suppression impossible");
}
export function definirCouverture(carteId: string, pieceId: string | null): Promise<void> {
  return request(`${B}/cartes-espace/${carteId}/couverture`, { method: "POST", body: jbody({ piece_id: pieceId }) }, "Action impossible");
}

// Checklists and items (advanced)
export function renommerChecklist(checklistId: string, titre: string): Promise<void> {
  return request(`${B}/checklists/${checklistId}`, { method: "PATCH", body: jbody({ titre }) }, "Action impossible");
}
export function supprimerChecklist(checklistId: string): Promise<void> {
  return request(`${B}/checklists/${checklistId}`, { method: "DELETE" }, "Suppression impossible");
}
export function modifierChecklistItem(
  itemId: string,
  patch: { texte?: string; assigne_id?: string | null; assignes?: string[]; echeance?: string | null },
): Promise<void> {
  return request(`${B}/checklist-items/${itemId}`, { method: "PATCH", body: jbody(patch) }, "Action impossible");
}
export function supprimerChecklistItem(itemId: string): Promise<void> {
  return request(`${B}/checklist-items/${itemId}`, { method: "DELETE" }, "Suppression impossible");
}
export function reordonnerChecklistItems(checklistId: string, ordre: string[]): Promise<void> {
  return request(`${B}/checklists/${checklistId}/items/ordre`, { method: "POST", body: jbody({ ordre }) }, "Action impossible");
}
export function convertirItemEnCarte(itemId: string, colonneId?: string | null): Promise<{ id: string }> {
  return request(
    `${B}/checklist-items/${itemId}/convertir`,
    { method: "POST", body: jbody({ colonne_id: colonneId ?? null }) },
    "Conversion impossible",
  );
}
