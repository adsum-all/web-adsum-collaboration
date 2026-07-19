import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createCarteProto,
  createColonne,
  deleteColonne,
  getTableauProto,
  listCartes,
  listCartesArchivees,
  listColonnes,
  listMembres,
  moveCarte,
  peutEcrireCollaboration,
  reordonnerColonnes,
  toggleArchiveCarte,
  updateColonne,
  updateTableauProto,
} from "../../lib/store.js";
import { peut, roleDansEspace } from "../../lib/permissions.js";
import type { CarteProto, ColonneProto, Espace, Membre, TableauProto } from "../../lib/types.js";
import { CarteModalProto } from "./CarteModalProto.js";
import { CarteVue, echeanceLate, formatDate, libellePriorite } from "./CarteVue.js";
import { ParticipantsTableau } from "./ParticipantsTableau.js";

type Vue = "kanban" | "liste";


interface Props {
  espace: Espace;
  moiId: string;
  tableauId: string;
  carteInitiale?: string | null;
  onRetour: () => void;
  onChanged: () => void;
}

export function TableauPage({ espace, moiId, tableauId, carteInitiale = null, onRetour, onChanged }: Props): JSX.Element {
  const [tableau, setTableau] = useState<TableauProto | null>(null);
  const [colonnes, setColonnes] = useState<ColonneProto[]>([]);
  const [cartes, setCartes] = useState<CarteProto[]>([]);
  const [cartesArchivees, setCartesArchivees] = useState<CarteProto[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [openCardId, setOpenCardId] = useState<string | null>(carteInitiale);
  const [vue, setVue] = useState<Vue>("kanban");
  const [newColonneMode, setNewColonneMode] = useState(false);
  const [newColonneNom, setNewColonneNom] = useState("");
  const [drag, setDrag] = useState<{ carteId: string; from: string } | null>(null);
  const [dragOver, setDragOver] = useState<{ colonneId: string; index: number } | null>(null);
  const [colDrag, setColDrag] = useState<string | null>(null);
  const [colOver, setColOver] = useState<string | null>(null);
  const [erreurBoard, setErreurBoard] = useState<string | null>(null);
  const [chargeEtat, setChargeEtat] = useState<"loading" | "ok" | "error" | "introuvable">("loading");
  const [fRecherche, setFRecherche] = useState("");
  const [fPriorite, setFPriorite] = useState<string>("");
  const [fEtiquette, setFEtiquette] = useState<string>("");
  const [fAssigne, setFAssigne] = useState<string>("");
  const [fRetard, setFRetard] = useState(false);


  const role = roleDansEspace(espace, moiId);
  // Space role AND the platform write permission: the server requires both, so the
  // UI must too, otherwise a superviser-only account sees buttons that 403.
  const ecritCollab = peutEcrireCollaboration();
  const peutGererCol = ecritCollab && peut(espace, role, "gerer_colonnes");
  const peutCreerCarte = ecritCollab && peut(espace, role, "creer_carte");
  const peutDeplacer = ecritCollab && peut(espace, role, "deplacer_carte");

  const cartesFiltrees = useMemo(() => {
    const q = fRecherche.trim().toLowerCase();
    const now = Date.now();
    return cartes.filter((c) => {
      if (q && !(c.titre.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || `#${c.numero}` === q)) return false;
      if (fPriorite && c.priorite !== fPriorite) return false;
      if (fEtiquette && !c.etiquettes.includes(fEtiquette)) return false;
      if (fAssigne && !c.assignes.includes(fAssigne)) return false;
      if (fRetard && !(c.echeance && new Date(c.echeance).getTime() < now)) return false;
      return true;
    });
  }, [cartes, fRecherche, fPriorite, fEtiquette, fAssigne, fRetard]);

  const filtresActifs = Boolean(fRecherche || fPriorite || fEtiquette || fAssigne || fRetard);

  const reloadSeq = useRef(0);
  const reload = useCallback(async () => {
    const seq = ++reloadSeq.current;
    try {
      const [t, c, k, ka] = await Promise.all([
        getTableauProto(tableauId),
        listColonnes(tableauId),
        listCartes(tableauId),
        listCartesArchivees(tableauId),
      ]);
      // Drop a stale reload whose response arrives after a newer one was issued, so an
      // earlier-but-slower fetch cannot overwrite fresher data (last-write-wins bug).
      if (seq !== reloadSeq.current) return;
      setTableau(t);
      setColonnes(c);
      setCartes(k);
      setCartesArchivees(ka);
      setChargeEtat(t ? "ok" : "introuvable");
    } catch (e) {
      // Without this, a rejected initial load (expired session, 403, 500) left a dead
      // "Chargement du tableau..." spinner. Fail to an explicit state; a failed poll
      // once the board is loaded keeps the board and only surfaces a banner.
      if (seq !== reloadSeq.current) return;
      setErreurBoard(e instanceof Error ? e.message : "Chargement du tableau impossible");
      setChargeEtat((prev) => (prev === "ok" ? "ok" : "error"));
    }
  }, [tableauId]);

  async function reorderColonne(targetColId: string): Promise<void> {
    const dragged = colDrag;
    setColDrag(null);
    setColOver(null);
    if (!dragged || dragged === targetColId) return;
    const ids = colonnes.map((c) => c.id).filter((id) => id !== dragged);
    const at = ids.indexOf(targetColId);
    ids.splice(at < 0 ? ids.length : at, 0, dragged);
    try {
      await reordonnerColonnes(tableauId, ids);
    } catch (e) {
      setErreurBoard(e instanceof Error ? e.message : "Reordonnancement impossible");
    } finally {
      await reload();
    }
  }

  useEffect(() => {
    void reload();
    void listMembres().then(setMembres);
  }, [reload]);

  // Near real-time board: refresh every 5 s so cards moved or added by others appear
  // without a manual reload. Paused while a card is open, and skipped during a drag or a
  // column reorder, so it never clobbers an unsaved edit (which used to overwrite the
  // assignees/labels of the open card) nor yanks the board mid-drag. The stale-response
  // guard above keeps it safe. This single guarded poll replaces the former 5 s + 20 s pair.
  useEffect(() => {
    if (openCardId) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && !drag && !colDrag) void reload();
    }, 5000);
    return () => window.clearInterval(id);
  }, [reload, openCardId, drag, colDrag]);

  // Near-real-time collaboration without a websocket stack: refetch when the tab
  // regains focus, and poll gently while the board is visible and no card is open
  // (polling is paused during a card edit so it never clobbers an in-progress change).
  useEffect(() => {
    const onFocus = (): void => {
      if (document.visibilityState !== "visible") return;
      // Do not refetch while a card is open or a drag is in progress: it would
      // clobber an unsaved card edit or yank the board mid-drag.
      if (openCardId || drag || colDrag) return;
      void reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [reload, openCardId, drag, colDrag]);

  useEffect(() => {
    if (carteInitiale) setOpenCardId(carteInitiale);
  }, [carteInitiale]);


  const carteOuverte = useMemo(() => {
    return cartes.find((c) => c.id === openCardId) ?? cartesArchivees.find((c) => c.id === openCardId) ?? null;
  }, [cartes, cartesArchivees, openCardId]);

  if (chargeEtat === "loading") return <div className="page"><p className="muted">Chargement du tableau...</p></div>;
  if (!tableau) {
    const introuvable = chargeEtat === "introuvable";
    return (
      <div className="page">
        <div className="empty-state">
          <h2>{introuvable ? "Tableau introuvable" : "Chargement impossible"}</h2>
          <p>{introuvable ? "Ce tableau n'existe plus ou vous n'y avez pas accès." : (erreurBoard ?? "Une erreur est survenue lors du chargement du tableau.")}</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {!introuvable && <button type="button" className="btn btn-primary" onClick={() => void reload()}>Réessayer</button>}
            <button type="button" className="btn btn-ghost" onClick={onRetour}>Retour à l'espace</button>
          </div>
        </div>
      </div>
    );
  }

  function exportCsv(): void {
    const rows = [["#", "Titre", "Colonne", "Priorité", "Échéance", "Étiquettes", "Assignés", "Description"]];
    cartesFiltrees.forEach((c) => {
      const col = colonnes.find((x) => x.id === c.colonne_id)?.nom ?? "";
      const et = espace.etiquettes.filter((e) => c.etiquettes.includes(e.id)).map((e) => e.nom).join("|");
      const as = membres.filter((m) => c.assignes.includes(m.id)).map((m) => m.nom).join("|");
      rows.push([String(c.numero), c.titre, col, c.priorite, c.echeance ?? "", et, as, c.description.replace(/\n/g, " ")]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableau!.nom.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }


  async function ajouterColonne(): Promise<void> {
    if (!newColonneNom.trim()) return;
    await createColonne(tableauId, newColonneNom.trim());
    setNewColonneNom("");
    setNewColonneMode(false);
    await reload();
  }

  async function drop(colonneId: string, index: number): Promise<void> {
    if (!drag) return;
    const carteId = drag.carteId;
    setDrag(null);
    setDragOver(null);
    try {
      await moveCarte(carteId, colonneId, index);
    } catch (e) {
      setErreurBoard(e instanceof Error ? e.message : "Déplacement impossible");
    } finally {
      await reload();
    }
  }

  // Touch/keyboard move: send a card to the adjacent column (append at its end). This is
  // the accessible fallback to HTML5 drag, which does not work on touch nor keyboard.
  async function bougerCarteColonne(carteId: string, colIdx: number, dir: -1 | 1): Promise<void> {
    const cible = colonnes[colIdx + dir];
    if (!cible) return;
    const fin = cartes.filter((c) => c.colonne_id === cible.id).length;
    try {
      await moveCarte(carteId, cible.id, fin);
    } catch (e) {
      setErreurBoard(e instanceof Error ? e.message : "Déplacement impossible");
    } finally {
      await reload();
    }
  }

  return (
    <div className="page page-wide">
      {erreurBoard && (
        <div role="alert" className="banner banner-warn" style={{ margin: "0 0 8px" }}
          onClick={() => setErreurBoard(null)}>
          {erreurBoard} (cliquer pour masquer)
        </div>
      )}
      <header className="page-head tab-head">
        <div>
          <button type="button" className="btn btn-ghost btn-inline" onClick={onRetour}>
            ← Retour à l'espace
          </button>
          <h1 style={{ marginTop: 8 }}>
            {tableau.favori && <span className="favori-star" aria-hidden="true">★ </span>}
            {tableau.nom}
          </h1>
          {tableau.description && <p className="muted">{tableau.description}</p>}
        </div>
        <div className="toolbar">
          <div className="tabs tabs-mini" role="tablist" aria-label="Vue">
            <button type="button" role="tab" aria-selected={vue === "kanban"} className={`tab${vue === "kanban" ? " tab-active" : ""}`} onClick={() => setVue("kanban")}>Kanban</button>
            <button type="button" role="tab" aria-selected={vue === "liste"} className={`tab${vue === "liste" ? " tab-active" : ""}`} onClick={() => setVue("liste")}>Liste</button>
          </div>
          <button type="button" className="btn btn-ghost btn-inline" onClick={exportCsv}>Export CSV</button>
          <button type="button" className="btn btn-ghost btn-inline" onClick={() => setShowArchives((v) => !v)}>
            Archives ({cartesArchivees.length})
          </button>
          {ecritCollab && (
            <button
              type="button"
              className="btn btn-ghost btn-inline"
              onClick={async () => {
                await updateTableauProto(tableauId, { favori: !tableau.favori });
                await reload();
                onChanged();
              }}
              aria-pressed={tableau.favori}
            >
              {tableau.favori ? "Retirer des favoris" : "Ajouter aux favoris"}
            </button>
          )}
          <span className="badge badge-mut">
            {tableau.visibilite === "prive" ? "Privé" : "Visible espace"}
          </span>
          {tableau.visibilite === "prive" && (
            <ParticipantsTableau
              espace={espace}
              tableauId={tableauId}
              peutGerer={ecritCollab && (role === "proprietaire" || role === "admin" || role === "membre")}
            />
          )}
        </div>
      </header>

      <div className="filtres-bar">
        <input
          className="search"
          value={fRecherche}
          placeholder="Filtrer les cartes (titre, description, #num)…"
          onChange={(e) => setFRecherche(e.target.value)}
          aria-label="Recherche dans le tableau"
        />
        <select value={fPriorite} onChange={(e) => setFPriorite(e.target.value)} aria-label="Priorité">
          <option value="">Toutes priorités</option>
          <option value="urgente">Urgente</option>
          <option value="haute">Haute</option>
          <option value="normale">Normale</option>
          <option value="basse">Basse</option>
        </select>
        <select value={fEtiquette} onChange={(e) => setFEtiquette(e.target.value)} aria-label="Étiquette">
          <option value="">Toutes étiquettes</option>
          {espace.etiquettes.map((et) => (
            <option key={et.id} value={et.id}>{et.nom}</option>
          ))}
        </select>
        <select value={fAssigne} onChange={(e) => setFAssigne(e.target.value)} aria-label="Assigné">
          <option value="">Tous membres</option>
          {espace.membres.map((mm) => {
            const nom = mm.nom || membres.find((x) => x.id === mm.membre_id)?.nom || mm.membre_id;
            return <option key={mm.membre_id} value={mm.membre_id}>{nom}</option>;
          })}
        </select>
        <label className="switch-row" style={{ margin: 0 }}>
          <input type="checkbox" checked={fRetard} onChange={(e) => setFRetard(e.target.checked)} />
          <span>En retard</span>
        </label>
        {filtresActifs && (
          <button
            type="button"
            className="btn btn-ghost btn-inline"
            onClick={() => { setFRecherche(""); setFPriorite(""); setFEtiquette(""); setFAssigne(""); setFRetard(false); }}
          >
            Réinitialiser
          </button>
        )}
        <span className="muted small" style={{ marginLeft: "auto" }}>
          {cartesFiltrees.length} / {cartes.length} carte(s)
        </span>
      </div>

      {showArchives && (
        <section className="card">
          <h2 className="card-title">Cartes archivées ({cartesArchivees.length})</h2>
          {cartesArchivees.length === 0 ? (
            <p className="muted small">Aucune carte archivée.</p>
          ) : (
            <ul className="liste-cartes">
              {cartesArchivees.map((c) => (
                <li key={c.id} className="liste-carte">
                  <button type="button" className="liste-carte-titre" onClick={() => setOpenCardId(c.id)}>
                    #{c.numero} {c.titre}
                  </button>
                  <span style={{ display: "flex", gap: 6 }}>
                    {ecritCollab && (
                      <button type="button" className="btn btn-ghost btn-inline" onClick={async () => { await toggleArchiveCarte(c.id, false); await reload(); }}>
                        Restaurer
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {vue === "liste" ? (
        <ListeVue
          colonnes={colonnes}
          cartes={cartesFiltrees}
          etiquettes={espace.etiquettes}
          membres={membres}
          onOpen={setOpenCardId}
        />
      ) : (
      <div className="kanban">

        {colonnes.map((col, idxCol) => {
          const cartesCol = cartesFiltrees
            .filter((c) => c.colonne_id === col.id)
            .sort((a, b) => a.position - b.position);
          return (
            <ColonneVue
              key={col.id}
              espace={espace}
              colonne={col}
              cartes={cartesCol}
              membres={membres}
              ecritCollab={ecritCollab}
              peutGererCol={peutGererCol}
              peutCreerCarte={peutCreerCarte}
              peutDeplacer={peutDeplacer}
              estPremiere={idxCol === 0}
              estDerniere={idxCol === colonnes.length - 1}
              onBougerCarte={(carteId, dir) => void bougerCarteColonne(carteId, idxCol, dir)}
              dragOver={dragOver?.colonneId === col.id ? dragOver.index : null}
              draggingId={drag?.carteId ?? null}
              onDragStart={(carteId) => setDrag({ carteId, from: col.id })}
              onDragEnd={() => { setDrag(null); setDragOver(null); }}
              onDragOverIndex={(index) => setDragOver({ colonneId: col.id, index })}
              onDrop={(index) => void drop(col.id, index)}
              draggingCol={colDrag != null}
              colSurvole={colOver === col.id && colDrag != null && colDrag !== col.id}
              onColDragStart={() => setColDrag(col.id)}
              onColDragEnd={() => { setColDrag(null); setColOver(null); }}
              onColDragOver={() => setColOver(col.id)}
              onColDrop={() => void reorderColonne(col.id)}
              onOpen={setOpenCardId}
              onCreated={reload}
              onRename={async (nom) => { await updateColonne(col.id, { nom }); await reload(); }}
              onUpdate={async (patch) => { await updateColonne(col.id, patch); await reload(); }}
              onDelete={async () => {
                if (window.confirm(`Supprimer la colonne « ${col.nom} » et ses cartes ?`)) {
                  await deleteColonne(col.id);
                  await reload();
                }
              }}
            />

          );
        })}

        {peutGererCol && (
          <section className="kanban-col kanban-col-add">
            {newColonneMode ? (
              <div className="kanban-add">
                <input
                  autoFocus
                  value={newColonneNom}
                  placeholder="Nom de la colonne"
                  onChange={(e) => setNewColonneNom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void ajouterColonne();
                    if (e.key === "Escape") {
                      setNewColonneMode(false);
                      setNewColonneNom("");
                    }
                  }}
                />
                <button type="button" className="btn btn-primary btn-inline" onClick={() => void ajouterColonne()}>
                  Ajouter
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => setNewColonneMode(true)}>
                + Ajouter une colonne
              </button>
            )}
          </section>
        )}
      </div>
      )}


      {carteOuverte && (
        <CarteModalProto
          carte={carteOuverte}
          espace={espace}
          membres={membres}
          moiId={moiId}
          onClose={() => setOpenCardId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

interface ColonneVueProps {
  espace: Espace;
  colonne: ColonneProto;
  cartes: CarteProto[];
  membres: Membre[];
  ecritCollab: boolean;
  peutGererCol: boolean;
  peutCreerCarte: boolean;
  peutDeplacer: boolean;
  dragOver: number | null;
  draggingId: string | null;
  onDragStart: (carteId: string) => void;
  onDragEnd: () => void;
  onDragOverIndex: (index: number) => void;
  onDrop: (index: number) => void;
  estPremiere: boolean;
  estDerniere: boolean;
  onBougerCarte: (carteId: string, dir: -1 | 1) => void;
  onOpen: (id: string) => void;
  onCreated: () => Promise<void>;
  onRename: (nom: string) => Promise<void>;
  onUpdate: (patch: Partial<ColonneProto>) => Promise<void>;
  onDelete: () => Promise<void>;
  draggingCol: boolean;
  colSurvole: boolean;
  onColDragStart: () => void;
  onColDragEnd: () => void;
  onColDragOver: () => void;
  onColDrop: () => void;
}


function ColonneVue({
  espace,
  colonne,
  cartes,
  membres,
  ecritCollab,
  peutGererCol,
  peutCreerCarte,
  peutDeplacer,
  dragOver,
  draggingId,
  onDragStart,
  onDragEnd,
  onDragOverIndex,
  onDrop,
  estPremiere,
  estDerniere,
  onBougerCarte,
  onOpen,
  onCreated,
  onRename,
  onUpdate,
  onDelete,
  draggingCol,
  colSurvole,
  onColDragStart,
  onColDragEnd,
  onColDragOver,
  onColDrop,
}: ColonneVueProps): JSX.Element {
  const [titre, setTitre] = useState("");
  const [editNom, setEditNom] = useState(false);
  const [nom, setNom] = useState(colonne.nom);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const wipDepasse = colonne.wip !== null && cartes.length > colonne.wip;

  async function ajouter(): Promise<void> {
    if (!titre.trim()) return;
    setBusy(true);
    try {
      await createCarteProto({ tableau_id: colonne.tableau_id, colonne_id: colonne.id, titre: titre.trim() });
      setTitre("");
      await onCreated();
    } finally {
      setBusy(false);
    }
  }

  const couleurs = [null, "#94a3b8", "#3b82f6", "#22c55e", "#f59e0b", "#c0392b", "#a855f7"];

  return (
    <section
      className={`kanban-col${colonne.repliee ? " kanban-col-repliee" : ""}${wipDepasse ? " kanban-col-wip-over" : ""}`}
      onDragOver={(e) => { if (draggingCol) { e.preventDefault(); onColDragOver(); } }}
      onDrop={(e) => { if (draggingCol) { e.preventDefault(); onColDrop(); } }}
      style={colSurvole ? { boxShadow: "inset 3px 0 0 0 var(--accent, #0EA5E9)" } : undefined}
    >
      {colonne.couleur && <div className="kanban-col-bar" style={{ background: colonne.couleur }} aria-hidden="true" />}
      <header className="kanban-col-head">
        {peutGererCol && !editNom && (
          <span draggable title="Deplacer la colonne" onDragStart={onColDragStart} onDragEnd={onColDragEnd}
            style={{ cursor: "grab", color: "var(--muted, #9aa4b2)", userSelect: "none", paddingRight: 2 }}>≡</span>
        )}

        {editNom && peutGererCol ? (
          <input
            autoFocus
            className="inline-input"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onBlur={() => {
              setEditNom(false);
              if (nom.trim() && nom !== colonne.nom) void onRename(nom.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setNom(colonne.nom);
                setEditNom(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="kanban-col-titre"
            onClick={() => peutGererCol && setEditNom(true)}
            aria-label={peutGererCol ? "Renommer la colonne" : undefined}
            disabled={!peutGererCol}
          >
            {colonne.nom}
          </button>
        )}
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className={`kanban-count${wipDepasse ? " kanban-count-over" : ""}`} title={colonne.wip !== null ? `WIP max ${colonne.wip}` : undefined}>
            {cartes.length}{colonne.wip !== null && `/${colonne.wip}`}
          </span>
          {ecritCollab && (
            <button type="button" className="col-more" aria-label={colonne.repliee ? "Déplier" : "Replier"} onClick={() => void onUpdate({ repliee: !colonne.repliee })}>
              {colonne.repliee ? "▸" : "▾"}
            </button>
          )}
          {peutGererCol && (
            <>
              <button type="button" className="col-more" aria-label="Options" onClick={() => setMenuOpen((v) => !v)}>⋯</button>
              <button type="button" className="col-more" aria-label="Supprimer la colonne" onClick={() => void onDelete()}>×</button>
            </>
          )}
        </span>
      </header>
      {menuOpen && peutGererCol && (
        <div className="col-menu">
          <div className="col-menu-row">
            <span className="muted small">Couleur</span>
            <div className="et-picker">
              {couleurs.map((c, i) => (
                <button key={i} type="button" className={`swatch${colonne.couleur === c ? " swatch-on" : ""}`}
                  style={{ background: c ?? "transparent", border: c ? undefined : "1px dashed var(--muted)" }}
                  onClick={() => void onUpdate({ couleur: c })} aria-label={c ?? "Aucune"} />
              ))}
            </div>
          </div>
          <div className="col-menu-row">
            <label className="switch-row" style={{ margin: 0 }}>
              <span>WIP max</span>
              <input type="number" min={0} value={colonne.wip ?? ""} placeholder="-" style={{ width: 70 }}
                onChange={(e) => { const v = e.target.value; void onUpdate({ wip: v === "" ? null : Math.max(0, Number(v)) }); }} />
            </label>
          </div>
        </div>
      )}


      {!colonne.repliee && (
        <>
          <div
            className="kanban-cards"
            onDragOver={(e) => {
              if (!peutDeplacer || !draggingId) return;
              e.preventDefault();
              if (cartes.length === 0) onDragOverIndex(0);
            }}
            onDrop={(e) => {
              if (!peutDeplacer || !draggingId) return;
              e.preventDefault();
              e.stopPropagation();  // never let a card drop bubble to the column-reorder drop
              onDrop(dragOver ?? cartes.length);
            }}
          >
            {cartes.length === 0 && (
              <div className={`kanban-drop-zone${dragOver === 0 ? " kanban-drop-zone-over" : ""}`}>
                {draggingId ? "Déposer ici" : ""}
              </div>
            )}
            {cartes.map((c, i) => (
              <CarteVue
                key={c.id}
                carte={c}
                espace={espace}
                membres={membres}
                draggable={peutDeplacer}
                isDragging={draggingId === c.id}
                dropBefore={dragOver === i && draggingId !== null}
                onDragStart={() => onDragStart(c.id)}
                onDragEnd={onDragEnd}
                onDragOverIndex={(pos) => onDragOverIndex(pos === "before" ? i : i + 1)}
                onOpen={() => onOpen(c.id)}
                canMove={peutDeplacer}
                isFirstColonne={estPremiere}
                isLastColonne={estDerniere}
                onMove={(dir) => onBougerCarte(c.id, dir)}
              />
            ))}
            {cartes.length > 0 && dragOver === cartes.length && draggingId && (
              <div className="kanban-drop-zone kanban-drop-zone-over">Déposer ici</div>
            )}
          </div>

          {peutCreerCarte && (
            <div className="kanban-add">
              <input
                value={titre}
                placeholder="+ Ajouter une carte"
                onChange={(e) => setTitre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void ajouter()}
              />
              {titre.trim() && (
                <button type="button" className="btn btn-primary btn-inline" disabled={busy} onClick={() => void ajouter()}>
                  Ajouter
                </button>
              )}
            </div>
          )}
        </>
      )}

    </section>
  );
}

interface ListeVueProps {
  colonnes: ColonneProto[];
  cartes: CarteProto[];
  etiquettes: Espace["etiquettes"];
  membres: Membre[];
  onOpen: (id: string) => void;
}

function ListeVue({ colonnes, cartes, etiquettes, membres, onOpen }: ListeVueProps): JSX.Element {
  const [tri, setTri] = useState<"colonne" | "priorite" | "echeance" | "titre">("colonne");
  const ordre: Record<string, number> = { urgente: 0, haute: 1, normale: 2, basse: 3 };
  const rows = cartes.slice().sort((a, b) => {
    if (tri === "priorite") return (ordre[a.priorite] ?? 9) - (ordre[b.priorite] ?? 9);
    if (tri === "echeance") return (a.echeance ?? "z") < (b.echeance ?? "z") ? -1 : 1;
    if (tri === "titre") return a.titre.localeCompare(b.titre);
    const ca = colonnes.find((x) => x.id === a.colonne_id)?.position ?? 9;
    const cb = colonnes.find((x) => x.id === b.colonne_id)?.position ?? 9;
    return ca - cb || a.position - b.position;
  });
  return (
    <div className="liste-vue">
      <div className="filtres-bar" style={{ marginTop: 0 }}>
        <label className="switch-row" style={{ margin: 0 }}>
          <span>Trier</span>
          <select value={tri} onChange={(e) => setTri(e.target.value as typeof tri)}>
            <option value="colonne">Par colonne</option>
            <option value="priorite">Par priorité</option>
            <option value="echeance">Par échéance</option>
            <option value="titre">Par titre</option>
          </select>
        </label>
      </div>
      <table className="table-cartes">
        <thead>
          <tr>
            <th>#</th><th>Titre</th><th>Colonne</th><th>Priorité</th><th>Échéance</th><th>Étiquettes</th><th>Assignés</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const col = colonnes.find((x) => x.id === c.colonne_id);
            const ets = etiquettes.filter((e) => c.etiquettes.includes(e.id));
            const as = membres.filter((m) => c.assignes.includes(m.id));
            return (
              <tr key={c.id} onClick={() => onOpen(c.id)} className="table-cartes-row">
                <td className="muted small">#{c.numero}</td>
                <td>{c.titre}</td>
                <td>{col?.nom ?? "-"}</td>
                <td><span className={`badge badge-prio badge-prio-${c.priorite}`}>{libellePriorite(c.priorite)}</span></td>
                <td>{c.echeance ? <span className={`badge ${echeanceLate(c.echeance) ? "badge-warn" : "badge-mut"}`}>{formatDate(c.echeance)}</span> : "-"}</td>
                <td>
                  {ets.map((et) => (<span key={et.id} className="et-pill" style={{ background: et.couleur, marginRight: 4 }}>{et.nom}</span>))}
                </td>
                <td>
                  <span className="kanban-card-avatars">
                    {as.map((a) => (<span key={a.id} className="avatar avatar-sm" title={a.nom}>{a.initiales}</span>))}
                  </span>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (<tr><td colSpan={7} className="muted small">Aucune carte.</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}


