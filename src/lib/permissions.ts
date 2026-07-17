
import type { Espace, RoleEspace } from "./types.js";

export type ActionEspace =
  | "voir"
  | "creer_carte"
  | "editer_carte"
  | "deplacer_carte"
  | "commenter"
  | "gerer_colonnes"
  | "gerer_membres"
  | "gerer_etiquettes"
  | "archiver"
  | "publier_evenement";

export interface RegleAction {
  action: ActionEspace;
  libelle: string;
  autorises: RoleEspace[];
  depend_observateurs_commentent?: boolean;
}

export const MATRICE: RegleAction[] = [
  { action: "voir", libelle: "Voir", autorises: ["proprietaire", "admin", "membre", "observateur"] },
  { action: "creer_carte", libelle: "Créer une carte", autorises: ["proprietaire", "admin", "membre"] },
  { action: "editer_carte", libelle: "Éditer une carte", autorises: ["proprietaire", "admin", "membre"] },
  { action: "deplacer_carte", libelle: "Déplacer une carte", autorises: ["proprietaire", "admin", "membre"] },
  {
    action: "commenter",
    libelle: "Commenter",
    autorises: ["proprietaire", "admin", "membre"],
    depend_observateurs_commentent: true,
  },
  { action: "gerer_colonnes", libelle: "Gérer les colonnes", autorises: ["proprietaire", "admin"] },
  { action: "gerer_membres", libelle: "Gérer les membres", autorises: ["proprietaire", "admin"] },
  { action: "gerer_etiquettes", libelle: "Gérer les étiquettes", autorises: ["proprietaire", "admin"] },
  { action: "archiver", libelle: "Archiver", autorises: ["proprietaire", "admin"] },
  { action: "publier_evenement", libelle: "Publier en événement", autorises: ["proprietaire", "admin", "membre"] },
];

export function roleDansEspace(espace: Espace, membreId: string): RoleEspace | null {
  return espace.membres.find((m) => m.membre_id === membreId)?.role ?? null;
}

export function peut(espace: Espace, role: RoleEspace | null, action: ActionEspace): boolean {
  if (!role) return false;
  const regle = MATRICE.find((r) => r.action === action);
  if (!regle) return false;
  if (!regle.autorises.includes(role)) {
    if (
      regle.depend_observateurs_commentent &&
      role === "observateur" &&
      espace.observateurs_commentent &&
      action === "commenter"
    ) {
      return true;
    }
    return false;
  }
  return true;
}

export function libelleRole(role: RoleEspace): string {
  switch (role) {
    case "proprietaire":
      return "Propriétaire";
    case "admin":
      return "Admin";
    case "membre":
      return "Membre";
    case "observateur":
      return "Observateur";
  }
}
