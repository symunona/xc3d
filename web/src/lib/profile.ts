// Room-load profiler. Records one timestamp per named mark, derives inter-phase
// durations, and logs a table when the load completes — so "why did the room take N
// seconds" has a concrete answer instead of a guess. Zero deps; also drops
// `performance.mark`s (visible in the DevTools Performance panel) alongside its own log.
//
// Timeline of a cold room open (see Room.tsx / Player.tsx for the mark sites):
//   boot  → the chunks + JS are already parsed; this is the first app code for the room
//   fetch → download the session JSON (bytes streamed, gzip on the wire)
//   parse → JSON.parse + build the flight objects
//   map:* → maplibre engine, base-map style, deck scene, per-flight geometry
//   ready → first interactive frame

export type ProfMark = { name: string; t: number; meta?: string };

let marks: ProfMark[] = [];
let reported = false;

// Begin a fresh timeline (call when a room mount starts). t0 is anchored here.
export function profStart(): void {
  marks = [{ name: "boot", t: now() }];
  reported = false;
}

// Record a phase boundary. First occurrence of a name wins (later dupes ignored), so
// idempotent effects don't smear the timeline. `meta` annotates the row (e.g. "6.0 MB").
export function profMark(name: string, meta?: string): void {
  if (!marks.length) profStart();
  if (marks.some((m) => m.name === name)) return;
  marks.push({ name, t: now(), meta });
  try {
    performance.mark("pr:" + name);
  } catch {}
}

// Phase durations between consecutive marks.
export function profPhases(): { phase: string; ms: number; meta?: string }[] {
  const out: { phase: string; ms: number; meta?: string }[] = [];
  for (let i = 1; i < marks.length; i++) {
    out.push({ phase: `${marks[i - 1].name}→${marks[i].name}`, ms: Math.round(marks[i].t - marks[i - 1].t), meta: marks[i].meta });
  }
  return out;
}

export function profTotalMs(): number {
  return marks.length > 1 ? Math.round(marks[marks.length - 1].t - marks[0].t) : 0;
}

// Live wall-clock since the timeline was anchored (marks[0], i.e. room mount). Drives the
// continuous elapsed clock on the LoadScreen across the Room→Player hand-off.
export function profElapsedMs(): number {
  return marks.length ? Math.round(now() - marks[0].t) : 0;
}

// Time from navigation to the first app code for the room (chunk download + JS boot).
// marks[0].t is performance.now() at mount, i.e. ms since navigation start.
export function profBootMs(): number {
  return marks.length ? Math.round(marks[0].t) : 0;
}

// Log the timeline once (idempotent). Called when the load reaches "ready".
export function profReport(label = "room load"): void {
  if (reported || marks.length < 2) return;
  reported = true;
  const rows = profPhases();
  // eslint-disable-next-line no-console
  console.groupCollapsed(`%c[xc3d] ${label}: ${profTotalMs()}ms (+${profBootMs()}ms boot before app)`, "color:#ff7a2f;font-weight:700");
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

// Snapshot for on-screen readouts (DebugHud).
export function profSnapshot(): { phases: { phase: string; ms: number; meta?: string }[]; totalMs: number; bootMs: number } {
  return { phases: profPhases(), totalMs: profTotalMs(), bootMs: profBootMs() };
}

function now(): number {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}
