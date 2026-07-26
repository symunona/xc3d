import { For, Show, createSignal, createEffect } from "solid-js";
import type { Thermal, Glide } from "../../../lib/tracklogThermals";
import { fmtDur } from "../../../lib/tracklogThermals";
import { fmtHM } from "../format";

/* ── Per-tracklog climb / glide tables ──────────────────────────────────
   The detected THERMALS and the GLIDES between them, for ONE pilot (the
   followed/active one), on two tabs of one panel. Each table's row for the
   segment the playhead is inside is highlighted; clicking a row seeks the
   clock to that segment's start.

   Thermals: entry time, dur, alt gain, avg + peak climb, turns.
   Glides:   start time, dur, distance, avg + peak sink, glide ratio (L/D).
   ──────────────────────────────────────────────────────────────────── */

// shared 7-col layout — the trailing `alt` column is the from→to altitude readout
// (start → end height), added for both thermals and glides.
const GRID = "1.2rem 2.5rem 2.2rem 2.6rem 2.8rem 1.9rem 6rem";

// "1200m → 1850m" — a segment's start altitude to its end altitude (both rounded to m)
const fmtAlt = (alt0: number, alt1: number) => `${Math.round(alt0)}m → ${Math.round(alt1)}m`;

const fmtLD = (ld: number) => (Number.isFinite(ld) ? (ld >= 10 ? ld.toFixed(0) : ld.toFixed(1)) : "∞");

export default function ThermalPanel(props: {
  name: string;
  color: string;
  thermals: () => Thermal[];
  glides: () => Glide[];
  t0: () => number; // pilot's launch time-of-day (rel-sec → tod)
  playhead: () => number; // current time-of-day, seconds
  onSeek?: (tod: number) => void;
  selectedSeg?: () => { kind: "thermal" | "glide"; idx: number } | null;
  onSelectSeg?: (kind: "thermal" | "glide", idx: number) => void;
  onClose?: () => void;
}) {
  // the row the user clicked (highlighted on the map). Selected wins over the fainter
  // "playhead is inside this one" tint.
  const isSel = (kind: "thermal" | "glide", i: number) => {
    const s = props.selectedSeg?.();
    return !!s && s.kind === kind && s.idx === i;
  };
  const rowBg = (sel: boolean, cur: boolean) =>
    sel ? "color-mix(in srgb, var(--accent) 42%, transparent)"
      : cur ? "color-mix(in srgb, var(--accent) 22%, transparent)"
      : "transparent";
  const [tab, setTab] = createSignal<"thermals" | "glides">("thermals");
  // per-row element refs, so a selection made ELSEWHERE (e.g. clicking the barogram) can
  // flip to the right tab and scroll the picked climb/glide into view.
  const rowRefs = new Map<string, HTMLElement>();
  createEffect(() => {
    const s = props.selectedSeg?.();
    if (!s) return;
    setTab(s.kind === "thermal" ? "thermals" : "glides"); // show the tab the picked row lives on
    // wait for that tab's rows to render, then bring the selected one into view
    queueMicrotask(() => rowRefs.get(`${s.kind}:${s.idx}`)?.scrollIntoView({ block: "nearest" }));
  });
  const rel = () => props.playhead() - props.t0();
  const curThermal = () => props.thermals().findIndex((s) => rel() >= s.t0 && rel() <= s.t1);
  const curGlide = () => props.glides().findIndex((s) => rel() >= s.t0 && rel() <= s.t1);

  const gainTot = () => props.thermals().reduce((s, t) => s + t.gain, 0);
  const climbTot = () => props.thermals().reduce((s, t) => s + t.dur, 0);
  const distTot = () => props.glides().reduce((s, g) => s + g.distKm, 0);
  const glideTot = () => props.glides().reduce((s, g) => s + g.dur, 0);

  const Tab = (p: { id: "thermals" | "glides"; label: string; n: number }) => (
    <button
      class="text-xs px-2 py-0.5 rounded-md"
      style={{
        background: tab() === p.id ? "var(--accent)" : "transparent",
        color: tab() === p.id ? "#10151b" : "var(--text-dim)",
        border: `1px solid ${tab() === p.id ? "var(--accent)" : "var(--border)"}`,
        cursor: "pointer",
        "font-weight": tab() === p.id ? 700 : 400,
      }}
      onClick={() => setTab(p.id)}
    >
      {p.label} {p.n}
    </button>
  );

  return (
    <div class="panel flex flex-col" style={{ "max-height": "17rem", "min-width": "18rem" }}>
      {/* header */}
      <div class="flex items-center gap-2 px-3 py-1.5" style={{ "border-bottom": "1px solid var(--border)" }}>
        <span style={{ width: "10px", height: "10px", "border-radius": "50%", background: props.color, "flex-shrink": 0 }} />
        <span class="text-sm font-bold truncate" style={{ color: "var(--text)" }} title={props.name}>{props.name}</span>
        <div class="flex-1" />
        <Show when={props.onClose}>
          <button class="text-xs leading-none" title="hide table (markers stay — 🌀 / t reopens)" style={{ color: "var(--text-dim)", cursor: "pointer" }} onClick={() => props.onClose!()}>✕</button>
        </Show>
      </div>

      {/* tabs */}
      <div class="flex gap-1.5 px-3 py-1.5">
        <Tab id="thermals" label="🌀 thermals" n={props.thermals().length} />
        <Tab id="glides" label="🪂 glides" n={props.glides().length} />
      </div>

      {/* ── THERMALS ── */}
      <Show when={tab() === "thermals"}>
        <Show
          when={props.thermals().length > 0}
          fallback={<div class="px-3 py-3 text-xs" style={{ color: "var(--text-dim)" }}>no thermals detected on this track</div>}
        >
          <div class="grid px-3 py-1 text-[10px] uppercase tracking-wider"
               style={{ color: "var(--text-dim)", "grid-template-columns": GRID, gap: "2px" }}>
            <span>#</span><span>time</span><span>dur</span><span>gain</span><span>avg/mx</span><span>turns</span><span>alt</span>
          </div>
          <div class="scroll-y" style={{ "overflow-y": "auto" }}>
            <For each={props.thermals()}>
              {(th, i) => (
                <div
                  ref={(el) => rowRefs.set(`thermal:${i()}`, el)}
                  class="grid px-3 py-1 text-xs items-center"
                  style={{
                    "grid-template-columns": GRID, gap: "2px",
                    "font-variant-numeric": "tabular-nums", cursor: props.onSeek ? "pointer" : "default",
                    background: rowBg(isSel("thermal", i()), i() === curThermal()),
                    "box-shadow": isSel("thermal", i()) ? "inset 3px 0 0 0 var(--accent)" : "none",
                  }}
                  title={`entry ${fmtHM(props.t0() + th.t0)} · exit ${fmtHM(props.t0() + th.t1)} · ${th.alt0 | 0}→${th.alt1 | 0} m`}
                  onClick={() => { props.onSeek?.(props.t0() + th.t0); props.onSelectSeg?.("thermal", i()); }}
                >
                  <span style={{ color: "var(--text-dim)" }}>{i() + 1}</span>
                  <span>{fmtHM(props.t0() + th.t0)}</span>
                  <span>{fmtDur(th.dur)}</span>
                  <span style={{ color: "#4ade80", "font-weight": 700 }}>+{th.gain | 0}</span>
                  <span>{th.avgClimb.toFixed(1)}/<span style={{ color: "var(--accent)" }}>{th.maxClimb.toFixed(1)}</span></span>
                  <span style={{ color: "var(--text-dim)" }}>{th.turns.toFixed(1)}</span>
                  <span style={{ color: "var(--text-dim)", "white-space": "nowrap" }}>{fmtAlt(th.alt0, th.alt1)}</span>
                </div>
              )}
            </For>
          </div>
          <div class="flex items-center gap-3 px-3 py-1.5 text-xs"
               style={{ "border-top": "1px solid var(--border)", "font-variant-numeric": "tabular-nums", color: "var(--text-dim)" }}>
            <span>Σ gain <span style={{ color: "#4ade80", "font-weight": 700 }}>+{gainTot() | 0} m</span></span>
            <span>climbing {fmtDur(climbTot())}</span>
          </div>
        </Show>
      </Show>

      {/* ── GLIDES ── */}
      <Show when={tab() === "glides"}>
        <Show
          when={props.glides().length > 0}
          fallback={<div class="px-3 py-3 text-xs" style={{ color: "var(--text-dim)" }}>no glides detected on this track</div>}
        >
          <div class="grid px-3 py-1 text-[10px] uppercase tracking-wider"
               style={{ color: "var(--text-dim)", "grid-template-columns": GRID, gap: "2px" }}>
            <span>#</span><span>time</span><span>dur</span><span>dist</span><span>avg/mx↓</span><span>L/D</span><span>alt</span>
          </div>
          <div class="scroll-y" style={{ "overflow-y": "auto" }}>
            <For each={props.glides()}>
              {(g, i) => (
                <div
                  ref={(el) => rowRefs.set(`glide:${i()}`, el)}
                  class="grid px-3 py-1 text-xs items-center"
                  style={{
                    "grid-template-columns": GRID, gap: "2px",
                    "font-variant-numeric": "tabular-nums", cursor: props.onSeek ? "pointer" : "default",
                    background: rowBg(isSel("glide", i()), i() === curGlide()),
                    "box-shadow": isSel("glide", i()) ? "inset 3px 0 0 0 var(--accent)" : "none",
                  }}
                  title={`${fmtHM(props.t0() + g.t0)}–${fmtHM(props.t0() + g.t1)} · ${g.alt0 | 0}→${g.alt1 | 0} m · lost ${g.lost | 0} m · ${g.speedKmh.toFixed(0)} km/h`}
                  onClick={() => { props.onSeek?.(props.t0() + g.t0); props.onSelectSeg?.("glide", i()); }}
                >
                  <span style={{ color: "var(--text-dim)" }}>{i() + 1}</span>
                  <span>{fmtHM(props.t0() + g.t0)}</span>
                  <span>{fmtDur(g.dur)}</span>
                  <span style={{ color: "#60a5fa", "font-weight": 700 }}>{g.distKm.toFixed(1)}</span>
                  <span>{g.avgSink.toFixed(1)}/<span style={{ color: "var(--accent)" }}>{g.maxSink.toFixed(1)}</span></span>
                  <span style={{ color: "var(--text-dim)" }}>{fmtLD(g.ld)}</span>
                  <span style={{ color: "var(--text-dim)", "white-space": "nowrap" }}>{fmtAlt(g.alt0, g.alt1)}</span>
                </div>
              )}
            </For>
          </div>
          <div class="flex items-center gap-3 px-3 py-1.5 text-xs"
               style={{ "border-top": "1px solid var(--border)", "font-variant-numeric": "tabular-nums", color: "var(--text-dim)" }}>
            <span>Σ dist <span style={{ color: "#60a5fa", "font-weight": 700 }}>{distTot().toFixed(1)} km</span></span>
            <span>gliding {fmtDur(glideTot())}</span>
          </div>
        </Show>
      </Show>
    </div>
  );
}
