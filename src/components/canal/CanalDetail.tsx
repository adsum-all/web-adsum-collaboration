import { useEffect, useRef, useState } from "react";

import { downloadUrl } from "../tableau/ApercuPiece.js";
import { fileToDataUrl, mmss, pickMime } from "../../lib/media.js";
import { listColonnes } from "../../lib/store-cartes.js";
import { listEspaces } from "../../lib/store.js";
import { listTableauxEspace } from "../../lib/store-tableaux.js";
import {
  affecterCanal,
  ajouterNote,
  ajouterPieceCanal,
  chargerTableauCanal,
  cloturerCanal,
  creerCarteCanal,
  deleteCanal,
  getWorkflowCanal,
  listCanal,
  patchNote,
  priseEnChargeCanal,
  redigerNote,
  repondreCanal,
  restituerCanal,
  supprimerNote,
  supprimerPieceCanal,
  transcrireNote,
  updateCanal,
} from "../../lib/store-canal.js";
import type {
  CanalCategorie, CanalMessage, CanalNote, ColonneProto, EtapeWorkflow, Espace, Priorite, TableauProto,
} from "../../lib/types.js";

const CATEGORIES: { id: CanalCategorie; label: string }[] = [
  { id: "projet", label: "Projet" }, { id: "activite", label: "Activité" },
  { id: "organisation", label: "Organisation" }, { id: "communication", label: "Communication" },
  { id: "urgence", label: "Urgence" }, { id: "autre", label: "Autre" },
];
const PRIORITES: Priorite[] = ["urgente", "haute", "normale", "basse"];
const STATUTS: { id: string; label: string }[] = [
  { id: "nouveau", label: "Nouveau" }, { id: "en_cours", label: "En cours" },
  { id: "traite", label: "Traité" }, { id: "archive", label: "Archivé" },
];
type Onglet = "suivi" | "notes" | "pieces" | "discussion" | "liens";

const ETAPES: { id: string; label: string }[] = [
  { id: "recue", label: "Reçue" }, { id: "transcrite", label: "Transcrite" }, { id: "redigee", label: "Rédigée" },
  { id: "a_qualifier", label: "À qualifier" }, { id: "prise_en_charge", label: "Prise en charge" },
  { id: "affectee", label: "Affectée" }, { id: "chargee", label: "Chargée" }, { id: "en_traitement", label: "En traitement" },
  { id: "traitee", label: "Traitée" }, { id: "restituee", label: "Restituée" }, { id: "a_verifier", label: "À vérifier" },
  { id: "cloturee", label: "Clôturée" },
];
const etapeLabel = (id: string): string => ETAPES.find((e) => e.id === id)?.label ?? id;

// Key stages shown in the workflow graph (a Jira-style stepper). Their position in
// the full ETAPES order determines whether each is done, current or pending.
const KEY_STEPS = ["recue", "prise_en_charge", "affectee", "en_traitement", "restituee", "cloturee"];

function WorkflowGraph({ etapeCourante }: { etapeCourante: string }): JSX.Element {
  const order = ETAPES.map((e) => e.id);
  const cur = Math.max(0, order.indexOf(etapeCourante));
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "6px 0" }}>
      {KEY_STEPS.map((s, i) => {
        const idx = order.indexOf(s);
        const done = idx < cur;
        const current = idx === cur || (s === "recue" && cur < order.indexOf("prise_en_charge"));
        const bg = current ? "var(--collab-accent, #2A4FAD)" : done ? "#22c55e" : "var(--collab-line, #e2e6ef)";
        const color = current || done ? "#fff" : "var(--collab-muted, #64748b)";
        return (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ padding: "3px 10px", borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: current ? 700 : 500, whiteSpace: "nowrap" }}>
              {etapeLabel(s)}
            </span>
            {i < KEY_STEPS.length - 1 && <span aria-hidden style={{ color: "var(--collab-muted, #94a3b8)" }}>→</span>}
          </span>
        );
      })}
    </div>
  );
}

interface Props {
  message: CanalMessage;
  nomMembre: (id: string | null) => string;
  onChanged: () => Promise<void> | void;
  onBack: () => void;
}

export function CanalDetail({ message, nomMembre, onChanged, onBack }: Props): JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>("notes");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(p: Promise<unknown>): Promise<void> {
    setBusy(true); setErr(null);
    try { await p; await onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Action impossible"); }
    finally { setBusy(false); }
  }
  const patch = (champ: Parameters<typeof updateCanal>[1]): void => { void run(updateCanal(message.id, champ)); };

  const onglets: { id: Onglet; label: string; count?: number }[] = [
    { id: "suivi", label: "Suivi" },
    { id: "notes", label: "Notes vocales", count: message.notes.length },
    { id: "pieces", label: "Pièces jointes", count: message.pieces.length },
    { id: "discussion", label: "Discussion", count: message.reponses.length },
    { id: "liens", label: "Carte & liens", count: message.enfants.length + (message.parent ? 1 : 0) },
  ];

  return (
    <div className="canal-detail">
      <div className="canal-detail-head">
        <button type="button" className="btn btn-ghost btn-inline canal-back" onClick={onBack} aria-label="Retour">‹ Retour</button>
        <div className="canal-detail-actions">
          <select className="canal-select" value={message.statut} onChange={(e) => patch({ statut: e.target.value })} disabled={busy}>
            {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button type="button" className="btn btn-ghost btn-inline" disabled={busy}
            onClick={() => { if (window.confirm("Supprimer ce canal et toutes ses notes ?")) void run(deleteCanal(message.id).then(onBack)); }}>Supprimer</button>
        </div>
      </div>

      <input className="canal-input canal-sujet-edit" value={message.sujet}
        onChange={(e) => patch({ sujet: e.target.value })} placeholder="Sujet du canal" />
      <div className="canal-row canal-meta-row">
        <select className="canal-select" value={message.categorie} onChange={(e) => patch({ categorie: e.target.value as CanalCategorie })} disabled={busy}>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="canal-select" value={message.priorite} onChange={(e) => patch({ priorite: e.target.value as Priorite })} disabled={busy}>
          {PRIORITES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="muted small canal-auteur">Par {nomMembre(message.auteur_id)} · {message.cree_le ? new Date(message.cree_le).toLocaleString("fr-FR") : ""}</span>
      </div>

      {message.note && <p className="canal-note canal-note-inline">{message.note}</p>}

      <div className="canal-tabs" role="tablist">
        {onglets.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={onglet === o.id}
            className={`canal-tab${onglet === o.id ? " canal-tab-on" : ""}`} onClick={() => setOnglet(o.id)}>
            {o.label}{o.count ? <span className="canal-tab-count">{o.count}</span> : null}
          </button>
        ))}
      </div>

      {err && <p className="canal-err">{err}</p>}

      <div className="canal-tab-body">
        {onglet === "suivi" && <OngletSuivi message={message} nomMembre={nomMembre} busy={busy} run={run} />}
        {onglet === "notes" && <OngletNotes message={message} busy={busy} run={run} />}
        {onglet === "pieces" && <OngletPieces message={message} busy={busy} run={run} />}
        {onglet === "discussion" && <OngletDiscussion message={message} nomMembre={nomMembre} busy={busy} run={run} />}
        {onglet === "liens" && <OngletLiens message={message} busy={busy} run={run} />}
      </div>
    </div>
  );
}

// --- Recorder hook (add a voice note to an existing channel) --------------------

function useRecorder(): {
  enreg: boolean; chrono: number; audio: { dataUrl: string; type: string; duree: number } | null;
  micErr: string | null; start: () => Promise<void>; stop: () => void; reset: () => void;
} {
  const [enreg, setEnreg] = useState(false);
  const [chrono, setChrono] = useState(0);
  const [audio, setAudio] = useState<{ dataUrl: string; type: string; duree: number } | null>(null);
  const [micErr, setMicErr] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);
  async function start(): Promise<void> {
    setMicErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec; chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null;
        const duree = Math.round((Date.now() - startRef.current) / 1000);
        if (blob.size < 1500) { setMicErr("Enregistrement trop court."); return; }
        setAudio({ dataUrl: await fileToDataUrl(blob), type: blob.type || "audio/webm", duree });
      };
      rec.start(); startRef.current = Date.now(); setEnreg(true); setChrono(0);
      timerRef.current = window.setInterval(() => setChrono((c) => c + 1), 1000);
    } catch { setMicErr("Accès au micro refusé ou indisponible."); }
  }
  function stop(): void {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    setEnreg(false); recRef.current?.stop();
  }
  return { enreg, chrono, audio, micErr, start, stop, reset: () => { setAudio(null); setChrono(0); } };
}

type RunFn = (p: Promise<unknown>) => Promise<void>;

// --- Tab: voice notes -----------------------------------------------------------

function OngletNotes({ message, busy, run }: { message: CanalMessage; busy: boolean; run: RunFn }): JSX.Element {
  const rec = useRecorder();
  async function publierNote(): Promise<void> {
    if (!rec.audio) return;
    const a = rec.audio;
    await run(
      ajouterNote(message.id, { nom: "note-vocale", type: a.type, data_url: a.dataUrl, duree_s: a.duree })
        .then(async (msg) => { const n = msg.notes[msg.notes.length - 1]; if (n) { try { await transcrireNote(n.id); } catch { /* pas de fournisseur IA */ } } }),
    );
    rec.reset();
  }
  return (
    <div className="canal-notes-list">
      <div className="canal-add-note">
        {!rec.enreg && !rec.audio && (
          <button type="button" className="canal-rec-btn" onClick={() => void rec.start()} disabled={busy}>
            <span className="canal-rec-dot" aria-hidden="true" /> Ajouter une note vocale à ce canal
          </button>
        )}
        {rec.enreg && (
          <button type="button" className="canal-rec-btn canal-rec-on" onClick={rec.stop}>
            <span className="canal-rec-pulse" aria-hidden="true" /> Arrêter · {mmss(rec.chrono)}
          </button>
        )}
        {rec.audio && !rec.enreg && (
          <div className="canal-audio-preview">
            <audio controls src={rec.audio.dataUrl} />
            <span className="muted small">{mmss(rec.audio.duree)}</span>
            <button type="button" className="btn btn-primary btn-inline" disabled={busy} onClick={() => void publierNote()}>Publier la note</button>
            <button type="button" className="btn btn-ghost btn-inline" onClick={rec.reset}>Retirer</button>
          </div>
        )}
        {rec.micErr && <p className="canal-err">{rec.micErr}</p>}
      </div>

      {message.notes.length === 0 && (
        <p className="muted small canal-vide">Aucune note vocale. Enregistrez-en une ci-dessus. Chaque note aura sa propre transcription et sa rédaction.</p>
      )}
      {message.notes.map((n, i) => <NoteCard key={n.id} note={n} index={i} busy={busy} run={run} />)}
    </div>
  );
}

function NoteCard({ note, index, busy, run }: { note: CanalNote; index: number; busy: boolean; run: RunFn }): JSX.Element {
  const [brut, setBrut] = useState(note.transcription_brute);
  const [redige, setRedige] = useState(note.transcription_redigee);
  useEffect(() => { setBrut(note.transcription_brute); setRedige(note.transcription_redigee); },
    [note.id, note.transcription_brute, note.transcription_redigee]);
  const st = note.transcription_statut;
  return (
    <div className="canal-note-card">
      <div className="canal-note-head">
        <span className="canal-note-num">Note {index + 1}</span>
        <button type="button" className="btn btn-ghost btn-inline canal-note-del" disabled={busy}
          onClick={() => { if (window.confirm("Supprimer cette note vocale ?")) void run(supprimerNote(note.id)); }}>Supprimer</button>
      </div>
      {note.audio && <audio controls src={note.audio.data_url ?? ""} className="canal-audio" />}
      <div className="canal-trans-actions">
        <button type="button" className="btn btn-primary btn-inline" disabled={busy} onClick={() => void run(transcrireNote(note.id))}>
          {st === "prete" ? "Refaire la transcription" : "Transcrire (auto)"}
        </button>
        {st === "en_cours" && <span className="muted small">Transcription en cours...</span>}
        {st === "echec" && <span className="canal-err">{note.transcription_erreur || "Transcription indisponible (aucun fournisseur configuré)."}</span>}
      </div>
      <label className="canal-conserver">
        <input type="checkbox" checked={note.audio_conserver} disabled={busy}
          onChange={(e) => void run(patchNote(note.id, { audio_conserver: e.target.checked }))} />
        <span>Conserver l'audio au-delà de 30 jours
          {!note.audio_conserver && note.audio_expire_jours != null && (
            <span className="muted small"> · supprimé dans {note.audio_expire_jours} j (la transcription reste)</span>
          )}
        </span>
      </label>
      <span className="canal-bloc-titre">Transcription brute (verbatim)</span>
      <textarea className="canal-textarea" value={brut} onChange={(e) => setBrut(e.target.value)} rows={4}
        placeholder="Texte brut exact. Éditez-le si besoin en écoutant l'audio." />
      <div className="canal-trans-actions">
        <button type="button" className="btn btn-ghost btn-inline" disabled={busy || brut === note.transcription_brute}
          onClick={() => void run(patchNote(note.id, { transcription_brute: brut }))}>Enregistrer le brut</button>
        <button type="button" className="btn btn-primary btn-inline" disabled={busy || !brut.trim()}
          onClick={() => void run(redigerNote(note.id))}>Rédiger (pro)</button>
      </div>
      <span className="canal-bloc-titre">Rédaction professionnelle (éditable)</span>
      <textarea className="canal-textarea" value={redige} onChange={(e) => setRedige(e.target.value)} rows={5}
        placeholder="Version rédigée, fidèle au brut. Éditez-la librement." />
      <div className="canal-trans-actions">
        <button type="button" className="btn btn-ghost btn-inline" disabled={busy || redige === note.transcription_redigee}
          onClick={() => void run(patchNote(note.id, { transcription_redigee: redige }))}>Enregistrer la rédaction</button>
      </div>
    </div>
  );
}

// --- Tab: attachments -----------------------------------------------------------

function OngletPieces({ message, busy, run }: { message: CanalMessage; busy: boolean; run: RunFn }): JSX.Element {
  async function onFiles(files: FileList | null): Promise<void> {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.size > 2_500_000) { window.alert(`« ${f.name} » dépasse 2,5 Mo.`); continue; }
      const data_url = await fileToDataUrl(f);
      await run(ajouterPieceCanal(message.id, { nom: f.name, type: f.type, data_url }));
    }
  }
  return (
    <div>
      <label className="btn btn-primary canal-upload">
        + Ajouter un document ou une image
        <input type="file" multiple style={{ display: "none" }}
          onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
      </label>
      <p className="muted small" style={{ margin: "6px 0 10px" }}>Documents et images liés à ce canal (max 2,5 Mo chacun).</p>
      {message.pieces.length === 0 ? (
        <p className="muted small canal-vide">Aucune pièce jointe.</p>
      ) : (
        <div className="canal-pieces">
          {message.pieces.map((p) => (
            <span key={p.id} className="canal-chip">
              <a href={p.data_url ?? "#"} target="_blank" rel="noopener noreferrer">{p.nom}</a>
              <a href={downloadUrl(p)} download={p.nom} title="Télécharger">↓</a>
              <button type="button" disabled={busy} onClick={() => void run(supprimerPieceCanal(p.id))} aria-label="Retirer">✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tab: discussion ------------------------------------------------------------

function OngletDiscussion(
  { message, nomMembre, busy, run }: { message: CanalMessage; nomMembre: (id: string | null) => string; busy: boolean; run: RunFn },
): JSX.Element {
  const [reponse, setReponse] = useState("");
  return (
    <div>
      {message.reponses.length === 0 && <p className="muted small canal-vide">Aucun message. Démarrez la discussion.</p>}
      {message.reponses.map((r) => (
        <div key={r.id} className="canal-reponse">
          <span className="canal-reponse-auteur">{nomMembre(r.auteur_id)}</span>
          <span className="muted small">{r.cree_le ? new Date(r.cree_le).toLocaleString("fr-FR") : ""}</span>
          <p>{r.corps}</p>
        </div>
      ))}
      <div className="canal-row canal-reponse-row">
        <input className="canal-input" placeholder="Répondre..." value={reponse} onChange={(e) => setReponse(e.target.value)} />
        <button type="button" className="btn btn-primary btn-inline" disabled={busy || !reponse.trim()}
          onClick={() => void run(repondreCanal(message.id, reponse.trim()).then(() => setReponse("")))}>Envoyer</button>
      </div>
    </div>
  );
}

// --- Tab: card + links ----------------------------------------------------------

// --- Tab: instruction workflow (suivi) ------------------------------------------

function OngletSuivi(
  { message, nomMembre, busy, run }:
  { message: CanalMessage; nomMembre: (id: string | null) => string; busy: boolean; run: RunFn },
): JSX.Element {
  const [wf, setWf] = useState<EtapeWorkflow[]>([]);
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [affOuvert, setAffOuvert] = useState(false);
  const [espSel, setEspSel] = useState("");
  const [assignes, setAssignes] = useState<string[]>([]);
  const [chargerOuvert, setChargerOuvert] = useState(false);
  const [tableaux, setTableaux] = useState<TableauProto[]>([]);
  const [colonnes, setColonnes] = useState<ColonneProto[]>([]);
  const [ctEsp, setCtEsp] = useState(""); const [ctTab, setCtTab] = useState(""); const [ctCol, setCtCol] = useState("");
  const [restOuvert, setRestOuvert] = useState(false);
  const [rapport, setRapport] = useState(""); const [resume, setResume] = useState("");

  useEffect(() => { void getWorkflowCanal(message.id).then(setWf).catch(() => undefined); }, [message.id, message.etape]);
  useEffect(() => { if ((affOuvert || chargerOuvert) && !espaces.length) void listEspaces().then(setEspaces).catch(() => undefined); }, [affOuvert, chargerOuvert, espaces.length]);
  useEffect(() => { if (ctEsp) void listTableauxEspace(ctEsp).then(setTableaux).catch(() => undefined); }, [ctEsp]);
  useEffect(() => { if (ctTab) void listColonnes(ctTab).then(setColonnes).catch(() => undefined); }, [ctTab]);

  const cloturee = message.etape === "cloturee";
  const prise = !!message.prise_en_charge_le;
  const espaceCible = espaces.find((e) => e.id === espSel);
  const membresCible = espaceCible?.membres ?? [];

  return (
    <div className="canal-suivi">
      <div className="canal-row" style={{ alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        {message.matricule && <span className="canal-badge" style={{ fontWeight: 700 }}>{message.matricule}</span>}
        <span className={`canal-badge canal-statut-${cloturee ? "traite" : "en_cours"}`}>{etapeLabel(message.etape)}</span>
      </div>

      <div className="muted small" style={{ margin: "8px 0", lineHeight: 1.7 }}>
        {message.prise_en_charge_nom && <div>Pris en charge par <strong>{message.prise_en_charge_nom}</strong></div>}
        {message.assigne_espace_nom && <div>Affecté à l'espace <strong>{message.assigne_espace_nom}</strong></div>}
        {message.assignes.length > 0 && <div>Assigné à : {message.assignes.map((id) => nomMembre(id)).join(", ")}</div>}
        {cloturee && message.restitution_resume && <div>Résumé : <strong>{message.restitution_resume}</strong></div>}
      </div>

      {!cloturee ? (
        <div className="canal-row" style={{ flexWrap: "wrap", gap: 8 }}>
          {!prise && (
            <button type="button" className="btn btn-primary btn-inline" disabled={busy}
              onClick={() => void run(priseEnChargeCanal(message.id))}>Prendre en charge</button>
          )}
          {prise && <button type="button" className="btn btn-ghost btn-inline" disabled={busy} onClick={() => setAffOuvert((v) => !v)}>Affecter</button>}
          {prise && <button type="button" className="btn btn-ghost btn-inline" disabled={busy} onClick={() => setChargerOuvert((v) => !v)}>Charger vers un tableau</button>}
          {prise && <button type="button" className="btn btn-ghost btn-inline" disabled={busy} onClick={() => setRestOuvert((v) => !v)}>Restituer</button>}
          {prise && <button type="button" className="btn btn-ghost btn-inline" disabled={busy}
            onClick={() => { if (window.confirm("Clôturer définitivement ? Aucune réouverture ne sera possible.")) void run(cloturerCanal(message.id)); }}>Clôturer</button>}
        </div>
      ) : (
        <p className="banner banner-ok small">Instruction clôturée. Des compléments restent possibles via l'onglet Discussion, sans réouverture.</p>
      )}

      {affOuvert && !cloturee && (
        <div className="canal-creer-carte" style={{ marginTop: 10 }}>
          <select className="canal-select" value={espSel} onChange={(e) => { setEspSel(e.target.value); setAssignes([]); }}>
            <option value="">Espace / sous-espace cible...</option>
            {espaces.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
          {membresCible.length > 0 && (
            <select className="canal-select" multiple value={assignes} onChange={(e) => setAssignes(Array.from(e.target.selectedOptions, (o) => o.value))} style={{ minHeight: 90 }}>
              {membresCible.map((m) => <option key={m.membre_id} value={m.membre_id}>{nomMembre(m.membre_id)}</option>)}
            </select>
          )}
          <div className="canal-row">
            <button type="button" className="btn btn-primary btn-inline" disabled={busy || !espSel}
              onClick={() => void run(affecterCanal(message.id, espSel || null, assignes).then(() => setAffOuvert(false)))}>Valider l'affectation</button>
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => setAffOuvert(false)}>Annuler</button>
          </div>
        </div>
      )}

      {chargerOuvert && !cloturee && (
        <div className="canal-creer-carte" style={{ marginTop: 10 }}>
          <select className="canal-select" value={ctEsp} onChange={(e) => { setCtEsp(e.target.value); setCtTab(""); setCtCol(""); }}>
            <option value="">Espace...</option>
            {espaces.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
          <select className="canal-select" value={ctTab} onChange={(e) => { setCtTab(e.target.value); setCtCol(""); }} disabled={!ctEsp}>
            <option value="">Tableau...</option>
            {tableaux.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
          </select>
          <select className="canal-select" value={ctCol} onChange={(e) => setCtCol(e.target.value)} disabled={!ctTab}>
            <option value="">Colonne...</option>
            {colonnes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <div className="canal-row">
            <button type="button" className="btn btn-primary btn-inline" disabled={busy || !ctTab || !ctCol}
              onClick={() => void run(chargerTableauCanal(message.id, ctTab, ctCol).then(() => setChargerOuvert(false)))}>Charger</button>
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => setChargerOuvert(false)}>Annuler</button>
          </div>
        </div>
      )}

      {restOuvert && !cloturee && (
        <div className="canal-creer-carte" style={{ marginTop: 10 }}>
          <textarea className="canal-input" rows={5} placeholder="Rapport détaillé (documents à ajouter via l'onglet Pièces jointes)" value={rapport} onChange={(e) => setRapport(e.target.value)} />
          <input className="canal-input" placeholder="Résumé très court (envoyé à l'émetteur)" value={resume} onChange={(e) => setResume(e.target.value)} maxLength={280} />
          <div className="canal-row">
            <button type="button" className="btn btn-primary btn-inline" disabled={busy || !resume.trim()}
              onClick={() => void run(restituerCanal(message.id, rapport, resume).then(() => setRestOuvert(false)))}>Enregistrer la restitution</button>
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => setRestOuvert(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <span className="canal-bloc-titre">Progression (workflow)</span>
        <WorkflowGraph etapeCourante={message.etape} />
      </div>

      <div className="canal-arbre" style={{ marginTop: 10 }}>
        <span className="canal-bloc-titre">Historique</span>
        {wf.length === 0 && <p className="muted small">Aucune étape encore. Prenez l'instruction en charge pour démarrer le suivi.</p>}
        {wf.map((e, i) => (
          <div key={i} className="canal-arbre-item">
            <span className="canal-badge">{etapeLabel(e.etape)}</span>
            <span className="canal-arbre-sujet">{e.acteur ?? ""}{e.detail ? ` · ${e.detail}` : ""}</span>
            <span className="muted small">{e.cree_le ? new Date(e.cree_le).toLocaleString("fr-FR") : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OngletLiens({ message, busy, run }: { message: CanalMessage; busy: boolean; run: RunFn }): JSX.Element {
  const [creerOuvert, setCreerOuvert] = useState(false);
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [tableaux, setTableaux] = useState<TableauProto[]>([]);
  const [colonnes, setColonnes] = useState<ColonneProto[]>([]);
  const [espSel, setEspSel] = useState(""); const [tabSel, setTabSel] = useState(""); const [colSel, setColSel] = useState("");
  const [autres, setAutres] = useState<CanalMessage[]>([]);

  useEffect(() => { if (creerOuvert && !espaces.length) void listEspaces().then(setEspaces).catch(() => undefined); }, [creerOuvert, espaces.length]);
  useEffect(() => { if (espSel) void listTableauxEspace(espSel).then(setTableaux).catch(() => undefined); }, [espSel]);
  useEffect(() => { if (tabSel) void listColonnes(tabSel).then(setColonnes).catch(() => undefined); }, [tabSel]);
  useEffect(() => { void listCanal().then(setAutres).catch(() => undefined); }, [message.id]);

  const liables = autres.filter((m) => m.id !== message.id && !message.enfants.some((e) => e.id === m.id));

  return (
    <div className="canal-liens">
      <span className="canal-bloc-titre">Continuité (arbre de canaux)</span>
      <p className="muted small" style={{ margin: "0 0 8px" }}>Reliez ce canal à un canal parent : il apparaîtra comme sa continuité, organisé par priorité puis par date.</p>
      <div className="canal-row">
        <select className="canal-select" value={message.parent_id ?? ""} disabled={busy}
          onChange={(e) => void run(updateCanal(message.id, { parent_id: e.target.value }))}>
          <option value="">Aucun parent (canal racine)</option>
          {liables.map((m) => <option key={m.id} value={m.id}>{m.sujet || "(sans sujet)"}</option>)}
        </select>
      </div>
      {message.parent && (
        <p className="muted small">Parent : <strong>{message.parent.sujet || "(sans sujet)"}</strong> · {message.parent.priorite}</p>
      )}
      {message.enfants.length > 0 && (
        <div className="canal-arbre">
          <span className="canal-bloc-titre">Canaux liés ({message.enfants.length})</span>
          {[...message.enfants]
            .sort((a, b) => PRIORITES.indexOf(a.priorite) - PRIORITES.indexOf(b.priorite) || (a.cree_le ?? "").localeCompare(b.cree_le ?? ""))
            .map((e) => (
              <div key={e.id} className="canal-arbre-item">
                <span className={`canal-badge canal-prio-${e.priorite}`}>{e.priorite}</span>
                <span className="canal-arbre-sujet">{e.sujet || "(sans sujet)"}</span>
                <span className={`canal-badge canal-statut-${e.statut}`}>{e.statut.replace("_", " ")}</span>
              </div>
            ))}
        </div>
      )}

      <div className="canal-liens-carte">
        <span className="canal-bloc-titre">Transformer en carte</span>
        {message.carte_id ? (
          <p className="muted small">Une carte a été créée depuis ce canal.</p>
        ) : creerOuvert ? (
          <div className="canal-creer-carte">
            <select className="canal-select" value={espSel} onChange={(e) => { setEspSel(e.target.value); setTabSel(""); setColSel(""); }}>
              <option value="">Espace...</option>
              {espaces.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
            <select className="canal-select" value={tabSel} onChange={(e) => { setTabSel(e.target.value); setColSel(""); }} disabled={!espSel}>
              <option value="">Tableau...</option>
              {tableaux.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
            <select className="canal-select" value={colSel} onChange={(e) => setColSel(e.target.value)} disabled={!tabSel}>
              <option value="">Colonne...</option>
              {colonnes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <div className="canal-row">
              <button type="button" className="btn btn-primary btn-inline" disabled={busy || !tabSel || !colSel}
                onClick={() => void run(creerCarteCanal(message.id, tabSel, colSel).then(() => setCreerOuvert(false)))}>Créer</button>
              <button type="button" className="btn btn-ghost btn-inline" onClick={() => setCreerOuvert(false)}>Annuler</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setCreerOuvert(true)}>Créer une carte depuis ce canal</button>
        )}
      </div>
    </div>
  );
}
