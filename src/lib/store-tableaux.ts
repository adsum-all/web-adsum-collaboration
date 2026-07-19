// Boards (rich, space-scoped) and board templates: real API calls mirroring the
// prototype store surface. Endpoints under /api/v1/collaboration.
import type { TableauProto, VisibiliteTableau } from "./types.js";
import { request, jbody } from "./http.js";

const B = "/api/v1/collaboration";

export type ModeleTableau = string;

export interface ModeleColonne {
  nom: string;
  couleur: string | null;
  wip: number | null;
}
export interface ModeleCatalogue {
  id: string;
  libelle: string;
  description: string;
  source?: "systeme" | "personnalise";
  colonnes: ModeleColonne[];
}

// Merged catalogue: the built-in templates plus the GLOBAL custom-template library
// (shared templates + the caller's private ones), the same in every workspace.
export function listModelesCatalogue(): Promise<ModeleCatalogue[]> {
  return request(`${B}/modeles-catalogue`, { method: "GET" }, "Modèles indisponibles");
}

// Custom board templates: a global library asset, not tied to a workspace. Building or
// managing one is gated by collaboration.modeles; anyone can reuse a shared one.
export interface ModelePerso {
  id: string;
  libelle: string;
  description: string;
  visibilite: "partage" | "prive";
  cree_par: string | null;
  source: "personnalise";
  colonnes: ModeleColonne[];
}
export interface ModelePersoInput {
  nom: string;
  description?: string;
  visibilite?: "partage" | "prive";
  colonnes: ModeleColonne[];
}

export function listModelesPerso(): Promise<ModelePerso[]> {
  return request(`${B}/modeles-perso`, { method: "GET" }, "Modèles indisponibles");
}
export function createModelePerso(input: ModelePersoInput): Promise<ModelePerso> {
  return request(`${B}/modeles-perso`, { method: "POST", body: jbody(input) }, "Modèle non créé");
}
export function updateModelePerso(id: string, patch: Partial<ModelePersoInput>): Promise<ModelePerso> {
  return request(`${B}/modeles-perso/${id}`, { method: "PATCH", body: jbody(patch) }, "Modèle non mis à jour");
}
export function deleteModelePerso(id: string): Promise<void> {
  return request(`${B}/modeles-perso/${id}`, { method: "DELETE" }, "Modèle non supprimé");
}

export function listTableauxEspace(espaceId: string): Promise<TableauProto[]> {
  return request(`${B}/espaces/${espaceId}/tableaux`, { method: "GET" }, "Tableaux indisponibles");
}
export function getTableauProto(id: string): Promise<TableauProto | null> {
  return request(`${B}/tableaux-espace/${id}`, { method: "GET" }, "Tableau indisponible");
}
export function createTableauProto(input: {
  espace_id: string;
  nom: string;
  description?: string;
  visibilite?: VisibiliteTableau;
}): Promise<TableauProto> {
  return request(`${B}/tableaux-espace`, { method: "POST", body: jbody(input) }, "Tableau non cree");
}
export function updateTableauProto(id: string, patch: Partial<TableauProto>): Promise<TableauProto> {
  return request(`${B}/tableaux-espace/${id}`, { method: "PATCH", body: jbody(patch) }, "Tableau non mis a jour");
}
export function deleteTableauProto(id: string): Promise<void> {
  return request(`${B}/tableaux-espace/${id}`, { method: "DELETE" }, "Tableau non supprime");
}
export function toggleArchiveTableau(id: string, archive: boolean): Promise<void> {
  return request(`${B}/tableaux-espace/${id}/archive`, { method: "POST", body: jbody({ archive }) }, "Archivage impossible");
}
export function listTableauxArchives(espaceId: string): Promise<TableauProto[]> {
  return request(`${B}/espaces/${espaceId}/tableaux-archives`, { method: "GET" }, "Tableaux indisponibles");
}
// Board participants (Trello-style sharing of a private board).
export interface ParticipantTableau {
  utilisateur_id: string;
  nom: string;
  initiales: string;
  role_espace: string | null;
}
export function listParticipantsTableau(tableauId: string): Promise<ParticipantTableau[]> {
  return request(`${B}/tableaux-espace/${tableauId}/participants`, { method: "GET" }, "Participants indisponibles");
}
export function ajouterParticipantTableau(tableauId: string, utilisateurId: string): Promise<ParticipantTableau[]> {
  return request(`${B}/tableaux-espace/${tableauId}/participants`, { method: "POST", body: jbody({ utilisateur_id: utilisateurId }) }, "Ajout impossible");
}
export function retirerParticipantTableau(tableauId: string, utilisateurId: string): Promise<ParticipantTableau[]> {
  return request(`${B}/tableaux-espace/${tableauId}/participants/${utilisateurId}`, { method: "DELETE" }, "Retrait impossible");
}

export function createTableauDepuisModele(input: {
  espace_id: string;
  nom: string;
  modele: ModeleTableau;
  visibilite?: VisibiliteTableau;
}): Promise<TableauProto> {
  return request(`${B}/tableaux-espace/depuis-modele`, { method: "POST", body: jbody(input) }, "Tableau non cree");
}
