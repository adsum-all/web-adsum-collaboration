/** Inline professional confirmations for the Information editor, in the back-office
 * house style (a coloured .banner with a title, an explanation and two buttons),
 * replacing every window.confirm. One at a time: the parent holds a single "confirm"
 * state and the matching action callback. Publish and relance use the calm blue
 * .banner-info; a delete uses the red .banner-error, and its wording warns when a
 * sent Information's read tracking would be lost. */
import type { JSX } from "react";

const ROW = { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" } as const;

export function InformationConfirm({
  kind,
  editable,
  busy,
  publierBloque,
  onPublier,
  onSupprimer,
  onRelancer,
  onAnnuler,
}: Readonly<{
  kind: "publier" | "supprimer" | "relancer";
  editable: boolean;
  busy: boolean;
  publierBloque: boolean;
  onPublier: () => void;
  onSupprimer: () => void;
  onRelancer: () => void;
  onAnnuler: () => void;
}>): JSX.Element {
  if (kind === "supprimer") {
    return (
      <div className="banner banner-error small" style={{ textAlign: "left", marginTop: 6 }}>
        <strong>{editable ? "Supprimer ce brouillon d'information ?" : "Supprimer définitivement cette information diffusée ?"}</strong>
        <div className="muted" style={{ marginTop: 4 }}>{editable ? "Cette action est irréversible." : "Son suivi de lecture (lu, confirmé) sera définitivement perdu. Pour la retirer sans perdre le suivi, préférez l'archivage."}</div>
        <div style={ROW}>
          <button type="button" className="btn btn-danger btn-inline" disabled={busy} onClick={onSupprimer}>Supprimer définitivement</button>
          <button type="button" className="btn btn-ghost btn-inline" disabled={busy} onClick={onAnnuler}>Annuler</button>
        </div>
      </div>
    );
  }
  if (kind === "relancer") {
    return (
      <div className="banner banner-info small" style={{ textAlign: "left", marginTop: 6 }}>
        <strong>Relancer les destinataires non lus ?</strong>
        <div className="muted" style={{ marginTop: 4 }}>L&apos;information sera renvoyée sur ses canaux (Telegram, e-mail) uniquement aux personnes qui ne l&apos;ont pas encore lue. Celles qui l&apos;ont déjà lue ne sont pas notifiées.</div>
        <div style={ROW}>
          <button type="button" className="btn btn-primary btn-inline" disabled={busy} onClick={onRelancer}>Relancer maintenant</button>
          <button type="button" className="btn btn-ghost btn-inline" disabled={busy} onClick={onAnnuler}>Annuler</button>
        </div>
      </div>
    );
  }
  return (
    <div className="banner banner-info small" style={{ textAlign: "left", marginTop: 6 }}>
      <strong>Publier et diffuser cette information ?</strong>
      <div className="muted" style={{ marginTop: 4 }}>Elle sera envoyée à tous les destinataires ciblés sur les canaux choisis (Telegram, e-mail). Cette diffusion ne peut pas être annulée.</div>
      <div style={ROW}>
        <button type="button" className="btn btn-primary btn-inline" disabled={publierBloque} onClick={onPublier}>Publier et diffuser</button>
        <button type="button" className="btn btn-ghost btn-inline" disabled={busy} onClick={onAnnuler}>Annuler</button>
      </div>
    </div>
  );
}
