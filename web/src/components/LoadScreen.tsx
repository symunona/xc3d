import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { profElapsedMs } from "../lib/profile";

// One continuous room-load screen, shared by the data phase (Room) and the WebGL-boot
// phase (Player) so the hand-off is seamless. Per NN/g, a multi-second load wants a
// DETERMINATE bar that only moves forward: the download owns the front of the bar
// (real byte %), and the WebGL boot folds into the back as named stages — the bar never
// resets to 0. A stage checklist (✓ done · ● active · ○ pending) names what's happening,
// and an eased trickle keeps it alive while a slow stage (tiles / GPU) has no sub-progress.

export const LOAD_STAGES = [
  "Downloading flights", //   0 — byte progress from the stream
  "Reading tracks", //        1 — JSON.parse + build objects
  "Starting the map engine", // 2 ┐
  "Loading the base map", //   3 ├ Player (WebGL boot)
  "Building the scene", //     4 │
  "Placing the flights", //    5 ┘
];
export const MAP_STAGE_BASE = 2; // Player's first stage index in LOAD_STAGES

// The download+parse half owns the front of the bar (it's the long pole on a slow link).
const DATA_FRACTION = 0.55;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Overall 0..1 bar position. Monotonic across the Room→Player hand-off: data stages fill
// [0, .55], the four map stages fill [.55, 1]. `sub` is within-stage progress (download
// byte fraction; 0 for the discrete map stages).
export function overallFraction(stage: number, sub: number): number {
  if (stage <= 1) {
    // The download is the long, measurable part → it owns nearly all of the front band;
    // parse is ~instant so it just tops the band off before the WebGL stages take over.
    if (stage === 0) return clamp01(sub) * (DATA_FRACTION - 0.03); // 0 → .52
    return DATA_FRACTION - 0.01; // parsing → .54
  }
  const mapStages = LOAD_STAGES.length - MAP_STAGE_BASE; // 4
  const done = Math.min(stage - MAP_STAGE_BASE, mapStages); // 0..4
  return DATA_FRACTION + (done / mapStages) * (1 - DATA_FRACTION);
}

export default function LoadScreen(props: {
  activeStage: () => number; // 0..LOAD_STAGES.length (== length → all done)
  fraction: () => number; // overall 0..1, from overallFraction()
  detail?: () => string | null; // e.g. "3.2 / 6.0 MB"
  error?: () => string | null; // fatal → load can't continue
  note?: () => string | null; // last non-fatal map message
  onReload: () => void;
}) {
  // Eased + trickle display. Seed from the CURRENT fraction (not 0) so the second
  // instance — Player's, mounted at the Room→Player hand-off — picks up where the data
  // phase left off instead of snapping back to 0. shown is clamped monotonic so the bar
  // only ever moves forward, per NN/g.
  const [shown, setShown] = createSignal(clamp01(props.fraction()));
  const [elapsed, setElapsed] = createSignal(profElapsedMs() / 1000);
  onMount(() => {
    const iv = setInterval(() => {
      setElapsed(profElapsedMs() / 1000);
      const done = props.activeStage() >= LOAD_STAGES.length;
      setShown((s) => {
        if (done) return 1; // snap full on completion
        let t = clamp01(props.fraction());
        if (t - s < 0.008 && t < 0.97) t = s + (1 - s) * 0.015; // trickle when caught up
        return Math.max(s, s + (t - s) * 0.28); // monotonic — never step backward
      });
    }, 90);
    onCleanup(() => clearInterval(iv));
  });

  const pct = () => Math.round(shown() * 100);
  const stuckLabel = () => LOAD_STAGES[Math.min(props.activeStage(), LOAD_STAGES.length - 1)];

  return (
    <div
      class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
      style={{ background: "var(--bg)", padding: "1rem" }}
    >
      <div style={{ "font-size": "40px", "line-height": 1 }}>🪂</div>
      <div class="text-base font-bold" style={{ color: "var(--accent)", "letter-spacing": ".5px" }}>
        XC3D
      </div>
      <div class="text-xs" style={{ color: "var(--text-dim)", "max-width": "22rem", "text-align": "center", "line-height": 1.5, "margin-top": "-0.5rem" }}>
        3D flight analysis for XC pilots. Drop your IGC, share your flights, learn from each other, fly safe!
      </div>

      {/* determinate bar */}
      <div style={{ width: "min(70vw, 320px)" }}>
        <div style={{ height: "6px", "border-radius": "999px", background: "rgba(255,255,255,.10)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%", width: `${pct()}%`, background: "var(--accent)",
              "border-radius": "999px", transition: "width .12s linear",
            }}
          />
        </div>
        <div class="flex items-center justify-between mt-1.5 text-xs tabular-nums" style={{ color: "var(--text-dim)" }}>
          <span>{pct()}%</span>
          <Show when={props.detail?.()} fallback={<span>{elapsed().toFixed(1)}s</span>}>
            <span>{props.detail!()}</span>
          </Show>
        </div>
      </div>

      {/* stage checklist */}
      <div class="flex flex-col gap-1.5" style={{ "min-width": "13rem" }}>
        <For each={LOAD_STAGES}>
          {(label, i) => {
            const done = () => i() < props.activeStage();
            const active = () => i() === props.activeStage() && !props.error?.();
            return (
              <div class="flex items-center gap-2 text-sm">
                <span style={{ width: "14px", "text-align": "center", "flex-shrink": 0 }}>
                  <Show
                    when={done()}
                    fallback={
                      <span style={{ color: active() ? "var(--accent)" : "var(--text-dim)", opacity: active() ? "1" : "0.4" }}>
                        {active() ? "●" : "○"}
                      </span>
                    }
                  >
                    <span style={{ color: "#4ade80" }}>✓</span>
                  </Show>
                </span>
                <span style={{
                  color: active() ? "var(--text)" : "var(--text-dim)",
                  opacity: done() || active() ? "1" : "0.5",
                  "font-weight": active() ? 600 : 400,
                }}>
                  {label}{active() ? "…" : ""}
                </span>
              </div>
            );
          }}
        </For>
      </div>

      {/* fatal error */}
      <Show when={props.error?.()}>
        <div class="text-xs px-3 py-2 rounded" style={{
          "max-width": "20rem", "text-align": "center",
          background: "color-mix(in srgb, #ef4444 15%, transparent)",
          border: "1px solid color-mix(in srgb, #ef4444 45%, transparent)",
          color: "var(--text)",
        }}>
          <div style={{ "font-weight": 700, "margin-bottom": "2px" }}>Loading failed</div>
          <div style={{ color: "var(--text-dim)" }}>{props.error!()}</div>
        </div>
      </Show>

      {/* dragging on — name the stage it's stuck on + the last map complaint */}
      <Show when={!props.error?.() && elapsed() > 6}>
        <div class="text-xs px-4" style={{ color: "var(--text-dim)", "max-width": "20rem", "text-align": "center" }}>
          Still on “{stuckLabel()}” — a slow connection, slow tiles, or a weak GPU can do this.
          <Show when={props.note?.()}>
            <div class="mt-1" style={{ opacity: "0.75", "word-break": "break-word" }}>last map message: {props.note!()}</div>
          </Show>
        </div>
      </Show>

      <Show when={props.error?.() || elapsed() > 12}>
        <button class="btn" onClick={() => props.onReload()}>Reload</button>
      </Show>
    </div>
  );
}
