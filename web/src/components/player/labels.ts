// Named, terrain-fixed MAP LABELS (annotations dropped on the map). PURELY CLIENT-SIDE:
// there is NO server involvement — a room's labels live in localStorage, keyed by the room
// id, so each room keeps its own set locally in this browser (like the per-room view/pos
// prefs in viewPrefs.ts). Sharing between rooms / people is JSON export ↔ import, below.

export interface MapLabel {
  id: number; // client-local id, unique within a room's set (re-minted on import)
  name: string;
  lon: number;
  lat: number;
}

const LABELS_PREFIX = "xc3d.labels.";
// Per-USER global set. Labels are "universal per user": a fresh/never-seen room opens
// pre-populated with everything you've ever labelled, and every per-room save keeps this set
// growing. Rooms still store their OWN set (so you can prune a room without touching others).
const USER_LABELS_KEY = "xc3d.labels.user";

function isLabelish(l: any): boolean {
  return l && typeof l.name === "string" && Number.isFinite(+l.lon) && Number.isFinite(+l.lat);
}

function parseLabels(raw: string | null): MapLabel[] {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(isLabelish)
      .map((l: any) => ({ id: Number(l.id) || 0, name: String(l.name), lon: +l.lon, lat: +l.lat }));
  } catch {
    return [];
  }
}

// identity for de-duping across rooms: name + rounded coords (labels are terrain-fixed).
const dedupeKey = (l: { name: string; lat: number; lon: number }) =>
  `${l.name}|${l.lat.toFixed(5)}|${l.lon.toFixed(5)}`;

function readUserLabels(): MapLabel[] {
  try { return parseLabels(localStorage.getItem(USER_LABELS_KEY)); } catch { return []; }
}

// Grow the per-user global set (union, de-duped) with whatever a room currently holds. Called
// on every per-room save, so just visiting/editing rooms accumulates the universal set. Ids
// are re-minted so the global set is self-consistent.
function mergeIntoUserLabels(labels: MapLabel[]): void {
  try {
    const seen = new Map<string, MapLabel>();
    for (const l of readUserLabels()) seen.set(dedupeKey(l), l);
    for (const l of labels) { const k = dedupeKey(l); if (!seen.has(k)) seen.set(k, l); }
    let i = 1;
    const merged = [...seen.values()].map((l) => ({ id: i++, name: l.name, lon: l.lon, lat: l.lat }));
    localStorage.setItem(USER_LABELS_KEY, JSON.stringify(merged));
  } catch {
    /* private mode / quota — the global set just won't grow */
  }
}

// This room's stored labels. A NEVER-SEEN room (no stored key at all) is seeded from the
// per-user global set — new rooms open pre-populated. A room that has been saved before
// (even to an empty []) keeps its own set: no re-seed, so pruning a room sticks.
export function loadLabels(roomId: string): MapLabel[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LABELS_PREFIX + roomId); } catch { raw = null; }
  if (raw === null) {
    // seed from the global set, re-minting ids into this room's local id space
    return readUserLabels().map((l, i) => ({ id: i + 1, name: l.name, lon: l.lon, lat: l.lat }));
  }
  return parseLabels(raw);
}

export function saveLabels(roomId: string, labels: MapLabel[]): void {
  try {
    localStorage.setItem(LABELS_PREFIX + roomId, JSON.stringify(labels));
  } catch {
    /* private mode / quota — labels just won't persist */
  }
  mergeIntoUserLabels(labels); // keep the universal per-user set growing
}

// ── sharing: JSON export ↔ import (replaces any server round-trip) ──────────
// Export a portable document: a small header + the labels (id dropped — ids are re-minted
// on import so two people's sets never collide). Pretty-printed for a readable .json file.
export function labelsToJSON(roomId: string, labels: MapLabel[]): string {
  return JSON.stringify(
    {
      kind: "xc3d-labels",
      version: 1,
      room: roomId,
      labels: labels.map((l) => ({ name: l.name, lon: l.lon, lat: l.lat })),
    },
    null,
    2,
  );
}

// Parse an exported document (or a bare labels array) into coordinate/name records. Ids are
// (re-)assigned by the caller on merge/replace. Throws on malformed input so the caller can
// surface a clear error.
export function labelsFromJSON(text: string): { name: string; lon: number; lat: number }[] {
  const doc = JSON.parse(text);
  const arr = Array.isArray(doc) ? doc : doc?.labels;
  if (!Array.isArray(arr)) throw new Error("not a labels document");
  const out = arr
    .filter(isLabelish)
    .map((l: any) => ({ name: String(l.name), lon: +l.lon, lat: +l.lat }));
  if (!out.length) throw new Error("no valid labels found");
  return out;
}
