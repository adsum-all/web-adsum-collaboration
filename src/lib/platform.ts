// Detect the broadcast platform from a URL so a link shows its name and brand
// colour. Same rules as the back office (adsum-back-office/src/platform.ts) and the
// member app, so every app shows the same platform labels/icons.

export interface PlatformInfo {
  key: string;
  label: string;
  color: string;
}

const YOUTUBE: PlatformInfo = { key: "youtube", label: "YouTube", color: "#FF0000" };
const VIMEO: PlatformInfo = { key: "vimeo", label: "Vimeo", color: "#1AB7EA" };
const FACEBOOK: PlatformInfo = { key: "facebook", label: "Facebook", color: "#1877F2" };
const ZOOM: PlatformInfo = { key: "zoom", label: "Zoom", color: "#2D8CFF" };
const TELEGRAM: PlatformInfo = { key: "telegram", label: "Telegram", color: "#2AABEE" };
const WHATSAPP: PlatformInfo = { key: "whatsapp", label: "WhatsApp", color: "#25D366" };
const MEET: PlatformInfo = { key: "meet", label: "Google Meet", color: "#00897B" };
const TEAMS: PlatformInfo = { key: "teams", label: "Microsoft Teams", color: "#6264A7" };
const EXTERNE: PlatformInfo = { key: "autre", label: "Lien externe", color: "#64748b" };

/** Map a URL host to a broadcast platform. Returns the "Lien externe" fallback when
 * the URL cannot be parsed or does not match a known platform. */
export function detectPlatform(url: string): PlatformInfo {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return EXTERNE;
  }
  if (host === "youtube.com" || host === "youtu.be") return YOUTUBE;
  if (host === "vimeo.com" || host === "player.vimeo.com") return VIMEO;
  if (host === "facebook.com" || host === "fb.watch" || host === "fb.com") return FACEBOOK;
  if (host.endsWith("zoom.us") || host.endsWith("zoom.com")) return ZOOM;
  if (host === "t.me" || host.endsWith("telegram.org")) return TELEGRAM;
  if (host === "wa.me" || host.endsWith("whatsapp.com")) return WHATSAPP;
  if (host === "meet.google.com") return MEET;
  if (host.endsWith("teams.microsoft.com") || host.endsWith("teams.live.com")) return TEAMS;
  return EXTERNE;
}
