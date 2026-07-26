import { For, Show } from "solid-js";
import type { UploadJob } from "../lib/types";

// Blocking full-screen progress for a NEW / empty room's first upload. Deliberately
// styled to match LoadScreen (parachute header, determinate accent bar, ✓ / ● / ○
// checklist) so the hand-off — into the player once the flights land, or into the
// room-load LoadScreen — feels like one continuous loading screen rather than a jump.
//
// The bar is determinate: each file owns 1/N of it. Within a file's slice the upload
// BYTES fill the first 85%, the server "processing" the last 15%; a finished slice
// (done / skipped / error) counts full. So the bar only ever moves forward.

const TERMINAL = new Set<UploadJob["phase"]>(["done", "skipped", "error"]);

export default function UploadProgress(props: { jobs: () => UploadJob[] }) {
  const count = () => props.jobs().length;
  const fraction = () => {
    const n = count();
    if (!n) return 0;
    let f = 0;
    for (const j of props.jobs()) {
      if (TERMINAL.has(j.phase)) f += 1;
      else if (j.phase === "processing") f += 0.85;
      else if (j.phase === "uploading") f += j.frac * 0.85;
    }
    return f / n;
  };
  const pct = () => Math.round(fraction() * 100);
  const active = () => props.jobs().find((j) => j.phase === "uploading" || j.phase === "processing");
  const doneCount = () => props.jobs().filter((j) => TERMINAL.has(j.phase)).length;
  const headline = () => {
    const a = active();
    if (a) {
      const n = props.jobs().indexOf(a) + 1;
      return `${a.phase === "processing" ? "Processing" : "Uploading"} ${n} / ${count()} — ${a.name}`;
    }
    return `Uploaded ${doneCount()} / ${count()}`;
  };

  return (
    <div
      class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4"
      style={{ background: "var(--bg)", padding: "1rem" }}
    >
      <div style={{ "font-size": "40px", "line-height": 1 }}>🪂</div>
      <div class="text-sm font-bold" style={{ color: "var(--accent)", "letter-spacing": ".5px" }}>
        Adding your flights
      </div>

      {/* determinate bar — mirrors LoadScreen's */}
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
          <span>{headline()}</span>
        </div>
      </div>

      {/* per-file checklist — mirrors LoadScreen's stage list */}
      <div class="flex flex-col gap-1.5" style={{ "min-width": "16rem", "max-width": "min(88vw, 22rem)" }}>
        <For each={props.jobs()}>
          {(j) => {
            const done = () => j.phase === "done";
            const skipped = () => j.phase === "skipped";
            const errored = () => j.phase === "error";
            const running = () => j.phase === "uploading" || j.phase === "processing";
            const status = () =>
              j.phase === "uploading" ? `${Math.round(j.frac * 100)}%`
              : j.phase === "processing" ? "processing…"
              : j.phase === "done" ? ""
              : j.phase === "skipped" ? "skipped"
              : j.phase === "error" ? "failed"
              : "";
            return (
              <div class="flex items-center gap-2 text-sm">
                <span style={{ width: "14px", "text-align": "center", "flex-shrink": 0 }}>
                  <Show when={done()} fallback={
                    <Show when={errored()} fallback={
                      <Show when={skipped()} fallback={
                        <span style={{ color: running() ? "var(--accent)" : "var(--text-dim)", opacity: running() ? "1" : "0.4" }}>
                          {running() ? "●" : "○"}
                        </span>
                      }>
                        <span style={{ color: "var(--text-dim)" }}>⊘</span>
                      </Show>
                    }>
                      <span style={{ color: "#ef4444" }}>✕</span>
                    </Show>
                  }>
                    <span style={{ color: "#4ade80" }}>✓</span>
                  </Show>
                </span>
                <span class="flex-1 min-w-0 truncate" style={{
                  color: running() ? "var(--text)" : "var(--text-dim)",
                  opacity: done() || running() ? "1" : "0.6",
                  "font-weight": running() ? 600 : 400,
                }}>
                  {j.name}
                </span>
                <span class="text-xs tabular-nums shrink-0" style={{ color: "var(--text-dim)" }}>{status()}</span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
