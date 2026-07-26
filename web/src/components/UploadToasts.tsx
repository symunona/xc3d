import { For, Show } from "solid-js";
import type { UploadJob } from "../lib/types";

// Non-blocking status chips, stacked bottom-right OVER a live player. Adding a flight to a
// room that's already replaying shouldn't freeze the scene — so the compact Upload panel
// closes on "add" and each file reports here instead. Each chip walks
// uploading → processing → added ✓ (or "already added" / failed) and Room auto-dismisses
// it a few seconds after it settles. Several adds stack.

function statusText(t: UploadJob): string {
  switch (t.phase) {
    case "uploading": return `uploading ${Math.round(t.frac * 100)}%`;
    case "processing": return "processing…";
    case "done": return "added ✓";
    case "skipped": return "already added";
    case "error": return "failed ✕";
    default: return "queued";
  }
}

export default function UploadToasts(props: { toasts: () => UploadJob[] }) {
  return (
    <div
      class="fixed z-40 flex flex-col gap-2"
      style={{ right: "1rem", bottom: "1rem", "pointer-events": "none" }}
    >
      <For each={props.toasts()}>
        {(t) => {
          const running = () => t.phase === "uploading" || t.phase === "processing";
          const barPct = () =>
            t.phase === "uploading" ? Math.round(t.frac * 85)
            : t.phase === "processing" ? 92
            : 100;
          const statusColor = () =>
            t.phase === "done" ? "#4ade80"
            : t.phase === "error" ? "#ef4444"
            : "var(--text-dim)";
          return (
            <div class="panel px-3 py-2" style={{ "min-width": "15rem", "max-width": "min(80vw, 20rem)", "pointer-events": "auto" }}>
              <div class="flex items-center gap-2 text-sm">
                <span style={{ "background-color": t.color, width: "10px", height: "10px", "border-radius": "3px", "flex-shrink": 0 }} />
                <span class="flex-1 min-w-0 truncate">{t.name}</span>
                <span class="text-xs shrink-0" style={{ color: statusColor() }}>{statusText(t)}</span>
              </div>
              {/* thin determinate underline while it's in flight */}
              <Show when={running() || t.phase === "done"}>
                <div class="mt-1.5" style={{ height: "3px", "border-radius": "999px", background: "rgba(255,255,255,.10)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${barPct()}%`,
                    background: t.phase === "done" ? "#4ade80" : "var(--accent)",
                    "border-radius": "999px", transition: "width .15s linear",
                  }} />
                </div>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}
