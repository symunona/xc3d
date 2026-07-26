// Rooms this browser has visited — persisted so they show on the home screen.
export interface RoomRec {
  id: string;
  ts: number;      // last visited
  flights: number; // last-seen flight count
  name?: string;   // last-seen human-readable room title (falls back to `id` when blank)
}

const KEY = "xc3d:rooms";
const CAP = 30;

export function getRooms(): RoomRec[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as RoomRec[]) : [];
    return arr.sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

// Upsert a room (bump timestamp + flight count + optional title), newest first, capped.
// name semantics: undefined → keep the title we last stored (plain revisit, don't clobber);
// "" → explicit clear (a live rename back to blank); non-empty → set.
export function recordRoom(id: string, flights: number, name?: string) {
  const prev = getRooms().find((r) => r.id === id);
  const all = getRooms().filter((r) => r.id !== id);
  const title = name === undefined ? prev?.name : name.trim() || undefined;
  all.unshift({ id, ts: Date.now(), flights, ...(title ? { name: title } : {}) });
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, CAP)));
  } catch {}
}

// Forget a room from this browser's list. Local-only: the room + its tracklogs
// stay on the server, this just drops it from the home-screen history.
export function forgetRoom(id: string) {
  const all = getRooms().filter((r) => r.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export function relTime(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
