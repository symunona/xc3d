// Per-tracklog thermal detection.
//
// Distinct from lib/thermals.ts (the streamed WORLD point cloud of where OTHERS
// climbed). This one segments a SINGLE flown track into the thermals that pilot
// actually cored, so we can label enter/exit and show per-climb stats.
//
// The hard part is not counting one thermal as two. Naively marking every fix with
// vertical-speed > 0 shatters a real thermal into a dozen slivers, because half of
// each 360° turn is sink — you climb the up-wind side and sink the down-wind side,
// net positive. Two things fix that:
//
//   1. WINDOWED climb, not instantaneous. We measure the altitude change over a
//      ~24 s window centred on each fix (≈ one full turn), so the sink-half of a
//      circle never drags the signal negative inside a working thermal.
//   2. RE-CORE MERGE. Even so, you routinely fall out of the core, sink for a bit,
//      and re-centre — losing maybe 100 m before you find it again. That's ONE
//      thermal, not two. So we join two candidate runs across the gap between them
//      when the gap looks like a re-core rather than a real transition: short in
//      time, shallow in height given back, and local in ground displacement. Lose a
//      lot of height, drift far, or dawdle and it's a genuine glide to the next
//      thermal instead, so the two stay separate. Merging on altitude-loss (not just
//      a fixed time gap) is what stops one thermal being sliced by every tiny sink.
//
// Then we drop anything too short or too shallow to be a real climb (a glide bump).
// Time-contiguity — not spatial clustering — is the right axis: a paraglider drifts
// downwind with the air mass but stays in the same core, so the core moves over the
// ground while the climb stays one continuous stretch of time.

import type { Track } from "./types";
import { haversine } from "./geo";

export interface Thermal {
  i0: number; // track index of entry (base)
  i1: number; // track index of exit (top)
  t0: number; // entry time, relative seconds
  t1: number; // exit time, relative seconds
  dur: number; // t1 - t0, seconds
  alt0: number; // entry altitude, m
  alt1: number; // exit altitude, m
  gain: number; // alt1 - alt0, m (net)
  avgClimb: number; // gain / dur, m/s
  maxClimb: number; // peak windowed climb inside the thermal, m/s
  turns: number; // cumulative heading change / 360
  entryLat: number;
  entryLon: number;
  exitLat: number;
  exitLon: number;
}

// tuning — deliberately forgiving so a scrappy climb still registers as one thermal
const HALF_WIN = 12; // ± seconds for the windowed climb (~24 s ≈ one turn)
const CLIMB_MIN = 0.4; // m/s windowed climb to count a fix as "climbing"
// Re-core merge (replaces the old pure-time GAP_MERGE). Join two climb runs when the
// gap between them is you losing the core and re-centring, not a glide away. ALL three
// must hold for a merge; break any one and it's a real transition:
const GAP_MAX_TIME = 90; // s — gap longer than this is a glide, not a re-core
const GAP_MAX_LOSS = 120; // m — give back more height than this before re-climbing → separate thermals
const GAP_MAX_DIST = 2000; // m — drift/travel farther than this between climbs → a glide, not a re-core
const MIN_DUR = 30; // s — drop climbs shorter than this
const MIN_GAIN = 30; // m — drop climbs shallower than this

// altitude of a fix (GPS altitude; index 4 is pressure alt) — matches the rest of the app
const altOf = (p: Track[number]) => p[3];

// initial bearing from a→b in degrees (−180..180)
function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const d2r = Math.PI / 180;
  const dLon = (lon2 - lon1) * d2r;
  const y = Math.sin(dLon) * Math.cos(lat2 * d2r);
  const x =
    Math.cos(lat1 * d2r) * Math.sin(lat2 * d2r) -
    Math.sin(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}
// shortest signed angle from a→b, wrapped to (−180..180]
const turnDelta = (a: number, b: number) => (((b - a) % 360) + 540) % 360 - 180;

// windowed vertical speed per fix — altitude change over the ± HALF_WIN window
// (two-pointer sweep, O(n)). Smoothing over ≈ one turn is what lets both climb and
// sink read as sustained rates instead of GPS-altitude noise.
function windowedVs(track: Track): number[] {
  const n = track.length;
  const vs = new Array<number>(n);
  let lo = 0,
    hi = 0;
  for (let i = 0; i < n; i++) {
    const ti = track[i][0];
    while (track[lo][0] < ti - HALF_WIN) lo++;
    while (hi < n - 1 && track[hi + 1][0] <= ti + HALF_WIN) hi++;
    const dt = track[hi][0] - track[lo][0];
    vs[i] = dt > 0 ? (altOf(track[hi]) - altOf(track[lo])) / dt : 0;
  }
  return vs;
}

export function detectThermals(track: Track): Thermal[] {
  const n = track.length;
  if (n < 4) return [];

  // ── 1. windowed climb per fix ──
  const vs = windowedVs(track);

  // ── 2. contiguous runs of "climbing" fixes ──
  const runs: [number, number][] = [];
  let s = -1;
  for (let i = 0; i < n; i++) {
    if (vs[i] > CLIMB_MIN) {
      if (s < 0) s = i;
    } else if (s >= 0) {
      runs.push([s, i - 1]);
      s = -1;
    }
  }
  if (s >= 0) runs.push([s, n - 1]);

  // ── 3. join runs across a re-core gap (lost the core, gave back a little, re-cored) ──
  // The gap is a re-core (→ merge) only if it's short in time AND shallow in height
  // given back AND local in displacement. Any one broken → it's a real glide, keep split.
  const merged: [number, number][] = [];
  for (const r of runs) {
    const prev = merged[merged.length - 1];
    if (prev) {
      const a = track[prev[1]],
        b = track[r[0]];
      const gapDt = b[0] - a[0];
      const gapLoss = altOf(a) - altOf(b); // net height given back before re-climbing
      const gapDist = haversine(a[1], a[2], b[1], b[2]); // straight-line core displacement
      if (gapDt < GAP_MAX_TIME && gapLoss < GAP_MAX_LOSS && gapDist < GAP_MAX_DIST) {
        prev[1] = r[1];
        continue;
      }
    }
    merged.push([r[0], r[1]]);
  }

  // ── 4. per-thermal stats + drop the bumps ──
  const out: Thermal[] = [];
  for (const [i0, i1] of merged) {
    const p0 = track[i0],
      p1 = track[i1];
    const t0 = p0[0],
      t1 = p1[0],
      dur = t1 - t0;
    const alt0 = altOf(p0),
      alt1 = altOf(p1),
      gain = alt1 - alt0;
    if (dur < MIN_DUR || gain < MIN_GAIN) continue;

    let maxClimb = 0;
    for (let i = i0; i <= i1; i++) if (vs[i] > maxClimb) maxClimb = vs[i];

    let cum = 0;
    let prevB = bearing(track[i0][1], track[i0][2], track[i0 + 1][1], track[i0 + 1][2]);
    for (let i = i0 + 1; i < i1; i++) {
      const b = bearing(track[i][1], track[i][2], track[i + 1][1], track[i + 1][2]);
      cum += turnDelta(prevB, b);
      prevB = b;
    }

    out.push({
      i0, i1, t0, t1, dur, alt0, alt1, gain,
      avgClimb: gain / dur,
      maxClimb,
      turns: Math.abs(cum) / 360,
      entryLat: p0[1], entryLon: p0[2],
      exitLat: p1[1], exitLon: p1[2],
    });
  }
  return out;
}

export interface Glide {
  i0: number;
  i1: number;
  t0: number; // start time, relative seconds
  t1: number; // end time, relative seconds
  dur: number;
  alt0: number; // start altitude, m
  alt1: number; // end altitude, m
  lost: number; // altitude lost, m (alt0 - alt1; negative if the glide net-gained)
  distKm: number; // ground path distance flown
  avgSink: number; // m/s, positive = sinking (lost / dur)
  maxSink: number; // m/s magnitude, peak windowed sink
  ld: number; // glide ratio: metres travelled per metre lost (Infinity if no net loss)
  speedKmh: number; // ground speed over the glide
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
}

const MIN_GLIDE_DUR = 20; // s — drop the momentary gaps between two turns of one thermal
const MIN_GLIDE_DIST = 300; // m

// Glides are the transitions BETWEEN thermals — plus the run from launch to the first
// climb and from the last climb to landing. They're the complement of detectThermals
// over the track. `thermals` MUST be detectThermals(track)'s output (sorted, disjoint).
export function detectGlides(track: Track, thermals: Thermal[]): Glide[] {
  const n = track.length;
  if (n < 4) return [];
  const vs = windowedVs(track);

  // index spans not covered by a thermal: [0→first.i0], [th.i1→next.i0]…, [last.i1→n-1]
  const spans: [number, number][] = [];
  let prev = 0;
  for (const th of thermals) {
    if (th.i0 > prev) spans.push([prev, th.i0]);
    prev = th.i1;
  }
  if (n - 1 > prev) spans.push([prev, n - 1]);

  const out: Glide[] = [];
  for (const [i0, i1] of spans) {
    const p0 = track[i0],
      p1 = track[i1];
    const t0 = p0[0],
      t1 = p1[0],
      dur = t1 - t0;
    let distM = 0;
    for (let i = i0; i < i1; i++) distM += haversine(track[i][1], track[i][2], track[i + 1][1], track[i + 1][2]);
    if (dur < MIN_GLIDE_DUR || distM < MIN_GLIDE_DIST) continue;
    let minVs = 0;
    for (let i = i0; i <= i1; i++) if (vs[i] < minVs) minVs = vs[i];
    const alt0 = altOf(p0),
      alt1 = altOf(p1),
      lost = alt0 - alt1;
    out.push({
      i0, i1, t0, t1, dur,
      alt0, alt1, lost,
      distKm: distM / 1000,
      avgSink: lost / dur,
      maxSink: -minVs, // minVs ≤ 0
      ld: lost > 0 ? distM / lost : Infinity,
      speedKmh: distM / 1000 / (dur / 3600),
      startLat: p0[1], startLon: p0[2], endLat: p1[1], endLon: p1[2],
    });
  }
  return out;
}

// mm:ss for a duration in seconds
export function fmtDur(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
