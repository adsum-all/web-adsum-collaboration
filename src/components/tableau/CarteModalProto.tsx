import { useEffect, useMemo, useRef, useState } from "react";

import {
  ajouterChecklist,
  ajouterChecklistItem,
  ajouterCommentaire,
  battementPresence,
  deleteCarteProto,
  deplacerCarteVersTableau,
  duplicateCarte,
  listTableauxEspace,
  modifierCommentaire,
  publierCarteEnActivite,
  marquerCommentairesLus,
  quitterPresence,
  reagirCommentaire,
  reordonnerChecklistItems,
  supprimerChecklist,
  supprimerCommentaire,
  toggleArchiveCarte,
  updateCarteProto,
} from "../../lib/store.js";
import { type Presence, peutEcrireCollaboration } from "../../lib/store.js";
import { peut, roleDansEspace } from "../../lib/permissions.js";
import type { CarteProto, Espace, Membre, Priorite, TableauProto } from "../../lib/types.js";
import { PiecesCarte } from "./PiecesCarte.js";
import { DescriptionEditor } from "./DescriptionEditor.js";
import { ChecklistItemRow } from "./ChecklistItemRow.js";

interface Props {
  carte: CarteProto;
  espace: Espace;
  membres: Membre[];
  moiId: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

const PRIOS: Priorite[] = ["urgente", "haute", "normale", "basse"];

export function CarteModalProto({ carte, espace, membres, moiId, onClose, onChanged }: Props): JSX.Element {
  const [titre, setTitre] = useState(carte.titre);
  const [echeance, setEcheance] = useState(carte.echeance ? carte.echeance.slice(0, 10) : "");
  const [priorite, setPriorite] = useState<Priorite>(carte.priorite);
  const [nouveauCom, setNouveauCom] = useState("");
  const [nouvelleChecklist, setNouvelleChecklist] = useState("");
  const [nouveauItem, setNouveauItem] = useState<Record<string, string>>({});
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFrag, setMentionFrag] = useState("");
  const [tableauxCible, setTableauxCible] = useState<TableauProto[]>([]);
  const [showMove, setShowMove] = useState(false);
  const [showPublier, setShowPublier] = useState(false);
  const [publierDate, setPublierDate] = useState(carte.echeance ? carte.echeance.slice(0, 10) : (carte.debut ? carte.debut.slice(0, 10) : ""));
  const [publierType, setPublierType] = useState<"rassemblement" | "formation" | "priere">("rassemblement");
  const [publierErr, setPublierErr] = useState<string | null>(null);
  const [publieOk, setPublieOk] = useState(Boolean(carte.publie));
  const inputComRef = useRef<HTMLInputElement | null>(null);
  const [editCom, setEditCom] = useState<{ id: string; corps: string } | null>(null);
  const [viewers, setViewers] = useState<Presence[]>([]);
  const [assignesLoc, setAssignesLoc] = useState<string[]>(carte.assignes);
  const [etiquettesLoc, setEtiquettesLoc] = useState<string[]>(carte.etiquettes);
  const assignesRef = useRef(carte.assignes);
  const etiquettesRef = useRef(carte.etiquettes);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const [errAction, setErrAction] = useState<string | null>(null);
  useEffect(() => { assignesRef.current = carte.assignes; setAssignesLoc(carte.assignes); }, [carte.assignes]);
  useEffect(() => { etiquettesRef.current = carte.etiquettes; setEtiquettesLoc(carte.etiquettes); }, [carte.etiquettes]);

  // Serialize relation writes so rapid clicks cannot reorder on the server and each
  // PATCH carries the cumulative array (fixes the lost-update race on assignees/labels).
  function enqueueSave(patch: Partial<CarteProto>): void {
    saveChain.current = saveChain.current
      .then(() => updateCarteProto(carte.id, patch))
      .then(() => onChanged())
      .catch((e) => setErrAction(e instanceof Error ? e.message : "Enregistrement impossible"));
  }

  async function run(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setErrAction(e instanceof Error ? e.message : "Action impossible");
    }
  }
  const [itemDrag, setItemDrag] = useState<{ checklistId: string; itemId: string } | null>(null);
  const [itemOver, setItemOver] = useState<string | null>(null);

  async function reorderItem(checklistId: string, targetItemId: string): Promise<void> {
    const drag = itemDrag;
    setItemOver(null);
    setItemDrag(null);
    if (!drag || drag.checklistId !== checklistId || drag.itemId === targetItemId) return;
    const cl = carte.checklists.find((c) => c.id === checklistId);
    if (!cl) return;
    const ids = cl.items.map((i) => i.id).filter((id) => id !== drag.itemId);
    const at = ids.indexOf(targetItemId);
    ids.splice(at < 0 ? ids.length : at, 0, drag.itemId);
    await reordonnerChecklistItems(checklistId, ids);
    await onChanged();
  }

  const role = roleDansEspace(espace, moiId);
  // Every card write (edit, comment, archive, publish, pieces, checklists) requires
  // the platform permission collaboration.gerer on the server, ON TOP of the space
  // role. Gate the UI with both so a superviser-only account gets a read-only card
  // instead of buttons that the API refuses with 403.
  const ecritCollab = peutEcrireCollaboration();
  const peutEditer = ecritCollab && peut(espace, role, "editer_carte");
  const peutCommenter = ecritCollab && peut(espace, role, "commenter");
  const peutArchiver = ecritCollab && peut(espace, role, "archiver");
  const peutPublier = ecritCollab && peut(espace, role, "publier_evenement");
  // Assignee picker source: every member of the space, with their display name and
  // initials carried by the space payload. We no longer intersect with the staff-only
  // directory ("membres"), which hid non-staff space members from the picker.
  const membresEspace: Membre[] = espace.membres.map((em) => {
    const known = membres.find((m) => m.id === em.membre_id);
    return {
      id: em.membre_id,
      nom: em.nom || known?.nom || em.membre_id,
      initiales: em.initiales || known?.initiales || "?",
      courriel: known?.courriel || "",
    };
  });

  useEffect(() => {
    void marquerCommentairesLus(carte.id).then(() => onChanged());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carte.id]);

  // Live presence: heartbeat while the card is open, show the other current viewers,
  // and clear our presence when the card closes.
  useEffect(() => {
    let alive = true;
    const beat = (): void => {
      void battementPresence(carte.id).then((v) => { if (alive) setViewers(v); }).catch(() => undefined);
    };
    beat();
    const id = window.setInterval(beat, 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
      void quitterPresence(carte.id).catch(() => undefined);
    };
  }, [carte.id]);

  useEffect(() => {
    void listTableauxEspace(espace.id).then(setTableauxCible);
  }, [espace.id]);

  // Mention suggestions from the real space members (the members passed in that
  // belong to this space), filtered by the typed fragment. No stub.
  const suggestions = useMemo(() => {
    if (!mentionOpen) return [];
    const frag = mentionFrag.trim().toLowerCase();
    if (!frag) return membresEspace.slice(0, 6);
    return membresEspace
      .filter((m) => m.nom.toLowerCase().includes(frag) || m.courriel.toLowerCase().includes(frag))
      .slice(0, 6);
  }, [mentionOpen, mentionFrag, membresEspace]);

  async function save(patch: Partial<CarteProto>): Promise<void> {
    await updateCarteProto(carte.id, patch);
    await onChanged();
  }

  function toggleEtiquette(id: string): void {
    const prev = etiquettesRef.current;
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    etiquettesRef.current = next;
    setEtiquettesLoc(next);
    enqueueSave({ etiquettes: next });
  }

  function toggleAssigne(id: string): void {
    const prev = assignesRef.current;
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    assignesRef.current = next;
    setAssignesLoc(next);
    enqueueSave({ assignes: next });
  }

  function nomMembre(id: string): string {
    return membresEspace.find((m) => m.id === id)?.nom ?? membres.find((m) => m.id === id)?.nom ?? id;
  }

  function onComChange(v: string): void {
    setNouveauCom(v);
    const m = v.match(/@([\p{L}\p{M}'-]*)$/u);
    if (m) {
      setMentionOpen(true);
      setMentionFrag(m[1] ?? "");
    } else {
      setMentionOpen(false);
    }
  }

  function insererMention(nom: string): void {
    const v = nouveauCom.replace(/@([\p{L}\p{M}'-]*)$/u, `@${nom} `);
    setNouveauCom(v);
    setMentionOpen(false);
    inputComRef.current?.focus();
  }

  async function envoyerCom(): Promise<void> {
    const v = nouveauCom.trim();
    if (!v) return;
    try {
      await ajouterCommentaire(carte.id, v);
      setNouveauCom("");
      setMentionOpen(false);
      await onChanged();
    } catch (e) {
      setErrAction(e instanceof Error ? e.message : "Envoi impossible");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <span className="muted small">Carte #{carte.numero}{carte.archive && " · Archivée"}</span>
            {peutEditer ? (
              <input
                className="modal-titre-input"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                onBlur={() => titre !== carte.titre && void save({ titre })}
                aria-label="Titre de la carte"
              />
            ) : (
              <h2>{titre}</h2>
            )}
          </div>
          {viewers.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", marginRight: 10 }} title={`En train de regarder : ${viewers.map((v) => v.nom).join(", ")}`}>
              {viewers.slice(0, 4).map((v) => (
                <span key={v.utilisateur_id} className="avatar avatar-sm"
                  style={{ marginLeft: -6, border: "2px solid var(--adsum-bg, #fff)", background: "var(--adsum-acc, #2A4FAD)", color: "#fff" }}>{v.initiales}</span>
              ))}
              {viewers.length > 4 && <span className="muted small" style={{ marginLeft: 3 }}>+{viewers.length - 4}</span>}
            </div>
          )}
          <button type="button" className="btn btn-ghost btn-inline" onClick={onClose} aria-label="Fermer">Fermer</button>
        </div>

        {errAction && (
          <div role="alert" className="banner banner-warn" style={{ margin: "8px 16px 0" }} onClick={() => setErrAction(null)}>
            {errAction} (cliquer pour masquer)
          </div>
        )}
        <div className="modal-body">
          <div className="modal-form">
            <DescriptionEditor
              value={carte.description}
              membres={membresEspace}
              disabled={!peutEditer}
              onSave={(html) => save({ description: html })}
            />

            <div className="modal-grid">
              <label>
                <span>Priorité</span>
                <select value={priorite} disabled={!peutEditer} onChange={(e) => { const p = e.target.value as Priorite; setPriorite(p); void save({ priorite: p }); }}>
                  {PRIOS.map((p) => (<option key={p} value={p}>{libPrio(p)}</option>))}
                </select>
              </label>
              <label>
                <span>Échéance</span>
                <input
                  type="date"
                  value={echeance}
                  disabled={!peutEditer}
                  onChange={(e) => setEcheance(e.target.value)}
                  onBlur={() => {
                    const iso = echeance ? new Date(echeance).toISOString() : null;
                    if (iso !== carte.echeance) void save({ echeance: iso });
                  }}
                />
              </label>
            </div>

            <div>
              <span className="modal-section-titre">Étiquettes</span>
              <div className="et-picker">
                {espace.etiquettes.map((et) => {
                  const active = etiquettesLoc.includes(et.id);
                  return (
                    <button key={et.id} type="button"
                      className={`et-pill${active ? "" : " et-pill-off"}`}
                      style={active ? { background: et.couleur } : { borderColor: et.couleur, color: et.couleur }}
                      onClick={() => peutEditer && toggleEtiquette(et.id)}
                      disabled={!peutEditer}
                    >{et.nom}</button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="modal-section-titre">Assignés</span>
              <div className="et-picker">
                {membresEspace.map((m) => {
                  const active = assignesLoc.includes(m.id);
                  return (
                    <button key={m.id} type="button" className={`membre-chip${active ? " membre-chip-on" : ""}`}
                      onClick={() => peutEditer && toggleAssigne(m.id)} disabled={!peutEditer}>
                      <span className="avatar avatar-sm" aria-hidden="true">{m.initiales}</span>
                      <span>{m.nom}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="modal-section-titre">Checklists</span>
              {carte.checklists.map((cl) => {
                const total = cl.items.length;
                const faits = cl.items.filter((i) => i.fait).length;
                const pct = total > 0 ? Math.round((faits / total) * 100) : 0;
                return (
                  <div key={cl.id} className="checklist">
                    <div className="checklist-head">
                      <strong>{cl.titre}</strong>
                      <span className="muted small">{faits}/{total} · {pct}%</span>
                      {peutEditer && (
                        <button type="button" className="btn btn-ghost btn-inline" style={{ fontSize: 11 }}
                          onClick={async () => { if (window.confirm(`Supprimer la checklist « ${cl.titre} » ?`)) { await supprimerChecklist(cl.id); await onChanged(); } }}>
                          Supprimer la checklist
                        </button>
                      )}
                    </div>
                    <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
                    <ul>
                      {cl.items.map((it) => (
                        <ChecklistItemRow key={it.id} item={it} carteId={carte.id} checklistId={cl.id}
                          membres={membresEspace} peutEditer={peutEditer} onChanged={onChanged}
                          onDragStartItem={() => setItemDrag({ checklistId: cl.id, itemId: it.id })}
                          onDragOverItem={() => setItemOver(it.id)}
                          onDropItem={() => void reorderItem(cl.id, it.id)}
                          survole={itemOver === it.id && itemDrag != null && itemDrag.itemId !== it.id} />
                      ))}
                    </ul>
                    {peutEditer && (
                      <div className="kanban-add">
                        <input value={nouveauItem[cl.id] ?? ""} placeholder="+ Ajouter un item"
                          onChange={(e) => setNouveauItem({ ...nouveauItem, [cl.id]: e.target.value })}
                          onKeyDown={async (e) => {
                            const v = (nouveauItem[cl.id] ?? "").trim();
                            if (e.key === "Enter" && v) {
                              await ajouterChecklistItem(carte.id, cl.id, v);
                              setNouveauItem({ ...nouveauItem, [cl.id]: "" });
                              await onChanged();
                            }
                          }} />
                      </div>
                    )}
                  </div>
                );
              })}
              {peutEditer && (
                <div className="kanban-add" style={{ marginTop: 8 }}>
                  <input value={nouvelleChecklist} placeholder="+ Nouvelle checklist"
                    onChange={(e) => setNouvelleChecklist(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && nouvelleChecklist.trim()) {
                        await ajouterChecklist(carte.id, nouvelleChecklist.trim());
                        setNouvelleChecklist("");
                        await onChanged();
                      }
                    }} />
                </div>
              )}
            </div>

            <PiecesCarte carte={carte} peutEditer={peutEditer} onChanged={onChanged} />

            {(peutEditer || peutArchiver || peutPublier) && (
              <div className="modal-actions" style={{ flexWrap: "wrap" }}>
                {peutEditer && (
                  <button type="button" className="btn btn-ghost btn-inline" onClick={() => void run(() => duplicateCarte(carte.id))}>Dupliquer</button>
                )}
                {peutEditer && (
                  <button type="button" className="btn btn-ghost btn-inline" onClick={() => setShowMove((v) => !v)}>
                    Déplacer vers un tableau…
                  </button>
                )}
                {publieOk ? (
                  <span className="chip chip-ok" title="Cette carte a été publiée en activité">Publiée en activité</span>
                ) : peutPublier && (
                  <button type="button" className="btn btn-ghost btn-inline" onClick={() => { setShowPublier((v) => !v); setPublierErr(null); }}>
                    Publier en activité…
                  </button>
                )}
                {peutArchiver && (
                  <button type="button" className="btn btn-ghost btn-inline"
                    onClick={() => void run(() => toggleArchiveCarte(carte.id, !carte.archive))}>{carte.archive ? "Restaurer" : "Archiver"}</button>
                )}
                {peutArchiver && (
                  <button type="button" className="btn btn-danger" onClick={async () => {
                    if (window.confirm("Supprimer définitivement cette carte ?")) {
                      await deleteCarteProto(carte.id);
                      await onChanged();
                      onClose();
                    }
                  }}>Supprimer</button>
                )}
                {showMove && (
                  <select onChange={async (e) => {
                    const id = e.target.value;
                    if (id && id !== carte.tableau_id) {
                      await deplacerCarteVersTableau(carte.id, id);
                      await onChanged();
                      onClose();
                    }
                  }} defaultValue="">
                    <option value="">- Choisir un tableau -</option>
                    {tableauxCible.filter((t) => t.id !== carte.tableau_id).map((t) => (
                      <option key={t.id} value={t.id}>{t.nom}</option>
                    ))}
                  </select>
                )}
                {showPublier && !publieOk && (
                  <div className="publier-panneau" style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span className="small muted">Publier « {carte.titre} » comme activité pour tous les membres :</span>
                    <label className="small muted">Type</label>
                    <select value={publierType} onChange={(e) => setPublierType(e.target.value as typeof publierType)}>
                      <option value="rassemblement">Rassemblement</option>
                      <option value="formation">Formation</option>
                      <option value="priere">Prière</option>
                    </select>
                    <label className="small muted">Date</label>
                    <input type="date" value={publierDate} onChange={(e) => setPublierDate(e.target.value)} />
                    <button type="button" className="btn btn-primary btn-inline" disabled={!publierDate} onClick={async () => {
                      setPublierErr(null);
                      try {
                        await publierCarteEnActivite(carte.id, {
                          cible_type: "general",
                          type: publierType,
                          debut: new Date(publierDate).toISOString(),
                        });
                        setPublieOk(true);
                        setShowPublier(false);
                        await onChanged();
                      } catch (err) {
                        setPublierErr(err instanceof Error ? err.message : "Publication impossible");
                      }
                    }}>Publier</button>
                    <span className="small muted" style={{ width: "100%" }}>
                      L'activité est ajoutée à l'agenda des membres et les membres de l'espace sont notifiés. Le ciblage par unité (coordination, commission, tribu) se choisit dans le back office.
                    </span>
                    {publierErr && <span className="small" style={{ color: "var(--danger, #c0392b)", width: "100%" }}>{publierErr}</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-chat">
            <div className="chat-thread">
              {carte.commentaires.length === 0 && (<p className="muted small">Aucun commentaire pour l'instant.</p>)}
              {carte.commentaires.map((c) => {
                const pouces = c.reactions.filter((r) => r.type === "pouce").length;
                const coches = c.reactions.filter((r) => r.type === "coche").length;
                const jePouce = c.reactions.some((r) => r.type === "pouce" && r.membre_id === moiId);
                const jeCoche = c.reactions.some((r) => r.type === "coche" && r.membre_id === moiId);
                const estAuteur = c.auteur_id === moiId;
                return (
                  <div key={c.id} className="chat-msg">
                    <span className="chat-author">{nomMembre(c.auteur_id)}</span>
                    {editCom?.id === c.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "4px 0" }}>
                        <textarea className="textarea" rows={2} value={editCom.corps}
                          onChange={(e) => setEditCom({ id: c.id, corps: e.target.value })} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" className="btn btn-primary btn-inline" disabled={!editCom.corps.trim()}
                            onClick={async () => { await modifierCommentaire(c.id, editCom.corps.trim()); setEditCom(null); await onChanged(); }}>Enregistrer</button>
                          <button type="button" className="btn btn-ghost btn-inline" onClick={() => setEditCom(null)}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <span className="chat-body">{c.corps}{c.edite_le && <span className="muted small"> (modifié)</span>}</span>
                    )}
                    <span className="chat-time">{new Date(c.cree_le).toLocaleString("fr-FR")}</span>
                    {peutCommenter && editCom?.id !== c.id && (
                      <span className="chat-reactions">
                        <button type="button" className={`react-btn${jePouce ? " react-btn-on" : ""}`}
                          onClick={() => void run(() => reagirCommentaire(carte.id, c.id, "pouce"))}>
                          J&apos;aime{pouces > 0 ? ` ${pouces}` : ""}
                        </button>
                        <button type="button" className={`react-btn${jeCoche ? " react-btn-on" : ""}`}
                          onClick={() => void run(() => reagirCommentaire(carte.id, c.id, "coche"))}>
                          Fait{coches > 0 ? ` ${coches}` : ""}
                        </button>
                        {estAuteur && (
                          <>
                            <button type="button" className="react-btn" onClick={() => setEditCom({ id: c.id, corps: c.corps })}>Modifier</button>
                            <button type="button" className="react-btn"
                              onClick={() => { if (window.confirm("Supprimer ce commentaire ?")) void run(() => supprimerCommentaire(c.id)); }}>Supprimer</button>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
              {carte.activite.map((a) => (
                <div key={a.id} className="chat-activity">
                  <span className="muted small">
                    {nomMembre(a.auteur_id)} {a.texte} · {new Date(a.cree_le).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))}
            </div>
            {peutCommenter && (
              <div className="chat-input" style={{ position: "relative" }}>
                <input ref={inputComRef} value={nouveauCom} placeholder="Écrire un commentaire (@ pour mentionner)…"
                  onChange={(e) => onComChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !mentionOpen) void envoyerCom(); }} />
                <button type="button" className="btn btn-primary btn-inline" disabled={!nouveauCom.trim()} onClick={() => void envoyerCom()}>
                  Envoyer
                </button>
                {mentionOpen && suggestions.length > 0 && (
                  <div className="mention-pop">
                    {suggestions.map((m) => (
                      <button key={m.id} type="button" className="mention-item" onClick={() => insererMention(m.nom.split(" ")[0]!)}>
                        <span className="avatar avatar-sm">{m.initiales}</span>
                        <span>{m.nom}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function libPrio(p: Priorite): string {
  switch (p) {
    case "urgente": return "Urgente";
    case "haute": return "Haute";
    case "normale": return "Normale";
    case "basse": return "Basse";
  }
}
