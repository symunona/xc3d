import type { Track, TrackPt } from "./types";

const R = 6371000; // earth radius m

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r;
  const dLon = (lon2 - lon1) * d2r;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Interpolate a track at relative time t → [lat, lon, alt, palt]; index cache optional.
export function sampleTrack(track: Track, t: number): [number, number, number, number] {
  if (track.length === 0) return [0, 0, 0, 0];
  if (t <= track[0][0]) { const p = track[0]; return [p[1], p[2], p[3], p[4]]; }
  const last = track[track.length - 1];
  if (t >= last[0]) return [last[1], last[2], last[3], last[4]];
  // binary search
  let lo = 0, hi = track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid][0] <= t) lo = mid; else hi = mid;
  }
  const a = track[lo], b = track[hi];
  const span = b[0] - a[0] || 1;
  const f = (t - a[0]) / span;
  return [
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
    a[3] + (b[3] - a[3]) * f,
    a[4] + (b[4] - a[4]) * f,
  ];
}

// Index of last point with t <= playhead (for "points flown so far").
export function idxAtTime(track: Track, t: number): number {
  let lo = 0, hi = track.length - 1;
  if (t <= track[0][0]) return 0;
  if (t >= track[hi][0]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid][0] <= t) lo = mid; else hi = mid;
  }
  return lo;
}
