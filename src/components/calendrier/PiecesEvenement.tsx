import { useEffect, useRef, useState } from "react";

import {
  type PieceEvenement,
  ajouterPieceActivite,
  listPiecesActivite,
  supprimerPieceActivite,
} from "../../lib/store.js";

// Attachments of an activity: images inline, other files as download links. Managers
// add by click, drag-and-drop, or paste (Ctrl+V), and remove. Files are read as data
// URLs and size-capped. Same behaviour as the back office, so both apps feel identical.
interface Props {
  activiteId: string;
  peutGerer: boolean;
}

const MAX_TAILLE = 4_500_000; // 4,5 Mo par fichier

export function lireFichier(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Lecture du fichier impossible"));
    r.readAsDataURL(f);
  });
}

export function PiecesEvenement({ activiteId, peutGerer }: Props): JSX.Element {
  const [pieces, setPieces] = useState<PieceEvenement[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function charger(): void {
    listPiecesActivite(activiteId).then(setPieces).catch(() => setPieces([]));
  }
  useEffect(charger, [activiteId]);

  async function ajouter(files: File[]): Promise<void> {
    if (files.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      for (const f of files) {
        if (f.size > MAX_TAILLE) { setErr(`« ${f.name || "fichier"} » trop volumineux (max 4,5 Mo).`); continue; }
        const dataUrl = await lireFichier(f);
        await ajouterPieceActivite(activiteId, { nom: f.name || `piece-${Date.now()}`, type: f.type, taille: f.size, data_url: dataUrl });
      }
      charger();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Ajout impossible");
    } finally {
      setBusy(false);
    }
  }

  function onPaste(e: React.ClipboardEvent): void {
    const files = [...(e.clipboardData?.items ?? [])]
      .filter((it) => it.kind === "file")
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length > 0) { e.preventDefault(); void ajouter(files); }
  }

  async function retirer(id: string): Promise<void> {
    await supprimerPieceActivite(id);
    charger();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="muted small" style={{ fontWeight: 600 }}>Pièces jointes (images, documents)</span>
      {pieces.length === 0 && <span className="muted small">Aucune pièce.</span>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {pieces.map((p) => (
          <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 160 }}>
            {p.type.startsWith("image/") ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                <img src={p.url} alt={p.nom} style={{ maxWidth: 150, maxHeight: 110, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border, #e2e2e2)" }} />
              </a>
            ) : (
              <a href={p.url} download={p.nom} style={{ fontSize: 13, wordBreak: "break-all" }}>📎 {p.nom}</a>
            )}
            {peutGerer && (
              <button type="button" className="btn btn-ghost btn-inline" style={{ fontSize: 12 }} onClick={() => void retirer(p.id)}>Retirer</button>
            )}
          </div>
        ))}
      </div>
      {peutGerer && (
        <div
          onPaste={onPaste}
          onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => { e.preventDefault(); setSurvol(false); void ajouter([...e.dataTransfer.files]); }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          style={{
            border: `2px dashed ${survol ? "var(--accent, #2a4fad)" : "var(--border, #d7dbe2)"}`,
            background: survol ? "rgba(42,79,173,0.06)" : "transparent",
            borderRadius: 10, padding: "12px 14px", textAlign: "center", cursor: "pointer", fontSize: 13,
            color: "var(--muted, #5b6472)",
          }}
        >
          {busy ? "Ajout en cours..." : "Glissez-déposez, collez (Ctrl+V) ou cliquez pour ajouter une image ou un document"}
          <input ref={inputRef} type="file" multiple style={{ display: "none" }} disabled={busy}
            onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void ajouter(fs); }} />
        </div>
      )}
      {err && <span className="small" style={{ color: "var(--danger, #c0392b)" }}>{err}</span>}
    </div>
  );
}
