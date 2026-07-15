// Small shared media helpers for the moderator channel (recording + file reading).

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function pickMime(): string {
  const mr = (globalThis as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (mr && typeof mr.isTypeSupported === "function") {
    if (mr.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (mr.isTypeSupported("audio/webm")) return "audio/webm";
    if (mr.isTypeSupported("audio/mp4")) return "audio/mp4";
  }
  return "";
}

export function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
