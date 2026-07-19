import { useEffect, useRef, useState } from "react";

import { type MembreProfile, getMembres } from "../../api.js";

/* eslint-disable react-hooks/exhaustive-deps */

/** Rich emoji catalogue by category, with skin-tone support for hand/person
 * emojis, built from code points so the source stays ASCII (the project bans
 * literal emojis in code; member-facing CONTENT may of course carry them). */
interface EmojiCat {
  nom: string;
  /** True when the category's emojis accept a skin-tone modifier. */
  teintes: boolean;
  points: number[][];
}
const EMOJI_CATS: EmojiCat[] = [
  { nom: "Mains", teintes: true, points: [
    [0x1f64f], [0x1f44d], [0x1f44e], [0x1f44f], [0x1f64c], [0x1f4aa], [0x270b], [0x270c],
    [0x1f44b], [0x1f446], [0x1f447], [0x1f448], [0x1f449], [0x1f91f], [0x1f918], [0x1f590],
    [0x1f470], [0x1f47c], [0x1f486], [0x1f487],
  ] },
  { nom: "Visages", teintes: false, points: [
    [0x1f600], [0x1f603], [0x1f604], [0x1f601], [0x1f606], [0x1f642], [0x1f60a], [0x1f607],
    [0x1f929], [0x1f970], [0x1f60d], [0x1f618], [0x1f917], [0x1f914], [0x1f92d], [0x1f644],
    [0x1f622], [0x1f62d], [0x1f625], [0x1f614], [0x1f60c], [0x1f634], [0x1f637], [0x1f973], [0x1f60e],
  ] },
  { nom: "Coeurs", teintes: false, points: [
    [0x2764, 0xfe0f], [0x1f9e1], [0x1f49b], [0x1f49a], [0x1f499], [0x1f49c], [0x1f90d], [0x1f5a4],
    [0x1f494], [0x1f495], [0x1f496], [0x1f497], [0x1f49d], [0x1f49e], [0x1f4af],
  ] },
  { nom: "Spirituel", teintes: false, points: [
    [0x1f54a, 0xfe0f], [0x26ea], [0x1f4d6], [0x1f56f, 0xfe0f], [0x1f4ff], [0x271d, 0xfe0f], [0x1f397, 0xfe0f], [0x1f549, 0xfe0f],
  ] },
  { nom: "Fete", teintes: false, points: [
    [0x1f389], [0x1f38a], [0x1f388], [0x1f381], [0x1f382], [0x1f3c6], [0x1f947], [0x2728],
    [0x1f31f], [0x2b50], [0x1f308], [0x1f386], [0x1f387], [0x1f393],
  ] },
  { nom: "Nature", teintes: false, points: [
    [0x1f338], [0x1f33a], [0x1f33b], [0x1f337], [0x1f341], [0x1f343], [0x1f33f], [0x2600, 0xfe0f],
    [0x1f319], [0x26c5], [0x1f4a7], [0x1f30d], [0x1f525],
  ] },
  { nom: "Objets", teintes: false, points: [
    [0x1f4e2], [0x1f4e3], [0x1f514], [0x1f4c5], [0x1f4cd], [0x1f551], [0x1f4dd], [0x1f4ce],
    [0x1f4bc], [0x1f4da], [0x1f3b5], [0x1f3b6], [0x1f399, 0xfe0f], [0x1f4f1], [0x1f4bb], [0x2709, 0xfe0f], [0x1f4e7],
  ] },
  { nom: "Symboles", teintes: false, points: [
    [0x2705], [0x274c], [0x2757], [0x2753], [0x26a0, 0xfe0f], [0x1f4a1], [0x1f511], [0x1f512],
    [0x1f513], [0x27a1, 0xfe0f], [0x2b06, 0xfe0f], [0x1f4cc], [0x1f4cb], [0x1f6a8], [0x1f4a5],
  ] },
];
/** Skin-tone modifiers (null = default yellow), like on a phone keyboard. */
const TEINTES: (number | null)[] = [null, 0x1f3fb, 0x1f3fc, 0x1f3fd, 0x1f3fe, 0x1f3ff];

function emojiDe(points: number[], teinte: number | null, teintable: boolean): string {
  // A tone modifier replaces the FE0F presentation selector and only applies to
  // tone-capable emojis (single-person/hand code points).
  if (teintable && teinte && points.length === 1) return String.fromCodePoint(points[0] ?? 0, teinte);
  return String.fromCodePoint(...points);
}
/** Flat default-tone list, kept for callers that only need a small set. */
export const EMOJIS: string[] = EMOJI_CATS.flatMap((c) => c.points.map((p) => emojiDe(p, null, false)));

/** Wrap the current textarea selection with markers (bold/italic/underline) or
 * insert a plain string at the caret, keeping focus and a sensible caret position. */
function applyToTextarea(
  el: HTMLTextAreaElement | null,
  value: string,
  onChange: (v: string) => void,
  before: string,
  after = "",
): void {
  if (!el) return;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end);
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  onChange(next);
  const caret = after ? (selected ? end + before.length + after.length : start + before.length) : start + before.length;
  window.setTimeout(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  }, 0);
}

/** Formatting toolbar for the content textarea: bold, italic, underline and an
 * emoji palette. The markers are the light markup the member app renders
 * (**gras**, *italique*, __souligne__); nothing is ever interpreted as HTML. */
export function RichToolbar({
  textareaRef,
  value,
  onChange,
}: Readonly<{
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (v: string) => void;
}>): JSX.Element {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [cat, setCat] = useState(0);
  const [teinte, setTeinte] = useState<number | null>(null);
  const wrap = (b: string, a: string): void => applyToTextarea(textareaRef.current, value, onChange, b, a);
  // Line-start formatting (title, bullet, quote): prefix every selected line.
  const prefixLines = (prefix: string): void => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const debutLigne = value.lastIndexOf("\n", start - 1) + 1;
    const bloc = value.slice(debutLigne, end);
    const transforme = bloc.split("\n").map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l)).join("\n");
    const next = value.slice(0, debutLigne) + transforme + value.slice(end);
    onChange(next);
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(debutLigne, debutLigne + transforme.length);
    }, 0);
  };
  const catCourante = EMOJI_CATS[cat] ?? EMOJI_CATS[0];
  return (
    <div className="rt-bar">
      <button type="button" className="rt-btn" title="Gras" aria-label="Mettre en gras" onClick={() => wrap("**", "**")}><b>G</b></button>
      <button type="button" className="rt-btn" title="Italique" aria-label="Mettre en italique" onClick={() => wrap("*", "*")}><i>I</i></button>
      <button type="button" className="rt-btn" title="Souligner" aria-label="Souligner" onClick={() => wrap("__", "__")}><u>S</u></button>
      <span className="rt-sep" aria-hidden="true" />
      <button type="button" className="rt-btn" title="Titre de section" aria-label="Titre de section" onClick={() => prefixLines("## ")}>T</button>
      <button type="button" className="rt-btn" title="Liste à puces" aria-label="Liste à puces" onClick={() => prefixLines("- ")}>{"•"}</button>
      <button type="button" className="rt-btn" title="Citation" aria-label="Citation" onClick={() => prefixLines("> ")}>{"»"}</button>
      <span className="rt-sep" aria-hidden="true" />
      <button type="button" className="rt-btn" aria-expanded={emojiOpen} aria-label="Insérer un émoji" onClick={() => setEmojiOpen((v) => !v)}>
        {String.fromCodePoint(0x1f60a)}
      </button>
      {emojiOpen && (
        <div className="rt-emojis rt-emojis-riche" role="dialog" aria-label="Choisir un émoji">
          <div className="rt-cats">
            {EMOJI_CATS.map((c, i) => (
              <button key={c.nom} type="button" className={`rt-cat ${i === cat ? "is-on" : ""}`} onClick={() => setCat(i)}>{c.nom}</button>
            ))}
          </div>
          {catCourante?.teintes && (
            <div className="rt-tons" role="radiogroup" aria-label="Teinte de peau">
              {TEINTES.map((t) => (
                <button
                  key={t ?? 0}
                  type="button"
                  role="radio"
                  aria-checked={teinte === t}
                  className={`rt-ton ${teinte === t ? "is-on" : ""}`}
                  onClick={() => setTeinte(t)}
                >
                  {emojiDe([0x1f44b], t, true)}
                </button>
              ))}
            </div>
          )}
          <div className="rt-grid">
            {(catCourante?.points ?? []).map((p) => {
              const e = emojiDe(p, teinte, catCourante?.teintes ?? false);
              return (
                <button
                  key={e}
                  type="button"
                  className="rt-emoji"
                  onClick={() => {
                    applyToTextarea(textareaRef.current, value, onChange, e);
                    setEmojiOpen(false);
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuree(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Voice-note recorder for the editor (MediaRecorder). Explicit start, pause,
 * resume, stop, preview and re-record; the result is handed up as a data URL and
 * only persisted when the admin saves. A device without microphone access shows a
 * clear message instead of a dead button. */
export function VoiceRecorder({
  existingUrl,
  onChange,
  onBusyChange,
}: Readonly<{
  /** Currently stored voice note (data URL) or null. */
  existingUrl: string | null;
  /** null clears; a data URL replaces. Called only on explicit user actions. */
  onChange: (dataUrl: string | null) => void;
  /** True while recording or encoding: the editor blocks save/publish so a note
   * being finalised can never be silently lost. */
  onBusyChange?: (busy: boolean) => void;
}>): JSX.Element {
  const [etat, setEtat] = useState<"idle" | "rec" | "pause" | "encodage">("idle");
  const [duree, setDuree] = useState(0);
  const [preview, setPreview] = useState<string | null>(existingUrl);
  const [erreur, setErreur] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  function tick(on: boolean): void {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = on ? window.setInterval(() => setDuree((d) => d + 1), 1000) : null;
  }

  async function demarrer(): Promise<void> {
    setErreur(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const du = String(reader.result || "");
          setPreview(du);
          onChange(du);
          setEtat("idle");
          onBusyChange?.(false);
        };
        reader.onerror = () => {
          setErreur("Encodage de la note impossible: réessayez.");
          setEtat("idle");
          onBusyChange?.(false);
        };
        reader.readAsDataURL(blob);
      };
      recRef.current = rec;
      rec.start();
      setDuree(0);
      setEtat("rec");
      onBusyChange?.(true);
      tick(true);
    } catch {
      setErreur("Microphone indisponible: autorisez l'accès au micro puis réessayez.");
    }
  }

  function stop(): void {
    // Encoding runs until the data URL is ready (onstop -> reader.onload): the
    // editor stays blocked meanwhile so a click on Enregistrer/Publier right after
    // "Terminer" can never lose the note.
    setEtat("encodage");
    tick(false);
    recRef.current?.stop();
  }

  function basculerPause(): void {
    const rec = recRef.current;
    if (!rec) return;
    if (etat === "rec") {
      rec.pause();
      setEtat("pause");
      tick(false);
    } else {
      rec.resume();
      setEtat("rec");
      tick(true);
    }
  }

  const enCours = etat === "rec" || etat === "pause";
  return (
    <div className="vr-box">
      <div className="vr-row">
        {etat === "idle" && (
          <button type="button" className="btn btn-ghost btn-inline" onClick={() => void demarrer()}>
            {preview ? "Réenregistrer" : "Enregistrer une note vocale"}
          </button>
        )}
        {etat === "encodage" && <span className="muted small">Encodage de la note vocale...</span>}
        {enCours && (
          <>
            <span className={`vr-dot ${etat === "rec" ? "is-rec" : ""}`} aria-hidden="true" />
            <span className="vr-time">{formatDuree(duree)}</span>
            <button type="button" className="btn btn-ghost btn-inline" onClick={basculerPause}>
              {etat === "rec" ? "Pause" : "Reprendre"}
            </button>
            <button type="button" className="btn btn-primary btn-inline" onClick={stop}>
              Terminer
            </button>
          </>
        )}
        {preview && etat === "idle" && (
          <button
            type="button"
            className="btn btn-danger btn-inline"
            onClick={() => {
              setPreview(null);
              onChange(null);
            }}
          >
            Supprimer
          </button>
        )}
      </div>
      {preview && etat === "idle" && <audio controls src={preview} className="vr-audio" />}
      {erreur && <p className="banner banner-error">{erreur}</p>}
    </div>
  );
}

/** Read a picked file as a data URL, refusing anything above the API cap so the
 * admin gets an immediate size message instead of a failed upload. */
export function fileToDataUrl(file: File, maxBytes = 2_500_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error(`Fichier trop volumineux (${Math.round(file.size / 1024)} Ko, maximum ${Math.round(maxBytes / 1024)} Ko).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

/** Member search-and-pick for the manual "selection" targeting: type a name,
 * pick from the matches, chips list the chosen members. */
export function MembrePicker({
  token,
  selection,
  onChange,
}: Readonly<{
  token: string;
  selection: { id: string; nom: string }[];
  onChange: (next: { id: string; nom: string }[]) => void;
}>): JSX.Element {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<MembreProfile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) {
      setResultats([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setBusy(true);
      getMembres(token, { q: terme, limit: 8 })
        .then((rows) => setResultats(rows))
        .catch(() => setResultats([]))
        .finally(() => setBusy(false));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [q, token]);

  const nomDe = (m: MembreProfile): string =>
    (m.nom_affiche as string | null) ?? `${m.prenoms ?? ""} ${m.nom ?? ""}`.trim();

  return (
    <div className="mp-box">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un membre par nom..."
        aria-label="Rechercher un membre"
      />
      {busy && <p className="muted small">Recherche...</p>}
      {resultats.length > 0 && (
        <ul className="mp-results">
          {resultats
            .filter((m) => !selection.some((s) => s.id === m.id))
            .map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...selection, { id: m.id, nom: nomDe(m) }]);
                    setQ("");
                    setResultats([]);
                  }}
                >
                  {nomDe(m)}
                  <span className="muted small"> {m.matricule ?? ""}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
      {selection.length > 0 && (
        <div className="mp-chips">
          {selection.map((s) => (
            <span key={s.id} className="mp-chip">
              {s.nom}
              <button type="button" aria-label={`Retirer ${s.nom}`} onClick={() => onChange(selection.filter((x) => x.id !== s.id))}>
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
