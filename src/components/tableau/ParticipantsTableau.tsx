import { useEffect, useState } from "react";

import {
  type ParticipantTableau,
  ajouterParticipantTableau,
  listParticipantsTableau,
  retirerParticipantTableau,
} from "../../lib/store.js";
import type { Espace } from "../../lib/types.js";

interface Props {
  espace: Espace;
  tableauId: string;
  /** Whether the signed-in user can add or remove participants (active space member). */
  peutGerer: boolean;
}

/** Trello-style member avatars on a private board: who can see and act on it, with
 * add/remove controls. Only members OF THE SPACE can be added (enforced server-side
 * too), so a private board is never shared outside its space. */
export function ParticipantsTableau({ espace, tableauId, peutGerer }: Props): JSX.Element {
  const [participants, setParticipants] = useState<ParticipantTableau[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void listParticipantsTableau(tableauId)
      .then((p) => alive && setParticipants(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tableauId]);

  const dejaDedans = new Set(participants.map((p) => p.utilisateur_id));
  const ajoutables = espace.membres.filter((m) => !dejaDedans.has(m.membre_id));

  async function agir(action: () => Promise<ParticipantTableau[]>): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      setParticipants(await action());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  }

  const avatar = (initiales: string, key: string, onRemove?: () => void): JSX.Element => (
    <span
      key={key}
      title=""
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "#2a4fad",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        marginLeft: -6,
        border: "2px solid var(--collab-panel, #fff)",
      }}
    >
      {initiales}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label="Retirer du tableau"
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 15,
            height: 15,
            borderRadius: "50%",
            border: "none",
            background: "#c0392b",
            color: "#fff",
            fontSize: 10,
            lineHeight: "13px",
            cursor: "pointer",
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </span>
  );

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
      <span className="muted" style={{ fontSize: 11 }}>Membres du tableau</span>
      <div style={{ display: "flex", alignItems: "center", paddingLeft: 6 }}>
        {participants.length === 0 && <span className="muted" style={{ fontSize: 11 }}>-</span>}
        {participants.map((p) =>
          avatar(
            p.initiales,
            p.utilisateur_id,
            peutGerer ? () => void agir(() => retirerParticipantTableau(tableauId, p.utilisateur_id)) : undefined,
          ),
        )}
        {peutGerer && (
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={busy || ajoutables.length === 0}
            aria-label="Ajouter un membre au tableau"
            title={ajoutables.length === 0 ? "Tous les membres de l'espace sont déjà sur le tableau" : "Ajouter un membre"}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              marginLeft: participants.length ? -6 : 0,
              border: "2px dashed #9aa4bd",
              background: "var(--collab-panel, #fff)",
              color: "#5a6478",
              fontSize: 15,
              lineHeight: "22px",
              cursor: ajoutables.length === 0 ? "not-allowed" : "pointer",
              padding: 0,
            }}
          >
            +
          </button>
        )}
      </div>
      {err && <span style={{ fontSize: 11, color: "#c0392b" }}>{err}</span>}
      {menuOpen && peutGerer && (
        <div
          style={{
            position: "absolute",
            top: 34,
            right: 0,
            zIndex: 20,
            minWidth: 220,
            maxHeight: 260,
            overflowY: "auto",
            background: "var(--collab-panel, #fff)",
            border: "1px solid var(--collab-line, #e2e6ef)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,.16)",
            padding: 6,
          }}
        >
          <div className="muted" style={{ fontSize: 10, padding: "4px 8px" }}>Membres de l'espace à ajouter</div>
          {ajoutables.length === 0 && <div className="muted" style={{ fontSize: 12, padding: "6px 8px" }}>Aucun à ajouter.</div>}
          {ajoutables.map((m) => (
            <button
              key={m.membre_id}
              type="button"
              disabled={busy}
              onClick={() => {
                setMenuOpen(false);
                void agir(() => ajouterParticipantTableau(tableauId, m.membre_id));
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                border: "none",
                background: "transparent",
                padding: "7px 8px",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "#eef1f8", color: "#2a4fad", fontSize: 10, fontWeight: 700 }}>{m.initiales}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nom}</span>
              <span className="muted" style={{ fontSize: 10 }}>{m.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
