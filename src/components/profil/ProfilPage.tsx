import { useEffect, useState } from "react";

import { currentMembre, getMoi, listEspaces, listMesCartes, setLanguePref, setThemePref } from "../../lib/store.js";
import { libelleRole, roleDansEspace } from "../../lib/permissions.js";
import { type Theme, applyTheme, loadTheme, saveTheme } from "../../lib/theme.js";
import type { Espace, Membre } from "../../lib/types.js";

function membreSur(): Membre {
  try {
    return currentMembre();
  } catch {
    return { id: "", nom: "Membre", courriel: "", initiales: "AD" };
  }
}

const THEMES: { id: Theme; label: string }[] = [
  { id: "light", label: "Clair" },
  { id: "dark", label: "Sombre" },
  { id: "system", label: "Système" },
];
const LANGUES: { id: "fr" | "en"; label: string }[] = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
];
function loadLangue(): "fr" | "en" {
  try { return localStorage.getItem("adsum.collab.lang") === "en" ? "en" : "fr"; } catch { return "fr"; }
}

export function ProfilPage(): JSX.Element {
  const [me, setMe] = useState<Membre>(membreSur);
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [nbCartes, setNbCartes] = useState(0);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [langue, setLangue] = useState<"fr" | "en">(loadLangue);
  const [prefMsg, setPrefMsg] = useState<string | null>(null);

  useEffect(() => {
    // Read the real identity from the server (nom_affiche), never a stale cache.
    void getMoi().then(setMe).catch(() => undefined);
    void listEspaces().then(setEspaces).catch(() => undefined);
    void listMesCartes().then((c) => setNbCartes(c.length)).catch(() => undefined);
  }, []);

  function choisirTheme(v: Theme): void {
    setTheme(v);
    applyTheme(v);
    saveTheme(v);
    setPrefMsg(null);
    void setThemePref(v).catch(() => setPrefMsg("Le thème est appliqué localement mais n'a pas pu être enregistré sur le serveur."));
  }
  function choisirLangue(v: "fr" | "en"): void {
    setLangue(v);
    try { localStorage.setItem("adsum.collab.lang", v); } catch { /* ignore */ }
    setPrefMsg(null);
    void setLanguePref(v).catch(() => setPrefMsg("La langue n'a pas pu être enregistrée sur le serveur."));
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Mon profil</h1>
        <p className="muted">Vos informations et votre appartenance aux espaces.</p>
      </header>

      <div className="profil-carte">
        <div className="profil-avatar" aria-hidden="true">{me.initiales}</div>
        <div className="profil-form">
          <div className="profil-champ">
            <span className="muted small">Nom affiché</span>
            <strong>{me.nom}</strong>
          </div>
          <div className="profil-champ">
            <span className="muted small">Courriel</span>
            <strong>{me.courriel}</strong>
          </div>
          <p className="muted small">
            Votre identité est gérée de façon centralisée par l&apos;administration (back-office) et partagée par
            toutes les applications. Elle ne se modifie pas ici.
          </p>
        </div>
      </div>

      <section className="section">
        <h2>Préférences d&apos;affichage</h2>
        <div className="pref-row">
          <div>
            <strong>Thème</strong>
            <p className="muted small">Apparence de l&apos;application de collaboration.</p>
          </div>
          <div className="pref-choix">
            {THEMES.map((t) => (
              <button key={t.id} type="button" className={`btn btn-ghost btn-inline${theme === t.id ? " is-on" : ""}`} aria-pressed={theme === t.id} onClick={() => choisirTheme(t.id)}>{t.label}</button>
            ))}
          </div>
        </div>
        <div className="pref-row">
          <div>
            <strong>Langue</strong>
            <p className="muted small">Langue de votre compte, utilisée pour les notifications et l&apos;application membre.</p>
          </div>
          <div className="pref-choix">
            {LANGUES.map((l) => (
              <button key={l.id} type="button" className={`btn btn-ghost btn-inline${langue === l.id ? " is-on" : ""}`} aria-pressed={langue === l.id} onClick={() => choisirLangue(l.id)}>{l.label}</button>
            ))}
          </div>
        </div>
        {prefMsg && <p className="banner banner-error small" style={{ marginTop: 10 }}>{prefMsg}</p>}
      </section>

      <section className="section">
        <h2>Mes espaces ({espaces.length})</h2>
        <ul className="profil-espaces">
          {espaces.map((e) => {
            const role = roleDansEspace(e, me.id);
            return (
              <li key={e.id}>
                <span className="nav-initiale" aria-hidden="true" style={{ background: e.couleur }}>{e.initiale}</span>
                <div>
                  <strong>{e.nom}</strong>
                  <span className="muted small"> · {role ? libelleRole(role) : "-"}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="section">
        <h2>Résumé</h2>
        <div className="stat-grid">
          <div className="stat-tile"><span className="stat-val">{espaces.length}</span><span className="muted small">Espaces</span></div>
          <div className="stat-tile"><span className="stat-val">{nbCartes}</span><span className="muted small">Cartes suivies</span></div>
        </div>
      </section>
    </div>
  );
}
