import { useEffect } from "react";
import { createPortal } from "react-dom";

import type { PieceJointe } from "../../lib/types.js";

interface Props {
  piece: PieceJointe;
  onClose: () => void;
}

type Kind = "image" | "pdf" | "text" | "none";

function kindOf(type: string): Kind {
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("text/")) return "text";
  return "none";
}

// Force a download disposition. For an inline data: URL the download attribute is
// enough; for an object-backed signed URL we add Supabase's download parameter so
// the file arrives as an attachment instead of rendering.
export function downloadUrl(p: { nom: string; data_url: string | null }): string {
  const u = p.data_url ?? "";
  if (!u || u.startsWith("data:")) return u;
  return u + (u.includes("?") ? "&" : "?") + `download=${encodeURIComponent(p.nom)}`;
}

function humanSize(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

// In-app preview of an attachment: images, PDFs and text files render inline; other
// types (Word, Excel, archives, ...) cannot be previewed natively in the browser, so
// we offer opening them in a new tab or downloading them. No third-party viewer is
// used, so no document ever leaves the platform (RGPD/HDS).
export function ApercuPiece({ piece, onClose }: Props): JSX.Element {
  const url = piece.data_url ?? "";
  const kind = url ? kindOf(piece.type) : "none";

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div className="apercu-overlay" onClick={onClose}>
      <div className="apercu-box" onClick={(e) => e.stopPropagation()}>
        <header className="apercu-head">
          <div style={{ minWidth: 0 }}>
            <div className="apercu-nom" title={piece.nom}>{piece.nom}</div>
            <div className="muted small">{piece.type || "type inconnu"} · {humanSize(piece.taille)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-inline">Ouvrir</a>
            )}
            {url && (
              <a href={downloadUrl(piece)} download={piece.nom} className="btn btn-primary btn-inline">Télécharger</a>
            )}
            <button type="button" className="btn btn-ghost btn-inline" aria-label="Fermer" onClick={onClose}>✕</button>
          </div>
        </header>
        <div className="apercu-body">
          {!url && <p className="muted">Aperçu indisponible (fichier non accessible).</p>}
          {url && kind === "image" && <img src={url} alt={piece.nom} className="apercu-image" />}
          {url && kind === "pdf" && <iframe src={url} title={piece.nom} className="apercu-frame" />}
          {url && kind === "text" && <iframe src={url} title={piece.nom} className="apercu-frame" />}
          {url && kind === "none" && (
            <div className="apercu-none">
              <p>Ce type de fichier ne peut pas être prévisualisé directement dans le navigateur.</p>
              <p className="muted small">Ouvrez-le dans un nouvel onglet ou téléchargez-le pour le consulter dans son application.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
