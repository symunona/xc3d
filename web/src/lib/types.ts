// Track point: [t (relative seconds), lat, lon, gpsAlt (m), pressAlt (m)]
export type TrackPt = [number, number, number, number, number];
export type Track = TrackPt[];

export interface Flight {
  fingerprint: string;
  filename: string;
  pilot: string;
  date: string;
  launchEpoch: number;
  launch: [number, number, number]; // lat, lon, alt
  duration: number;
  track: Track;
}

export interface SessionFlight extends Flight {
  name: string;
  color: string;
}

// A flight's metadata WITHOUT its (multi-MB) track — what the room list carries before
// each track is fetched separately by fingerprint and cached immutably in the browser.
export type FlightMeta = Omit<Flight, "track">;
export interface SessionFlightMeta extends FlightMeta {
  name: string;
  color: string;
}

export interface SessionData {
  id: string;
  title?: string; // optional human-readable room name; the `id` stays the immutable code
  flights: SessionFlight[];
}

// The room-load payload: title + per-flight metadata, no tracks (getSessionMeta).
export interface SessionMeta {
  id: string;
  title?: string;
  flights: SessionFlightMeta[];
}

// A single-file upload's live status. Room drives one of these per file through the
// phases below and renders them either as the blocking new-room progress screen
// (UploadProgress) or as non-blocking toasts over a live player (UploadToasts).
//   pending → uploading (byte progress) → processing (bytes sent, awaiting the server)
//   → done | skipped (already in room / not a valid .igc) | error
export type UploadPhase = "pending" | "uploading" | "processing" | "done" | "skipped" | "error";
export interface UploadJob {
  id: number;
  name: string; // display name (row name, falling back to the filename)
  color: string;
  filename: string;
  phase: UploadPhase;
  frac: number; // upload byte fraction 0..1 (meaningful in the "uploading" phase)
  message?: string; // reason, for skipped / error
}
