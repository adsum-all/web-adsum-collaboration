import { useState } from "react";

import {
  type PolitiqueSuppression,
  createEtiquette,
  deleteEtiquette,
  peutEcrireCollaboration,
  supprimerEspace,
  updateEspace,
  updateEtiquette,
} from "../../lib/store.js";
import { libelleRole, peut } from "../../lib/permissions.js";
import type { Espace, RoleEspace } from "../../lib/types.js";
import { PermissionsMatrix } from "./PermissionsMatrix.js";
import { ArchivesPanel } from "./ArchivesPanel.js";

interface Props {
  espace: Espace;
  roleReel: RoleEspace | null;
  viewAs: RoleEspace | null;
  onViewAs: (r: RoleEspace | null) => void;
  onChanged: () => void;
}

export function TabReglages({ espace, roleReel, viewAs, onViewAs, onChanged }: Props): JSX.Element {
  const [nom, setNom] = useState(espace.nom);
  const [description, setDescription] = useState(espace.description);
  const [newEt, setNewEt] = useState("");
  const [newEtCouleur, setNewEtCouleur] = useState("#2a4fad");
  const [enregistrement, setEnregistrement] = useState<"" | "cours" | "ok" | "erreur">("");
  const [erreurMsg, setErreurMsg] = useState<string | null>(null);
  // Write gates use the REAL role, never viewAs (which only previews the header
  // badge), and require the platform permission collaboration.gerer like the server,
  // so a supervise-only account never sees a control the API would refuse with 403.
  const peutEcrire = peutEcrireCollaboration();
  const peutGererEt = peutEcrire && peut(espace, roleReel, "gerer_etiquettes");
  const peutModifier = peutEcrire && peut(espace, roleReel, "gerer_membres");
  const estProprio = roleReel === "proprietaire" && peutEcrire;
  const [suppr, setSuppr] = useState(false);
  const [supprBusy, setSupprBusy] = useState(false);
  const [supprErr, setSupprErr] = useState<string | null>(null);

  async function executerSuppression(politique: PolitiqueSuppression): Promise<void> {
    const libelle: Record<PolitiqueSuppression, string> = {
      corbeille: "Mettre cet espace à la corbeille (récupérable pendant le délai de rétention) ?",
      archiver: "Archiver cet espace et ses sous-espaces ?",
      definitif_garder_canal: "Supprimer DÉFINITIVEMENT l'espace en CONSERVANT ses instructions (archives détachées) ? Cette action est irréversible.",
      definitif: "Supprimer DÉFINITIVEMENT l'espace ET toutes ses instructions, tableaux et fichiers ? Cette action est irréversible.",
    };
    if (!window.confirm(libelle[politique])) return;
    setSupprBusy(true);
    setSupprErr(null);
    try {
      await supprimerEspace(espace.id, politique);
      if (politique === "archiver") {
        await onChanged();
        setSuppr(false);
      } else {
        // The workspace no longer exists: return to the workspace list cleanly.
        window.location.assign("/");
      }
    } catch (err) {
      setSupprErr(err instanceof Error ? err.message : "Suppression impossible");
    } finally {
      setSupprBusy(false);
    }
  }

  async function enregistrerGeneral(): Promise<void> {
    setEnregistrement("cours");
    setErreurMsg(null);
    try {
      await updateEspace(espace.id, { nom: nom.trim(), description });
      await onChanged();
      setEnregistrement("ok");
      window.setTimeout(() => setEnregistrement(""), 2500);
    } catch (err) {
      setEnregistrement("erreur");
      setErreurMsg(err instanceof Error ? err.message : "Enregistrement impossible");
    }
  }

  return (
    <div>
      <section className="card">
        <h2 className="card-title">Général</h2>
        <div className="form-grid">
          <label>
            <span>Nom de l'espace</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} disabled={!peutModifier} />
          </label>
          <label>
            <span>Description</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!peutModifier} />
          </label>
        </div>
        <div className="modal-actions" style={{ alignItems: "center", gap: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!peutModifier || enregistrement === "cours" || !nom.trim()}
            onClick={() => void enregistrerGeneral()}
          >
            {enregistrement === "cours" ? "Enregistrement..." : "Enregistrer"}
          </button>
          {enregistrement === "ok" && <span className="small" style={{ color: "var(--ok, #1a7f37)" }}>Enregistré.</span>}
          {enregistrement === "erreur" && <span className="small" style={{ color: "var(--danger, #c0392b)" }}>{erreurMsg}</span>}
          {!peutModifier && <span className="muted small">Réservé au propriétaire ou à un administrateur de l'espace.</span>}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Commentaires des observateurs</h2>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={espace.observateurs_commentent}
            disabled={!peutModifier}
            onChange={(e) => void updateEspace(espace.id, { observateurs_commentent: e.target.checked }).then(onChanged)}
          />
          <span>Autoriser les observateurs à commenter les cartes</span>
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">Étiquettes par défaut de l'espace</h2>
        <ul className="mini-list">
          {espace.etiquettes.map((et) => (
            <li key={et.id}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="et-swatch" style={{ background: et.couleur }} aria-hidden="true" />
                {peutGererEt ? (
                  <input
                    className="inline-input"
                    value={et.nom}
                    onChange={(e) => void updateEtiquette(espace.id, et.id, { nom: e.target.value }).then(onChanged)}
                  />
                ) : (
                  <span>{et.nom}</span>
                )}
              </span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {peutGererEt && (
                  <input
                    type="color"
                    value={et.couleur}
                    onChange={(e) => void updateEtiquette(espace.id, et.id, { couleur: e.target.value }).then(onChanged)}
                    aria-label="Couleur de l'étiquette"
                  />
                )}
                <label className="switch-row" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={et.par_defaut}
                    disabled={!peutGererEt}
                    onChange={(e) => void updateEtiquette(espace.id, et.id, { par_defaut: e.target.checked }).then(onChanged)}
                  />
                  <span className="small">Proposée à la création</span>
                </label>
                {peutGererEt && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-inline"
                    onClick={() => {
                      if (window.confirm(`Supprimer l'étiquette « ${et.nom} » ?`)) {
                        void deleteEtiquette(espace.id, et.id).then(onChanged);
                      }
                    }}
                  >
                    Supprimer
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {peutGererEt && (
          <div className="toolbar" style={{ marginTop: 12 }}>
            <input
              className="search"
              value={newEt}
              placeholder="Nom de la nouvelle étiquette"
              onChange={(e) => setNewEt(e.target.value)}
            />
            <input
              type="color"
              value={newEtCouleur}
              onChange={(e) => setNewEtCouleur(e.target.value)}
              aria-label="Couleur"
            />
            <button
              type="button"
              className="btn btn-primary btn-inline"
              disabled={!newEt.trim()}
              onClick={() => {
                void createEtiquette(espace.id, {
                  nom: newEt.trim(),
                  couleur: newEtCouleur,
                  par_defaut: false,
                }).then(() => {
                  setNewEt("");
                  onChanged();
                });
              }}
            >
              Créer
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Matrice de droits (lecture seule)</h2>
        <p className="muted small">Les rôles par défaut ne sont pas modifiables dans cette itération.</p>
        <PermissionsMatrix />
      </section>

      <section className="card">
        <h2 className="card-title">Voir en tant que</h2>
        <p className="muted small">
          Simule un rôle pour démontrer les autorisations. Votre rôle réel : {roleReel ? libelleRole(roleReel) : "aucun"}.
        </p>
        <div className="toolbar">
          {(["proprietaire", "admin", "membre", "observateur"] as RoleEspace[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`btn btn-ghost btn-inline${viewAs === r ? " btn-active" : ""}`}
              onClick={() => onViewAs(viewAs === r ? null : r)}
            >
              {libelleRole(r)}
            </button>
          ))}
          {viewAs && (
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => onViewAs(null)}>
              Réinitialiser
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Tableaux archivés</h2>
        <ArchivesPanel espace={espace} peutGerer={peutEcrire && peut(espace, roleReel, "archiver")} onChanged={onChanged} />
      </section>

      {estProprio && (
        <section className="card" style={{ borderColor: "var(--adsum-danger, #c0392b)" }}>
          <h2 className="card-title">Zone de danger, suppression de l'espace</h2>
          <p className="muted small">
            Réservé au propriétaire. Choisissez explicitement ce qu'il advient de l'espace, de ses sous-espaces et de son
            canal d'instructions. Toute action est tracée dans le journal d'audit.
          </p>
          {!suppr ? (
            <button type="button" className="btn btn-ghost" onClick={() => setSuppr(true)}>Supprimer ou archiver l'espace…</button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <PolBtn titre="Archiver" desc="L'espace et ses sous-espaces sont masqués, sans rien supprimer. Réversible."
                  disabled={supprBusy} onClick={() => void executerSuppression("archiver")} />
                <PolBtn titre="Mettre à la corbeille" desc="Suppression différée, récupérable pendant le délai de rétention."
                  disabled={supprBusy} onClick={() => void executerSuppression("corbeille")} />
                <PolBtn titre="Supprimer en conservant les instructions" danger
                  desc="L'espace est supprimé, mais ses instructions du canal sont conservées comme archives détachées."
                  disabled={supprBusy} onClick={() => void executerSuppression("definitif_garder_canal")} />
                <PolBtn titre="Supprimer définitivement (tout)" danger
                  desc="Efface l'espace ET toutes ses instructions, tableaux et fichiers. Le webhook du bot est révoqué. Irréversible."
                  disabled={supprBusy} onClick={() => void executerSuppression("definitif")} />
              </div>
              <p className="muted small" style={{ margin: 0 }}>Pour ne désactiver que le bot Telegram sans toucher à l'espace, utilisez « Dissocier le bot » dans le back-office (Bots et Telegram).</p>
              {supprErr && <p className="small" style={{ color: "var(--adsum-danger, #c0392b)" }}>{supprErr}</p>}
              <button type="button" className="btn btn-ghost btn-inline" disabled={supprBusy} onClick={() => setSuppr(false)}>Annuler</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function PolBtn({ titre, desc, danger, disabled, onClick }: { titre: string; desc: string; danger?: boolean; disabled?: boolean; onClick: () => void }): JSX.Element {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      style={{
        textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
        border: `1px solid ${danger ? "var(--adsum-danger, #c0392b)" : "var(--adsum-line, #e2e6ef)"}`,
        background: "var(--adsum-panel, #fff)", color: "inherit", font: "inherit",
      }}>
      <strong style={{ color: danger ? "var(--adsum-danger, #c0392b)" : "inherit" }}>{titre}</strong>
      <span className="muted small" style={{ display: "block", marginTop: 2 }}>{desc}</span>
    </button>
  );
}
