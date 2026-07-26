import type { Track } from "./types";
import { haversine, idxAtTime } from "./geo";

// Project lat/lon to local planar meters (equirectangular around a ref point).
function toXY(pts: Array<[number, number]>): Array<[number, number]> {
  if (pts.length === 0) return [];
  const lat0 = pts[0][0] * Math.PI / 180;
  const mPerDegLat = 111132;
  const mPerDegLon = 111320 * Math.cos(lat0);
  return pts.map(([la, lo]) => [lo * mPerDegLon, la * mPerDegLat]);
}

function cross(o: number[], a: number[], b: number[]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

// Andrew's monotone chain convex hull.
function convexHull(pts: Array<[number, number]>): Array<[number, number]> {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower: any[] = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: any[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

// "Fair" free triangle: max-perimeter triangle over the track flown so far.
// Vertices of the optimum lie on the convex hull → cheap brute over hull points.
// Returns {distKm, tps:[[lat,lon],...]}.
export function freeTriangle(track: Track, tNow: number): { distKm: number; tps: Array<[number, number]> } {
  const end = idxAtTime(track, tNow);
  if (end < 2) return { distKm: 0, tps: [] };

  // downsample to keep hull cheap
  const step = Math.max(1, Math.floor(end / 400));
  const latlon: Array<[number, number]> = [];
  for (let i = 0; i <= end; i += step) latlon.push([track[i][1], track[i][2]]);

  const hull = convexHull(toXY(latlon));
  // map hull xy back is annoying; instead brute over hull in latlon space using haversine.
  // Recompute hull on latlon indices: build hull of projected, but we need latlon of hull pts.
  const xy = toXY(latlon);
  const hullIdx: number[] = [];
  {
    // rebuild with index tracking
    const idx = xy.map((p, i) => ({ p, i })).sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1]);
    const lower: any[] = [], upper: any[] = [];
    for (const e of idx) {
      while (lower.length >= 2 && cross(lower[lower.length - 2].p, lower[lower.length - 1].p, e.p) <= 0) lower.pop();
      lower.push(e);
    }
    for (let i = idx.length - 1; i >= 0; i--) {
      const e = idx[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2].p, upper[upper.length - 1].p, e.p) <= 0) upper.pop();
      upper.push(e);
    }
    lower.pop(); upper.pop();
    for (const e of lower.concat(upper)) hullIdx.push(e.i);
  }

  const H = hullIdx;
  if (H.length < 3) return { distKm: 0, tps: [] };
  let best = 0, ba = 0, bb = 0, bc = 0;
  const d = (i: number, j: number) =>
    haversine(latlon[i][0], latlon[i][1], latlon[j][0], latlon[j][1]);
  for (let a = 0; a < H.length; a++) {
    for (let b = a + 1; b < H.length; b++) {
      const dab = d(H[a], H[b]);
      for (let c = b + 1; c < H.length; c++) {
        const per = dab + d(H[b], H[c]) + d(H[a], H[c]);
        if (per > best) { best = per; ba = H[a]; bb = H[b]; bc = H[c]; }
      }
    }
  }
  return {
    distKm: best / 1000,
    tps: [latlon[ba], latlon[bb], latlon[bc]],
  };
}

// Straight-line distance from launch to current position (km).
export function distFromStart(track: Track, curLat: number, curLon: number): number {
  return haversine(track[0][1], track[0][2], curLat, curLon) / 1000;
}
