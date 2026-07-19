import { useEffect, useMemo, useState } from "react";

import { type OrgLien, type OrgNoeud, type OrganigrammePublie, getOrganigrammePublie } from "../../lib/store.js";

interface Noeud extends OrgNoeud {
  enfants: Noeud[];
}

/** Build the hierarchical tree from the published nodes and hierarchical links. */
function construireArbre(noeuds: OrgNoeud[], liens: OrgLien[]): Noeud[] {
  const map = new Map<string, Noeud>();
  for (const n of noeuds) map.set(n.id, { ...n, enfants: [] });
  const aParent = new Set<string>();
  for (const l of liens) {
    const parent = map.get(l.source_id);
    const enfant = map.get(l.cible_id);
    if (parent && enfant) {
      parent.enfants.push(enfant);
      aParent.add(enfant.id);
    }
  }
  return [...map.values()].filter((n) => !aParent.has(n.id));
}

function Carte({ n, niveau }: Readonly<{ n: Noeud; niveau: number }>): JSX.Element {
  const [ouvert, setOuvert] = useState(niveau < 2);
  const aEnfants = n.enfants.length > 0;
  return (
    <div style={{ marginLeft: niveau === 0 ? 0 : 18, borderLeft: niveau === 0 ? "none" : "1px solid var(--adsum-line)", paddingLeft: niveau === 0 ? 0 : 12, marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--adsum-line)", borderRadius: 10, background: "var(--adsum-panel)", borderLeft: `4px solid ${n.couleur || "var(--adsum-acc)"}` }}>
        {aEnfants && (
          <button type="button" onClick={() => setOuvert((o) => !o)} aria-label={ouvert ? "Replier" : "Deplier"}
            style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--adsum-line)", background: "var(--adsum-bg)", cursor: "pointer", flexShrink: 0, fontWeight: 700 }}>
            {ouvert ? "-" : "+"}
          </button>
        )}
        {n.photo_url && <img src={n.photo_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{n.nom || n.membre_nom || "Sans nom"}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>
            {[n.sous_titre, n.membre_nom && n.membre_nom !== n.nom ? n.membre_nom : null, n.effectif ? `${n.effectif} membre(s)` : null].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      {aEnfants && ouvert && n.enfants.map((e) => <Carte key={e.id} n={e} niveau={niveau + 1} />)}
    </div>
  );
}

/**
 * Read-only consultation of the published organisation chart inside collaboration,
 * so collaborators can verify who holds which responsibility and how units relate.
 * A collapsible hierarchical tree (never editable here; editing stays in the back
 * office). Reaches the shared ``GET /organigramme/publie`` endpoint.
 */
export function OrganigrammeView(): JSX.Element {
  const [data, setData] = useState<OrganigrammePublie | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    void getOrganigrammePublie().then(setData).catch((e) => setErr(e instanceof Error ? e.message : "Erreur"));
  }, []);

  const arbre = useMemo(() => (data ? construireArbre(data.noeuds, data.liens) : []), [data]);
  const filtres = useMemo(() => {
    if (!q.trim() || !data) return null;
    const t = q.toLowerCase();
    return data.noeuds.filter((n) => `${n.nom ?? ""} ${n.membre_nom ?? ""} ${n.sous_titre ?? ""}`.toLowerCase().includes(t));
  }, [q, data]);

  if (err) return <div className="page"><p className="small" style={{ color: "var(--adsum-danger)" }}>{err}</p></div>;
  if (!data) return <div className="page"><p className="muted">Chargement de l'organigramme...</p></div>;

  return (
    <div className="page" style={{ maxWidth: 820, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Organigramme hiérarchique</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          {data.version ? `Version publiée : ${data.version.libelle}. ` : ""}Consultation seule. La modification se fait dans le back-office.
        </p>
      </header>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une personne, une fonction, une unité"
        style={{ width: "100%", height: 38, borderRadius: 9, border: "1px solid var(--adsum-line)", padding: "0 12px", fontSize: 13.5, marginBottom: 12 }} />

      {!data.version || data.noeuds.length === 0 ? (
        <p className="muted">Aucun organigramme publié pour le moment.</p>
      ) : filtres ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p className="muted small">{filtres.length} résultat(s)</p>
          {filtres.map((n) => (
            <div key={n.id} style={{ padding: "8px 10px", border: "1px solid var(--adsum-line)", borderRadius: 10, background: "var(--adsum-panel)", borderLeft: `4px solid ${n.couleur || "var(--adsum-acc)"}` }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{n.nom || n.membre_nom}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{[n.sous_titre, n.membre_nom].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
      ) : (
        arbre.map((r) => <Carte key={r.id} n={r} niveau={0} />)
      )}
    </div>
  );
}
