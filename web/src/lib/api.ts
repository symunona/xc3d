import type { SessionFlight, SessionMeta, Track } from "./types";

// Track-format cache-buster. A fingerprint→track mapping is immutable forever, so
// /api/flights/{fp}/track is cached `immutable` in the browser. If the track FORMAT ever
// changes (parse / precision / point layout), bump this: the client requests a different
// URL (?v=N), which the browser treats as a fresh cache entry, so stale immutable copies
// are never served. The server ignores the param.
export const TRACK_CACHE_V = 1;

// Non-OK HTTP → an Error carrying `.status`, like linkFlight/renameFlight below, so a
// caller can tell 404 (really gone) from 5xx (server had a bad day). A genuine NETWORK
// failure — offline, DNS, timeout — makes `fetch` REJECT instead, with a TypeError that
// has NO `.status`: that absence is how callers spot "we never reached the server".
function httpErr(r: Response, what: string): any {
  const err: any = new Error(`${what} (HTTP ${r.status})`);
  err.status = r.status;
  return err;
}

export async function createSession(): Promise<string> {
  const r = await fetch("/api/sessions", { method: "POST" });
  if (!r.ok) throw new Error("createSession failed");
  return (await r.json()).id;
}

// Room-load metadata: title + per-flight meta, NO tracks. Tiny + never cached (the flight
// list changes on upload). Tracks are fetched separately by fingerprint via getTrack().
export async function getSessionMeta(id: string): Promise<SessionMeta> {
  const r = await fetch(`/api/sessions/${id}`);
  if (!r.ok) throw httpErr(r, "session not found");
  return r.json();
}

// Fetch ONE flight's track by fingerprint. A plain fetch is all that's needed: the response
// is `Cache-Control: immutable`, so the browser's own HTTP cache reuses every already-seen
// track (reload, or a new upload alongside old flights) with zero network — only genuinely
// new fingerprints download. The ?v= token cache-busts on a track-format change.
export async function getTrack(fp: string): Promise<Track> {
  const r = await fetch(`/api/flights/${fp}/track?v=${TRACK_CACHE_V}`);
  if (!r.ok) throw httpErr(r, "track not found: " + fp);
  return r.json();
}

// Upload ONE .igc as a single multipart POST to the SAME endpoint the old multi-file path
// used — the backend loops 1..N files, here N==1. We use XMLHttpRequest (not fetch) so we
// can report upload BYTE progress via onUpProgress: that's the "uploading" phase. When the
// bytes are all sent (onUpProgress fires with 1) the request is simply awaiting the server's
// parse→store→link response — the caller reads that frac>=1 gap as the "processing" phase.
// Resolves to the server's `added` array: 1 element when linked, 0 when the track was
// already in this room or failed to parse (same silent-drop semantics as before).
export function uploadFlight(
  id: string,
  file: File,
  name: string,
  color: string,
  onUpProgress?: (frac: number) => void,
): Promise<SessionFlight[]> {
  const fd = new FormData();
  // form-level fallbacks (server tries: per-row name > parsed pilot > this name). The row
  // name is already pre-filled from the .igc pilot (or the profile) at pick() time, so
  // sending it for both the row entry and the form fallback preserves the old behaviour.
  fd.append("name", name);
  fd.append("color", color);
  fd.append("files", file, file.name);
  fd.append("names", name);
  fd.append("colors", color);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/sessions/${id}/flights`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total) onUpProgress?.(e.loaded / e.total);
    };
    xhr.upload.onload = () => onUpProgress?.(1); // all bytes sent → "processing" begins
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve((JSON.parse(xhr.responseText).added ?? []) as SessionFlight[]);
        } catch (e) {
          reject(e);
        }
      } else {
        const err: any = new Error("upload failed: " + xhr.responseText);
        err.status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error("upload failed (network error)"));
    xhr.send(fd);
  });
}

// Re-add an already-uploaded flight (by fingerprint) to a room without the file.
// Throws with a `.status` so callers can distinguish 404 (need file) / 409 (dup).
export async function linkFlight(
  id: string,
  fingerprint: string,
  name: string,
  color: string,
): Promise<SessionFlight[]> {
  const r = await fetch(`/api/sessions/${id}/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fingerprint, name, color }),
  });
  if (!r.ok) {
    const err: any = new Error(await r.text());
    err.status = r.status;
    throw err;
  }
  return (await r.json()).added;
}

// Rename a flight's per-room display name by fingerprint. PATCHes the new name; the
// server broadcasts `flight_renamed` so every other viewer relabels the pilot live.
// Throws with a `.status` (400 blank / 404 not in room) so callers can react, like linkFlight.
export async function renameFlight(
  id: string,
  fingerprint: string,
  name: string,
): Promise<{ fingerprint: string; name: string }> {
  const r = await fetch(`/api/sessions/${id}/flights/${fingerprint}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) {
    const err: any = new Error(await r.text());
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// Rename a room's human-readable display title. PATCHes the whole session (NOT a flight);
// the server broadcasts `room_renamed` so every other viewer updates its title header live.
// A blank title is allowed and clears the label back to the room code. Throws with a
// `.status` (404 no such room) so callers can react, like renameFlight.
export async function renameSession(
  id: string,
  title: string,
): Promise<{ id: string; title: string }> {
  const r = await fetch(`/api/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!r.ok) {
    const err: any = new Error(await r.text());
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// Remove a flight from a room by fingerprint. The server keeps the archived .igc and
// the global flight record — only this room's link is dropped — so it can be re-added
// later. A 404 means it was already gone, which we treat as success (idempotent).
export async function removeFlight(id: string, fingerprint: string): Promise<void> {
  const r = await fetch(`/api/sessions/${id}/flights/${fingerprint}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404) throw new Error("remove failed: " + (await r.text()));
}

export function roomWS(id: string, onMsg: (m: any) => void): WebSocket {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/api/sessions/${id}/ws`);
  ws.onmessage = (e) => {
    try { onMsg(JSON.parse(e.data)); } catch {}
  };
  return ws;
}
