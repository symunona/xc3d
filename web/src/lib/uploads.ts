// Cross-session history of flights this browser has uploaded (by fingerprint = id).
export interface UploadRec {
  fingerprint: string;
  filename: string;
  name: string;
  color: string;
  date: string;
  duration: number;
  sessionId: string;
  ts: number;
}

const KEY = "xc3d:uploads";
const CAP = 50;

export function getUploads(): UploadRec[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as UploadRec[]) : [];
  } catch {
    return [];
  }
}

// Append (or refresh) a record; newest first, deduped by fingerprint, capped.
export function recordUpload(rec: UploadRec) {
  const all = getUploads().filter((u) => u.fingerprint !== rec.fingerprint);
  all.unshift(rec);
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, CAP)));
  } catch {}
}
