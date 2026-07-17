
export type RoleEspace = "proprietaire" | "admin" | "membre" | "observateur";
export type TypeEspace = "coordination" | "intendance" | "commission" | "direction" | "autre";
export type Priorite = "urgente" | "haute" | "normale" | "basse";
export type Complexite = 1 | 2 | 3 | 5 | 8;
export type VisibiliteTableau = "espace" | "prive";

export interface Membre {
  id: string;
  nom: string;
  courriel: string;
  initiales: string;
}

export interface MembreEspace {
  membre_id: string;
  role: RoleEspace;
  nom: string;
  initiales: string;
}

export interface Etiquette {
  id: string;
  nom: string;
  couleur: string;
  par_defaut: boolean;
}

export interface SousEspace {
  id: string;
  nom: string;
  couleur: string;
  initiale: string;
  archive: boolean;
}

export interface Espace {
  id: string;
  nom: string;
  description: string;
  type: TypeEspace;
  couleur: string;
  initiale: string;
  membres: MembreEspace[];
  etiquettes: Etiquette[];
  observateurs_commentent: boolean;
  archive: boolean;
  invitation_jeton: string;
  demandes_acces: DemandeAcces[];
  // Hierarchy: parent workspace (null for a top-level space) and, for a top-level
  // space, its sub-spaces. A sub-space never contains sub-spaces (depth 1).
  parent_id: string | null;
  sous_espaces: SousEspace[];
  // Dedicated instruction bot of this general workspace (separate from the member
  // notification bot). Status: non_configure / demande / configure. The deep link /
  // QR are set only once the workspace's own bot is configured.
  instruction_bot_statut: string;
  instruction_bot_username: string | null;
  telegram_deep_link: string | null;
}

export interface DemandeAcces {
  id: string;
  membre_id: string;
  cree_le: string;
}

export interface ColonneProto {
  id: string;
  tableau_id: string;
  nom: string;
  position: number;
  couleur: string | null;
  repliee: boolean;
  wip: number | null;
  archivee: boolean;
}

export interface TableauProto {
  id: string;
  espace_id: string;
  nom: string;
  description: string;
  visibilite: VisibiliteTableau;
  participants: string[];
  favori: boolean;
  archive: boolean;
  modele: boolean;
  compteur_cartes: number;
  cree_le: string;
}

export interface ChecklistItem {
  id: string;
  texte: string;
  fait: boolean;
  assigne_id: string | null;
  assignes: string[];
  echeance: string | null;
}

export interface Checklist {
  id: string;
  titre: string;
  items: ChecklistItem[];
}

export type Rappel = "aucun" | "heure" | "1h" | "1j" | "2j";

export interface PieceJointe {
  id: string;
  nom: string;
  taille: number;
  type: string;
  cree_le: string;
  data_url: string | null;
  couverture: boolean;
}

export interface Reaction {
  membre_id: string;
  type: "pouce" | "coche";
}

export interface CommentaireProto {
  id: string;
  auteur_id: string;
  corps: string;
  cree_le: string;
  edite_le: string | null;
  reactions: Reaction[];
  pieces: PieceJointe[];
  lu_par: string[];
  mentions: string[];
}


export interface EntreeActivite {
  id: string;
  auteur_id: string;
  cree_le: string;
  texte: string;
}

export interface CarteProto {
  id: string;
  tableau_id: string;
  colonne_id: string;
  numero: number;
  titre: string;
  description: string;
  etiquettes: string[];
  assignes: string[];
  suiveurs: string[];
  debut: string | null;
  echeance: string | null;
  rappel: Rappel;
  priorite: Priorite;
  complexite: Complexite | null;
  position: number;
  checklists: Checklist[];
  pieces: PieceJointe[];
  commentaires: CommentaireProto[];
  activite: EntreeActivite[];
  archive: boolean;
  modele: boolean;
  couverture_id: string | null;
  publie?: boolean;
  evenement_id?: string | null;
}

export interface Notification {
  id: string;
  membre_id: string;
  type: "mention" | "assignation" | "echeance" | "carte_suivie" | "demande_acces";
  carte_id: string | null;
  espace_id: string | null;
  texte: string;
  cree_le: string;
  lue: boolean;
}

export interface HabillageColonneServeur {
  colonne_id: string;
  couleur: string | null;
  repliee: boolean;
  wip: number | null;
}

// Moderator channel (Canal Moderateur): voice-note driven instruction requests.
export type CanalCategorie =
  | "projet"
  | "activite"
  | "organisation"
  | "communication"
  | "urgence"
  | "autre";
export type CanalStatut = "nouveau" | "en_cours" | "traite" | "archive";
export type TranscriptionStatut = "aucune" | "en_cours" | "prete" | "echec";

export interface CanalPiece {
  id: string;
  nom: string;
  taille: number;
  type: string;
  cree_le: string | null;
  data_url: string | null;
  duree_s: number | null;
  est_audio: boolean;
}

export interface CanalReponse {
  id: string;
  auteur_id: string;
  corps: string;
  cree_le: string | null;
}

export interface CanalNote {
  id: string;
  ordre: number;
  audio: CanalPiece | null;
  transcription_brute: string;
  transcription_redigee: string;
  transcription_statut: TranscriptionStatut;
  transcription_erreur: string | null;
  audio_conserver: boolean;
  audio_expire_jours: number | null;
  cree_le: string | null;
}

export interface CanalLien {
  id: string;
  sujet: string;
  priorite: Priorite;
  statut: CanalStatut;
  cree_le: string | null;
}

export interface CanalMessage {
  id: string;
  auteur_id: string;
  espace_id: string | null;
  espace_nom: string | null;
  assigne_id: string | null;
  carte_id: string | null;
  parent_id: string | null;
  categorie: CanalCategorie;
  priorite: Priorite;
  statut: CanalStatut;
  sujet: string;
  note: string;
  // First-note mirror kept for backward compatibility; the UI uses `notes`.
  transcription_brute: string;
  transcription_redigee: string;
  transcription_statut: TranscriptionStatut;
  transcription_erreur: string | null;
  audio: CanalPiece | null;
  audio_conserver: boolean;
  audio_expire_jours: number | null;
  notes: CanalNote[];
  parent: CanalLien | null;
  enfants: CanalLien[];
  pieces: CanalPiece[];
  reponses: CanalReponse[];
  cree_le: string | null;
  // Instruction workflow.
  matricule: string | null;
  etape: EtapeInstruction;
  prise_en_charge_par: string | null;
  prise_en_charge_nom: string | null;
  prise_en_charge_le: string | null;
  assigne_espace_id: string | null;
  assigne_espace_nom: string | null;
  assignes: string[];
  restitution_rapport: string | null;
  restitution_resume: string | null;
  cloture_le: string | null;
  cloture_par: string | null;
}

export type EtapeInstruction =
  | "recue" | "transcrite" | "redigee" | "a_qualifier" | "prise_en_charge"
  | "affectee" | "chargee" | "en_traitement" | "traitee" | "restituee" | "a_verifier" | "cloturee";

export interface EtapeWorkflow {
  etape: string;
  detail: string | null;
  acteur: string | null;
  cree_le: string | null;
}
