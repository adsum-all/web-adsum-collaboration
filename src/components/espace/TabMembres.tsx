import { useMemo, useState } from "react";

import {
  accepterDemande,
  addMembreEspace,
  changeRoleMembre,
  peutEcrireCollaboration,
  refuserDemande,
  removeMembreEspace,
} from "../../lib/store.js";
import { libelleRole, peut, roleDansEspace } from "../../lib/permissions.js";
import type { Espace, Membre, RoleEspace } from "../../lib/types.js";

interface Props {
  espace: Espace;
  membres: Membre[];
  moiId: string;
  onChanged: () => void;
}

const ROLES: RoleEspace[] = ["proprietaire", "admin", "membre", "observateur"];

export function TabMembres({ espace, membres, moiId, onChanged }: Props): JSX.Element {
  const [recherche, setRecherche] = useState("");
  const [copied, setCopied] = useState(false);
  // Managing members writes on the server, so it needs the platform manage grant
  // (peutEcrireCollaboration) on top of the space role. Gate on the REAL role, never
  // on a previewed viewAs role, so a supervise-only account never sees a 403 button.
  const roleReel = roleDansEspace(espace, moiId);
  const peutGerer = peutEcrireCollaboration() && peut(espace, roleReel, "gerer_membres");
  const [erreur, setErreur] = useState<string | null>(null);
  // Every membership mutation goes through this: a failure (403, conflict such as the
  // last-owner guard) surfaces a message instead of silently looking successful.
  function run(p: Promise<unknown>): Promise<void> {
    return p.then(() => { setErreur(null); onChanged(); }).catch((e) => setErreur(e instanceof Error ? e.message : "Action impossible"));
  }

  const dansEspace = new Set(espace.membres.map((m) => m.membre_id));
  const candidats = useMemo(
    () =>
      membres
        .filter((m) => !dansEspace.has(m.id))
        .filter(
          (m) =>
            recherche.trim() === "" ||
            m.nom.toLowerCase().includes(recherche.toLowerCase()) ||
            m.courriel.toLowerCase().includes(recherche.toLowerCase()),
        )
        .slice(0, 5),
    [membres, recherche, dansEspace],
  );

  const lien = `${window.location.origin}/rejoindre?jeton=${espace.invitation_jeton}`;

  async function copierLien(): Promise<void> {
    try {
      await navigator.clipboard.writeText(lien);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  function nomMembre(id: string): string {
    return (
      espace.membres.find((m) => m.membre_id === id)?.nom ||
      membres.find((m) => m.id === id)?.nom ||
      id
    );
  }

  return (
    <div>
      {erreur && (
        <div className="banner banner-error" role="alert" style={{ marginBottom: 10 }}>
          {erreur}
          <button type="button" className="link" onClick={() => setErreur(null)} style={{ marginLeft: 12 }}>Fermer</button>
        </div>
      )}
      <section className="card">
        <h2 className="card-title">Membres de l'espace</h2>
        <ul className="mini-list">
          {espace.membres.map((m) => {
            const isMoi = m.membre_id === moiId;
            return (
              <li key={m.membre_id}>
                <span>
                  {nomMembre(m.membre_id)}
                  {isMoi && <span className="badge badge-mut" style={{ marginLeft: 8 }}>Vous</span>}
                </span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {peutGerer ? (
                    <select
                      value={m.role}
                      onChange={(e) => {
                        void run(changeRoleMembre(espace.id, m.membre_id, e.target.value as RoleEspace));
                      }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {libelleRole(r)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="badge badge-mut">{libelleRole(m.role)}</span>
                  )}
                  {peutGerer && !isMoi && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-inline"
                      onClick={() => {
                        if (window.confirm(`Retirer ${nomMembre(m.membre_id)} de l'espace ?`)) {
                          void run(removeMembreEspace(espace.id, m.membre_id));
                        }
                      }}
                    >
                      Retirer
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {peutGerer && (
        <section className="card">
          <h2 className="card-title">Inviter un membre</h2>
          <div className="toolbar">
            <input
              className="search"
              placeholder="Rechercher un nom ou un courriel dans l'annuaire"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          {recherche.trim() && candidats.length === 0 && (
            <p className="muted small">Aucun résultat.</p>
          )}
          <ul className="mini-list">
            {candidats.map((c) => (
              <li key={c.id}>
                <span>{c.nom} <span className="muted small">{c.courriel}</span></span>
                <button
                  type="button"
                  className="btn btn-primary btn-inline"
                  onClick={() => {
                    void run(addMembreEspace(espace.id, c.id, "membre")).then(() => setRecherche(""));
                  }}
                >
                  Ajouter comme membre
                </button>
              </li>
            ))}
          </ul>

          <div className="invitation-lien">
            <label>
              <span>Lien d'invitation de l'espace</span>
              <input value={lien} readOnly />
            </label>
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => void copierLien()}>
              {copied ? "Copié" : "Copier le lien"}
            </button>
          </div>
        </section>
      )}

      {peutGerer && (
        <section className="card">
          <h2 className="card-title">Demandes d'accès</h2>
          {espace.demandes_acces.length === 0 ? (
            <p className="muted small">Aucune demande en attente.</p>
          ) : (
            <ul className="mini-list">
              {espace.demandes_acces.map((d) => (
                <li key={d.id}>
                  <span>{nomMembre(d.membre_id)}</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-inline"
                      onClick={() => void run(accepterDemande(espace.id, d.id))}
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-inline"
                      onClick={() => void run(refuserDemande(espace.id, d.id))}
                    >
                      Refuser
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
