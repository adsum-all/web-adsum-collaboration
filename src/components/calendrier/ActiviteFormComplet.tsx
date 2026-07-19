import { useEffect, useState } from "react";

import {
  type CibleActiviteRef,
  type Cibles,
  type EvenementDetail,
  type EvenementPayload,
  type TypeEvenementRef,
  ajouterPieceActivite,
  creerActivite,
  listCibles,
  listCiblesActivite,
  listTypesEvenements,
  modifierActivite,
} from "../../lib/store.js";
import { PiecesACharger } from "./PiecesACharger.js";
import { lireFichier } from "./PiecesEvenement.js";
import { type Plan, PlanificationActivite } from "./PlanificationActivite.js";
import { detectPlatform } from "../../lib/platform.js";
import { FUSEAUX } from "../../lib/fuseaux.js";
import { utcToZoned, zonedToUtc } from "../../lib/tz.js";
import { RichEditor } from "../common/RichEditor.js";

// The full activity/event form, reproduced from the back office so an activity can
// be programmed or edited from collaboration with EXACTLY the same fields, plus a
// rich description, contributors and automatic broadcast-source detection. Aired,
// single-column and scrollable for real usability. Reaches the same shared engine.
// Times are typed in the activity's own zone and converted to UTC like the BO.

// The destination list comes from the administrable referential
// (GET /reference/cibles-activite), shared with the back office: no hardcoded
// destination here, a new destination needs no code change in this form either.

function Champ({ label, aide, children, full }: { label: string; aide?: string; children: JSX.Element; full?: boolean }): JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: full ? "1 / -1" : "auto" }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {children}
      {aide && <span className="muted" style={{ fontSize: 12 }}>{aide}</span>}
    </label>
  );
}

interface Props {
  detail: EvenementDetail | null; // null = create
  onDone: () => void;
  onCancel: () => void;
}

export function ActiviteFormComplet({ detail, onDone, onCancel }: Props): JSX.Element {
  const zone0 = detail?.fuseau_horaire ?? "Africa/Abidjan";
  const [titre, setTitre] = useState(detail?.titre ?? "");
  const [zone, setZone] = useState(zone0);
  const [debut, setDebut] = useState(detail?.debut ? utcToZoned(detail.debut, zone0) : "");
  const [fin, setFin] = useState(detail?.fin ? utcToZoned(detail.fin, zone0) : "");
  const [lieu, setLieu] = useState(detail?.lieu ?? "");
  const [type, setType] = useState(detail?.type ?? "rassemblement");
  const [typeEvenementId, setTypeEvenementId] = useState<string | null>(detail?.type_evenement_id ?? null);
  const [typesEvenements, setTypesEvenements] = useState<TypeEvenementRef[]>([]);
  const [mode, setMode] = useState(detail?.mode ?? "presentiel");
  const [diffusion, setDiffusion] = useState(detail?.type_diffusion ?? "aucun");
  const [visibilite, setVisibilite] = useState(detail?.visibilite ?? "membres");
  const [volet, setVolet] = useState(detail?.volet ?? "A");
  const [fenetre, setFenetre] = useState(detail?.fenetre_reponse_heures != null ? String(detail.fenetre_reponse_heures) : "");
  const [cibleType, setCibleType] = useState(detail?.cible_type ?? "general");
  const [cibleId, setCibleId] = useState<string | null>(detail?.cible_id ?? null);
  const [cibleGenre, setCibleGenre] = useState(detail?.cible_genre ?? "");
  const [ageMin, setAgeMin] = useState(detail?.cible_age_min != null ? String(detail.cible_age_min) : "");
  const [ageMax, setAgeMax] = useState(detail?.cible_age_max != null ? String(detail.cible_age_max) : "");
  const [emailsTexte, setEmailsTexte] = useState((detail?.cible_emails ?? []).join("\n"));
  const [liens, setLiens] = useState<string[]>(
    detail?.liens && detail.liens.length > 0 ? detail.liens : detail?.lien_session ? [detail.lien_session] : [""],
  );
  // Scheduling plan (create mode): dates separated from per-day times, exactly like
  // the back office, so each day becomes a same-day occurrence sharing a serie_id.
  const [plan, setPlan] = useState<Plan | null>(null);
  const [toucherSerie, setToucherSerie] = useState(false);
  const [principal, setPrincipal] = useState(detail?.intervenant_principal ?? "");
  const [intervenants, setIntervenants] = useState<string[]>(
    detail?.intervenants && detail.intervenants.length > 0 ? detail.intervenants : [""],
  );
  const [description, setDescription] = useState(detail?.description ?? "");
  const [piecesAJoindre, setPiecesAJoindre] = useState<File[]>([]);
  const [cibles, setCibles] = useState<Cibles | null>(null);
  const [destinations, setDestinations] = useState<CibleActiviteRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estEdition = detail !== null;
  const estSerie = Boolean(detail?.serie_id);

  useEffect(() => {
    void listCibles().then(setCibles).catch(() => setCibles(null));
    void listCiblesActivite().then(setDestinations).catch(() => setDestinations([]));
    void listTypesEvenements().then(setTypesEvenements).catch(() => setTypesEvenements([]));
  }, []);

  const typeCouleur = typesEvenements.find((te) => te.id === typeEvenementId)?.couleur ?? null;

  const cibleCourante = destinations.find((c) => c.code === cibleType);
  const besoinUnite = cibleCourante?.besoin_unite ?? false;
  const estListe = cibleCourante?.type_regle === "liste";
  const uniteTable = cibleCourante?.parametres.table ?? "";
  const options: { id: string; nom: string }[] =
    uniteTable === "coordination" ? (cibles?.coordinations ?? [])
      : uniteTable === "commission" ? (cibles?.commissions ?? [])
        : uniteTable === "intendance" ? (cibles?.intendances ?? [])
          : uniteTable === "tribu" ? (cibles?.tribus ?? []) : [];

  async function save(): Promise<void> {
    if (!titre.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }
    if (!estEdition && !plan) {
      setError("Renseignez la planification : au moins une date avec son heure de début et de fin.");
      return;
    }
    if (estEdition && !debut) {
      setError("La date de début est obligatoire.");
      return;
    }
    if (besoinUnite && !cibleId) {
      setError("Choisissez l'unité ciblée ou repassez sur « général ».");
      return;
    }
    const emails = estListe
      ? emailsTexte.split(/[\n,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)
      : [];
    if (estListe && emails.length === 0) {
      setError("Ajoutez au moins une adresse e-mail pour un ciblage par liste.");
      return;
    }
    const cleanLiens = liens.map((l) => l.trim()).filter(Boolean);
    // Create: the planner is the source of truth (same-day debut/fin). Edit keeps
    // the single date/time of the occurrence being edited.
    const debutIso = estEdition ? zonedToUtc(debut, zone) : zonedToUtc((plan as Plan).debut, zone);
    const payload: EvenementPayload = {
      titre: titre.trim(),
      volet,
      debut: debutIso,
      type,
      type_evenement_id: typeEvenementId,
      mode,
      type_diffusion: diffusion as EvenementPayload["type_diffusion"],
      visibilite: visibilite as EvenementPayload["visibilite"],
      cible_type: cibleType as EvenementPayload["cible_type"],
      cible_id: besoinUnite ? cibleId : null,
      cible_genre: (cibleGenre || null) as EvenementPayload["cible_genre"],
      cible_age_min: ageMin ? Number(ageMin) : null,
      cible_age_max: ageMax ? Number(ageMax) : null,
      cible_emails: emails,
      fenetre_reponse_heures: fenetre ? Number(fenetre) : null,
      fuseau_horaire: zone,
      description: description.trim() || null,
      intervenant_principal: principal.trim() || null,
      intervenants: intervenants.map((x) => x.trim()).filter(Boolean),
    };
    if (estEdition && fin) payload.fin = zonedToUtc(fin, zone);
    if (!estEdition) payload.fin = zonedToUtc((plan as Plan).fin, zone);
    if (lieu.trim()) payload.lieu = lieu.trim();
    if (cleanLiens.length > 0) {
      payload.liens = cleanLiens;
      payload.lien_session = cleanLiens[0];
    }
    // Create: each planned slot beyond the first becomes a real same-day occurrence
    // sharing a serie_id, so a multi-day activity gives one pointage per day.
    if (!estEdition && plan && plan.occurrences.length > 0) {
      payload.occurrences = plan.occurrences.map((o) => {
        const occ: { debut: string; fin?: string | null; mode?: string | null } = { debut: zonedToUtc(o.debut, zone), fin: zonedToUtc(o.fin, zone) };
        if (o.mode && o.mode !== mode) occ.mode = o.mode;
        return occ;
      });
    }
    setBusy(true);
    setError(null);
    try {
      if (estEdition && detail) {
        await modifierActivite(detail.id, payload, estSerie && toucherSerie ? "toute_la_serie" : undefined);
      } else {
        const cree = await creerActivite(payload);
        // Upload the attachments joined during planning to the freshly created activity.
        for (const f of piecesAJoindre) {
          try {
            const dataUrl = await lireFichier(f);
            await ajouterPieceActivite(cree.id, { nom: f.name || `piece-${Date.now()}`, type: f.type, taille: f.size, data_url: dataUrl });
          } catch { /* a failed attachment must not lose the created activity */ }
        }
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {error && <p className="small" style={{ color: "var(--danger, #c0392b)" }}>{error}</p>}

      <Champ label="Titre *" full>
        <input value={titre} onChange={(e) => setTitre(e.target.value)} style={{ fontSize: 15, padding: "8px 10px" }} />
      </Champ>

      {!estEdition && (
        <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Planification (dates et horaires)</span>
          <PlanificationActivite modeDefaut={mode} onChange={setPlan} />
        </section>
      )}

      <section style={grid}>
        <Champ label="Fuseau horaire de l'activité *" aide="Par défaut GMT (Côte d'Ivoire). Les heures sont saisies dans ce fuseau ; chaque membre les verra à sa propre heure.">
          <select value={zone} onChange={(e) => setZone(e.target.value)}>{FUSEAUX.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Champ>
        {estEdition && (
          <>
            <Champ label="Début * (heure du fuseau ci-dessus)">
              <input type="datetime-local" value={debut} onChange={(e) => setDebut(e.target.value)} />
            </Champ>
            <Champ label="Fin">
              <input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} />
            </Champ>
          </>
        )}
        <Champ label="Fenêtre de pointage spécifique (h, facultatif)" aide="Laissez vide pour le réglage global (2 h par défaut).">
          <input type="number" min={1} max={336} placeholder="Par défaut : 2 h" value={fenetre} onChange={(e) => setFenetre(e.target.value)} />
        </Champ>
        <Champ label="Volet">
          <select value={volet} onChange={(e) => setVolet(e.target.value)}><option value="A">A (membres)</option><option value="B">B (grand public)</option></select>
        </Champ>
        <Champ label="Nature">
          <select value={type} onChange={(e) => setType(e.target.value)}><option value="rassemblement">Rassemblement</option><option value="formation">Formation</option><option value="priere">Prière</option></select>
        </Champ>
        <Champ label="Type d'événement (couleur du calendrier)">
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {typeCouleur && <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, background: typeCouleur, border: "1px solid rgba(0,0,0,0.15)", flexShrink: 0 }} />}
            <select style={{ flex: 1 }} value={typeEvenementId ?? ""} onChange={(e) => setTypeEvenementId(e.target.value || null)}>
              <option value="">Aucun (couleur par défaut)</option>
              {typesEvenements.map((te) => <option key={te.id} value={te.id}>{te.nom}</option>)}
            </select>
          </span>
        </Champ>
        <Champ label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value)}><option value="presentiel">Présentiel</option><option value="en_ligne">En ligne</option><option value="hybride">Hybride</option></select>
        </Champ>
      </section>

      <section style={grid}>
        <Champ label="Destinataires (qui est concerné ?)" aide={cibleCourante?.description ?? undefined} full>
          <select value={cibleType} onChange={(e) => { setCibleType(e.target.value); setCibleId(null); }}>
            {destinations.map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
            {/* Historical event whose destination was deactivated since: keep it
                selectable so editing never silently retargets the audience. */}
            {cibleCourante == null && destinations.length > 0 && (
              <option value={cibleType}>{cibleType} (destination désactivée)</option>
            )}
          </select>
        </Champ>
        {besoinUnite && (
          <Champ label="Unité ciblée *">
            <select value={cibleId ?? ""} onChange={(e) => setCibleId(e.target.value || null)}>
              <option value="">Choisir...</option>
              {options.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>
          </Champ>
        )}
        {estListe && (
          <Champ label="Adresses e-mail * (une par ligne)" full>
            <textarea value={emailsTexte} onChange={(e) => setEmailsTexte(e.target.value)} rows={3} />
          </Champ>
        )}
        <Champ label="Affiner par genre">
          <select value={cibleGenre} onChange={(e) => setCibleGenre(e.target.value)}><option value="">Tous</option><option value="homme">Hommes</option><option value="femme">Femmes</option></select>
        </Champ>
        <Champ label="Âge min."><input type="number" min={0} max={120} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} /></Champ>
        <Champ label="Âge max."><input type="number" min={0} max={120} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} /></Champ>
        <Champ label="Diffusion">
          <select value={diffusion} onChange={(e) => setDiffusion(e.target.value)}><option value="aucun">Aucune</option><option value="embed">Diffusion intégrée (embed)</option><option value="externe">Lien externe</option></select>
        </Champ>
        <Champ label="Visibilité">
          <select value={visibilite} onChange={(e) => setVisibilite(e.target.value)}><option value="public">Public</option><option value="membres">Membres</option><option value="prive">Privé</option></select>
        </Champ>
        <Champ label="Lieu" full><input value={lieu} onChange={(e) => setLieu(e.target.value)} /></Champ>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Liens de diffusion (Zoom, Telegram, YouTube...)</span>
        <span className="muted" style={{ fontSize: 12 }}>La plateforme est détectée automatiquement.</span>
        {liens.map((l, i) => {
          const p = l.trim() ? detectPlatform(l.trim()) : null;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ flex: 1 }} value={l} placeholder="https://..." onChange={(e) => setLiens(liens.map((x, j) => (j === i ? e.target.value : x)))} />
                <button type="button" className="btn btn-ghost btn-inline" onClick={() => setLiens(liens.length > 1 ? liens.filter((_, j) => j !== i) : [""])}>Retirer</button>
              </div>
              {p && (
                <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: "#fff", background: p.color }}>
                  {p.label}
                </span>
              )}
            </div>
          );
        })}
        <div><button type="button" className="btn btn-ghost btn-inline" onClick={() => setLiens([...liens, ""])}>+ Ajouter un lien</button></div>
      </section>

      <section style={grid}>
        <Champ label="Intervenant principal (orateur)" full>
          <input value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="Nom de l'intervenant principal" />
        </Champ>
        <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Autres intervenants</span>
          {intervenants.map((v, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <input style={{ flex: 1 }} value={v} placeholder="Nom d'un intervenant" onChange={(e) => setIntervenants(intervenants.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="btn btn-ghost btn-inline" onClick={() => setIntervenants(intervenants.length > 1 ? intervenants.filter((_, j) => j !== i) : [""])}>Retirer</button>
            </div>
          ))}
          <div><button type="button" className="btn btn-ghost btn-inline" onClick={() => setIntervenants([...intervenants, ""])}>+ Ajouter un intervenant</button></div>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Description</span>
        <span className="muted" style={{ fontSize: 12 }}>Rédigez le contenu de l'activité : paragraphes, titres, gras, listes, liens.</span>
        <RichEditor value={description} onChange={setDescription} disabled={busy} />
      </section>

      {!estEdition && (
        <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Pièces jointes (images, documents)</span>
          <PiecesACharger files={piecesAJoindre} onChange={setPiecesAJoindre} />
        </section>
      )}

      {estSerie && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={toucherSerie} onChange={(e) => setToucherSerie(e.target.checked)} />
          Appliquer ces détails à toute la série (chaque date garde son horaire propre).
        </label>
      )}

      <div style={{ display: "flex", gap: 8, position: "sticky", bottom: 0, background: "var(--bg, #fff)", paddingTop: 8 }}>
        <button type="button" className="btn btn-primary" disabled={busy || !titre.trim()} onClick={() => void save()}>
          {busy ? "Enregistrement..." : estEdition ? (toucherSerie ? "Enregistrer pour toute la série" : "Enregistrer") : "Créer l'activité"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}
