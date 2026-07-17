import { useEffect, useState } from "react";

import { currentMembre, getMoi, listEspaces, listMesCartes } from "../../lib/store.js";
import { libelleRole, roleDansEspace } from "../../lib/permissions.js";
import type { Espace, Membre } from "../../lib/types.js";

function membreSur(): Membre {
  try {
    return currentMembre();
  } catch {
    return { id: "", nom: "Membre", courriel: "", initiales: "AD" };
  }
}

export function ProfilPage(): JSX.Element {
  const [me, setMe] = useState<Membre>(membreSur);
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [nbCartes, setNbCartes] = useState(0);

  useEffect(() => {
    // Read the real identity from the server (nom_affiche), never a stale cache.
    void getMoi().then(setMe);
    void listEspaces().then(setEspaces);
    void listMesCartes().then((c) => setNbCartes(c.length));
  }, []);

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
