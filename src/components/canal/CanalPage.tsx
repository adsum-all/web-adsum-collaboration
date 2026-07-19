import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

import { fileToDataUrl, mmss, pickMime } from "../../lib/media.js";
import {
  ajouterNote,
  ajouterPieceCanal,
  createCanal,
  demanderConfigBot,
  importerNotesTelegram,
  listCanal,
  transcrireNote,
} from "../../lib/store-canal.js";
import { listEspaces, listMembres } from "../../lib/store.js";
import type { CanalCategorie, CanalMessage, Espace, Membre, Priorite } from "../../lib/types.js";
import { EmptyState } from "../common/EmptyState.js";
import { CanalDetail } from "./CanalDetail.js";

const CATEGORIES: { id: CanalCategorie; label: string }[] = [
  { id: "projet", label: "Projet" },
  { id: "activite", label: "Activité" },
  { id: "organisation", label: "Organisation" },
  { id: "communication", label: "Communication" },
  { id: "urgence", label: "Urgence" },
  { id: "autre", label: "Autre" },
];
const PRIORITES: Priorite[] = ["urgente", "haute", "normale", "basse"];
const FILTRES: { id: string; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "nouveau", label: "Nouveaux" },
  { id: "en_cours", label: "En cours" },
  { id: "traite", label: "Traités" },
  { id: "archive", label: "Archivés" },
];

export function CanalPage(): JSX.Element {
  const [messages, setMessages] = useState<CanalMessage[]>([]);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("tous");
  // Two-level navigation: null = level 1 (only the list of workspace names), a
  // workspace id = level 2 (only that workspace's instructions). There is no
  // global inbox: instructions are always seen inside a workspace.
  const [espaceSel, setEspaceSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [composerOuvert, setComposerOuvert] = useState(false);

  const [sujet, setSujet] = useState("");
  const [note, setNote] = useState("");
  const [categorie, setCategorie] = useState<CanalCategorie>("autre");
  const [priorite, setPriorite] = useState<Priorite>("normale");
  const [audio, setAudio] = useState<{ dataUrl: string; type: string; duree: number } | null>(null);
  const [pieces, setPieces] = useState<{ nom: string; type: string; data_url: string }[]>([]);
  const [enreg, setEnreg] = useState(false);
  const [chrono, setChrono] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [importTg, setImportTg] = useState(false);
  const [infoTg, setInfoTg] = useState<string | null>(null);
  // Instruction spaces (general workspaces): each has its own dedicated bot.
  const [espacesFull, setEspacesFull] = useState<Espace[]>([]);
  // Level-1 sub-tab: connected channels (bot active) by default, or the ones that exist
  // but have never been connected. Panel id opens the connection request modal for one.
  const [ongletCanal, setOngletCanal] = useState<"connectes" | "non_connectes">("connectes");
  const [panneauId, setPanneauId] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  // Automatic ingestion: pull new Telegram voice notes without any click. Inside a
  // workspace we poll ONLY its dedicated bot (``espaceId``) so a note surfaces near
  // instantly; at the list a slower global sweep keeps counts fresh. ``manuel`` shows
  // feedback (including refused notes and their precise cause); auto-runs stay silent
  // and only refresh the list when a note actually arrived.
  async function importerTelegram(manuel = false, espaceId?: string): Promise<void> {
    if (manuel) { setImportTg(true); setInfoTg(null); setErr(null); }
    try {
      const r = await importerNotesTelegram(espaceId);
      if (r.importees > 0) {
        if (manuel) setInfoTg(`${r.importees} note(s) vocale(s) importée(s) depuis Telegram.`);
        await reload();
      } else if (manuel) {
        setInfoTg(
          r.messages.length > 0
            ? r.messages.join(" ")
            : "Aucune nouvelle note vocale. Les notes envoyées au bot arrivent ici automatiquement.",
        );
      }
    } catch {
      if (manuel) setErr("Import Telegram impossible.");
    } finally {
      if (manuel) setImportTg(false);
    }
  }

  const reload = async (): Promise<void> => {
    const list = await listCanal();
    setMessages(list);
    // Keep the current selection if it still exists; never auto-jump to another
    // message (which could belong to a different workspace during polling).
    setSelId((id) => (id && list.some((m) => m.id === id) ? id : null));
  };

  // Enter a workspace (level 2): show only its instructions, reset the selection.
  const ouvrirEspace = (id: string): void => { setEspaceSel(id); setSelId(null); setErr(null); };
  // Back to the workspace list (level 1).
  const fermerEspace = (): void => { setEspaceSel(null); setSelId(null); setComposerOuvert(false); };

  const reloadEspaces = (): void => { void listEspaces().then((l) => setEspacesFull(l.filter((e) => !e.parent_id))).catch(() => undefined); };
  useEffect(() => {
    // Members are needed once for name resolution; the canal list, the workspaces and
    // the Telegram ingestion are all refreshed by the real-time effect below.
    void listMembres().then(setMembres).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Real-time without manual reload, on three independent tracks so a change is
  // never invisible:
  //  - Telegram ingestion: inside a workspace poll ITS bot every 2s (near-instant
  //    voice notes); at the list a slower 8s global sweep.
  //  - Instruction list: reload the canal every 4s so statuses, take-in-charge,
  //    assignments, restitutions, closures, new text subjects and transcription
  //    completions surface for everyone, not only when a Telegram note arrives.
  //  - Workspaces + bot statuses: refresh every 12s so a new/renamed/archived space
  //    and its bot badge update on their own.
  // Everything also refires immediately on entry and when the tab regains focus.
  useEffect(() => {
    const importTick = (): void => { void importerTelegram(false, espaceSel ?? undefined); };
    const listTick = (): void => { void reload(); };
    const espacesTick = (): void => { reloadEspaces(); };
    importTick(); listTick(); espacesTick();
    const importId = window.setInterval(importTick, espaceSel ? 2000 : 8000);
    const listId = window.setInterval(listTick, 4000);
    const espacesId = window.setInterval(espacesTick, 12000);
    pollRef.current = importId;
    const onVisible = (): void => {
      if (document.visibilityState !== "visible") return;
      importTick(); listTick(); espacesTick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(importId);
      window.clearInterval(listId);
      window.clearInterval(espacesId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espaceSel]);
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const filtres = useMemo(() => {
    const query = q.trim().toLowerCase();
    return messages.filter((m) => {
      if (filtre !== "tous" && m.statut !== filtre) return false;
      // Level 2 shows only the selected workspace's instructions (server also isolates).
      if (espaceSel && m.espace_id !== espaceSel) return false;
      if (!query) return true;
      return (
        m.sujet.toLowerCase().includes(query) ||
        m.note.toLowerCase().includes(query) ||
        m.transcription_brute.toLowerCase().includes(query) ||
        m.transcription_redigee.toLowerCase().includes(query)
      );
    });
  }, [messages, filtre, espaceSel, q]);

  const espaceCourant = useMemo(
    () => espacesFull.find((e) => e.id === espaceSel) ?? null,
    [espacesFull, espaceSel],
  );
  const selection = useMemo(() => messages.find((m) => m.id === selId) ?? null, [messages, selId]);
  const nomMembre = (id: string | null): string => (id ? membres.find((x) => x.id === id)?.nom ?? "Membre" : "");

  async function startRec(): Promise<void> {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const duree = Math.round((Date.now() - startRef.current) / 1000);
        if (blob.size < 1500) { setErr("Enregistrement trop court."); return; }
        setAudio({ dataUrl: await fileToDataUrl(blob), type: blob.type || "audio/webm", duree });
      };
      rec.start();
      startRef.current = Date.now();
      setEnreg(true);
      setChrono(0);
      timerRef.current = window.setInterval(() => setChrono((c) => c + 1), 1000);
    } catch {
      setErr("Accès au micro refusé ou indisponible.");
    }
  }

  function stopRec(): void {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    setEnreg(false);
    recRef.current?.stop();
  }

  async function onFiles(files: FileList | null): Promise<void> {
    if (!files) return;
    const out: { nom: string; type: string; data_url: string }[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 2_500_000) { setErr(`« ${f.name} » dépasse 2,5 Mo.`); continue; }
      out.push({ nom: f.name, type: f.type, data_url: await fileToDataUrl(f) });
    }
    setPieces((p) => [...p, ...out]);
  }

  function resetComposer(): void {
    setSujet(""); setNote(""); setCategorie("autre"); setPriorite("normale");
    setAudio(null); setPieces([]); setChrono(0);
  }

  // Voice-note-first: the moderator records and validates; the message is created
  // from the audio alone, then transcribed and auto-filled (title, category,
  // priority) server-side. Each recording becomes its own message.
  async function publierNoteVocale(): Promise<void> {
    if (!audio) return;
    setEnvoi(true);
    setErr(null);
    try {
      let msg = await createCanal({ sujet: "", note: "", categorie: "autre", priorite: "normale", espace_id: espaceSel });
      msg = await ajouterNote(msg.id, { nom: "note-vocale", type: audio.type, data_url: audio.dataUrl, duree_s: audio.duree });
      const note0 = msg.notes[msg.notes.length - 1];
      if (note0) { try { msg = await transcrireNote(note0.id); } catch { /* provider non configure: statut echec serveur */ } }
      setAudio(null);
      setChrono(0);
      await reload();
      setSelId(msg.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setEnvoi(false);
    }
  }

  async function publier(): Promise<void> {
    if (!sujet.trim() && !note.trim() && !audio && pieces.length === 0) {
      setErr("Ajoutez un sujet, une note, une pièce ou une note vocale.");
      return;
    }
    setEnvoi(true);
    setErr(null);
    try {
      let msg = await createCanal({ sujet: sujet.trim(), note: note.trim(), categorie, priorite, espace_id: espaceSel });
      if (audio) {
        msg = await ajouterNote(msg.id, { nom: "note-vocale", type: audio.type, data_url: audio.dataUrl, duree_s: audio.duree });
      }
      for (const p of pieces) {
        msg = await ajouterPieceCanal(msg.id, p);
      }
      const note0 = msg.notes[msg.notes.length - 1];
      if (audio && note0) {
        try { msg = await transcrireNote(note0.id); } catch { /* provider non configure: statut echec serveur */ }
      }
      resetComposer();
      setComposerOuvert(false);
      await reload();
      setSelId(msg.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setEnvoi(false);
    }
  }

  const actualiserBtn = (
    <button type="button" className="btn btn-ghost btn-inline" disabled={importTg}
      title="Les notes vocales Telegram arrivent automatiquement. Cliquez pour forcer une actualisation immédiate."
      onClick={() => void importerTelegram(true)}>
      {importTg ? "Actualisation..." : "Actualiser Telegram"}
    </button>
  );

  // ----- Level 1: workspace cards, split into connected vs never-connected channels -----
  if (!espaceSel) {
    const connectes = espacesFull.filter((e) => e.instruction_bot_statut === "configure");
    const nonConnectes = espacesFull.filter((e) => e.instruction_bot_statut !== "configure");
    const enAttente = espacesFull.filter((e) => e.instruction_bot_statut === "demande").length;
    const aConfigurer = nonConnectes.length - enAttente;
    const totalInstr = messages.length;
    const nouvellesInstr = messages.filter((m) => m.statut === "nouveau").length;
    const liste = ongletCanal === "connectes" ? connectes : nonConnectes;
    const panneauEspace = espacesFull.find((e) => e.id === panneauId) ?? null;
    return (
      <div className="page canal-page">
        <header className="page-head">
          <div className="row-between">
            <div>
              <p className="topbar-crumb">CANAL</p>
              <h1>Instructions</h1>
              <p className="muted">Chaque espace de travail a son propre canal Telegram dédié. Connectez le bot d'un espace pour y recevoir ses notes vocales, puis ouvrez-le pour traiter ses instructions. Le contenu d'un espace n'est jamais visible depuis un autre.</p>
            </div>
            {actualiserBtn}
          </div>
        </header>
        {infoTg && <p className="banner banner-ok small" style={{ margin: "0 0 10px" }}>{infoTg}</p>}
        {err && <p className="banner banner-error small" style={{ margin: "0 0 10px" }}>{err}</p>}

        <section className="stat-grid">
          <div className="stat-tile"><span className="stat-val">{espacesFull.length}</span><span className="muted small">Espaces</span></div>
          <div className="stat-tile"><span className="stat-val">{connectes.length}</span><span className="muted small">Connectés</span></div>
          <div className="stat-tile"><span className="stat-val">{enAttente}</span><span className="muted small">En attente</span></div>
          <div className="stat-tile"><span className="stat-val">{aConfigurer}</span><span className="muted small">À configurer</span></div>
          <div className="stat-tile"><span className="stat-val">{totalInstr}</span><span className="muted small">Instructions</span></div>
          <div className={`stat-tile${nouvellesInstr > 0 ? " stat-tile-alert" : ""}`}><span className="stat-val">{nouvellesInstr}</span><span className="muted small">Nouvelles</span></div>
        </section>

        <div className="canal-tabs" role="tablist" style={{ marginBottom: 16 }}>
          <button type="button" role="tab" aria-selected={ongletCanal === "connectes"} className={`canal-tab${ongletCanal === "connectes" ? " canal-tab-on" : ""}`} onClick={() => setOngletCanal("connectes")}>
            Connectés <span className="canal-tab-count">{connectes.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={ongletCanal === "non_connectes"} className={`canal-tab${ongletCanal === "non_connectes" ? " canal-tab-on" : ""}`} onClick={() => setOngletCanal("non_connectes")}>
            Non connectés <span className="canal-tab-count">{nonConnectes.length}</span>
          </button>
        </div>

        {espacesFull.length === 0 ? (
          <EmptyState titre="Aucun espace de travail" description="Vous n'êtes membre d'aucun espace d'instruction pour le moment." />
        ) : liste.length === 0 ? (
          <EmptyState
            titre={ongletCanal === "connectes" ? "Aucun canal connecté" : "Tous les canaux sont connectés"}
            description={ongletCanal === "connectes" ? "Depuis l'onglet « Non connectés », demandez la connexion du bot d'un espace pour commencer à recevoir ses instructions." : "Chaque espace dispose déjà de son bot d'instruction actif."} />
        ) : (
          <div className="board-grid">
            {liste.map((e) => {
              const total = messages.filter((m) => m.espace_id === e.id).length;
              const nouveaux = messages.filter((m) => m.espace_id === e.id && m.statut === "nouveau").length;
              const connecte = e.instruction_bot_statut === "configure";
              const demande = e.instruction_bot_statut === "demande";
              return (
                <div key={e.id} className="board-tile canal-tuile">
                  <button type="button" className="canal-tuile-corps" onClick={() => (connecte ? ouvrirEspace(e.id) : setPanneauId(e.id))}>
                    <span className="board-tile-name">
                      <span className="espace-avatar espace-avatar-sm" aria-hidden style={{ background: e.couleur }}>{e.initiale}</span>
                      {e.nom}
                    </span>
                    <span className="board-tile-desc">{total === 0 ? "Aucune instruction" : total === 1 ? "1 instruction" : `${total} instructions`}</span>
                    <span className="board-tile-meta canal-tuile-badges">
                      {nouveaux > 0 && <span className="canal-badge canal-badge-alerte">{nouveaux} nouveau{nouveaux > 1 ? "x" : ""}</span>}
                      <span className={`canal-badge ${connecte ? "canal-badge-ok" : "canal-badge-mut"}`}>{connecte ? "bot actif" : demande ? "bot demandé" : "bot à configurer"}</span>
                    </span>
                  </button>
                  {!connecte && (
                    <button type="button" className="btn btn-primary btn-inline canal-tuile-action" onClick={() => setPanneauId(e.id)}>
                      {demande ? "Suivre la demande" : "Connecter le canal"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {panneauEspace && (
          <div className="modal-backdrop" onClick={() => setPanneauId(null)} role="dialog" aria-modal="true" aria-label="Connexion du canal">
            <div className="modal" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 520 }}>
              <header className="modal-head">
                <h3 style={{ margin: 0 }}>Connexion Telegram - {panneauEspace.nom}</h3>
                <button type="button" className="btn btn-ghost btn-inline" onClick={() => setPanneauId(null)} aria-label="Fermer">×</button>
              </header>
              <div className="modal-body">
                <EspaceInstructionPanel espace={panneauEspace} onChanged={reloadEspaces} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----- Level 2: only the selected workspace's instructions -----
  return (
    <div className="page canal-page">
      <div className="canal-fil">
        <button type="button" className="canal-retour" onClick={fermerEspace}>← Instructions</button>
        <span className="canal-fil-sep" aria-hidden>/</span>
        <span className="canal-fil-espace">
          {espaceCourant && (
            <span className="canal-espace-avatar canal-espace-avatar-sm" aria-hidden style={{ background: espaceCourant.couleur }}>{espaceCourant.initiale}</span>
          )}
          {espaceCourant?.nom ?? "Espace"}
        </span>
        <span className="canal-fil-espace-grow" />
        {actualiserBtn}
      </div>
      <div className="canal-layout">
        <aside className={`canal-liste${selId ? " canal-liste-cachee-mobile" : ""}`}>
          {infoTg && <p className="banner banner-ok small" style={{ margin: "0 0 8px" }}>{infoTg}</p>}
          <EspaceInstructionPanel espace={espaceCourant} onChanged={reloadEspaces} />

          {/* Voice-note first: the primary action. Record, validate, done: le titre,
              la categorie, la priorite et la redaction sont remplis automatiquement. */}
          <div className="canal-vocal-card">
            <span className="canal-bloc-titre">Déposer une note vocale</span>
            <p className="muted small" style={{ margin: 0 }}>
              Enregistrez, validez : le titre et les informations sont détectés et remplis automatiquement.
              Chaque note vocale devient une demande distincte.
            </p>
            <div className="canal-recorder">
              {!enreg && !audio && (
                <button type="button" className="canal-rec-btn" onClick={() => void startRec()}>
                  <span className="canal-rec-dot" aria-hidden="true" /> Enregistrer une note vocale
                </button>
              )}
              {enreg && (
                <button type="button" className="canal-rec-btn canal-rec-on" onClick={stopRec}>
                  <span className="canal-rec-pulse" aria-hidden="true" /> Arrêter · {mmss(chrono)}
                </button>
              )}
              {audio && !enreg && (
                <div className="canal-audio-preview">
                  <audio controls src={audio.dataUrl} />
                  <span className="muted small">{mmss(audio.duree)}</span>
                  <button type="button" className="btn btn-ghost btn-inline" onClick={() => setAudio(null)}>Retirer</button>
                </div>
              )}
            </div>
            {audio && !enreg && (
              <button type="button" className="btn btn-primary canal-publier" disabled={envoi} onClick={() => void publierNoteVocale()}>
                {envoi ? "Envoi..." : "Publier la note vocale"}
              </button>
            )}
            <button type="button" className="canal-detaille-toggle" onClick={() => setComposerOuvert((v) => !v)}>
              {composerOuvert ? "Masquer la demande détaillée" : "Rédiger une demande détaillée (texte, fichiers)"}
            </button>
          </div>

          {composerOuvert && (
            <div className="canal-composer">
              <input className="canal-input" placeholder="Sujet (ex: Projet de construction)" value={sujet}
                onChange={(e) => setSujet(e.target.value)} />
              <textarea className="canal-textarea" placeholder="Note écrite (facultatif)" value={note}
                onChange={(e) => setNote(e.target.value)} rows={3} />
              <div className="canal-row">
                <select className="canal-select" value={categorie} onChange={(e) => setCategorie(e.target.value as CanalCategorie)}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <select className="canal-select" value={priorite} onChange={(e) => setPriorite(e.target.value as Priorite)}>
                  {PRIORITES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <label className="btn btn-ghost btn-inline" style={{ cursor: "pointer", alignSelf: "flex-start" }}>
                + Joindre un fichier
                <input type="file" multiple style={{ display: "none" }}
                  onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
              </label>
              {pieces.length > 0 && (
                <div className="canal-pieces-preview">
                  {pieces.map((p, i) => (
                    <span key={i} className="canal-chip">
                      {p.nom}
                      <button type="button" onClick={() => setPieces((ps) => ps.filter((_, j) => j !== i))} aria-label="Retirer">✕</button>
                    </span>
                  ))}
                </div>
              )}
              {err && <p className="canal-err">{err}</p>}
              <button type="button" className="btn btn-primary canal-publier" disabled={envoi} onClick={() => void publier()}>
                {envoi ? "Envoi..." : "Publier la demande"}
              </button>
            </div>
          )}
          {err && !composerOuvert && <p className="canal-err">{err}</p>}

          <div className="canal-filtres">
            {FILTRES.map((f) => (
              <button key={f.id} type="button" className={`canal-filtre${filtre === f.id ? " canal-filtre-on" : ""}`}
                onClick={() => setFiltre(f.id)}>{f.label}</button>
            ))}
          </div>
          <div className="canal-bloc-titre" style={{ marginTop: 4 }}>
            Instructions {filtres.length > 0 ? `(${filtres.length})` : ""}
          </div>
          <input className="canal-search" placeholder="Rechercher une instruction..." value={q} onChange={(e) => setQ(e.target.value)} />

          <div className="canal-items">
            {filtres.length === 0 && <p className="muted small" style={{ padding: "12px 4px" }}>Aucune demande.</p>}
            {filtres.map((m) => (
              <button key={m.id} type="button" className={`canal-item${selId === m.id ? " canal-item-on" : ""}`}
                onClick={() => setSelId(m.id)}>
                <div className="canal-item-head">
                  <span className={`canal-badge canal-statut-${m.statut}`}>{m.statut.replace("_", " ")}</span>
                  <span className={`canal-badge canal-prio-${m.priorite}`}>{m.priorite}</span>
                  {m.espace_nom && (
                    <span className="canal-badge canal-badge-mut" title="Espace">{m.espace_nom}</span>
                  )}
                  {m.notes.length > 0 && (
                    <span className="canal-badge canal-badge-mut" title="Notes vocales">
                      {m.notes.length === 1 ? "1 note" : `${m.notes.length} notes`}
                    </span>
                  )}
                  {m.enfants.length > 0 && (
                    <span className="canal-badge canal-badge-mut" title="Canaux liés">liés {m.enfants.length}</span>
                  )}
                </div>
                <div className="canal-item-sujet">{m.sujet || "(sans sujet)"}</div>
                <div className="canal-item-apercu">
                  {(m.transcription_redigee || m.transcription_brute || m.note || "").slice(0, 90) || "-"}
                </div>
                <div className="canal-item-meta">
                  <span>{CATEGORIES.find((c) => c.id === m.categorie)?.label ?? m.categorie}</span>
                  <span>{m.cree_le ? new Date(m.cree_le).toLocaleDateString("fr-FR") : ""}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className={`canal-detail-pane${selId ? " canal-detail-actif" : ""}`}>
          {selection ? (
            <CanalDetail
              message={selection}
              nomMembre={nomMembre}
              onChanged={reload}
              onBack={() => setSelId(null)}
            />
          ) : (
            <EmptyState titre="Canal d'instructions"
              description="Sélectionnez une demande, ou créez-en une nouvelle. Le fondateur ou modérateur peut déposer des instructions par note vocale ; la transcription est faite ici." />
          )}
        </section>
      </div>
    </div>
  );
}

// Instruction space panel inside the canal: the dedicated bot status, the QR / deep
// link (once configured), and the documented steps + request button otherwise.
const ETAPES_BOT = [
  "Un responsable clique « Demander la configuration » : l'équipe back-office est notifiée.",
  "Le back-office crée un bot dédié dans @BotFather (distinct du bot des membres).",
  "Il colle l'identifiant et le token du bot dans le back-office.",
  "Le QR ci-dessous s'active : l'émetteur autorisé le scanne pour démarrer le bot.",
  "Les notes vocales envoyées à ce bot arrivent automatiquement dans cet espace d'instruction.",
];

function EspaceInstructionPanel({ espace, onChanged }: { espace: Espace | null; onChanged: () => void }): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!espace) return <></>;
  const configure = espace.instruction_bot_statut === "configure";
  async function demander(): Promise<void> {
    setBusy(true); setMsg(null);
    try { await demanderConfigBot(espace!.id); setMsg("Demande envoyée à l'équipe back-office."); onChanged(); }
    catch { setMsg("Demande impossible."); }
    finally { setBusy(false); }
  }
  return (
    <div className="banner banner-info small" style={{ textAlign: "left", margin: "0 0 8px" }}>
      <strong>Espace d'instruction : {espace.nom}</strong>
      <div className="muted small" style={{ marginTop: 2 }}>
        Bot dédié : {configure ? `configuré (@${espace.instruction_bot_username})` :
          espace.instruction_bot_statut === "demande" ? "configuration demandée (en attente du back-office)" : "non configuré"}.
      </div>
      {configure && espace.telegram_deep_link ? (
        <div style={{ marginTop: 6 }}>
          <a href={espace.telegram_deep_link} target="_blank" rel="noreferrer" className="link mono" style={{ wordBreak: "break-all" }}>{espace.telegram_deep_link}</a>
          <div style={{ marginTop: 6 }}><QrCanvas value={espace.telegram_deep_link} /></div>
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          <ol style={{ margin: "0 0 8px 18px", padding: 0 }}>
            {ETAPES_BOT.map((e, i) => <li key={i} style={{ marginBottom: 2 }}>{e}</li>)}
          </ol>
          {espace.instruction_bot_statut !== "demande" && (
            <button type="button" className="btn btn-primary btn-inline" disabled={busy} onClick={() => void demander()}>
              Demander la configuration du bot
            </button>
          )}
        </div>
      )}
      {msg && <div className="muted small" style={{ marginTop: 4 }}>{msg}</div>}
    </div>
  );
}

function QrCanvas({ value }: { value: string }): JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) void QRCode.toCanvas(ref.current, value, { width: 150, margin: 1 }).catch(() => undefined);
  }, [value]);
  return <canvas ref={ref} width={150} height={150} style={{ background: "#fff", borderRadius: 8 }} />;
}
