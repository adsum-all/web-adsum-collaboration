/** Diffusion tracking panel of a sent Information: the per-status counters plus the
 * two follow-up actions (export the per-recipient CSV, relance the unread). Split
 * from InformationEditor to keep it under the size threshold. The relance itself is
 * confirmed by the shared InformationConfirm banner in the parent, so this only opens
 * the confirmation; the export runs immediately (read-only). */
import type { JSX } from "react";

import type { InformationStats } from "../../api.js";

export function InformationSuivi({
  stats,
  actionsVisibles,
  busy,
  relanceMsg,
  onExport,
  onRelance,
}: Readonly<{
  stats: InformationStats;
  actionsVisibles: boolean;
  busy: boolean;
  relanceMsg: string | null;
  onExport: () => void;
  onRelance: () => void;
}>): JSX.Element {
  return (
    <div className="info-stats">
      <p className="field-group-title">Suivi de diffusion</p>
      <div className="info-stats-grid">
        <div><b>{stats.destinataires}</b><span>Destinataires</span></div>
        <div><b>{stats.lus}</b><span>Lus ({stats.taux_lecture}%)</span></div>
        <div><b>{stats.confirmes}</b><span>Confirmés ({stats.taux_confirmation}%)</span></div>
        <div><b>{stats.non_lus}</b><span>Non lus</span></div>
      </div>
      {actionsVisibles && (
        <div className="info-suivi-actions">
          <button type="button" className="btn btn-ghost btn-inline" disabled={busy} onClick={onExport}>Exporter le suivi (CSV)</button>
          <button
            type="button"
            className="btn btn-ghost btn-inline"
            disabled={busy || stats.non_lus === 0}
            title={stats.non_lus === 0 ? "Tous les destinataires ont lu cette information." : "Renvoyer l'information sur ses canaux, uniquement aux personnes qui ne l'ont pas encore lue."}
            onClick={onRelance}
          >
            Relancer les non-lus
          </button>
        </div>
      )}
      {relanceMsg && <p className="banner banner-info">{relanceMsg}</p>}
    </div>
  );
}
