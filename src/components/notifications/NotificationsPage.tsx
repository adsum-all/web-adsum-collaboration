import { useEffect, useState } from "react";

import { listNotifications, marquerNotifLue, marquerToutesNotifsLues } from "../../lib/store.js";
import type { Notification } from "../../lib/types.js";
import { EmptyState } from "../common/EmptyState.js";

interface Props {
  onOuvrirEspace: (id: string) => void;
}

export function NotificationsPage({ onOuvrirEspace }: Props): JSX.Element {
  const [notifs, setNotifs] = useState<Notification[]>([]);

  const reload = (): void => { void listNotifications().then(setNotifs); };
  useEffect(reload, []);

  const nonLues = notifs.filter((n) => !n.lue);

  return (
    <div className="page">
      <header className="page-head">
        <div className="row-between">
          <div>
            <h1>Notifications</h1>
            <p className="muted">{nonLues.length} non lue{nonLues.length > 1 ? "s" : ""} · {notifs.length} au total</p>
          </div>
          {nonLues.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={async () => { await marquerToutesNotifsLues(); reload(); }}>
              Tout marquer comme lu
            </button>
          )}
        </div>
      </header>

      {notifs.length === 0 && (
        <EmptyState titre="Aucune notification" description="Vous serez notifié lors des mentions, assignations et échéances." />
      )}

      <ul className="notif-list">
        {notifs.map((n) => (
          <li key={n.id} className={`notif-item${n.lue ? "" : " notif-item-neuve"}`}>
            <span className={`notif-pastille notif-pastille-${n.type}`} aria-hidden="true" />
            <div className="notif-corps">
              <p>{n.texte}</p>
              <span className="muted small">{new Date(n.cree_le).toLocaleString("fr-FR")}</span>
            </div>
            <div className="notif-actions">
              {n.espace_id && (
                <button type="button" className="btn btn-ghost btn-inline" onClick={() => onOuvrirEspace(n.espace_id!)}>
                  Ouvrir
                </button>
              )}
              {!n.lue && (
                <button type="button" className="btn btn-ghost btn-inline" onClick={async () => { await marquerNotifLue(n.id); reload(); }}>
                  Marquer lu
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
