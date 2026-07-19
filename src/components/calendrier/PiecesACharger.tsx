import { useRef, useState } from "react";

/**
 * Attachment picker for the CREATE form, before the activity exists. Collects files
 * client-side (click, drag-and-drop, or paste Ctrl+V) and hands the list to the parent,
 * which uploads them right after the activity is created. Mirrors the back office.
 */
const MAX_TAILLE = 4_500_000; // 4,5 Mo par fichier

export function PiecesACharger({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }): JSX.Element {
  const [survol, setSurvol] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function ajouter(nouveaux: File[]): void {
    const ok: File[] = [];
    for (const f of nouveaux) {
      if (f.size > MAX_TAILLE) { setErr(`« ${f.name || "fichier"} » trop volumineux (max 4,5 Mo).`); continue; }
      ok.push(f);
    }
    if (ok.length > 0) { setErr(null); onChange([...files, ...ok]); }
  }

  function onPaste(e: React.ClipboardEvent): void {
    const fs = [...(e.clipboardData?.items ?? [])]
      .filter((it) => it.kind === "file")
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (fs.length > 0) { e.preventDefault(); ajouter(fs); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.06)", borderRadius: 8, padding: "4px 8px", fontSize: 12.5 }}>
              {f.type.startsWith("image/") ? "🖼️" : "📎"} {f.name || "image collée"}
              <button type="button" aria-label="Retirer" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
                onClick={() => onChange(files.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
        </div>
      )}
      <div
        onPaste={onPaste}
        onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => { e.preventDefault(); setSurvol(false); ajouter([...e.dataTransfer.files]); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        style={{
          border: `2px dashed ${survol ? "var(--adsum-acc, #2a4fad)" : "var(--adsum-line, #d7dbe2)"}`,
          background: survol ? "rgba(42,79,173,0.06)" : "transparent",
          borderRadius: 10, padding: "12px 14px", textAlign: "center", cursor: "pointer", fontSize: 13,
          color: "var(--adsum-mut, #5b6472)",
        }}
      >
        Glissez-déposez, collez (Ctrl+V) ou cliquez pour joindre une image ou un document
        <input ref={inputRef} type="file" multiple style={{ display: "none" }}
          onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; ajouter(fs); }} />
      </div>
      {err && <span className="small" style={{ color: "var(--danger, #c0392b)" }}>{err}</span>}
    </div>
  );
}
