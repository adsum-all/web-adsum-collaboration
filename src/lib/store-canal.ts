// Moderator channel data layer: every call reaches the ADSUM collaboration API.
// No mock, no localStorage. Transcription runs server-side through the pluggable
// AI providers (configured from the back office).
import { jbody, request } from "./http.js";
import type { CanalCategorie, CanalMessage, EtapeWorkflow, Priorite } from "./types.js";

const B = "/api/v1/collaboration";

export function listCanal(statut?: string, espaceId?: string): Promise<CanalMessage[]> {
  const p = new URLSearchParams();
  if (statut && statut !== "tous") p.set("statut", statut);
  if (espaceId) p.set("espace_id", espaceId);
  const q = p.toString();
  return request(`${B}/canal${q ? `?${q}` : ""}`, { method: "GET" }, "Canal indisponible");
}

export function compteurCanal(espaceId?: string): Promise<{ nouveaux: number }> {
  const q = espaceId ? `?espace_id=${encodeURIComponent(espaceId)}` : "";
  return request(`${B}/canal/compteur${q}`, { method: "GET" }, "Compteur indisponible");
}

// --- Instruction workflow -------------------------------------------------------
export function priseEnChargeCanal(id: string): Promise<CanalMessage> {
  return request(`${B}/canal/${id}/prise-en-charge`, { method: "POST", body: jbody({}) }, "Prise en charge impossible");
}
export function affecterCanal(id: string, espaceId: string | null, assignes: string[]): Promise<CanalMessage> {
  return request(`${B}/canal/${id}/affecter`, { method: "POST", body: jbody({ espace_id: espaceId, assignes }) }, "Affectation impossible");
}
export function chargerTableauCanal(id: string, tableauId: string, colonneId: string): Promise<CanalMessage> {
  return request(`${B}/canal/${id}/charger-tableau`, { method: "POST", body: jbody({ tableau_id: tableauId, colonne_id: colonneId }) }, "Chargement impossible");
}
export function restituerCanal(id: string, rapport: string, resume: string): Promise<CanalMessage> {
  return request(`${B}/canal/${id}/restituer`, { method: "POST", body: jbody({ rapport, resume }) }, "Restitution impossible");
}
export function cloturerCanal(id: string): Promise<CanalMessage> {
  return request(`${B}/canal/${id}/cloturer`, { method: "POST", body: jbody({}) }, "Clôture impossible");
}
export function getWorkflowCanal(id: string): Promise<EtapeWorkflow[]> {
  return request(`${B}/canal/${id}/workflow`, { method: "GET" }, "Suivi indisponible");
}

// Request the back-office to provision this workspace's dedicated instruction bot.
export function demanderConfigBot(espaceId: string): Promise<{ ok: boolean; statut: string }> {
  return request(`${B}/espaces/${espaceId}/canal/demander-config`, { method: "POST", body: jbody({}) }, "Demande impossible");
}

export interface ImportTelegram {
  importees: number;
  ignorees_deja_vues: number;
  ignorees_non_autorisees: number;
  messages: string[];
}

// Pull the voice notes sent to the bot into the channel. On demand (no webhook),
// so the OTP and account-linking flows that also read getUpdates keep working.
export function importerNotesTelegram(espaceId?: string): Promise<ImportTelegram> {
  const q = espaceId ? `?espace_id=${encodeURIComponent(espaceId)}` : "";
  return request(`${B}/canal/telegram/importer${q}`, { method: "POST", body: jbody({}) }, "Import Telegram impossible");
}

export interface CanalCreateInput {
  sujet?: string;
  note?: string;
  categorie?: CanalCategorie;
  priorite?: Priorite;
  espace_id?: string | null;
}

export function createCanal(input: CanalCreateInput): Promise<CanalMessage> {
  return request(`${B}/canal`, { method: "POST", body: jbody(input) }, "Message non cree");
}

export interface CanalPatchInput {
  sujet?: string;
  note?: string;
  categorie?: CanalCategorie;
  priorite?: Priorite;
  statut?: string;
  assigne_id?: string | null;
  espace_id?: string | null;
  // Link to a parent channel (continuity tree); "" clears the link.
  parent_id?: string | null;
}

export function updateCanal(id: string, patch: CanalPatchInput): Promise<CanalMessage> {
  return request(`${B}/canal/${id}`, { method: "PATCH", body: jbody(patch) }, "Mise a jour impossible");
}

export function deleteCanal(id: string): Promise<void> {
  return request(`${B}/canal/${id}`, { method: "DELETE" }, "Suppression impossible");
}

interface PieceInput {
  nom: string;
  type: string;
  data_url: string;
  duree_s?: number | null;
}

// --- Voice notes (several per channel, each with its own transcription) ----------

export function ajouterNote(canalId: string, audio: PieceInput): Promise<CanalMessage> {
  return request(`${B}/canal/${canalId}/notes`, { method: "POST", body: jbody(audio) }, "Note non ajoutee");
}

export function transcrireNote(noteId: string): Promise<CanalMessage> {
  return request(`${B}/canal/notes/${noteId}/transcrire`, { method: "POST" }, "Transcription impossible");
}

export function redigerNote(noteId: string): Promise<CanalMessage> {
  return request(`${B}/canal/notes/${noteId}/rediger`, { method: "POST" }, "Redaction impossible");
}

export interface NotePatchInput {
  transcription_brute?: string;
  transcription_redigee?: string;
  audio_conserver?: boolean;
}

export function patchNote(noteId: string, patch: NotePatchInput): Promise<CanalMessage> {
  return request(`${B}/canal/notes/${noteId}`, { method: "PATCH", body: jbody(patch) }, "Mise a jour impossible");
}

export function supprimerNote(noteId: string): Promise<void> {
  return request(`${B}/canal/notes/${noteId}`, { method: "DELETE" }, "Suppression impossible");
}

// --- Attachments (documents/images at the channel level) ------------------------

export function ajouterPieceCanal(id: string, piece: PieceInput): Promise<CanalMessage> {
  return request(`${B}/canal/${id}/pieces`, { method: "POST", body: jbody(piece) }, "Piece non ajoutee");
}

export function supprimerPieceCanal(pieceId: string): Promise<void> {
  return request(`${B}/canal/pieces/${pieceId}`, { method: "DELETE" }, "Suppression impossible");
}

export function repondreCanal(id: string, corps: string): Promise<CanalMessage> {
  return request(`${B}/canal/${id}/reponses`, { method: "POST", body: jbody({ corps }) }, "Reponse impossible");
}

export function creerCarteCanal(id: string, tableauId: string, colonneId: string): Promise<{ carte_id: string }> {
  return request(
    `${B}/canal/${id}/creer-carte`,
    { method: "POST", body: jbody({ tableau_id: tableauId, colonne_id: colonneId }) },
    "Carte non creee",
  );
}
