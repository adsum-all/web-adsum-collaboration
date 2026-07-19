import { useEffect, useRef, useState } from "react";

import { type Session } from "./api.js";
import { Login } from "./components/Login.js";
import { EspacePage } from "./components/espace/EspacePage.js";
import { EmptyState } from "./components/common/EmptyState.js";
import { RaccourcisModal } from "./components/common/RaccourcisModal.js";
import { CalendrierPage } from "./components/calendrier/CalendrierPage.js";
import { OrganigrammeView } from "./components/organigramme/OrganigrammeView.js";
import { CanalPage } from "./components/canal/CanalPage.js";
import { CorbeillePage } from "./components/corbeille/CorbeillePage.js";
import { InformationsAdmin } from "./components/informations/InformationsAdmin.js";
import { ModelesPage } from "./components/modeles/ModelesPage.js";
import { NotificationsPage } from "./components/notifications/NotificationsPage.js";
import { ProfilPage } from "./components/profil/ProfilPage.js";
import { Home } from "./components/home/Home.js";
import { MesCartes } from "./components/mes-cartes/MesCartes.js";
import { GlobalSearch } from "./components/search/GlobalSearch.js";
import { Sidebar, type Route } from "./components/shell/Sidebar.js";
import { Topbar } from "./components/shell/Topbar.js";
import { TableauPage } from "./components/tableau/TableauPage.js";
import { compteurCanal } from "./lib/store-canal.js";
import { getEspace, initStore, listEspaces, listNotifications, rejoindreEspace, resetStore } from "./lib/store.js";
import type { Espace, Membre } from "./lib/types.js";
import { clearSession, loadSession, saveSession } from "./session.js";

// The current view is mirrored in the URL hash so a refresh (or a shared link, or the
// browser back/forward) lands back on the SAME page instead of the home, and never
// signs the user out of where they were. No router library: the hash is the single
// source of truth, serialized here and restored on load.
function routeToHash(r: Route): string {
  switch (r.kind) {
    case "accueil": return "#/";
    case "espace": return `#/espace/${r.id}`;
    case "tableau": return `#/tableau/${r.espaceId}/${r.id}${r.carteId ? `/${r.carteId}` : ""}`;
    default: return `#/${r.kind}`;
  }
}
const ROUTES_SIMPLES = new Set(["mes-cartes", "calendrier", "organigramme", "canal", "informations", "modeles", "notifications", "corbeille", "profil"]);
function hashToRoute(): Route {
  if (typeof window === "undefined") return { kind: "accueil" };
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const k = parts[0];
  if (!k) return { kind: "accueil" };
  if (k === "espace" && parts[1]) return { kind: "espace", id: parts[1] };
  if (k === "tableau" && parts[1] && parts[2]) return { kind: "tableau", espaceId: parts[1], id: parts[2], carteId: parts[3] };
  if (ROUTES_SIMPLES.has(k)) return { kind: k } as Route;
  return { kind: "accueil" };
}

export function App(): JSX.Element {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [route, setRoute] = useState<Route>(() => hashToRoute());
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [nbNotifs, setNbNotifs] = useState(0);
  const [tick, setTick] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [me, setMe] = useState<Membre | null>(null);
  // True when the session is valid but the current member/permissions could not be
  // resolved: the app must not silently render read-only with an empty moiId (which
  // looks broken), it shows a clear reconnect banner instead.
  const [profilEchoue, setProfilEchoue] = useState(false);
  const [rejoindreMsg, setRejoindreMsg] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("adsum.collab.sidebar.collapsed") === "1"; } catch { return false; }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nbCanal, setNbCanal] = useState(0);
  // A sub-space (or any space not in the top-level list) is loaded on demand by id
  // so it opens as a full page, exactly like a general workspace.
  const [fetchedEspace, setFetchedEspace] = useState<Espace | null>(null);
  const [fetchEspaceState, setFetchEspaceState] = useState<"idle" | "loading" | "error">("idle");
  const toggleCollapse = (): void => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("adsum.collab.sidebar.collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };
  const navigate = (r: Route): void => { setRoute(r); setDrawerOpen(false); };

  // Keep the URL hash in sync with the route (covers every setRoute call, not only
  // navigate). A ref remembers our own write so the hashchange listener below ignores it
  // and only reacts to EXTERNAL changes (browser back/forward, a manual edit), avoiding a
  // set-route -> set-hash -> set-route loop.
  const dernierHash = useRef<string>("");
  useEffect(() => {
    const h = routeToHash(route);
    dernierHash.current = h;
    if (typeof window !== "undefined" && window.location.hash !== h) {
      window.history.replaceState(null, "", h);
    }
  }, [route]);
  useEffect(() => {
    const onHash = (): void => {
      if (window.location.hash === dernierHash.current) return;
      setRoute(hashToRoute());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const reloadEspaces = (): void => {
    void listEspaces().then(setEspaces);
    void listNotifications().then((n) => setNbNotifs(n.filter((x) => !x.lue).length));
  };

  // Invitation link: /rejoindre?jeton=... files an access request for the member.
  useEffect(() => {
    if (!session) return;
    if (typeof window === "undefined" || window.location.pathname !== "/rejoindre") return;
    const jeton = new URLSearchParams(window.location.search).get("jeton");
    window.history.replaceState({}, "", "/");
    if (!jeton) return;
    void rejoindreEspace(jeton)
      .then((r) => {
        if (r.statut === "deja_membre") {
          setRejoindreMsg(`Vous etes deja membre de « ${r.espace_nom} ».`);
          setRoute({ kind: "espace", id: r.espace_id });
        } else {
          setRejoindreMsg(`Demande d'acces envoyee a « ${r.espace_nom} ». Un responsable doit la valider.`);
        }
      })
      .catch(() => setRejoindreMsg("Cette invitation n'est plus valide."));
  }, [session]);

  // Resolve the session once (token + current member), not on every render, then
  // load the spaces. Avoids re-firing /auth/me on each 5 s tick.
  useEffect(() => {
    if (!session) {
      setMe(null);
      return;
    }
    let alive = true;
    void initStore(session).then((m) => {
      if (!alive) return;
      setMe(m);
      setProfilEchoue(m === null);
      if (m) reloadEspaces();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void listNotifications().then((n) => setNbNotifs(n.filter((x) => !x.lue).length));
    void compteurCanal().then((c) => setNbCanal(c.nouveaux)).catch(() => undefined);
    // Near real-time: refresh the workspaces on every 5 s tick too, so an open
    // space, sub-space or its members reflect changes without a manual reload
    // (the sub-space fetch effect already re-runs on tick).
    void listEspaces().then(setEspaces).catch(() => undefined);
  }, [session, tick, route]);

  // Load the targeted space on demand when it is not a top-level space (i.e. a
  // sub-space): the top-level list only carries lightweight sub-space stubs, so
  // the full object (members, tableaux, settings) must be fetched to render its
  // full page. Refreshes on tick to stay in sync like the top-level spaces.
  useEffect(() => {
    if (!session) { setFetchedEspace(null); setFetchEspaceState("idle"); return; }
    const targetId =
      route.kind === "espace" ? route.id : route.kind === "tableau" ? route.espaceId : null;
    if (!targetId || espaces.some((e) => e.id === targetId)) {
      setFetchedEspace(null);
      setFetchEspaceState("idle");
      return;
    }
    let alive = true;
    if (fetchedEspace?.id !== targetId) setFetchEspaceState("loading");
    void getEspace(targetId)
      .then((e) => { if (alive) { setFetchedEspace(e); setFetchEspaceState(e ? "idle" : "error"); } })
      .catch(() => { if (alive) { setFetchedEspace(null); setFetchEspaceState("error"); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, route, espaces, tick]);

  useEffect(() => {
    if (!session) return;
    function onKey(e: KeyboardEvent): void {
      const tgt = e.target as HTMLElement | null;
      const inField = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchQ("");
        setSearchOpen(true);
        return;
      }
      if (inField) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearchQ("");
        setSearchOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  function onAuth(s: Session): void {
    saveSession(s);
    setSession(s);
    setRoute({ kind: "accueil" });
  }

  function onQuitter(): void {
    clearSession();
    resetStore();
    setSession(null);
    setEspaces([]);
  }

  if (!session) {
    return <Login onAuth={onAuth} />;
  }

  if (profilEchoue) {
    return (
      <div className="auth">
        <div className="empty-state">
          <h2>Profil indisponible</h2>
          <p>Votre profil de collaboration n'a pas pu être chargé. Reconnectez-vous pour rétablir votre session.</p>
          <button type="button" className="btn btn-primary" onClick={onQuitter}>Se reconnecter</button>
        </div>
      </div>
    );
  }

  const targetEspaceId =
    route.kind === "espace" ? route.id : route.kind === "tableau" ? route.espaceId : null;
  const espaceCourant =
    (targetEspaceId
      ? espaces.find((e) => e.id === targetEspaceId)
        ?? (fetchedEspace && fetchedEspace.id === targetEspaceId ? fetchedEspace : null)
      : null) ?? null;
  // A targeted space that is not yet resolved shows a loading state until the on-demand
  // fetch actually FAILS (state 'error'): the transient 'idle' between navigation and the
  // fetch effect must not flash "access refused". Only a real error (not a member, or the
  // space is gone) falls through to the access-refused message.
  const espaceEnChargement = !!targetEspaceId && !espaceCourant && fetchEspaceState !== "error";
  // Parent workspace of the current sub-space (top-level, so it is in the list),
  // for the breadcrumb that tells the user exactly where they are.
  const parentEspace = espaceCourant?.parent_id
    ? espaces.find((e) => e.id === espaceCourant.parent_id) ?? null
    : null;

  const crumbTitle = crumbFor(route, espaceCourant);

  return (
    <div className={`shell${collapsed ? " shell-collapsed" : ""}${drawerOpen ? " shell-drawer-open" : ""}`}>
      <Sidebar
        route={route}
        onNavigate={navigate}
        currentInitials={me?.initiales ?? "AD"}
        currentNom={me?.nom ?? "Membre"}
        onQuitter={onQuitter}
        nbNotifsNonLues={nbNotifs}
        nbCanalNouveaux={nbCanal}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        onCloseDrawer={() => setDrawerOpen(false)}
      />
      {drawerOpen && <div className="shell-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      <div className="main">
        <Topbar
          crumb={crumbTitle.crumb}
          title={crumbTitle.title}
          onSearch={(q) => { setSearchQ(q); setSearchOpen(true); }}
          onOpenSearch={() => { setSearchQ(""); setSearchOpen(true); }}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        <div className="main-scroll">
          {rejoindreMsg && (
            <div className="banner banner-ok" role="status">
              {rejoindreMsg}
              <button type="button" className="link" onClick={() => setRejoindreMsg(null)} style={{ marginLeft: 12 }}>
                Fermer
              </button>
            </div>
          )}
          {route.kind === "accueil" && (
            <Home
              espaces={espaces}
              onOuvrir={(id) => setRoute({ kind: "espace", id })}
              onCree={reloadEspaces}
              currentNom={me?.nom ?? ""}
            />
          )}
          {route.kind === "mes-cartes" && (
            <MesCartes moiId={me?.id ?? ""} onOuvrirEspace={(id) => setRoute({ kind: "espace", id })} />
          )}
          {route.kind === "calendrier" && (
            <CalendrierPage onOuvrirCarte={(espaceId, tableauId, carteId) => setRoute({ kind: "tableau", espaceId, id: tableauId, carteId })} />
          )}
          {route.kind === "organigramme" && (
            <OrganigrammeView />
          )}
          {route.kind === "canal" && (
            <CanalPage />
          )}
          {route.kind === "informations" && (
            <InformationsAdmin token={session.token} />
          )}
          {route.kind === "modeles" && (
            <ModelesPage moiId={me?.id ?? ""} />
          )}
          {route.kind === "notifications" && (
            <NotificationsPage onOuvrirEspace={(id) => setRoute({ kind: "espace", id })} />
          )}
          {route.kind === "corbeille" && (
            <CorbeillePage onOuvrirEspace={(id) => setRoute({ kind: "espace", id })} />
          )}
          {route.kind === "profil" && (
            <ProfilPage />
          )}
          {route.kind === "espace" && espaceCourant && (
            <EspacePage
              espace={espaceCourant}
              parent={parentEspace}
              moiId={me?.id ?? ""}
              onChanged={reloadEspaces}
              onOuvrirEspace={(id) => setRoute({ kind: "espace", id })}
              onOuvrirTableau={(id) => setRoute({ kind: "tableau", espaceId: espaceCourant.id, id })}
              onOuvrirCarte={(espaceId, tableauId, carteId) => setRoute({ kind: "tableau", espaceId, id: tableauId, carteId })}
            />
          )}
          {route.kind === "tableau" && espaceCourant && (
            <TableauPage
              espace={espaceCourant}
              moiId={me?.id ?? ""}
              tableauId={route.id}
              carteInitiale={route.carteId ?? null}
              onRetour={() => setRoute({ kind: "espace", id: espaceCourant.id })}
              onChanged={reloadEspaces}
            />
          )}
          {((route.kind === "espace" || route.kind === "tableau") && !espaceCourant) && (
            espaceEnChargement ? (
              <div className="page muted">Chargement de l'espace…</div>
            ) : (
              <div className="page">
                <EmptyState titre="Accès refusé" description="Vous n'êtes pas membre de cet espace." />
              </div>
            )
          )}
        </div>
      </div>
      {searchOpen && (
        <GlobalSearch
          initialQuery={searchQ}
          onClose={() => setSearchOpen(false)}
          onOuvrirEspace={(id) => setRoute({ kind: "espace", id })}
          onOuvrirTableau={(espaceId, id) => setRoute({ kind: "tableau", espaceId, id })}
          onOuvrirCarte={(espaceId, tableauId, carteId) => setRoute({ kind: "tableau", espaceId, id: tableauId, carteId })}
        />
      )}
      {helpOpen && <RaccourcisModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function crumbFor(route: Route, espace: Espace | null): { crumb: string; title: string } {
  switch (route.kind) {
    case "accueil":
      return { crumb: "COLLABORATION", title: "Espaces de travail" };
    case "mes-cartes":
      return { crumb: "PERSONNEL", title: "Mes cartes" };
    case "calendrier":
      return { crumb: "PERSONNEL", title: "Calendrier" };
    case "organigramme":
      return { crumb: "ORGANISATION", title: "Organigramme" };
    case "canal":
      return { crumb: "COLLABORATION", title: "Canal d'instructions" };
    case "informations":
      return { crumb: "COMMUNICATION", title: "Informations importantes" };
    case "modeles":
      return { crumb: "COLLABORATION", title: "Modèles de tableaux" };
    case "notifications":
      return { crumb: "PERSONNEL", title: "Notifications" };
    case "corbeille":
      return { crumb: "COLLABORATION", title: "Corbeille et archives" };
    case "profil":
      return { crumb: "PERSONNEL", title: "Mon profil" };
    case "espace":
      return { crumb: espace?.parent_id ? "SOUS-ESPACE" : "ESPACE", title: espace?.nom ?? "Espace" };
    case "tableau":
      return { crumb: espace?.nom.toUpperCase() ?? "TABLEAU", title: "Tableau" };
  }
}
