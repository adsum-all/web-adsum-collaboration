import type { JSX } from "react";

import { peutConsulterInformations, peutCreerModeles } from "../../lib/store.js";
import { useMarque } from "../../useMarque.js";

export type Route =
  | { kind: "accueil" }
  | { kind: "mes-cartes" }
  | { kind: "calendrier" }
  | { kind: "organigramme" }
  | { kind: "canal" }
  | { kind: "informations" }
  | { kind: "modeles" }
  | { kind: "notifications" }
  | { kind: "corbeille" }
  | { kind: "profil" }
  | { kind: "espace"; id: string }
  | { kind: "tableau"; espaceId: string; id: string; carteId?: string };

interface SidebarProps {
  route: Route;
  onNavigate: (r: Route) => void;
  currentInitials: string;
  currentNom: string;
  onQuitter: () => void;
  nbNotifsNonLues?: number;
  nbCanalNouveaux?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onCloseDrawer?: () => void;
}

interface Item {
  key: string;
  label: string;
  route: Route;
  icon: JSX.Element;
  badge?: number;
}

// Minimal line icons (currentColor, no emoji) so the collapsed rail stays legible.
const ICONS = {
  accueil: <path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5" />,
  espaces: <path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 13h6v6h-6z" />,
  cartes: <path d="M4 5h6v14H4zM14 5h6v9h-6z" />,
  calendrier: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />,
  canal: <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />,
  notifications: <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" />,
  organigramme: <path d="M9 3h6v4H9zM3 17h6v4H3zM15 17h6v4h-6zM12 7v4M12 11H6v6M12 11h6v6" />,
  corbeille: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  informations: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8h.01M11 12h1v4h1" />,
  modeles: <path d="M4 4h16v4H4zM4 11h7v9H4zM14 11h6v9h-6z" />,
};

function svg(node: JSX.Element): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {node}
    </svg>
  );
}

export function Sidebar({
  route, onNavigate, currentInitials, currentNom, onQuitter,
  nbNotifsNonLues = 0, nbCanalNouveaux = 0, collapsed = false, onToggleCollapse, onCloseDrawer,
}: SidebarProps): JSX.Element {
  const marque = useMarque();
  // Fixed, scalable navigation: the sidebar never lists the workspaces themselves
  // (that list lives on the "Espaces de travail" page). Two primary destinations
  // ("Espaces de travail", "Canal d'instructions") plus personal shortcuts.
  const globaux: Item[] = [
    { key: "accueil", label: "Espaces de travail", route: { kind: "accueil" }, icon: svg(ICONS.espaces) },
    { key: "canal", label: "Canal d'instructions", route: { kind: "canal" }, icon: svg(ICONS.canal), badge: nbCanalNouveaux },
    ...(peutConsulterInformations()
      ? [{ key: "informations", label: "Informations importantes", route: { kind: "informations" } as Route, icon: svg(ICONS.informations) }]
      : []),
    { key: "mes-cartes", label: "Mes cartes", route: { kind: "mes-cartes" }, icon: svg(ICONS.cartes) },
    { key: "calendrier", label: "Calendrier", route: { kind: "calendrier" }, icon: svg(ICONS.calendrier) },
    { key: "organigramme", label: "Organigramme", route: { kind: "organigramme" }, icon: svg(ICONS.organigramme) },
    ...(peutCreerModeles()
      ? [{ key: "modeles", label: "Modèles de tableaux", route: { kind: "modeles" } as Route, icon: svg(ICONS.modeles) }]
      : []),
    { key: "notifications", label: "Notifications", route: { kind: "notifications" }, icon: svg(ICONS.notifications), badge: nbNotifsNonLues },
    { key: "corbeille", label: "Corbeille et archives", route: { kind: "corbeille" }, icon: svg(ICONS.corbeille) },
  ];
  return (
    <aside className="sidebar" aria-label="Menu latéral">
      <div className="sidebar-top">
        <button type="button" className="brand brand-btn" onClick={() => onNavigate({ kind: "accueil" })} aria-label="Retour à l'accueil">
          <span className="brand-logo" aria-hidden="true">{marque.initiale}</span>
          <span className="brand-text">
            {marque.marque}
            <span className="brand-sub">SACERDOCE ROYAL</span>
          </span>
        </button>
        {onToggleCollapse && (
          <button type="button" className="sidebar-pin" onClick={onToggleCollapse}
            aria-label={collapsed ? "Déployer le menu" : "Réduire le menu"} title={collapsed ? "Déployer le menu" : "Réduire le menu"}>
            {svg(collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />)}
          </button>
        )}
        {onCloseDrawer && (
          <button type="button" className="sidebar-close" onClick={onCloseDrawer} aria-label="Fermer le menu" title="Fermer">
            {svg(<path d="M6 6l12 12M18 6 6 18" />)}
          </button>
        )}
      </div>

      <nav aria-label="Navigation principale">
        {globaux.map((it) => (
          <button
            key={it.key}
            type="button"
            title={collapsed ? it.label : undefined}
            className={`nav-item${sameRoute(it.route, route) ? " nav-item-active" : ""}`}
            onClick={() => onNavigate(it.route)}
          >
            <span className="nav-ico" aria-hidden="true">{it.icon}</span>
            <span className="nav-label">{it.label}</span>
            {it.badge && it.badge > 0 ? <span className="nav-badge">{it.badge}</span> : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button type="button" className="avatar avatar-btn" onClick={() => onNavigate({ kind: "profil" })} aria-label="Mon profil">{currentInitials}</button>
        <div className="sidebar-foot-txt">
          <button type="button" className="link link-strong" onClick={() => onNavigate({ kind: "profil" })}>{currentNom}</button>
          <button type="button" className="link" onClick={onQuitter}>Quitter</button>
        </div>
      </div>
    </aside>
  );
}

function sameRoute(a: Route, b: Route): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "espace" && b.kind === "espace") return a.id === b.id;
  if (a.kind === "tableau" && b.kind === "tableau") return a.id === b.id;
  return true;
}
