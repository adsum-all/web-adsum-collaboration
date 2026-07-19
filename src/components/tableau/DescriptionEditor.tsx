import { useEffect, useRef, useState } from "react";

interface MembreLite {
  id: string;
  nom: string;
  initiales: string;
}

interface Props {
  value: string;
  membres: MembreLite[];
  disabled?: boolean;
  onSave: (html: string) => Promise<void> | void;
}

interface Tool {
  cmd: string;
  arg?: string;
  label: string;
  title: string;
}

const TOOLS: Tool[] = [
  { cmd: "bold", label: "G", title: "Gras" },
  { cmd: "italic", label: "I", title: "Italique" },
  { cmd: "underline", label: "U", title: "Souligne" },
  { cmd: "strikeThrough", label: "S", title: "Barre" },
  { cmd: "formatBlock", arg: "H3", label: "Titre", title: "Titre" },
  { cmd: "formatBlock", arg: "BLOCKQUOTE", label: "Citation", title: "Citation" },
  { cmd: "formatBlock", arg: "PRE", label: "Code", title: "Bloc de code" },
  { cmd: "insertUnorderedList", label: "Liste", title: "Liste a puces" },
  { cmd: "insertOrderedList", label: "1.", title: "Liste numerotee" },
  { cmd: "createLink", label: "Lien", title: "Inserer un lien" },
  { cmd: "removeFormat", label: "Effacer", title: "Effacer la mise en forme" },
];

// Rich description editor for a card: formatting, links, inline images (file or
// paste) and @mentions of space members. Emits HTML; the server sanitises it
// (allowlist incl. img data:/https) before storing and it renders back through the
// same allowlist, so authoring stays safe.
export function DescriptionEditor({ value, membres, disabled, onSave }: Props): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [frag, setFrag] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Seed the editable buffer only when entering edit mode, not on every `value`
    // change: a background reload that updates the card prop must not overwrite an
    // unsaved in-progress edit. The read view already reflects live `value`.
    if (editing && ref.current) ref.current.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const suggestions = (() => {
    const f = frag.trim().toLowerCase();
    const base = membres.slice(0, 6);
    if (!f) return base;
    return membres.filter((m) => m.nom.toLowerCase().includes(f)).slice(0, 6);
  })();

  function exec(cmd: string, arg?: string): void {
    ref.current?.focus();
    if (cmd === "createLink") {
      const url = window.prompt("Adresse du lien (https://...)");
      if (url) document.execCommand("createLink", false, url);
    } else {
      document.execCommand(cmd, false, arg);
    }
  }

  function onInput(): void {
    const el = ref.current;
    if (!el) return;
    const sel = window.getSelection();
    const text = sel && sel.anchorNode ? (sel.anchorNode.textContent ?? "").slice(0, sel.anchorOffset) : "";
    const m = text.match(/@([\p{L}\p{M}'.-]*)$/u);
    if (m) {
      setMentionOpen(true);
      setFrag(m[1] ?? "");
    } else {
      setMentionOpen(false);
    }
  }

  function insertMention(nom: string): void {
    const el = ref.current;
    el?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const back = frag.length + 1; // include the '@'
      const start = Math.max(0, range.startOffset - back);
      range.setStart(range.startContainer, start);
      range.deleteContents();
    }
    document.execCommand("insertText", false, `@${nom} `);
    setMentionOpen(false);
    setFrag("");
  }

  async function insertImage(file: File): Promise<void> {
    if (file.size > 2_500_000) {
      window.alert("Image trop volumineuse (max 2,5 Mo).");
      return;
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("lecture impossible"));
      r.readAsDataURL(file);
    });
    ref.current?.focus();
    document.execCommand("insertImage", false, dataUrl);
  }

  function onPaste(e: React.ClipboardEvent): void {
    const img = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (img) {
      e.preventDefault();
      void insertImage(img);
    }
  }

  async function save(): Promise<void> {
    setBusy(true);
    try {
      await onSave(ref.current?.innerHTML ?? "");
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="modal-section-titre" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Description</span>
          {!disabled && <button type="button" className="btn btn-ghost btn-inline" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>Modifier</button>}
        </div>
        {value && value.trim() ? (
          <div className="rich-read" style={{ fontSize: 14, lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: value }} />
        ) : (
          <p className="muted small" style={{ margin: "2px 0" }}>Aucune description. Cliquez sur Modifier pour rediger (gras, listes, liens, images, @mention).</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <span className="modal-section-titre">Description</span>
      <div style={{ border: "1px solid var(--adsum-line, #d7dbe3)", borderRadius: 10, overflow: "hidden", position: "relative" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 6, borderBottom: "1px solid var(--adsum-line, #e2e2e2)", background: "var(--adsum-board, #f7f8fa)" }}>
          {TOOLS.map((t) => (
            <button key={t.label} type="button" className="btn btn-ghost btn-inline" title={t.title}
              onMouseDown={(e) => { e.preventDefault(); exec(t.cmd, t.arg); }}
              style={{ padding: "2px 8px", fontSize: 13, fontWeight: t.cmd === "bold" ? 700 : 400, fontStyle: t.cmd === "italic" ? "italic" : "normal" }}>
              {t.label}
            </button>
          ))}
          <button type="button" className="btn btn-ghost btn-inline" title="Inserer une image"
            onMouseDown={(e) => { e.preventDefault(); fileRef.current?.click(); }} style={{ padding: "2px 8px", fontSize: 13 }}>Image</button>
          <button type="button" className="btn btn-ghost btn-inline" title="Mentionner (@)"
            onMouseDown={(e) => { e.preventDefault(); ref.current?.focus(); document.execCommand("insertText", false, "@"); setMentionOpen(true); setFrag(""); }}
            style={{ padding: "2px 8px", fontSize: 13 }}>@</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void insertImage(f); e.target.value = ""; }} />
        </div>
        <div ref={ref} contentEditable role="textbox" aria-multiline="true" aria-label="Description de la carte"
          onInput={onInput} onPaste={onPaste} suppressContentEditableWarning
          style={{ minHeight: 140, maxHeight: 340, overflowY: "auto", padding: "10px 12px", outline: "none", lineHeight: 1.55, fontSize: 14 }} />
        {mentionOpen && suggestions.length > 0 && (
          <div className="mention-pop" style={{ position: "absolute", bottom: 46, left: 12, zIndex: 5 }}>
            {suggestions.map((m) => (
              <button key={m.id} type="button" className="mention-item" onMouseDown={(e) => { e.preventDefault(); insertMention(m.nom.split(" ")[0] ?? m.nom); }}>
                <span className="avatar avatar-sm">{m.initiales}</span>
                <span>{m.nom}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-primary btn-inline" disabled={busy} onClick={() => void save()}>{busy ? "Enregistrement..." : "Enregistrer"}</button>
        <button type="button" className="btn btn-ghost btn-inline" disabled={busy} onClick={() => setEditing(false)}>Annuler</button>
      </div>
    </div>
  );
}
