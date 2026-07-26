import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { SessionFlight, TrackPt } from "../lib/types";

/* ── XContest-style barogram ────────────────────────────────────────────
   One altitude trace per flight, all on a single WALL-CLOCK x-axis
   (seconds since UTC midnight) so flights from different days overlay.
   Traces are downsampled + memoized; only the playhead line and the
   per-flight dots re-render on the clock tick.
   ──────────────────────────────────────────────────────────────────── */

// same rule as Player.tsx: a flight's launch as time-of-day
const todOfLaunch = (f: SessionFlight) => ((f.launchEpoch % 86400) + 86400) % 86400;
// altitude of a fix (GPS altitude; index 4 is pressure alt)
const altOf = (p: TrackPt) => p[3];

// wall-clock HH:MM
function fmtHM(s: number): string {
  const t = ((s % 86400) + 86400) % 86400;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const PAD_L = 40; // room for the altitude labels
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 18; // room for the HH:MM labels
const HEIGHT = 160;
const MAX_PTS = 400; // per trace, after downsampling

/** min/max bucket downsample: keeps thermal peaks + sink troughs, ≤ MAX_PTS points */
function downsample(track: TrackPt[]): TrackPt[] {
  const n = track.length;
  if (n <= MAX_PTS) return track;
  const buckets = Math.floor(MAX_PTS / 2);
  const size = n / buckets;
  const out: TrackPt[] = [];
  for (let b = 0; b < buckets; b++) {
    const lo = Math.floor(b * size);
    const hi = Math.min(n, Math.floor((b + 1) * size));
    if (hi <= lo) continue;
    let iMin = lo;
    let iMax = lo;
    for (let i = lo + 1; i < hi; i++) {
      const a = altOf(track[i]);
      if (a < altOf(track[iMin])) iMin = i;
      if (a > altOf(track[iMax])) iMax = i;
    }
    // emit both extremes, in chronological order
    const a = Math.min(iMin, iMax);
    const z = Math.max(iMin, iMax);
    out.push(track[a]);
    if (z !== a) out.push(track[z]);
  }
  // always pin the real endpoints
  if (out.length === 0 || out[0] !== track[0]) out.unshift(track[0]);
  if (out[out.length - 1] !== track[n - 1]) out.push(track[n - 1]);
  return out;
}

/** last fix at or before t (binary search over the FULL track) */
function idxAt(track: TrackPt[], rel: number): number {
  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track[mid][0] <= rel) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** "nice" tick step ≥ raw, from the 1/2/5 ladder */
function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** time-axis step from a human ladder (5 min … 6 h) */
function timeStep(span: number, target: number): number {
  const ladder = [300, 600, 900, 1800, 3600, 7200, 10800, 21600];
  const raw = span / target;
  return ladder.find((s) => s >= raw) ?? 21600;
}

// a pilot's thermal/glide segment as far as the barogram cares: just its rel-second span
type Seg = { t0: number; t1: number };

export default function AltitudeGraph(props: {
  flights: () => SessionFlight[];
  playhead: () => number; // current time-of-day, seconds
  dayStart: () => number; // x-axis min (time-of-day of first launch)
  dayEnd: () => number; // x-axis max (time-of-day of last landing)
  onSeek?: (tod: number) => void;
  onClose?: () => void;
  // click a pilot's trace → select that pilot (mirrors picking them on the map / in the dock)
  onSelectPilot?: (key: string) => void;
  // …and, if the click landed inside one of their thermal/glide segments, focus that row
  // (seg = null clears the segment selection). Player computes idx off the same source as
  // the table, so it stays in sync. Segments come from the two lookups below.
  onPickSegment?: (key: string, seg: { kind: "thermal" | "glide"; idx: number } | null) => void;
  thermalsFor?: (key: string) => Seg[];
  glidesFor?: (key: string) => Seg[];
}) {
  let host!: HTMLDivElement;
  const [width, setWidth] = createSignal(600);

  onMount(() => {
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(w);
    });
    ro.observe(host);
    setWidth(host.clientWidth || 600);
    onCleanup(() => ro.disconnect());
  });

  // ── x scale (time of day) ────────────────────────────────────────────
  // Full data domain …
  const x0 = createMemo(() => props.dayStart());
  const x1 = createMemo(() => Math.max(props.dayEnd(), props.dayStart() + 1));
  const plotW = createMemo(() => Math.max(1, width() - PAD_L - PAD_R));
  const plotH = HEIGHT - PAD_T - PAD_B;

  // … and the VISIBLE window inside it (null ⇒ full range). Wheel zooms;
  // pan drags shift it. sx()/ticks/paths all read the visible domain, so a
  // zoom change recomputes the memoized paths ONCE (never per playhead frame).
  const MIN_SPAN = 120; // don't let the window shrink below 2 min
  const [zoom, setZoom] = createSignal<{ lo: number; hi: number } | null>(null);
  const vx0 = createMemo(() => zoom()?.lo ?? x0());
  const vx1 = createMemo(() => Math.max(vx0() + 1, zoom()?.hi ?? x1()));
  const sx = (tod: number) => PAD_L + ((tod - vx0()) / (vx1() - vx0())) * plotW();
  // pixel-x → time-of-day, using the visible window
  const timeAt = (px: number) => vx0() + ((px - PAD_L) / plotW()) * (vx1() - vx0());

  /** set the visible window to [lo,hi], clamped to the full domain + MIN_SPAN;
      collapses back to null (full range) once it would cover everything. */
  const applyZoom = (lo: number, hi: number) => {
    const fLo = x0();
    const fHi = x1();
    let span = hi - lo;
    if (span >= fHi - fLo) return setZoom(null);
    if (span < MIN_SPAN) span = MIN_SPAN;
    if (lo < fLo) {
      lo = fLo;
      hi = fLo + span;
    }
    if (hi > fHi) {
      hi = fHi;
      lo = fHi - span;
    }
    setZoom({ lo: Math.max(fLo, lo), hi: Math.min(fHi, hi) });
  };

  // ── downsampled traces (recomputed ONLY when the flight list changes) ─
  type Trace = { key: string; color: string; name: string; pts: TrackPt[]; t0: number };
  const traces = createMemo<Trace[]>(() =>
    props
      .flights()
      .filter((f) => f.track && f.track.length > 0)
      .map((f) => ({
        key: f.fingerprint || f.filename,
        color: f.color,
        name: f.name,
        pts: downsample(f.track),
        t0: todOfLaunch(f),
      })),
  );

  // ── y scale (altitude), from the downsampled points ──────────────────
  const yDomain = createMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const tr of traces()) {
      for (const p of tr.pts) {
        const a = altOf(p);
        if (!Number.isFinite(a)) continue;
        if (a < lo) lo = a;
        if (a > hi) hi = a;
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1000, step: 250 };
    if (hi - lo < 50) hi = lo + 50; // flat / single-point tracks
    const step = niceStep((hi - lo) / 4);
    return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
  });
  const sy = (alt: number) => {
    const d = yDomain();
    return PAD_T + plotH - ((alt - d.lo) / Math.max(1, d.hi - d.lo)) * plotH;
  };

  // ── path data: depends on traces + scales, NOT on the playhead ───────
  const paths = createMemo(() =>
    traces().map((tr) => {
      let d = "";
      for (let i = 0; i < tr.pts.length; i++) {
        const p = tr.pts[i];
        const px = sx(tr.t0 + p[0]);
        const py = sy(altOf(p));
        d += (i === 0 ? "M" : "L") + px.toFixed(1) + " " + py.toFixed(1);
      }
      return { key: tr.key, color: tr.color, name: tr.name, d };
    }),
  );

  // ── gridlines / ticks ────────────────────────────────────────────────
  const yTicks = createMemo(() => {
    const d = yDomain();
    const out: number[] = [];
    for (let a = d.lo; a <= d.hi + 1e-6; a += d.step) out.push(Math.round(a));
    return out;
  });
  const xTicks = createMemo(() => {
    const span = vx1() - vx0();
    const step = timeStep(span, Math.max(2, Math.min(8, Math.floor(plotW() / 90))));
    const out: number[] = [];
    for (let t = Math.ceil(vx0() / step) * step; t <= vx1(); t += step) out.push(t);
    return out;
  });

  // ── per-frame layer: playhead + one dot per airborne flight ──────────
  const cursors = createMemo(() => {
    const tod = props.playhead();
    const out: { key: string; color: string; cx: number; cy: number; alt: number }[] = [];
    for (const f of props.flights()) {
      const tr = f.track;
      if (!tr || tr.length === 0) continue;
      const t0 = todOfLaunch(f);
      const rel = tod - t0;
      // not launched yet / already landed → no dot
      if (rel < tr[0][0] || rel > tr[tr.length - 1][0]) continue;
      const i = idxAt(tr, rel);
      const a = tr[i];
      const b = tr[Math.min(i + 1, tr.length - 1)];
      const dt = b[0] - a[0];
      const k = dt > 0 ? (rel - a[0]) / dt : 0;
      const alt = altOf(a) + (altOf(b) - altOf(a)) * k;
      out.push({
        key: f.fingerprint || f.filename,
        color: f.color,
        cx: sx(tod),
        cy: sy(alt),
        alt,
      });
    }
    return out;
  });

  // ── pointer interaction ──────────────────────────────────────────────
  //   left-drag on the plot  → scrub the playhead (onSeek)
  //   drag on the time-axis strip / shift-drag / middle-drag → pan (when zoomed)
  //   wheel                  → zoom in/out centred on the cursor time
  //   double-click           → reset zoom
  //   idle move              → snap the hover tooltip to the nearest sample
  //   click (down+up, no drag) on a trace → SELECT that pilot (+ focus the segment
  //                            under the cursor) — added alongside scrub, not replacing it
  type Mode = null | "scrub" | "pan";
  const [mode, setMode] = createSignal<Mode>(null);
  const [hovered, setHovered] = createSignal(false); // pointer over the graph
  let panStart = { x: 0, lo: 0, hi: 0 };
  // click-vs-scrub: a scrub starts as "scrub" too, so we track how far the pointer
  // travelled from the press point — beyond CLICK_SLOP px it's a drag (scrub), not a click.
  const CLICK_SLOP = 4; // px of travel still counted as a click, not a scrub
  const CLICK_R2 = 30 * 30; // squared px radius for "which trace did I click"
  let downX = 0, downY = 0, dragged = false;

  const seekFromEvent = (e: PointerEvent, el: SVGSVGElement) => {
    if (!props.onSeek) return;
    const r = el.getBoundingClientRect();
    const frac = (e.clientX - r.left - PAD_L) / plotW();
    const tod = vx0() + Math.min(1, Math.max(0, frac)) * (vx1() - vx0());
    props.onSeek(Math.round(tod));
  };

  const panFromEvent = (e: PointerEvent) => {
    const dTime = ((e.clientX - panStart.x) / plotW()) * (panStart.hi - panStart.lo);
    let lo = panStart.lo - dTime;
    let hi = panStart.hi - dTime;
    const span = hi - lo;
    if (lo < x0()) {
      lo = x0();
      hi = x0() + span;
    }
    if (hi > x1()) {
      hi = x1();
      lo = x1() - span;
    }
    setZoom({ lo, hi });
  };

  const wheelZoom = (e: WheelEvent, el: SVGSVGElement) => {
    e.preventDefault();
    e.stopPropagation(); // the graph lives inside maplibre's container — keep the wheel here, not on the map
    const r = el.getBoundingClientRect();
    const mx = Math.max(PAD_L, Math.min(PAD_L + plotW(), e.clientX - r.left));
    const t = timeAt(mx);
    const lo = vx0();
    const hi = vx1();
    const k = e.deltaY > 0 ? 1.25 : 1 / 1.25; // >0 = scroll down = zoom out
    applyZoom(t - (t - lo) * k, t + (hi - t) * k);
  };

  // ── hover tooltip: snap to the nearest downsampled sample of any trace ─
  type Tip = { px: number; py: number; alt: number; tod: number; name: string; color: string };
  const [tip, setTip] = createSignal<Tip | null>(null);
  const HOVER_R2 = 26 * 26; // squared pixel radius; beyond this → no tooltip
  const updateHover = (e: PointerEvent, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let best: Tip | null = null;
    let bestD = HOVER_R2;
    for (const tr of traces()) {
      for (const p of tr.pts) {
        const px = sx(tr.t0 + p[0]);
        if (px < PAD_L - 2 || px > PAD_L + plotW() + 2) continue; // outside zoom window
        const py = sy(altOf(p));
        const dx = px - mx;
        const dy = py - my;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { px, py, alt: altOf(p), tod: tr.t0 + p[0], name: tr.name, color: tr.color };
        }
      }
    }
    setTip(best);
  };

  // which trace is under (mx,my) — nearest downsampled sample of any trace within CLICK_R2.
  // Same sweep as the hover, but returns the pilot KEY + its launch-tod so a click can
  // select that pilot and map the cursor time into that pilot's rel-second timeline.
  const traceAt = (mx: number, my: number): { key: string; t0: number } | null => {
    let best: { key: string; t0: number } | null = null;
    let bestD = CLICK_R2;
    for (const tr of traces()) {
      for (const p of tr.pts) {
        const px = sx(tr.t0 + p[0]);
        if (px < PAD_L - 2 || px > PAD_L + plotW() + 2) continue; // outside zoom window
        const py = sy(altOf(p));
        const dx = px - mx;
        const dy = py - my;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { key: tr.key, t0: tr.t0 };
        }
      }
    }
    return best;
  };

  // a genuine click on a trace: select the pilot, then — from the clicked TIME (cursor-x →
  // time-of-day → rel-seconds against that pilot's launch) — see if it lands inside one of
  // their thermal/glide segments and, if so, focus that row. Segment idx is computed off the
  // same thermalsFor/glidesFor the table uses, so it matches.
  const clickSelect = (e: PointerEvent, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const hit = traceAt(mx, my);
    if (!hit) return;
    props.onSelectPilot?.(hit.key);
    const rel = timeAt(mx) - hit.t0; // cursor time in this pilot's own rel-second timeline
    let seg: { kind: "thermal" | "glide"; idx: number } | null = null;
    const ti = (props.thermalsFor?.(hit.key) ?? []).findIndex((s) => rel >= s.t0 && rel <= s.t1);
    if (ti >= 0) seg = { kind: "thermal", idx: ti };
    else {
      const gi = (props.glidesFor?.(hit.key) ?? []).findIndex((s) => rel >= s.t0 && rel <= s.t1);
      if (gi >= 0) seg = { kind: "glide", idx: gi };
    }
    props.onPickSegment?.(hit.key, seg);
  };

  return (
    <div ref={host} class="panel relative w-full" style={{ padding: "6px 4px 2px 4px" }}>
      <Show when={props.onClose}>
        <button
          class="absolute z-10 text-xs leading-none"
          style={{
            top: "6px",
            right: "6px",
            width: "20px",
            height: "20px",
            "border-radius": "6px",
            background: "var(--bg-panel-solid)",
            border: "1px solid var(--border)",
            color: "var(--text-dim)",
            cursor: "pointer",
          }}
          title="hide barogram"
          onClick={() => props.onClose!()}
        >
          ✕
        </button>
      </Show>

      <Show
        when={traces().length > 0}
        fallback={
          <div
            class="flex items-center justify-center text-sm"
            style={{ height: `${HEIGHT}px`, color: "var(--text-dim)" }}
          >
            no flights to plot
          </div>
        }
      >
        <svg
          width={width()}
          height={HEIGHT}
          style={{
            display: "block",
            cursor: mode() === "pan" ? "grabbing" : props.onSeek ? "ew-resize" : "default",
            "touch-action": "none",
          }}
          onPointerDown={(e) => {
            e.stopPropagation(); // don't let maplibre (our container) start a map-drag
            const el = e.currentTarget;
            el.setPointerCapture(e.pointerId);
            setTip(null);
            const inAxis = e.clientY - el.getBoundingClientRect().top >= PAD_T + plotH;
            // middle-drag / shift-drag / drag on the time-axis strip → pan
            if (e.button === 1 || e.shiftKey || inAxis) {
              e.preventDefault();
              setMode("pan");
              panStart = { x: e.clientX, lo: vx0(), hi: vx1() };
            } else {
              // left-press: begins a scrub, but might turn out to be a click (select) —
              // decided on pointer-up by how far the pointer moved (see onPointerUp).
              setMode("scrub");
              downX = e.clientX; downY = e.clientY; dragged = false;
              if (props.onSeek) seekFromEvent(e, el);
            }
          }}
          onPointerMove={(e) => {
            const m = mode();
            if (m === "scrub") {
              if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > CLICK_SLOP) dragged = true;
              seekFromEvent(e, e.currentTarget);
            } else if (m === "pan") panFromEvent(e);
            else updateHover(e, e.currentTarget); // idle → hover tooltip
          }}
          onPointerUp={(e) => {
            const wasClick = mode() === "scrub" && !dragged; // pressed + released without a drag
            setMode(null);
            e.currentTarget.releasePointerCapture(e.pointerId);
            if (wasClick) clickSelect(e, e.currentTarget);
          }}
          onPointerCancel={() => setMode(null)}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => {
            setHovered(false);
            setTip(null);
          }}
          onWheel={(e) => wheelZoom(e, e.currentTarget)}
          onDblClick={() => setZoom(null)}
        >
          {/* altitude gridlines + labels */}
          <For each={yTicks()}>
            {(a) => (
              <>
                <line
                  x1={PAD_L}
                  x2={PAD_L + plotW()}
                  y1={sy(a)}
                  y2={sy(a)}
                  stroke="var(--border)"
                  stroke-width="1"
                />
                <text
                  x={PAD_L - 6}
                  y={sy(a) + 3}
                  text-anchor="end"
                  font-size="9"
                  fill="var(--text-dim)"
                  style={{ "font-variant-numeric": "tabular-nums" }}
                >
                  {a}
                </text>
              </>
            )}
          </For>

          {/* time-of-day ticks */}
          <For each={xTicks()}>
            {(t) => (
              <>
                <line
                  x1={sx(t)}
                  x2={sx(t)}
                  y1={PAD_T}
                  y2={PAD_T + plotH}
                  stroke="var(--border)"
                  stroke-width="1"
                />
                <text
                  x={sx(t)}
                  y={HEIGHT - 5}
                  text-anchor="middle"
                  font-size="9"
                  fill="var(--text-dim)"
                  style={{ "font-variant-numeric": "tabular-nums" }}
                >
                  {fmtHM(t)}
                </text>
              </>
            )}
          </For>

          {/* one trace per flight — memoized, does NOT redraw on the tick */}
          <For each={paths()}>
            {(p) => (
              <path
                d={p.d}
                fill="none"
                stroke={p.color}
                stroke-width="1.5"
                stroke-linejoin="round"
                stroke-linecap="round"
                opacity="0.9"
              >
                <title>{p.name}</title>
              </path>
            )}
          </For>

          {/* future-dimming: ONE translucent panel-coloured rect over the
              region ahead of the playhead. Fades the not-yet-flown traces
              without touching the memoized paths. Hidden while hovering so
              the whole graph reads at full brightness ("highlight all"). */}
          <rect
            x={Math.max(PAD_L, Math.min(PAD_L + plotW(), sx(props.playhead())))}
            y={PAD_T}
            width={Math.max(0, PAD_L + plotW() - Math.max(PAD_L, Math.min(PAD_L + plotW(), sx(props.playhead()))))}
            height={plotH}
            fill="var(--bg-panel-solid)"
            opacity={hovered() ? 0 : 0.55}
            pointer-events="none"
            style={{ transition: "opacity 120ms ease" }}
          />

          {/* playhead */}
          <line
            x1={sx(props.playhead())}
            x2={sx(props.playhead())}
            y1={PAD_T}
            y2={PAD_T + plotH}
            stroke="var(--accent)"
            stroke-width="1.5"
            opacity="0.85"
          />

          {/* current altitude of each airborne flight */}
          <For each={cursors()}>
            {(c) => (
              <g>
                <circle cx={c.cx} cy={c.cy} r="3.5" fill={c.color} stroke="var(--bg-panel-solid)" stroke-width="1" />
                <title>{`${Math.round(c.alt)} m`}</title>
              </g>
            )}
          </For>

          {/* clock readout, pinned to the playhead */}
          <text
            x={Math.min(PAD_L + plotW() - 2, Math.max(PAD_L + 2, sx(props.playhead()) + 4))}
            y={PAD_T + 9}
            text-anchor={sx(props.playhead()) > PAD_L + plotW() - 40 ? "end" : "start"}
            font-size="10"
            font-weight="600"
            fill="var(--accent)"
            style={{ "font-variant-numeric": "tabular-nums" }}
          >
            {fmtHM(props.playhead())}
          </text>

          {/* hover tooltip: exact altitude (+ time + pilot) of the snapped sample */}
          <Show when={tip()} keyed>
            {(t) => {
              const label = t.name.length > 16 ? t.name.slice(0, 15) + "…" : t.name;
              // top row: pilot name (left) + HH:MM (right); bottom row: big altitude
              const boxW = Math.max(96, label.length * 6.2 + 44);
              const boxH = 40;
              const flip = t.px > PAD_L + plotW() - boxW - 10;
              const bx = flip ? t.px - boxW - 10 : t.px + 10;
              const by = Math.max(PAD_T, Math.min(PAD_T + plotH - boxH, t.py - boxH / 2));
              return (
                <g pointer-events="none">
                  {/* snapped point highlight */}
                  <circle cx={t.px} cy={t.py} r="4.5" fill={t.color} stroke="var(--bg-panel-solid)" stroke-width="1.5" />
                  <circle cx={t.px} cy={t.py} r="4.5" fill="none" stroke="var(--accent)" stroke-width="1" opacity="0.8" />
                  <rect
                    x={bx}
                    y={by}
                    width={boxW}
                    height={boxH}
                    rx="5"
                    fill="var(--bg-panel-solid)"
                    stroke="var(--border)"
                    stroke-width="1"
                    opacity="0.96"
                  />
                  <text x={bx + 8} y={by + 14} font-size="9.5" font-weight="600" fill={t.color}>
                    {label}
                  </text>
                  <text
                    x={bx + boxW - 8}
                    y={by + 14}
                    text-anchor="end"
                    font-size="9.5"
                    fill="var(--text-dim)"
                    style={{ "font-variant-numeric": "tabular-nums" }}
                  >
                    {fmtHM(t.tod)}
                  </text>
                  <text
                    x={bx + 8}
                    y={by + 30}
                    font-size="12"
                    font-weight="700"
                    fill="var(--text)"
                    style={{ "font-variant-numeric": "tabular-nums" }}
                  >
                    {`${Math.round(t.alt)} m`}
                  </text>
                </g>
              );
            }}
          </Show>
        </svg>

        {/* reset-zoom affordance (also: double-click the graph) */}
        <Show when={zoom()}>
          <button
            class="absolute z-10 text-xs leading-none"
            style={{
              top: "6px",
              left: "6px",
              height: "20px",
              padding: "0 7px",
              "border-radius": "6px",
              background: "var(--bg-panel-solid)",
              border: "1px solid var(--border)",
              color: "var(--text-dim)",
              cursor: "pointer",
            }}
            title="reset zoom (or double-click the graph)"
            onClick={() => setZoom(null)}
          >
            ⤢ reset
          </button>
        </Show>
      </Show>
    </div>
  );
}
