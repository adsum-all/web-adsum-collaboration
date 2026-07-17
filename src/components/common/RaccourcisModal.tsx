interface Props {
  onClose: () => void;
}

const RACCOURCIS: Array<{ touche: string; description: string }> = [
  { touche: "Ctrl / ⌘ + K", description: "Ouvrir la recherche globale" },
  { touche: "/", description: "Focus barre de recherche" },
  { touche: "?", description: "Afficher cette aide" },
  { touche: "Esc", description: "Fermer une fenêtre" },
  { touche: "N", description: "Nouvelle carte (dans un tableau)" },
  { touche: "↑ ↓ Entrée", description: "Naviguer dans les résultats" },
];

export function RaccourcisModal({ onClose }: Props): JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-label="Raccourcis clavier">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <header className="modal-head">
          <h2>Raccourcis clavier</h2>
          <button type="button" className="btn btn-ghost btn-inline" onClick={onClose} aria-label="Fermer">×</button>
        </header>
        <ul className="mini-list">
          {RACCOURCIS.map((r) => (
            <li key={r.touche}>
              <span>{r.description}</span>
              <kbd className="kbd">{r.touche}</kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
