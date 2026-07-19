// Display theme for the collaboration app. The CSS already reacts to data-theme (tokens.css)
// and falls back to the OS preference when no attribute is set, so "system" simply removes
// the attribute. The choice is cached locally for an instant boot and pushed to the server
// (setThemePref) so it follows the member across every app.
export type Theme = "light" | "dark" | "system";

const CLE = "adsum.collab.theme";

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
}

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(CLE);
    return v === "dark" || v === "light" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

export function saveTheme(theme: Theme): void {
  try { localStorage.setItem(CLE, theme); } catch { /* storage unavailable */ }
}

// Call once at boot (main.tsx) to apply the persisted choice before the first paint.
export function initTheme(): void {
  applyTheme(loadTheme());
}
