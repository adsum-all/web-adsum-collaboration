import { useEffect, useRef } from "react";

// A small rich-text editor for the activity description: bold, italic, underline,
// bullet/numbered lists and a heading, on several lines with paragraphs. It emits
// an HTML string; the server sanitises it (allowlist) before storing, and it is
// rendered back through the same allowlist, so authoring stays safe.

interface Props {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}

const TOOLS: { cmd: string; arg?: string; label: string; title: string }[] = [
  { cmd: "bold", label: "G", title: "Gras" },
  { cmd: "italic", label: "I", title: "Italique" },
  { cmd: "underline", label: "S", title: "Souligné" },
  { cmd: "formatBlock", arg: "H3", label: "Titre", title: "Titre" },
  { cmd: "formatBlock", arg: "P", label: "¶", title: "Paragraphe" },
  { cmd: "insertUnorderedList", label: "• Liste", title: "Liste à puces" },
  { cmd: "insertOrderedList", label: "1. Liste", title: "Liste numérotée" },
  { cmd: "createLink", label: "🔗 Lien", title: "Insérer un lien" },
  { cmd: "removeFormat", label: "Effacer", title: "Effacer la mise en forme" },
];

export function RichEditor({ value, onChange, disabled }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  // Set the initial HTML once (and when the incoming value changes externally, e.g.
  // opening the editor on a different activity), without fighting the caret on every
  // keystroke.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  function exec(cmd: string, arg?: string): void {
    if (disabled) return;
    const el = ref.current;
    el?.focus();
    if (cmd === "createLink") {
      const url = window.prompt("Adresse du lien (https://...)");
      if (url) document.execCommand("createLink", false, url);
    } else {
      document.execCommand(cmd, false, arg);
    }
    if (el) onChange(el.innerHTML);
  }

  return (
    <div style={{ border: "1px solid var(--adsum-line)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 6, borderBottom: "1px solid var(--adsum-line)", background: "var(--adsum-board)" }}>
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            className="btn btn-ghost btn-inline"
            title={t.title}
            disabled={disabled}
            onMouseDown={(e) => { e.preventDefault(); exec(t.cmd, t.arg); }}
            style={{ fontWeight: t.cmd === "bold" ? 700 : 400, fontStyle: t.cmd === "italic" ? "italic" : "normal", textDecoration: t.cmd === "underline" ? "underline" : "none", padding: "2px 8px", fontSize: 13 }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-label="Description de l'activité"
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        style={{ minHeight: 160, maxHeight: 320, overflowY: "auto", padding: "10px 12px", outline: "none", lineHeight: 1.5, fontSize: 14 }}
        suppressContentEditableWarning
      />
    </div>
  );
}
