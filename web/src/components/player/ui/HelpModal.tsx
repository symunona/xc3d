import { For, Show, createSignal } from "solid-js";
import { ANGLES } from "../constants";

// ── keyboard visual: physical rows, each key mapped to its in-app function. Keys with a
// function are highlighted; blanks stay dim. The number row 1–7 pulls the camera-angle
// labels straight from ANGLES so there's one source of truth. ──
const KEYFN: Record<string, string> = {
  q: "speed +", w: "show off-screen", t: "thermals", p: "controls",
  a: "speed −", s: "hide off-screen", f: "fps", g: "prev", h: "next", j: "−30 s", k: "+30 s", l: "labels",
  x: "seek mode", c: "cam mode", b: "alt graph", m: "grayscale",
};
const ROW_NUM = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const ROW_Q = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const ROW_A = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const ROW_Z = ["z", "x", "c", "v", "b", "n", "m", ",", "."];

// keys that don't sit on the lettered grid — shown as their own labelled strip
const EXTRA_KEYS: Array<[string, string]> = [
  ["space", "play / pause"],
  ["PgUp / PgDn", "seek ∓5 min"],
  [", / .", "orbit camera left / right"],
  ["[ / ]", "trail shorter / longer"],
  ["Tab", "hide all UI (world only)"],
  ["? ", "this help"],
  ["Esc", "close / exit"],
];

function Cap(props: { k: string; fn?: string; wide?: boolean }) {
  const active = () => !!props.fn;
  return (
    <div
      class="flex flex-col items-center justify-start rounded-md px-1 py-1 text-center"
      style={{
        "min-width": props.wide ? "3.4rem" : "2.4rem",
        "min-height": "2.6rem",
        flex: props.wide ? "1.4" : "1",
        background: active() ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "var(--bg-panel-solid)",
        border: `1px solid ${active() ? "var(--accent)" : "var(--border)"}`,
        color: active() ? "var(--text)" : "var(--text-dim)",
        "box-shadow": active() ? "inset 0 -2px 0 color-mix(in srgb, var(--accent) 40%, transparent)" : "none",
      }}
    >
      <span class="text-xs font-bold leading-none" style={{ color: active() ? "var(--accent)" : "var(--text-dim)" }}>
        {props.k.toUpperCase()}
      </span>
      <Show when={props.fn}>
        <span class="text-[9px] leading-tight mt-0.5" style={{ "word-break": "break-word" }}>{props.fn}</span>
      </Show>
    </div>
  );
}

function KeyRow(props: { keys: string[]; fn: (k: string) => string | undefined; indent?: number }) {
  return (
    <div class="flex gap-1" style={{ "margin-left": `${props.indent ?? 0}rem` }}>
      <For each={props.keys}>{(k) => <Cap k={k} fn={props.fn(k)} />}</For>
    </div>
  );
}

// arrow annotation pointing at a controller item (used in the Touch tab)
function Point(props: { children: any }) {
  return (
    <div class="flex items-start gap-2 py-1">
      <span style={{ color: "var(--accent)", "font-size": "1.1rem", "line-height": "1.2" }}>→</span>
      <span class="text-sm leading-snug">{props.children}</span>
    </div>
  );
}

// Help overlay (`?` / the drawer ? button). Two tabs — a keyboard layout and a touch guide;
// opens on the Touch tab for coarse-pointer (phone/tablet) devices, Keyboard otherwise.
export default function HelpModal(props: { onClose: () => void }) {
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const [tab, setTab] = createSignal<"keyboard" | "touch">(coarse ? "touch" : "keyboard");
  const angleFn = (k: string) => (ANGLES[k] ? ANGLES[k].label : undefined);

  const TabBtn = (p: { id: "keyboard" | "touch"; label: string }) => (
    <button
      type="button"
      class="text-sm px-3 py-1.5"
      onClick={() => setTab(p.id)}
      style={{
        background: "transparent",
        color: tab() === p.id ? "var(--accent)" : "var(--text)",
        border: "none",
        "border-bottom": `2px solid ${tab() === p.id ? "var(--accent)" : "transparent"}`,
        "margin-bottom": "-1px",
        cursor: "pointer",
        "font-weight": tab() === p.id ? 700 : 400,
      }}
    >
      {p.label}
    </button>
  );

  return (
    <div class="fixed inset-0 z-40 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.7)" }} onClick={props.onClose}>
      <div class="panel p-4 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-bold">Help</h3>
          <button class="btn text-sm" onClick={props.onClose}>✕</button>
        </div>

        {/* tab bar */}
        <div class="flex gap-1 mb-3" style={{ "border-bottom": "1px solid var(--border)" }}>
          <TabBtn id="keyboard" label="⌨ Keyboard" />
          <TabBtn id="touch" label="📱 Touch" />
        </div>

        {/* ── Keyboard: a labelled key layout ── */}
        <Show when={tab() === "keyboard"}>
          <div class="overflow-x-auto">
            <div class="flex flex-col gap-1" style={{ "min-width": "30rem" }}>
              <KeyRow keys={ROW_NUM} fn={angleFn} />
              <KeyRow keys={ROW_Q} fn={(k) => KEYFN[k]} indent={0.6} />
              <KeyRow keys={ROW_A} fn={(k) => KEYFN[k]} indent={1.1} />
              <KeyRow keys={ROW_Z} fn={(k) => KEYFN[k]} indent={1.6} />
              {/* space bar */}
              <div class="flex gap-1" style={{ "margin-left": "1.6rem" }}>
                <Cap k="space" fn="play / pause" wide />
              </div>
            </div>
          </div>
          <div class="text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>
            Number row 1–7 = camera angles. Highlighted keys are bound; dim keys are unused.
          </div>

          {/* the off-grid keys */}
          <div class="mt-3 flex flex-col gap-1.5">
            <For each={EXTRA_KEYS}>
              {([k, d]) => (
                <div class="flex items-center justify-between text-sm">
                  <kbd class="px-1.5 py-0.5 rounded text-xs"
                       style={{ background: "var(--bg-panel-solid)", border: "1px solid var(--border)" }}>{k.trim()}</kbd>
                  <span style={{ color: "var(--text-dim)" }}>{d}</span>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* ── Touch: the mobile navigation guide (proposed scheme) ── */}
        <Show when={tab() === "touch"}>
          <div class="flex flex-col gap-2">
            <div class="text-sm font-semibold">Getting around on a phone</div>
            <div class="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Two-tap navigation — the same idea as picking a pilot with the mouse, done with taps:
            </div>
            <Point><b>Tap a pilot</b> in the gaggle strip on the left to select them (their track lights up).</Point>
            <Point><b>Tap again</b> — or the ▶ — to lock the camera onto that pilot and follow.</Point>
            <Point>Use the <b>◂ ▸ arrows</b> on the controller to step to the previous / next pilot or gaggle (the touch version of <kbd class="px-1 rounded text-[10px]" style={{ background: "var(--bg-panel-solid)", border: "1px solid var(--border)" }}>h</kbd> / <kbd class="px-1 rounded text-[10px]" style={{ background: "var(--bg-panel-solid)", border: "1px solid var(--border)" }}>g</kbd>).</Point>
            <Point>Tap the <b>🎛 controls</b> button by the seek bar to open play / speed / camera.</Point>
            <Point>Turn on <b>seek mode</b> (Settings ▸ View) and tap the map to jump the clock to a point on a track.</Point>
            <Point>Drag on the map to orbit / tilt; pinch to zoom. Swipe from the left edge to go back.</Point>
            <div class="text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>
              All settings (basemap, sun, labels, layers) live under the ☰ button, top-right.
            </div>
          </div>
        </Show>

        {/* About + version */}
        <div class="mt-3 pt-3 text-xs leading-relaxed" style={{ "border-top": "1px solid var(--border)", color: "var(--text-dim)" }}>
          <div class="font-semibold mb-1" style={{ color: "var(--text)" }}>About</div>
          Built to understand how the XC pilots in my club actually fly, and to make real
          post-flight retrospectives possible. In 3D you can see what a flat track hides:
          where the climb was, when the gaggle split, how the glide worked out.
        </div>
        <div class="mt-3 pt-2 text-[11px] text-center flex items-center justify-center gap-2" style={{ "border-top": "1px solid var(--border)", color: "var(--text-dim)" }}>
          <span>XC3D v{import.meta.env.VITE_APP_VERSION ?? "dev"}</span>
          <span>·</span>
          <a href="https://github.com/symunona/xc3d" target="_blank" rel="noopener noreferrer"
             style={{ color: "var(--accent)", "text-decoration": "none" }}>GitHub ↗</a>
        </div>
      </div>
    </div>
  );
}
