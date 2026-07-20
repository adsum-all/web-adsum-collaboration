import { useEffect, useState } from "react";

import { type OrgContenu, type OrgContenuPublie, type OrgNode } from "../../api.js";
import { getOrganigrammePublie } from "../../lib/store.js";
import { OrgCanvas } from "./OrgCanvas.js";
import { OrgDetailPanel } from "./OrgDetailPanel.js";
import "./organigramme-badges.css";

/**
 * Collaboration read-only view of the PUBLISHED organisation chart. It renders the
 * exact same React-Flow tree as the back office (same OrgCanvas engine, nodes, links,
 * colours and legend), in consultation mode: zoom, pan, search, fit and collapse are
 * available, nothing can be edited. Editing happens only in the back office.
 */
export function OrganigrammeView(): JSX.Element {
  const [data, setData] = useState<OrgContenuPublie | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailNode, setDetailNode] = useState<OrgNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [centerToken, setCenterToken] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getOrganigrammePublie()
      .then((d) => alive && setData(d as unknown as OrgContenuPublie))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="page" style={{ padding: 16 }}><p className="muted">Chargement de l'organigramme...</p></div>;
  if (error) return <div className="page" style={{ padding: 16 }}><p className="muted">{error}</p></div>;

  const publieLe = data?.version?.publie_le ? new Date(data.version.publie_le).toLocaleDateString("fr-FR") : null;

  return (
    <div className="page" style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Organigramme publié</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          Consultez la structure officielle publiée de l'organisation.{publieLe ? ` Publié le ${publieLe}.` : ""} Consultation seule : la modification se fait dans le back-office.
        </p>
      </header>

      {!data || !data.version ? (
        <p className="muted">Aucun organigramme publié pour le moment.</p>
      ) : (
        <div style={{ position: "relative", height: "min(76vh, 720px)", border: "1px solid var(--adsum-line)", borderRadius: 14, overflow: "hidden", background: "var(--adsum-panel)" }}>
          <OrgCanvas
            contenu={data as OrgContenu}
            mode="consultation"
            onSelectNode={(n) => { setDetailNode(n); setSelectedId(n.id); }}
            selectedNodeId={selectedId}
            centerToken={centerToken}
          />
          {detailNode ? (
            <OrgDetailPanel
              node={detailNode}
              stats={null}
              canEdit={false}
              onClose={() => setDetailNode(null)}
              onCenter={() => setCenterToken((t) => t + 1)}
              onEdit={() => undefined}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
