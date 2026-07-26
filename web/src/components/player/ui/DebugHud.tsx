import { For, Show } from "solid-js";
import type { Dbg } from "../types";
import { profSnapshot } from "../../../lib/profile";

// FPS + per-frame render breakdown (`f`). Reads the metrics captured by the render
// loop and names the current bottleneck so you know which lever to pull.
export default function DebugHud(props: {
  fps: () => number;
  dbg: () => Dbg;
  highFps: () => boolean;
  trailFull: () => boolean;
}) {
  const fpsColor = () => { const v = props.fps(); return v >= 50 ? "#4ade80" : v >= 30 ? "#fbbf24" : "#f87171"; };
  const num = (n: number) => Math.round(n).toLocaleString();
  const bottleneck = () => {
    const d = props.dbg();
    if (props.trailFull() && d.trailPts > 60000) return "trail geometry — turn off full trails";
    if (d.jsMs > 8) return "JS layer rebuild — switch off 60 fps updates";
    if (props.fps() < 45) return "GPU fill-rate / terrain";
    return "none — comfortably real-time";
  };
  const DRow = (p: { label: string; val: string; hot?: boolean }) => (
    <div class="flex items-center justify-between gap-4">
      <span style={{ color: "var(--text-dim)" }}>{p.label}</span>
      <span style={{ color: p.hot ? "#fbbf24" : "var(--text)" }}>{p.val}</span>
    </div>
  );

  return (
    <div
      class="absolute z-30 panel px-3 py-2 text-xs flex flex-col gap-0.5"
      style={{
        top: "4.5rem", right: "0.75rem", "min-width": "13.5rem",
        "font-variant-numeric": "tabular-nums", "pointer-events": "none",
      }}
    >
      <div class="flex items-center justify-between mb-1">
        <span class="uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>render</span>
        <span class="font-bold text-lg leading-none" style={{ color: fpsColor() }}>{props.fps()} fps</span>
      </div>
      <DRow label="js / frame" val={props.dbg().jsMs.toFixed(1) + " ms"} hot={props.dbg().jsMs > 8} />
      <DRow label="updates" val={props.highFps() ? "60 fps" : "6 fps throttled"} />
      <DRow label="deck layers" val={"" + props.dbg().layers} />
      <DRow label="trail vertices" val={num(props.dbg().trailPts)} hot={props.trailFull() && props.dbg().trailPts > 60000} />
      <DRow label="gliders" val={"" + props.dbg().markers} />
      <div class="mt-1 pt-1 leading-snug" style={{ "border-top": "1px solid var(--border)" }}>
        <span style={{ color: "var(--text-dim)" }}>bottleneck: </span>
        <span style={{ color: "var(--accent)" }}>{bottleneck()}</span>
      </div>

      {/* room-load timeline (captured by lib/profile; also logged to the console) */}
      <Show when={profSnapshot().totalMs > 0}>
        <div class="mt-1 pt-1 leading-snug" style={{ "border-top": "1px solid var(--border)" }}>
          <div class="flex items-center justify-between mb-0.5">
            <span class="uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>load</span>
            <span style={{ color: "var(--text)" }}>{num(profSnapshot().totalMs)} ms · +{num(profSnapshot().bootMs)} boot</span>
          </div>
          <For each={profSnapshot().phases}>
            {(p) => (
              <DRow label={p.phase + (p.meta ? ` (${p.meta})` : "")} val={num(p.ms) + " ms"} hot={p.ms > 1500} />
            )}
          </For>
        </div>
      </Show>

      <div class="mt-0.5" style={{ color: "var(--text-dim)", opacity: "0.6" }}>press f to hide</div>
    </div>
  );
}
