import { MATRICE, libelleRole } from "../../lib/permissions.js";
import type { RoleEspace } from "../../lib/types.js";

const ROLES: RoleEspace[] = ["proprietaire", "admin", "membre", "observateur"];

export function PermissionsMatrix(): JSX.Element {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Action</th>
            {ROLES.map((r) => (
              <th key={r}>{libelleRole(r)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRICE.map((row) => (
            <tr key={row.action}>
              <td>{row.libelle}</td>
              {ROLES.map((r) => {
                const ok = row.autorises.includes(r) || (row.depend_observateurs_commentent && r === "observateur");
                return (
                  <td key={r}>
                    <span className={`pastille ${ok ? "pastille-ok" : "pastille-off"}`} aria-label={ok ? "Autorisé" : "Refusé"} />
                    {row.depend_observateurs_commentent && r === "observateur" && (
                      <span className="muted small" style={{ marginLeft: 6 }}>selon réglage</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
