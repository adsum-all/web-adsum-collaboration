import { useRef, useState } from "react";

import { definirCouverture, supprimerPiece, uploadCartePiece } from "../../lib/store.js";
import type { CarteProto, PieceJointe } from "../../lib/types.js";
import { ApercuPiece, downloadUrl } from "./ApercuPiece.js";

interface Props {
  carte: CarteProto;
  peutEditer: boolean;
  onChanged: () => Promise<void> | void;
}

const MAX = 2_500_000;

function lireFichier(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Lecture du fichier impossible"));
    r.readAsDataURL(f);
  });
}

// Card attachments: file picker, drag-and-drop, paste-from-clipboard, image preview,
// download, set-as-cover and delete. Backed by the real /pieces routes (object
// storage with signed URLs). No stub.
export function PiecesCarte({ carte, peutEditer, onChanged }: Props): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [apercu, setApercu] = useState<PieceJointe | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function envoyer(files: FileList | File[]): Promise<void> {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      for (const f of list) {
        if (f.size > MAX) {
          setErr(`« ${f.name} » dépasse 2,5 Mo.`);
          continue;
        }
        const dataUrl = await lireFichier(f);
        await uploadCartePiece(carte.id, { nom: f.name, type: f.type, taille: f.size, data_url: dataUrl });
      }
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ajout impossible");
    } finally {
      setBusy(false);
    }
  }

  async function onPaste(e: React.ClipboardEvent): Promise<void> {
    if (!peutEditer) return;
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      await envoyer(files);
    }
  }

  async function retirer(id: string): Promise<void> {
    if (!window.confirm("Retirer cette pièce jointe ?")) return;
    setBusy(true);
    setErr(null);
    try {
      await supprimerPiece(id);
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Suppression impossible");
    } finally {
      setBusy(false);
    }
  }

  async function couvrir(id: string | null): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      await definirCouverture(carte.id, id);
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="modal-section-titre">Pièces jointes</span>
      <div
        onPaste={(e) => void onPaste(e)}
        onDragOver={(e) => { if (peutEditer) { e.preventDefault(); setDrag(true); } }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { if (peutEditer) { e.preventDefault(); setDrag(false); void envoyer(e.dataTransfer.files); } }}
        style={{
          border: `1px dashed ${drag ? "var(--adsum-acc, #0EA5E9)" : "var(--adsum-line, #d8dee9)"}`,
          borderRadius: 10, padding: 10, background: drag ? "rgba(14,165,233,0.06)" : "transparent",
        }}
      >
        {carte.pieces.length === 0 && <p className="muted small" style={{ margin: "2px 0 8px" }}>Aucune pièce. Glissez un fichier ici, collez une image, ou ajoutez-en une.</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {carte.pieces.map((p) => {
            const isImage = p.type.startsWith("image/") && !!p.data_url;
            const isCover = carte.couverture_id === p.id;
            return (
              <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 170 }}>
                {isImage ? (
                  <button type="button" onClick={() => setApercu(p)} title="Aperçu"
                    style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer" }}>
                    <img src={p.data_url ?? ""} alt={p.nom}
                      style={{ maxWidth: 160, maxHeight: 110, borderRadius: 8, objectFit: "cover", border: isCover ? "2px solid var(--adsum-acc, #0EA5E9)" : "1px solid var(--adsum-line, #d8dee9)" }} />
                  </button>
                ) : (
                  <button type="button" onClick={() => setApercu(p)} className="btn btn-ghost btn-inline"
                    title="Aperçu" style={{ fontSize: 13, wordBreak: "break-all", textAlign: "left" }}>{p.nom}</button>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-ghost btn-inline" style={{ fontSize: 11 }}
                    onClick={() => setApercu(p)}>Aperçu</button>
                  <a href={downloadUrl(p)} download={p.nom} className="btn btn-ghost btn-inline" style={{ fontSize: 11 }}>Télécharger</a>
                  {peutEditer && isImage && (
                    <button type="button" className="btn btn-ghost btn-inline" style={{ fontSize: 11 }} disabled={busy}
                      onClick={() => void couvrir(isCover ? null : p.id)}>
                      {isCover ? "Retirer couverture" : "Couverture"}
                    </button>
                  )}
                  {peutEditer && (
                    <button type="button" className="btn btn-ghost btn-inline" style={{ fontSize: 11 }} disabled={busy}
                      onClick={() => void retirer(p.id)}>Retirer</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {peutEditer && (
          <label className="btn btn-ghost btn-inline" style={{ marginTop: 8, cursor: "pointer", display: "inline-block" }}>
            {busy ? "Envoi..." : "+ Ajouter une pièce"}
            <input ref={inputRef} type="file" multiple style={{ display: "none" }} disabled={busy}
              onChange={(e) => { void envoyer(e.target.files ?? []); e.target.value = ""; }} />
          </label>
        )}
        {err && <p className="small" style={{ color: "var(--danger, #c0392b)", margin: "6px 0 0" }}>{err}</p>}
      </div>
      {apercu && <ApercuPiece piece={apercu} onClose={() => setApercu(null)} />}
    </div>
  );
}
