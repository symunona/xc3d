import { For, Show, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { basemaps, type BasemapId } from "../lib/basemaps";
import type { MapLabel } from "./player/labels";
import { ToggleRow, SliderRow, SectionHead, TextRow } from "./menuKit";

const MAP_TILER = import.meta.env.VITE_MAP_TILER_ACCESS_TOKEN as string | undefined;

type Tab = "base" | "layers" | "view" | "labels" | "perf";
const TABS: { id: Tab; label: string }[] = [
  { id: "base", label: "Base" },
  { id: "layers", label: "Layers" },
  { id: "view", label: "View" },
  { id: "labels", label: "Labels" },
  { id: "perf", label: "Perf" },
];

// Curated shade tints for the Sun hillshade. BLACK is the default and stays first; the rest
// are useful low-key tints (cool-shadow blue, twilight purple, earthy brown, forest teal,
// dusk wine). Deliberately NOT the 20-colour pilot palette — these are dark, desaturated
// shadow colours, not track hues.
const SUN_SHADE_SWATCHES: { hex: string; label: string }[] = [
  { hex: "#000000", label: "black (default)" },
  { hex: "#0b1a3a", label: "deep blue" },
  { hex: "#241238", label: "purple" },
  { hex: "#3a2410", label: "warm brown" },
  { hex: "#08221c", label: "forest teal" },
  { hex: "#3a1015", label: "dusk wine" },
];

// small inline hotkey chip, e.g. "(x)", to advertise a control's keyboard shortcut
function Key(props: { k: string }) {
  return (
    <span class="text-[10px] font-mono" style={{ color: "var(--text-dim)", "margin-left": "4px" }} aria-hidden="true">
      ({props.k})
    </span>
  );
}

// All view settings on ONE slide-in drawer, split into tabs (Base · Layers · View · Labels ·
// Perf). Opens from a ☰ hamburger on every breakpoint and slides in from the right.
export default function SettingsMenu(props: {
  // room title (optional display name) — the room CODE stays the immutable identity
  roomTitle?: () => string;
  roomCode?: string;
  onRenameRoom?: (title: string) => void;

  basemap: () => BasemapId;
  onBasemap: (id: BasemapId) => void;
  hasToken: boolean;
  grayscale: () => number; // 0–100 % desaturation of the basemap (tracks stay coloured)
  onGrayscale: (v: number) => void;
  lightness: () => number; // CSS brightness() of the basemap: 0.3 (dark) … 1.0 … 1.7 (light)
  onLightness: (v: number) => void;

  sun: () => boolean; // sun-angle terrain shading (hillshade driven by the replay clock)
  onSun: (v: boolean) => void;
  sunShade: () => number; // 0–100 % opacity of that shading (alpha of the shaded side)
  onSunShade: (v: number) => void;
  sunShadeColor: () => string; // hex tint of the shaded side (RGB; the slider drives alpha)
  onSunShadeColor: (v: string) => void;
  castShadows: () => boolean; // sun v2: real DEM cast shadows (ray-march occlusion), additive
  onCastShadows: (v: boolean) => void;

  terrain: () => boolean;
  onTerrain: (v: boolean) => void;
  shadows: () => boolean;
  onShadows: (v: boolean) => void;
  dropLine: () => boolean;
  onDropLine: (v: boolean) => void;

  trailFull: () => boolean;
  onTrailFull: (v: boolean) => void;
  trailPct: () => number;
  onTrailPct: (v: number) => void;
  trailBudget: () => number;
  onTrailBudget: (v: number) => void;
  gpuTrails: () => boolean;
  onGpuTrails: (v: boolean) => void;
  labels: () => boolean;
  onLabels: (v: boolean) => void;
  declutterLabels: () => boolean; // de-overlap the pilot name tags + leader lines (gaggles)
  onDeclutterLabels: (v: boolean) => void;
  declutterAnchor: () => boolean; // mode: anchor-above + arrange-around vs the old spread
  onDeclutterAnchor: (v: boolean) => void;
  declutterMomentum: () => boolean; // ease + hold the arrangement (no fast blinking)
  onDeclutterMomentum: (v: boolean) => void;

  // ── map LABELS (named, terrain-fixed annotations) — the Labels tab. Client-side only:
  // labels persist per-user (a global set seeds new rooms) + per-room; sharing is JSON. ──
  mapLabels: () => boolean; // show/hide the labels layer
  onMapLabels: (v: boolean) => void;
  labelEdit: () => boolean; // edit mode: hides tracklogs, map clicks add/edit labels
  onLabelEdit: (v: boolean) => void;
  roomLabels?: () => MapLabel[]; // this room's labels
  onDeleteLabel?: (id: number) => void;
  onExportLabels?: () => void; // download this room's labels as a .json file
  onCopyLabelsJSON?: () => Promise<boolean>; // copy the JSON to the clipboard
  onImportLabels?: (text: string, mode: "merge" | "replace") => number; // returns # imported; throws on bad JSON

  // ── View tab: transport-adjacent view controls moved off the bottom-right panel ──
  soloVisible: () => boolean; // hide every tracklog except pilots airborne right now
  onSoloVisible: (v: boolean) => void;
  seekMode: () => boolean; // full tracks shown; click a track to jump the clock
  onSeekMode: (v: boolean) => void;
  showIntervals: () => boolean; // interval graph on the seek bar (who flew when)
  onShowIntervals: (v: boolean) => void;
  showFlags: () => boolean; // takeoff / landing flags on the seek bar
  onShowFlags: (v: boolean) => void;
  showGraph: () => boolean; // altitude graph / barogram strip
  onShowGraph: (v: boolean) => void;

  trackThermals: () => boolean; // per-track thermal analysis (climb detection + stats panel)
  onTrackThermals: (v: boolean) => void;
  glideStarts: () => boolean;
  onGlideStarts: (v: boolean) => void;
  highFps: () => boolean;
  onHighFps: (v: boolean) => void;
  fps?: () => number;

  onHelp?: () => void; // open the keyboard / help modal (the ? button at the drawer top)
  isMobile?: () => boolean; // mobile → full-width drawer instead of a fixed 360px panel
}) {
  const [tab, setTab] = createSignal<Tab>("base");
  const [open, setOpen] = createSignal(false);
  const options = () => basemaps(props.hasToken ? MAP_TILER : undefined);
  const anyActive = () => props.terrain() || props.shadows() || props.sun() || props.labelEdit();
  // ── labels: import UI state (a pasted-JSON box + a status line) ──
  const [importText, setImportText] = createSignal("");
  const [labelMsg, setLabelMsg] = createSignal("");
  const doImport = (mode: "merge" | "replace") => {
    const text = importText().trim();
    if (!text) { setLabelMsg("Paste a labels JSON first."); return; }
    try {
      const n = props.onImportLabels?.(text, mode) ?? 0;
      setImportText("");
      setLabelMsg(`Imported ${n} label${n === 1 ? "" : "s"} (${mode}).`);
    } catch (e: any) {
      setLabelMsg("Import failed: " + (e?.message ?? e));
    }
  };
  const onImportFile = (file: File | undefined, mode: "merge" | "replace") => {
    if (!file) return;
    file.text().then((t) => { setImportText(t); doImport(mode); }).catch(() => setLabelMsg("Couldn't read that file."));
  };

  // tab bar + selected-tab body — shared by the desktop dropdown and the mobile modal
  const Body = () => (
    <>
      {/* tab bar — underline-style tabs (active tab connects to the content below) */}
      <div class="flex gap-0.5 px-1" style={{ "border-bottom": "1px solid var(--border)" }}>
        <For each={TABS}>
          {(t) => {
            const active = () => tab() === t.id;
            const hot = () => t.id === "labels" && props.labelEdit();
            return (
              <button
                type="button"
                class="flex-1 text-xs px-1.5 pt-1.5 pb-1.5"
                onClick={() => setTab(t.id)}
                style={{
                  background: "transparent",
                  color: active() ? "var(--accent)" : hot() ? "var(--accent)" : "var(--text)",
                  border: "none",
                  "border-bottom": `2px solid ${active() ? "var(--accent)" : "transparent"}`,
                  "margin-bottom": "-1px",
                  cursor: "pointer",
                  "font-weight": active() ? 700 : 400,
                }}
              >
                {t.label}
              </button>
            );
          }}
        </For>
      </div>
      <div class="h-1" />

      {/* ── Base ── */}
      <Show when={tab() === "base"}>
        {/* room name: an optional human-readable title. The room CODE (in the header + URL)
            stays the identity — this only relabels it. Commits on Enter/blur; onRenameRoom
            persists it + broadcasts so everyone in the room sees the new header live. */}
        <Show when={props.onRenameRoom}>
          <SectionHead>Room</SectionHead>
          <TextRow
            label="Room name" hint={props.roomCode ? `code ${props.roomCode}` : undefined}
            placeholder={props.roomCode ?? "name this room"}
            value={() => props.roomTitle?.() ?? ""}
            onCommit={(v) => props.onRenameRoom!(v)}
          />
          <div class="h-px mx-1 my-1" style={{ background: "var(--border)" }} />
        </Show>
        <SectionHead>Basemap</SectionHead>
        <For each={options()}>
          {(b) => {
            const sel = () => props.basemap() === b.id;
            return (
              <button
                type="button"
                title={b.hint ?? b.label}
                onClick={() => props.onBasemap(b.id)}
                class="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-lg"
                style={{
                  background: sel() ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "transparent",
                  border: `1px solid ${sel() ? "var(--accent)" : "transparent"}`,
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "12px", height: "12px", "margin-top": "3px", "flex-shrink": 0, "border-radius": "50%",
                    border: `1px solid ${sel() ? "var(--accent)" : "var(--border)"}`,
                    background: sel() ? "var(--accent)" : "transparent",
                  }}
                />
                <span class="min-w-0 flex-1">
                  <span class="block text-sm leading-tight" style={{ color: sel() ? "var(--accent)" : "var(--text)" }}>{b.label}</span>
                  <Show when={b.hint}>
                    <span class="block text-[10px] leading-tight mt-0.5" style={{ color: "var(--text-dim)" }}>{b.hint}</span>
                  </Show>
                </span>
              </button>
            );
          }}
        </For>
        {/* ── Sun: shade the TERRAIN by the sun angle at the current replay time. ── */}
        <div class="h-px mx-1 my-1" style={{ background: "var(--border)" }} />
        <ToggleRow
          label="Sun" hint="shade the terrain by the sun angle at the current time"
          title="Shade the terrain from the real sun position at the playhead's time and place — which slopes are in the sun (working) and which are in their own shade. Follows the clock as the replay runs. Needs a MapTiler token (the terrain DEM)."
          value={props.sun} onChange={props.onSun}
        />
        <SliderRow
          label="sun shade" min={0} max={100} step={5}
          value={props.sunShade} onChange={props.onSunShade}
          fmt={(v) => (v === 0 ? "off" : `${v}%`)}
        />
        {/* shade COLOUR: tints the RGB of the shaded side; the slider above keeps driving its
            opacity, so colour + strength are independent. Black is the default (first swatch). */}
        <div class="px-2 py-1">
          <div class="flex items-center justify-between text-[10px]" style={{ color: "var(--text-dim)" }}>
            <span>shade colour</span>
          </div>
          <div class="flex flex-wrap gap-2" style={{ "margin-top": "3px" }}>
            <For each={SUN_SHADE_SWATCHES}>
              {(sw) => {
                const sel = () => props.sunShadeColor().toLowerCase() === sw.hex.toLowerCase();
                return (
                  <button
                    type="button" title={sw.label}
                    onClick={() => props.onSunShadeColor(sw.hex)}
                    style={{
                      "background-color": sw.hex,
                      width: "24px", height: "24px", "border-radius": "7px",
                      border: "1px solid var(--border)",
                      outline: sel() ? "2px solid var(--accent)" : "none",
                      "outline-offset": "2px",
                      cursor: "pointer",
                    }}
                  />
                );
              }}
            </For>
          </div>
        </div>
        {/* Sun v2: REAL cast shadows — additive over the hillshade above. */}
        <ToggleRow
          label="Cast shadows" hint="real terrain occlusion (peaks shadow the valley)"
          title="Sun v2: march a ray from every point toward the sun and darken it if the terrain occludes it — actual cast shadows that lengthen at a low sun and shrink toward midday. Additive over the Sun hillshade. Heavier: recomputed when the map settles or the clock ticks, not every frame."
          value={props.castShadows} onChange={props.onCastShadows}
        />
        {/* desaturate ONLY the basemap so tracks/gliders/labels pop. Toggle with `m`. */}
        <div class="h-px mx-1 my-1" style={{ background: "var(--border)" }} />
        <SliderRow
          label="grayscale (m)" min={0} max={100} step={5}
          value={props.grayscale} onChange={props.onGrayscale}
          fmt={(v) => (v === 0 ? "off" : `${v}%`)}
        />
        <SliderRow
          label="lightness" min={0.3} max={1.7} step={0.05}
          value={props.lightness} onChange={props.onLightness}
          fmt={(v) => (v === 1 ? "normal" : `${v.toFixed(2)}×`)}
        />
      </Show>

      {/* ── Layers ── */}
      <Show when={tab() === "layers"}>
        <SectionHead>Overlays</SectionHead>
        <ToggleRow
          label="3D terrain" hint="raster-dem relief + above-ground-level"
          title="Drape the map over elevation data. Needed for AGL readouts."
          value={props.terrain} onChange={props.onTerrain}
        />
        <ToggleRow
          label="Path shadows" hint="ground-projected copy of each track"
          title="Draw each flight path again at ground level, so you can read height over terrain."
          value={props.shadows} onChange={props.onShadows}
        />
        <Show when={props.shadows()}>
          <div style={{ "padding-left": "0.5rem" }}>
            <ToggleRow
              label="Drop line" hint="dark line from glider down to its shadow"
              title="Draw a subtle vertical line from each glider to its ground shadow."
              value={props.dropLine} onChange={props.onDropLine}
            />
          </div>
        </Show>
        <ToggleRow
          label="Glide starts" hint="↘ marker + start altitude at each glide onset"
          title="Drop a teal marker labelled with the start altitude wherever the followed pilot leaves a climb and starts gliding. Markers accumulate as the replay passes each glide onset."
          value={props.glideStarts} onChange={props.onGlideStarts}
        />
      </Show>

      {/* ── View ── transport-adjacent controls moved off the bottom-right panel ── */}
      <Show when={tab() === "view"}>
        <SectionHead>Tracks</SectionHead>
        <ToggleRow
          label="Solo visible" hint="hide all tracklogs except pilots airborne right now"
          title="Hide every tracklog except the pilots airborne at the playhead — clock-following, so landed / not-yet-launched pilots drop out and return. Layers on top of any manual hiding."
          value={props.soloVisible} onChange={props.onSoloVisible}
        />
        <ToggleRow
          label={"Seek mode (x)"} hint="full tracks shown — click a track to jump the clock there"
          title="Show every full track (climb bright / sink dark, future dimmed) and click any track to jump the clock to that point (x)."
          value={props.seekMode} onChange={props.onSeekMode}
        />
        <div class="h-px mx-1 my-1" style={{ background: "var(--border)" }} />
        <SectionHead>Timeline</SectionHead>
        <ToggleRow
          label="Interval graph" hint="who flew when — bars on the seek bar"
          title="Overlay a per-pilot interval graph on the seek bar: who was airborne when."
          value={props.showIntervals} onChange={props.onShowIntervals}
        />
        <ToggleRow
          label="Flags" hint="takeoff / landing markers on the seek bar"
          title="Mark each pilot's takeoff and landing times on the seek bar."
          value={props.showFlags} onChange={props.onShowFlags}
        />
        <div class="h-px mx-1 my-1" style={{ background: "var(--border)" }} />
        <SectionHead>Analysis</SectionHead>
        <ToggleRow
          label={"Altitude graph (b)"} hint="barogram strip under the map"
          title="Show the altitude graph / barogram strip for the followed pilot (b)."
          value={props.showGraph} onChange={props.onShowGraph}
        />
        <ToggleRow
          label={"Thermal analysis (t)"} hint="detect this track's climbs — markers + stats panel"
          title="Segment the followed pilot's own track into thermals: enter/exit markers on the map and a stats panel (gain, avg/max climb, time). Toggle with 't'."
          value={props.trackThermals} onChange={props.onTrackThermals}
        />
      </Show>

      {/* ── Labels ── named, terrain-fixed annotations. Client-side; per-user + per-room. ── */}
      <Show when={tab() === "labels"}>
        <SectionHead>Map labels</SectionHead>
        <div class="px-2 pb-1 text-[11px] leading-snug" style={{ color: "var(--text-dim)" }}>
          Your own named markers pinned to spots on the map — launches, LZs, turnpoints,
          known thermals. They stick to the terrain as you fly the replay, and carry over to
          every room (saved in this browser). Turn on edit mode and click the map to place one.
        </div>
        {/* label EDIT mode as a single prominent button (not a checkbox), hotkey shown */}
        <div class="px-2 py-1">
          <button
            type="button"
            class="btn w-full"
            classList={{ "btn-accent": props.labelEdit() }}
            title="Turn the map into a label editor: tracklogs hide, and a click adds a label (or opens rename/delete on one you click). Labels are saved in this browser. Hotkey: l"
            onClick={() => props.onLabelEdit(!props.labelEdit())}
          >
            {props.labelEdit() ? "🏷 Editing… — click the map to add / edit" : "🏷 Enter label edit mode"}
            <Key k="l" />
          </button>
        </div>
        <ToggleRow
          label="Show labels" hint="the terrain-fixed annotations layer"
          title="Show or hide the map labels layer (they sit on the terrain, behind the tracks)."
          value={props.mapLabels} onChange={props.onMapLabels}
        />

        <div class="h-px mx-1 my-1" style={{ background: "var(--border)" }} />

        {/* this room's labels — rename inline (edit mode is easier on the map) / delete here */}
        <SectionHead>This room's labels ({(props.roomLabels?.() ?? []).length})</SectionHead>
        <div class="overflow-auto" style={{ "max-height": "9rem" }}>
          <Show
            when={(props.roomLabels?.() ?? []).length}
            fallback={
              <div class="px-2 py-1.5 text-[10px] leading-tight" style={{ color: "var(--text-dim)" }}>
                No labels yet — turn on edit mode and click the map to place one.
              </div>
            }
          >
            <For each={props.roomLabels?.() ?? []}>
              {(l) => (
                <div class="flex items-center gap-1 px-2 py-1">
                  <span class="min-w-0 flex-1 truncate text-sm" title={l.name}>📍 {l.name}</span>
                  <button
                    type="button" class="btn text-xs" title="Delete this label"
                    onClick={() => props.onDeleteLabel?.(l.id)}
                  >🗑</button>
                </div>
              )}
            </For>
          </Show>
        </div>

        <div class="h-px mx-1 my-1" style={{ background: "var(--border)" }} />

        {/* SHARE: export the current set to a file / clipboard, import a shared set here */}
        <SectionHead>Share (JSON)</SectionHead>
        <div class="flex items-center gap-1.5 px-2 pb-1">
          <button
            type="button" class="btn text-xs flex-1"
            title="Download this room's labels as a .json file"
            onClick={() => props.onExportLabels?.()}
          >⭳ Export file</button>
          <button
            type="button" class="btn text-xs flex-1"
            title="Copy this room's labels JSON to the clipboard"
            onClick={async () => setLabelMsg((await props.onCopyLabelsJSON?.()) ? "Copied JSON to clipboard." : "Clipboard unavailable.")}
          >⧉ Copy</button>
        </div>
        <div class="px-2 py-1">
          <label class="text-[10px]" style={{ color: "var(--text-dim)" }}>Import — paste JSON or load a file</label>
          <textarea
            class="w-full text-xs" rows={3} style={{ "margin-top": "3px", "font-family": "monospace" }}
            placeholder='{"kind":"xc3d-labels",…}'
            value={importText()}
            onInput={(e) => setImportText(e.currentTarget.value)}
          />
          <div class="flex items-center gap-1.5 mt-1">
            <button type="button" class="btn btn-accent text-xs flex-1" title="Add the imported labels to this room's set" onClick={() => doImport("merge")}>Merge</button>
            <button type="button" class="btn text-xs flex-1" title="Replace this room's labels with the imported set" onClick={() => doImport("replace")}>Replace</button>
            <label class="btn text-xs" title="Load a .json file and merge it" style={{ cursor: "pointer" }}>
              ⭱ File
              <input
                type="file" accept="application/json,.json" style={{ display: "none" }}
                onChange={(e) => { onImportFile(e.currentTarget.files?.[0], "merge"); e.currentTarget.value = ""; }}
              />
            </label>
          </div>
          <Show when={labelMsg()}>
            <div class="text-[10px] leading-tight mt-1" style={{ color: "var(--text-dim)" }}>{labelMsg()}</div>
          </Show>
        </div>
      </Show>

      {/* ── Perf ── */}
      <Show when={tab() === "perf"}>
        <SectionHead>Performance</SectionHead>
        <ToggleRow
          label="Full trails" hint="heaviest — full track geometry each frame"
          title="On: draw the whole flown track. Off: only a recent slice (much cheaper)."
          value={props.trailFull} onChange={props.onTrailFull}
        />
        <Show when={!props.trailFull()}>
          <SliderRow label="trail length" min={2} max={100} step={1} value={props.trailPct} onChange={props.onTrailPct} fmt={(v) => `${v}%`} />
        </Show>
        <SliderRow
          label="trail detail" min={500} max={100000} step={500}
          value={props.trailBudget} onChange={props.onTrailBudget} fmt={(v) => `${(v / 1000).toFixed(v >= 1000 ? 0 : 2)}k pts`}
        />
        <ToggleRow
          label="GPU trails" hint="TripsLayer — reveal on the GPU, free playback"
          title="Render trails with deck TripsLayer: upload once, reveal by time on the GPU. No per-frame re-tesselation. Experimental."
          value={props.gpuTrails} onChange={props.onGpuTrails}
        />
        <ToggleRow
          label="Pilot labels" hint="text rendering per pilot"
          title="Show each pilot's name on the map." value={props.labels} onChange={props.onLabels}
        />
        <Show when={props.labels()}>
          <div style={{ "padding-left": "0.5rem" }}>
            <ToggleRow
              label="Declutter labels" hint="de-overlap the pilot name tags in a gaggle"
              title="In a gaggle, de-overlap the pilot name tags so they stay readable. Tune the behaviour with the options below."
              value={props.declutterLabels} onChange={props.onDeclutterLabels}
            />
            {/* tuning modes — checkmarks so you can dial in the right behaviour */}
            <Show when={props.declutterLabels()}>
              <div style={{ "padding-left": "0.5rem" }}>
                <ToggleRow
                  label="Anchor &amp; arrange" hint="on: above the dot, fan out on collision · off: push-apart spread"
                  title="On (new): each tag sits above its dot with no line; colliding tags fan out around their dots (2 → sides · 3 → sides + up · 4 → sides + up + down · more → sides, stacked) with L-shaped leaders. Off: the original greedy push-apart spread."
                  value={props.declutterAnchor} onChange={props.onDeclutterAnchor}
                />
                <ToggleRow
                  label="Momentum" hint="ease motion + hold a chosen side for a few seconds"
                  title="Smooth the tags into place instead of snapping, and keep a colliding tag's chosen side for ~2.5 s after the collision clears, so tags don't blink around."
                  value={props.declutterMomentum} onChange={props.onDeclutterMomentum}
                />
              </div>
            </Show>
          </div>
        </Show>
        <ToggleRow
          label="60 fps updates" hint="recompute every frame vs 4×/s"
          title="On: rebuild layers every animation frame. Off: throttled updates (4×/s)."
          value={props.highFps} onChange={props.onHighFps}
        />
        <Show when={props.fps}>
          <div class="flex items-center justify-between px-2 py-1 mt-1 rounded-lg" title="Measured frames per second" style={{ background: "var(--bg-panel-solid)" }}>
            <span class="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>fps</span>
            <span class="text-sm font-bold tabular-nums" style={{ color: "var(--accent)" }}>{Math.round(props.fps!())}</span>
          </div>
        </Show>
      </Show>
    </>
  );

  // ☰ hamburger on EVERY breakpoint → a right slide-in drawer. Desktop = fixed 360px panel;
  // mobile = full width. The (?) help button sits at the top, always visible.
  return (
    <>
      <button
        type="button"
        class="btn"
        classList={{ "btn-accent": open() || anyActive() }}
        title="Settings & help"
        aria-label="Open settings"
        onClick={() => setOpen(true)}
      >
        ☰
      </button>
      <Show when={open()}>
        <Portal>
          <div class="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setOpen(false)} />
          <div
            class="fixed top-0 right-0 z-50 h-full flex flex-col panel settings-drawer"
            style={{
              width: props.isMobile?.() ? "100%" : "360px",
              "max-width": "100%",
              "border-radius": "0",
              "box-shadow": "-8px 0 24px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header: title · always-visible ? help · close */}
            <div class="flex items-center gap-2 px-3 py-2" style={{ "border-bottom": "1px solid var(--border)", "flex-shrink": 0 }}>
              <span class="text-sm font-bold flex-1" style={{ color: "var(--accent)" }}>⚙ Settings</span>
              <button type="button" class="btn text-sm" title="Keyboard shortcuts & help (?)" aria-label="Help" onClick={() => props.onHelp?.()}>?</button>
              <button type="button" class="btn text-sm" title="Close" aria-label="Close settings" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div class="flex-1 overflow-auto p-2 flex flex-col gap-1">
              {Body()}
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
}
