interface TopbarProps {
  crumb: string;
  title: string;
  onOpenSearch?: () => void;
  onOpenMenu?: () => void;
  right?: JSX.Element;
}

export function Topbar({ crumb, title, onOpenSearch, onOpenMenu, right }: Readonly<TopbarProps>): JSX.Element {
  return (
    <header className="topbar-app">
      {onOpenMenu && (
        <button type="button" className="topbar-burger" onClick={onOpenMenu} aria-label="Ouvrir le menu" title="Menu">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      )}
      <div className="topbar-title">
        <p className="topbar-crumb">{crumb}</p>
        <h1 className="topbar-h1">{title}</h1>
      </div>
      <button
        type="button"
        className="search-global search-global-btn"
        onClick={() => onOpenSearch?.()}
        aria-label="Ouvrir la recherche globale"
      >
        <span className="search-ico" aria-hidden="true">⌕</span>
        <span className="search-placeholder">Rechercher un espace, un tableau, une carte</span>
        <kbd className="kbd kbd-sm">Ctrl K</kbd>
      </button>
      {right}
    </header>
  );
}

