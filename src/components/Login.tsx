import { useState } from "react";

import { ApiError, type Session, getMesPermissions, login, loginVerify } from "../api.js";
import { useMarque } from "../useMarque.js";
import { PasswordInput } from "./PasswordInput.js";

interface LoginProps {
  onAuth: (session: Session) => void;
}

// Access is gated by the collaboration permission, not by a hard-coded role: any
// account the admin team granted collaboration access (via a role or a specialized
// group) may sign in. The server still enforces every endpoint.
const REQUISE = "collaboration.superviser";

export function Login({ onAuth }: LoginProps): JSX.Element {
  const marque = useMarque();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [faireConfiance, setFaireConfiance] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [canal, setCanal] = useState<string | null>(null);
  const [alerteEmail, setAlerteEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finaliser(session: Session): Promise<void> {
    const perms = await getMesPermissions(session.token);
    if (!perms.includes(REQUISE)) {
      setError("Votre compte n'a pas encore accès à la collaboration. Contactez l'administration.");
      return;
    }
    onAuth(session);
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (otpRequired) {
        const session = await loginVerify(email, password, code.trim(), faireConfiance);
        await finaliser(session);
        return;
      }
      const result = await login(email, password);
      if (result.otpRequired) {
        setOtpRequired(true);
        setCanal(result.canal);
        setAlerteEmail(result.alerteEmail);
        return;
      }
      if (result.session) await finaliser(result.session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form onSubmit={submit} className="auth-card">
        <div className="brand brand-lg">
          <span className="brand-logo" aria-hidden="true">{marque.initiale}</span>
          <span className="brand-text">
            {marque.marque}
            <span className="brand-sub">Collaboration</span>
          </span>
        </div>

        {!otpRequired && (
          <>
            <label>
              <span>Courriel</span>
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              <span>Mot de passe</span>
              <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
          </>
        )}

        {otpRequired && (
          <>
            <p className="muted small">
              Un code de vérification vous a été envoyé{canal === "telegram" ? " sur Telegram" : " par courriel"}. Saisissez-le pour continuer.
            </p>
            {alerteEmail && <p className="banner banner-warn small">{alerteEmail}</p>}
            <label>
              <span>Code de vérification</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={faireConfiance} onChange={(e) => setFaireConfiance(e.target.checked)} />
              <span className="small">Faire confiance à cet appareil pendant 30 jours</span>
            </label>
          </>
        )}

        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Connexion..." : otpRequired ? "Valider le code" : "Se connecter"}
        </button>
        <p className="muted small center">Accès restreint, nominatif et supervisé.</p>
      </form>
    </div>
  );
}
