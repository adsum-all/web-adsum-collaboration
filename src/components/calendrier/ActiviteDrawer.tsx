import { useEffect, useState } from "react";

import {
  type EvenementDetail,
  annulerActivite,
  detailActivite,
  peutGererActivites,
} from "../../lib/store.js";
import { detectPlatform } from "../../lib/platform.js";
import { ActiviteFormComplet } from "./ActiviteFormComplet.js";
import { PiecesEvenement } from "./PiecesEvenement.js";
import { SerieOccurrences } from "./SerieOccurrences.js";

interface Props {
  activiteId: string;
  onClose: () => void;
  onChanged: () => void;
}

const TYPE_LABEL: Record<string, string> = { rassemblement: "Rassemblement", formation: "Formation", priere: "Prière" };
const MODE_LABEL: Record<string, string> = { presentiel: "Présentiel", en_ligne: "En ligne", hybride: "Hybride" };

// Right-side detail drawer. Clicking an activity FIRST shows its details in read
// mode (title, schedule, audience, contributors, rich description, links with the
// detected source), without leaving the calendar. Authorized users then switch to
// the full edit form or cancel the activity.
export function ActiviteDrawer({ activiteId, onClose, onChanged }: Props): JSX.Element {
  const [d, setD] = useState<EvenementDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edition, setEdition] = useState(false);
  const [busy, setBusy] = useState(false);
  const peutGerer = peutGererActivites();

  function charger(): void {
    detailActivite(activiteId).then(setD).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Activité indisponible"));
  }
  useEffect(charger, [activiteId]);

  async function annuler(): Promise<void> {
    if (!window.confirm("Annuler cette activité ? Elle disparaîtra de tous les calendriers.")) return;
    setBusy(true);
    try {
      await annulerActivite(activiteId);
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Annulation impossible");
    } finally {
      setBusy(false);
    }
  }

  const dateTxt = d ? new Date(d.debut).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" }) : "";
  const finTxt = d?.fin ? new Date(d.fin).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "";

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 60 }} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Détails de l'activité"
        style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(560px, 96vw)", background: "var(--adsum-panel, #fff)", color: "var(--adsum-ink, #111)", boxShadow: "-8px 0 24px rgba(0,0,0,.18)", zIndex: 61, display: "flex", flexDirection: "column" }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--adsum-line, #e2e2e2)" }}>
          <strong style={{ fontSize: 16 }}>{edition ? "Modifier l'activité" : "Activité"}</strong>
          <div style={{ display: "flex", gap: 8 }}>
            {d && peutGerer && !edition && !d.annule && (
              <button type="button" className="btn btn-primary btn-inline" onClick={() => setEdition(true)}>Modifier</button>
            )}
            <button type="button" className="btn btn-ghost btn-inline" onClick={onClose} aria-label="Fermer">✕</button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {!d && !err && <p className="muted">Chargement…</p>}
          {err && <p className="small" style={{ color: "var(--danger, #c0392b)" }}>{err}</p>}

          {d && edition && (
            <ActiviteFormComplet detail={d} onDone={() => { setEdition(false); charger(); onChanged(); }} onCancel={() => setEdition(false)} />
          )}

          {d && !edition && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {d.annule && <p className="small" style={{ color: "var(--danger, #c0392b)", fontWeight: 600 }}>Activité annulée.</p>}
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>{d.titre}</h2>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                  {TYPE_LABEL[d.type ?? ""] ?? d.type ?? ""}{d.mode ? " · " + (MODE_LABEL[d.mode] ?? d.mode) : ""}
                </p>
              </div>

              <Ligne libelle="Début" valeur={dateTxt} />
              {finTxt && <Ligne libelle="Fin" valeur={finTxt} />}
              {d.lieu && <Ligne libelle="Lieu" valeur={d.lieu} />}
              <Ligne libelle="Destinataires" valeur={d.cible_libelle ?? (d.cible_type === "general" ? "Toute la communauté" : d.cible_type)} />
              {(d.cible_genre || d.cible_age_min != null || d.cible_age_max != null) && (
                <Ligne libelle="Affinage" valeur={[d.cible_genre === "homme" ? "Hommes" : d.cible_genre === "femme" ? "Femmes" : "", d.cible_age_min != null ? `à partir de ${d.cible_age_min} ans` : "", d.cible_age_max != null ? `jusqu'à ${d.cible_age_max} ans` : ""].filter(Boolean).join(" · ")} />
              )}
              <Ligne libelle="Visibilité" valeur={d.visibilite} />
              {d.fenetre_reponse_heures != null && <Ligne libelle="Fenêtre de réponse" valeur={`${d.fenetre_reponse_heures} h après la fin`} />}

              {d.intervenant_principal && <Ligne libelle="Intervenant principal" valeur={d.intervenant_principal} />}
              {d.intervenants.length > 0 && <Ligne libelle="Autres intervenants" valeur={d.intervenants.join(", ")} />}

              {d.liens.length > 0 && (
                <div>
                  <span className="muted small" style={{ fontWeight: 600 }}>Liens de diffusion</span>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {d.liens.map((l, i) => {
                      const p = detectPlatform(l);
                      return (
                        <li key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, color: "#fff", background: p.color }}>{p.label}</span>
                          <a href={l} target="_blank" rel="noopener noreferrer nofollow" style={{ fontSize: 13, wordBreak: "break-all" }}>{l}</a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {d.description && (
                <div>
                  <span className="muted small" style={{ fontWeight: 600 }}>Description</span>
                  <div
                    style={{ marginTop: 6, fontSize: 14, lineHeight: 1.55 }}
                    // Server-sanitised HTML (allowlist), rendered read-only.
                    dangerouslySetInnerHTML={{ __html: d.description }}
                  />
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--adsum-line, #e2e2e2)", paddingTop: 12 }}>
                <PiecesEvenement activiteId={activiteId} peutGerer={peutGerer && !d.annule} />
              </div>

              {peutGerer && !d.annule && (
                <SerieOccurrences
                  activiteId={activiteId}
                  debut={d.debut}
                  fin={d.fin}
                  zone={d.fuseau_horaire}
                  estSerie={Boolean(d.serie_id)}
                  onChanged={() => { charger(); onChanged(); }}
                />
              )}

              {peutGerer && !d.annule && (
                <div style={{ borderTop: "1px solid var(--adsum-line, #e2e2e2)", paddingTop: 12, display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-primary btn-inline" onClick={() => setEdition(true)}>Modifier</button>
                  <button type="button" className="btn btn-danger btn-inline" disabled={busy} onClick={() => void annuler()}>Annuler l'activité</button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }): JSX.Element {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <span className="muted small" style={{ minWidth: 150, fontWeight: 600 }}>{libelle}</span>
      <span style={{ fontSize: 14 }}>{valeur}</span>
    </div>
  );
}
