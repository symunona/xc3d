import { createSignal, createMemo, onMount, onCleanup, createEffect, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import type { SessionFlight, Track } from "../../lib/types";
import { loadLabels, saveLabels, labelsToJSON, labelsFromJSON, type MapLabel } from "./labels";
import { sampleTrack, idxAtTime, haversine } from "../../lib/geo";
import { freeTriangle, distFromStart } from "../../lib/fai";
import { gaggles, orderByProximity, type Node } from "../../lib/gaggles";
import { basemapStyle, type BasemapId } from "../../lib/basemaps";
import { detectThermals, detectGlides, type Thermal, type Glide } from "../../lib/tracklogThermals";
import SettingsMenu from "../SettingsMenu";
import AltitudeGraph from "../AltitudeGraph";
import {
  ANGLES, SEEK_SMALL, SEEK_BIG, TRAIL_STEP, SPEEDS, MAP_TILER,
  GAGGLE_THRESHOLD_M,
} from "./constants";
import type { FollowMode, FlightState, Stat, Live, Dbg } from "./types";
import { todOfLaunch, fmtClock, fmtHM, rgb, dim, toHex } from "./format";
import { sunPosition, instantOf } from "./sun";
import { CastShadow } from "./castShadow";
import {
  VIEW_LS_KEY, type ViewPrefs, loadViewPrefs, loadRoomPos, saveRoomPos, type RoomPos,
  loadPanelPrefs, savePanelPrefs,
} from "./viewPrefs";
import LoadScreen, { overallFraction, LOAD_STAGES, MAP_STAGE_BASE } from "../LoadScreen";
import { profMark, profReport } from "../../lib/profile";
import BrandBar from "./ui/BrandBar";
import DebugHud from "./ui/DebugHud";
import HelpModal from "./ui/HelpModal";
import Hotkey from "./ui/Hotkey";
import GaggleDock from "./ui/GaggleDock";
import ThermalPanel from "./ui/ThermalPanel";

// The WebGL-boot stages live at the back of the shared LoadScreen checklist (LOAD_STAGES
// indices MAP_STAGE_BASE..end): "Starting the map engine", "Loading the base map",
// "Building the scene", "Placing the flights". loadStep below is the LOCAL 0-based index
// into that tail; the shared screen shows it as MAP_STAGE_BASE + loadStep. The stage that
// never ticks to ✓ is where a stuck load froze (weak GPU on engine, slow tiles on base map).
const MAP_STEPS = LOAD_STAGES.length - MAP_STAGE_BASE; // 4 — local "all done" sentinel

// Yield to the browser so a setLoadStep() actually PAINTS before the (possibly
// hanging) work of that stage runs. Without this the whole scene setup is ONE
// synchronous turn — stages 2 and 3 never render, so any freeze inside setup()
// leaves the loader stuck on stage 1 ("Loading the base map") no matter what's
// really running, and you can't tell where it died. Double rAF = the DOM update
// is committed AND a frame is presented before we hand control back to the work.
const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export default function Player(props: {
  flights: () => SessionFlight[];
  sessionId: string;
  roomTitle?: () => string; // optional display title; falls back to sessionId (the room CODE)
  selfName: string;
  hasOwnFlight?: boolean;
  onAddFlight?: () => void;
  onRemoveFlight?: (fingerprint: string) => void;
  onRenameFlight?: (fingerprint: string, name: string) => void;
  onRenameRoom?: (title: string) => void;
}) {
  let container!: HTMLDivElement;
  let map: maplibregl.Map;
  let overlay: MapboxOverlay;
  const live = new Map<string, Live>();
  // per-flight full track + color; the visible trail is sliced to the playhead each frame
  const pathData = new Map<string, { track: Track; color: [number, number, number]; vs: number[] }>();
  // Per-pilot trail cache: the flown-so-far polyline (NO live tip) kept in a stable
  // array + wrapper so deck only re-tesselates when the trail's SHAPE changes
  // (grew / shrank / hover / trim), not every frame. sig encodes that shape; the
  // moving tip is drawn by a separate cheap layer. This is the perf hot path — a full
  // rebuild here every frame cost ~170 ms/frame at ~84k vertices.
  const trailCache = new Map<string, { coords: number[][]; wrap: { path: number[][]; colors: number[][] }[]; sig: string }>();
  // GPU-trail (TripsLayer) cache: each pilot's FULL decimated path + tod timestamps,
  // precomputed once per budget (the track is complete at load — only the reveal grows,
  // via the currentTime uniform). tripsData is the stable shared data array deck diffs.
  const tripsCache = new Map<string, { path: number[][]; timestamps: number[]; colors: number[][]; colorsDim: number[][]; sig: string }>();
  let tripsData: { path: number[][]; timestamps: number[]; colors: number[][]; colorsDim: number[][]; color: [number, number, number] }[] | null = null;
  let tripsDataSig = "";
  // static launch (▲) markers: rebuilt only when the visible pilot set changes
  let startLayer: TextLayer | null = null, startSig = "";
  // ── label declutter: per-pilot RESOLVED screen pixel-offset for the name tag (keyed by
  // pilot key). The solver (a throttled greedy AABB push-apart) writes this; the TextLayer
  // reads it as its per-label getPixelOffset every frame, and the leader lines are rebuilt
  // each frame from it — so tags + lines stay glued to the moving dots between solves.
  const declutterOffsets = new Map<string, [number, number]>();
  // per-pilot momentum/hysteresis state for the anchor-arrange declutter mode: the current
  // (eased) pixel offset, the assigned slot direction, and how long to HOLD that alignment
  // after a collision clears (so tags don't blink back the instant a gaggle loosens).
  type DeclState = { ox: number; oy: number; dir: number; heldUntil: number };
  const declutterState = new Map<string, DeclState>();
  let lastDeclutterSolve = 0;
  const DECLUTTER_MS = 130; // re-solve at ~7.5 Hz max (cheap, and tags may lag a frame)
  const NAME_DEF_OFF: [number, number] = [0, -14]; // the tag's default lift above its dot
  // slot directions for the anchor-arrange mode (0 = above, no leader)
  const DIR_NONE = 0, DIR_LEFT = 1, DIR_RIGHT = 2, DIR_UP = 3, DIR_DOWN = 4;
  const DECL_HOLD_MS = 2500; // keep a colliding tag's chosen side for ~2.5 s after it clears
  const DECL_EASE = 0.28;    // per-solve easing toward the target offset (momentum)
  let mapReady = false;
  let hasTerrain = false;

  const [playhead, setPlayhead] = createSignal(0);
  const [playing, setPlaying] = createSignal(false); // start paused — show the whole flight first
  const [speedIdx, setSpeedIdx] = createSignal(SPEEDS.indexOf(16)); // default 16×
  const [followMode, setFollowMode] = createSignal<FollowMode>("free"); // whole flight in view until user picks a chase cam
  const [followKey, setFollowKey] = createSignal<string | null>(null);
  const [stats, setStats] = createSignal<Stat[]>([]);
  const [ready, setReady] = createSignal(false);
  // ── loading progress: booting the map (GL context, style, tiles, COPC) can take a
  // few seconds, so show a STAGE CHECKLIST + elapsed clock instead of an indefinite
  // spinner ("it just keeps loading for unknown amount of time"). loadStep = index of the
  // stage currently in progress; loadError = a fatal message; mapNote = the last non-fatal
  // map warning (shown only if the load drags, to hint at what's wrong). ──
  const [loadStep, setLoadStep] = createSignal(0);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [mapNote, setMapNote] = createSignal<string | null>(null);
  // (elapsed is tracked by the shared LoadScreen via the profiler, so no local clock here)
  const [followGaggle, setFollowGaggle] = createSignal<number | null>(null);
  // desired camera aim — angle presets + , / . drive these; the follow cams read
  // them each frame so 1–4 and orbiting work WHILE chasing, not just in free mode.
  const [camPitch, setCamPitch] = createSignal(55);
  const [camBearing, setCamBearing] = createSignal(0);
  // ACTUAL map bearing (drives the top-right compass rose). Updated from the loop only
  // when it changes, so a still map doesn't churn the signal.
  const [mapBearing, setMapBearing] = createSignal(0);
  const [mapPitch, setMapPitch] = createSignal(0); // drives the compass rose's 3D tilt
  let lastBearing = -999, lastPitch = -999;

  // responsive: on a phone (portrait ≈390px) we collapse the top rails under a ☰.
  const [isMobile, setIsMobile] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false); // the ☰ dropdown (mobile only)
  onMount(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => { setIsMobile(mq.matches); if (!mq.matches) setMenuOpen(false); };
    update();
    mq.addEventListener("change", update);
    onCleanup(() => mq.removeEventListener("change", update));
  });

  // panels — open/closed state is restored from localStorage so a refresh (or the next
  // room) shows the exact same chrome; the persist effect below writes it back on change.
  const _pp = loadPanelPrefs();
  const [showControls, setShowControls] = createSignal(_pp.controls);
  const [showGaggles, setShowGaggles] = createSignal(_pp.gaggles);
  const [showGraph, setShowGraph] = createSignal(_pp.graph);
  const [showHelp, setShowHelp] = createSignal(_pp.help);
  const [showThermalPanel, setShowThermalPanel] = createSignal(_pp.thermalPanel); // thermal stats table (hide ≠ turn off markers)
  const [showFlags, setShowFlags] = createSignal(_pp.flags); // takeoff/landing flag labels on the timeline
  const [showIntervals, setShowIntervals] = createSignal(_pp.intervals); // Gantt of flight time-spans
  const [hideUI, setHideUI] = createSignal(_pp.hideUI);        // Tab → world only, no chrome
  // seek mode: show every visible pilot's FULL track (past bright, future dim, both
  // coloured by climb/sink); clicking/tapping near a track jumps the playhead there.
  const [seekMode, setSeekMode] = createSignal(false);

  // pilots whose trail/marker/label are hidden on the map (toggled from the list).
  // still counted in stats/gaggles so you can un-hide them.
  const [hidden, setHidden] = createSignal<Set<string>>(new Set());
  // pilot the pointer is over / pressing (list row): show their FULL track, ignore trimming
  const [hoverKey, setHoverKey] = createSignal<string | null>(null);
  // last pilot the user clicked in the dock — the thermal/glide panel keys off this, so
  // picking someone in a gaggle shows THEIR climbs (not just the first flight's).
  const [selectedKey, setSelectedKey] = createSignal<string | null>(null);
  // the thermal/glide row the user clicked in the panel — its track segment gets a bright
  // white-glow highlight on the map. Cleared when the selected pilot changes (the indices
  // are into that pilot's track, so they don't carry over).
  const [selSeg, setSelSeg] = createSignal<{ kind: "thermal" | "glide"; idx: number } | null>(null);
  createEffect(() => { selectedKey(); setSelSeg(null); });
  const isHidden = (key: string) => hidden().has(key);
  const toggleHidden = (key: string) =>
    setHidden((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  // Solo-visible (`s` / control-panel button): hide every tracklog EXCEPT the pilots
  // airborne at the playhead. A live, clock-following filter — landed / not-yet-launched
  // pilots drop out and reappear as the replay clock moves. It layers ON TOP of the manual
  // hidden set and never mutates it, so toggling off restores exactly the manual state.
  const [soloVisible, setSoloVisible] = createSignal(false);
  const airborneNow = (key: string) => live.get(key)?.state === "air";
  // render-time visibility used by every MAP layer (NOT the pilot-list checkboxes, which
  // reflect the manual set via isHidden): manual-hidden OR (solo-visible AND not airborne).
  const renderHidden = (key: string) => hidden().has(key) || (soloVisible() && !airborneNow(key));
  // `w` (show) / `s` (hide): operate on the pilots whose CURRENT-playhead dot is OFF the
  // visible map right now — screen-space test (accurate under 3D pitch, unlike getBounds()).
  // Uses the actual current position, NOT any part of the track line.
  const offscreenNow = (): string[] => {
    if (!mapReady) return [];
    const cv = map.getCanvas();
    const W = cv.clientWidth, H = cv.clientHeight;
    const out: string[] = [];
    for (const [key, l] of live) {
      const p = map.project([l.lon, l.lat]);
      if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) out.push(key);
    }
    return out;
  };
  // `s` — hide every pilot not currently on screen (keep only the dots you can see now)
  const hideOffscreen = () =>
    setHidden((prev) => new Set([...prev, ...offscreenNow()]));
  // `w` — reveal every pilot whose current dot is off screen (un-hide them; inverse of `s`)
  const showOffscreen = () =>
    setHidden((prev) => { const n = new Set(prev); for (const k of offscreenNow()) n.delete(k); return n; });
  // ── bulk trail-visibility ops driven from the pilot-list header ──
  // every pilot's stable key, in room order (drives All / None / Invert + the name filter)
  const allTrailKeys = () => props.flights().map(keyOf);
  const showAllTrails = () => setHidden(new Set());                        // clear → every trail on
  const hideAllTrails = () => setHidden(new Set(allTrailKeys()));          // all keys → every trail off
  const invertTrails = () =>                                              // flip each pilot's visibility
    setHidden((prev) => {
      const n = new Set<string>();
      for (const k of allTrailKeys()) if (!prev.has(k)) n.add(k);
      return n;
    });
  // apply a name filter to the MAP: matching pilots stay visible, the rest get hidden.
  // Empty query un-hides everyone (so it doubles as a reset). Case-insensitive substring.
  const applyNameFilter = (q: string) =>
    setHidden(() => {
      const s = q.trim().toLowerCase();
      const n = new Set<string>();
      if (s) for (const f of props.flights()) if (!f.name.toLowerCase().includes(s)) n.add(keyOf(f));
      return n;
    });

  // map + perf options — seeded from the persisted view prefs (Base · Layers · Perf),
  // saved back below whenever any change, so they stick across rooms + sessions.
  const _vp = loadViewPrefs();
  const [basemap, setBasemap] = createSignal<BasemapId>(_vp.basemap);
  const [terrainOn, setTerrainOn] = createSignal(_vp.terrain);
  const [shadows, setShadows] = createSignal(_vp.shadows);
  // vertical drop-line from glider down to its ground shadow — on by default whenever
  // shadows are on (enabling shadows flips this on; see the effect below).
  const [dropLine, setDropLine] = createSignal(_vp.dropLine);
  createEffect(() => { if (shadows()) setDropLine(true); });
  // sun-angle terrain shading: a hillshade layer over the DEM, its illumination direction
  // driven by the real sun position at the playhead's instant (see the sun section below).
  const [sunOn, setSunOn] = createSignal(_vp.sun);
  // …and how hard that shading is painted: 0–100 %, straight into the alpha of the
  // hillshade's shadow colour (see sunShadeColor below).
  const [sunShade, setSunShade] = createSignal(_vp.sunShade);
  // …and what COLOUR the shaded side is tinted (RGB of the hillshade-shadow-color; the
  // slider above still drives its ALPHA). Black by default; a curated swatch set in
  // Settings › Base offers a few tints (deep blue, purple, warm brown, …).
  const [sunShadeCol, setSunShadeCol] = createSignal(_vp.sunShadeColor);
  // sun v2: REAL cast shadows (DEM ray-march occlusion), additive over the hillshade, off by
  // default. The controller (castShadow.ts) is created once the map exists; see below.
  const [castShadows, setCastShadows] = createSignal(_vp.castShadows);
  let cast: CastShadow | null = null;

  // performance toggles (each is independently benchmarkable — see README)
  const [trailFull, setTrailFull] = createSignal(_vp.trailFull);
  // when full trails are OFF, show only this % of each flight's length behind the glider
  const [trailPct, setTrailPct] = createSignal(_vp.trailPct);
  // max vertices a trail is decimated to (Perf tab slider) — higher = crisper, costlier
  const [trailBudget, setTrailBudget] = createSignal(_vp.trailBudget);
  // GPU trails: render via TripsLayer (upload once, reveal by a currentTime uniform) —
  // per-frame growth is free on the GPU (~38× cheaper at 16× than the CPU PathLayer).
  // Default on; toggle off in Perf for the PathLayer fallback (e.g. to use path shadows).
  const [gpuTrails, setGpuTrails] = createSignal(_vp.gpuTrails);
  const [labelsOn, setLabelsOn] = createSignal(_vp.labels);
  // ── map LABELS (named, terrain-fixed annotations — distinct from the pilot NAME tags) ──
  // PURELY CLIENT-SIDE: a room's labels live in localStorage (keyed by room id) and are
  // seeded here on mount; the effect below persists any change. Sharing is JSON export /
  // import (see the Labels settings tab) — no server. `mapLabelsOn` shows/hides the layer
  // (persisted with the other view prefs); edit mode is a transient session lever that
  // hides the tracklogs and turns map clicks into add/edit actions (see the click handler).
  const [labels, setLabels] = createStore<MapLabel[]>(loadLabels(props.sessionId));
  // persist this room's labels on any add/rename/delete/import (the .map reads every field
  // so the effect tracks them all). Keyed by room id, so each room keeps its own set.
  createEffect(() => {
    saveLabels(props.sessionId, labels.map((l) => ({ id: l.id, name: l.name, lon: l.lon, lat: l.lat })));
  });
  let labelSeq = Date.now(); // monotonic client-local id source (unique within this room)
  const nextLabelId = () => labelSeq++;
  const [mapLabelsOn, setMapLabelsOn] = createSignal(_vp.mapLabels);
  const [labelEditMode, setLabelEditMode] = createSignal(false);
  // the little context menu shown at the cursor in edit mode: either "add a label here" at a
  // clicked map point, or rename/delete an existing label the user clicked. Null = closed.
  const [labelMenu, setLabelMenu] = createSignal<
    | { x: number; y: number; lng: number; lat: number; label?: MapLabel }
    | null
  >(null);
  const [labelDraft, setLabelDraft] = createSignal("");
  // leaving edit mode closes any open context menu
  createEffect(() => { if (!labelEditMode()) setLabelMenu(null); });

  // ── label mutators (localStorage-backed via the persist effect above) ──
  const addLabelAt = (name: string, lon: number, lat: number) => setLabels(labels.length, { id: nextLabelId(), name, lon, lat });
  const renameLabelById = (id: number, name: string) => { const i = labels.findIndex((l) => l.id === id); if (i >= 0) setLabels(i, "name", name); };
  // rebuild as fresh plain objects so the store definitely reconciles a REMOVAL (passing the
  // existing store proxies straight back can no-op on a shrink — the array-of-proxies footgun).
  const deleteLabelById = (id: number) =>
    setLabels(labels.filter((l) => l.id !== id).map((l) => ({ id: l.id, name: l.name, lon: l.lon, lat: l.lat })));

  // menu actions — mutate the local store (persisted by the effect), then close the menu.
  const confirmAddLabel = () => {
    const m = labelMenu(); if (!m) return;
    const name = labelDraft().trim();
    if (name) addLabelAt(name, m.lng, m.lat);
    setLabelMenu(null);
  };
  const confirmRenameLabel = () => {
    const m = labelMenu(); if (!m?.label) return;
    const name = labelDraft().trim();
    if (name && name !== m.label.name) renameLabelById(m.label.id, name);
    setLabelMenu(null);
  };
  const confirmDeleteLabel = () => {
    const m = labelMenu(); if (!m?.label) return;
    deleteLabelById(m.label.id);
    setLabelMenu(null);
  };

  // ── sharing: export this room's labels to a .json file / clipboard; import from a pasted
  // or uploaded document (merge = add to the current set; replace = swap the whole set). ──
  const exportLabels = () => {
    const json = labelsToJSON(props.sessionId, labels as MapLabel[]);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xc3d-labels-${props.sessionId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyLabelsJSON = async () => {
    try { await navigator.clipboard.writeText(labelsToJSON(props.sessionId, labels as MapLabel[])); return true; }
    catch { return false; }
  };
  // returns the number imported, or throws with a message the caller can show.
  const importLabels = (text: string, mode: "merge" | "replace"): number => {
    const parsed = labelsFromJSON(text); // throws on malformed input
    const minted = parsed.map((p) => ({ id: nextLabelId(), name: p.name, lon: p.lon, lat: p.lat }));
    if (mode === "replace") setLabels(minted);
    else setLabels([...labels, ...minted]);
    return minted.length;
  };
  // when on, each on-map name bubble grows a second line with the pilot's CURRENT
  // altitude + climb rate at the playhead (see the path-names TextLayer). Toggled from
  // the pilot-list header; persisted with the other view prefs.
  const [showAltVario, setShowAltVario] = createSignal(_vp.altVario);
  // "Declutter labels": when on, the on-map pilot name tags are de-overlapped in screen
  // space (a greedy AABB push-apart) so a gaggle's tags stop stacking, and a thin leader
  // line ties each moved tag back to its pilot's dot. Default off = today's stacked tags.
  const [declutterLabels, setDeclutterLabels] = createSignal(_vp.declutterLabels);
  // declutter tuning (checkmarks under "Declutter labels"): anchor-arrange vs spread,
  // momentum (ease + hold), and whether to draw the leader lines.
  const [declutterAnchor, setDeclutterAnchor] = createSignal(_vp.declutterAnchor);
  const [declutterMomentum, setDeclutterMomentum] = createSignal(_vp.declutterMomentum);
  // per-tracklog thermal detection: enter/exit markers on the map + a stats panel for
  // the followed pilot. Distinct from the world thermal CLOUD (others' climbs) above.
  const [trackThermals, setTrackThermals] = createSignal(_vp.trackThermals);
  // 🌀 button / `t`: off → on (markers + table); on-but-table-hidden → bring the table
  // back; fully on → off. So the table's ✕ hides only the table (markers stay), and this
  // re-opens it without a detour through turning the whole feature off.
  const toggleThermals = () => {
    if (!trackThermals()) { setTrackThermals(true); setShowThermalPanel(true); }
    else if (!showThermalPanel()) setShowThermalPanel(true);
    else setTrackThermals(false);
  };
  // glide analysis: a marker + start-altitude label dropped at each glide's ONSET (where
  // the pilot leaves a climb and starts gliding away). Reuses the same detectGlides output
  // as the glide badge; independent of trackThermals so you can study glide-start heights
  // without the full thermal markers/panel. Persisted with the other view prefs.
  const [showGlideStarts, setShowGlideStarts] = createSignal(_vp.glideStarts);
  const [highFps, setHighFps] = createSignal(true);
  // ── basemap grayscale (0–100 %) ──────────────────────────────────────
  // CSS-filter ONLY the MapLibre base canvas. deck.gl renders in its OWN overlaid canvas
  // (MapboxOverlay interleaved:false — see onMount), so tracks/gliders/labels keep full
  // colour while the map behind them desaturates and the overlays pop. Toggle with `m`.
  const [grayscale, setGrayscale] = createSignal(_vp.grayscale);
  let lastGray = grayscale() || 100; // remembered non-zero level so `m` can restore it
  createEffect(() => { const g = grayscale(); if (g > 0) lastGray = g; });
  const toggleGrayscale = () => setGrayscale((g) => (g > 0 ? 0 : lastGray || 100));
  // ── basemap lightness: CSS brightness() of the base canvas, 0.3 (dark) … 1.7 (light) ──
  // Composed into the SAME filter string as grayscale below (one write, so neither clobbers
  // the other). Like grayscale it touches ONLY the MapLibre base canvas, not the deck overlay.
  const [lightness, setLightness] = createSignal(_vp.lightness);
  // apply to the base canvas (gate on ready() so the map exists; re-runs on any change).
  // The canvas survives setStyle (basemap swaps), so the filter sticks across basemaps.
  // ONE combined filter string: grayscale(<g>%) brightness(<b>) — emit only the parts that
  // deviate from the identity so a neutral setting leaves the canvas filter empty.
  createEffect(() => {
    const g = grayscale();
    const b = lightness();
    if (!ready() || !map) return;
    const parts = [];
    if (g > 0) parts.push(`grayscale(${g}%)`);
    if (b !== 1) parts.push(`brightness(${b})`);
    map.getCanvas().style.filter = parts.join(" ");
  });
  // persist the view/perf prefs (NOT highFps — a transient debug lever) whenever they change
  createEffect(() => {
    const prefs: ViewPrefs = {
      basemap: basemap(), terrain: terrainOn(), shadows: shadows(), dropLine: dropLine(),
      trailFull: trailFull(), trailPct: trailPct(), trailBudget: trailBudget(),
      gpuTrails: gpuTrails(), labels: labelsOn(), trackThermals: trackThermals(),
      glideStarts: showGlideStarts(),
      altVario: showAltVario(), declutterLabels: declutterLabels(),
      declutterAnchor: declutterAnchor(), declutterMomentum: declutterMomentum(),
      grayscale: grayscale(), lightness: lightness(),
      mapLabels: mapLabelsOn(), sun: sunOn(), sunShade: sunShade(), sunShadeColor: sunShadeCol(),
      castShadows: castShadows(),
    };
    try { localStorage.setItem(VIEW_LS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
  });
  const [fps, setFps] = createSignal(0);
  // ── debug / benchmark HUD (`f`): fps + per-frame render breakdown, so you can see
  // which lever (trail geometry, cloud fill, JS rebuild) is the current bottleneck. ──
  const [showDebug, setShowDebug] = createSignal(_pp.debug);
  const [dbg, setDbg] = createSignal<Dbg>({ jsMs: 0, layers: 0, trailPts: 0, cloudPts: 0, markers: 0 });
  // persist which panels/modals are open (all panel signals now exist), so a refresh — or
  // the next room — restores the identical chrome. Writes on any toggle change.
  createEffect(() => {
    savePanelPrefs({
      controls: showControls(), gaggles: showGaggles(), graph: showGraph(),
      thermalPanel: showThermalPanel(), flags: showFlags(), intervals: showIntervals(),
      hideUI: hideUI(), debug: showDebug(), help: showHelp(),
    });
  });
  // metrics captured cheaply during frameLayers / loop, drained into `dbg` once a second
  let mLayers = 0, mTrailPts = 0, jsMsAccum = 0, jsMsFrames = 0;

  // (World thermal-cloud overlay removed — the per-track "Thermal analysis" feature
  // (trackThermals / detectThermals) is separate and stays.)
  const speed = () => SPEEDS[speedIdx()];
  // A pilot's stable identity in every per-flight cache (live/pathData/trailCache/…) and
  // signal (followKey/hoverKey/selectedKey). Keyed on the fingerprint ALONE — unique within
  // a room — so an inline rename (which changes f.name) leaves the key put and never strands
  // or re-keys a cache. The name is only ever a DISPLAY string, never parsed back out of the key.
  const keyOf = (f: SessionFlight) => f.fingerprint;

  // per-point vertical speed (m/s) along a track — forward-diff altitude over time,
  // clamped to ±5. Computed once per flight at load (drives the climb/sink trail colour).
  function computeVs(track: Track): number[] {
    const n = track.length;
    const vs = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const a = track[i], b = track[Math.min(n - 1, i + 1)];
      const dt = b[0] - a[0];
      vs[i] = dt > 0 ? Math.max(-5, Math.min(5, (b[3] - a[3]) / dt)) : 0;
    }
    return vs;
  }
  // Colour a track vertex by vertical speed: sink → darker, climb → brighter (toward
  // white). The pilot's hue stays their identity; only lightness moves. Returns RGBA;
  // `mul` dims the whole colour (used for the dim FUTURE half of a track in seek mode).
  function vsRGBA(base: [number, number, number], v: number, alpha: number, mul = 1): number[] {
    const c = Math.max(-5, Math.min(5, v)) / 5; // -1 (sink) .. +1 (climb)
    let r: number, g: number, b: number;
    if (c >= 0) { const t = c * 0.7; r = base[0] + (255 - base[0]) * t; g = base[1] + (255 - base[1]) * t; b = base[2] + (255 - base[2]) * t; }
    else { const f = 1 + c * 0.55; r = base[0] * f; g = base[1] * f; b = base[2] * f; } // sink floor ≈0.45×
    return [r * mul, g * mul, b * mul, alpha];
  }

  // ── per-tracklog thermal detection ──────────────────────────────────
  // Pure function of a track, and a flight's track never changes → cache per pilot key
  // (computed lazily the first frame it's needed). See lib/tracklogThermals.ts.
  const thermalCache = new Map<string, Thermal[]>();
  function thermalsFor(key: string, track?: Track): Thermal[] {
    let c = thermalCache.get(key);
    if (c) return c;
    // Prefer an explicitly-passed track (the flight object always carries one, available
    // synchronously). Falling back to pathData would race: the panel's memo can run
    // before pathData is populated, cache [] and never recompute (pathData isn't reactive).
    const t = track ?? pathData.get(key)?.track;
    if (!t) return [];
    c = detectThermals(t);
    thermalCache.set(key, c);
    return c;
  }
  // whose thermals show on the MAP: the whole locked-on gaggle if one is set, else the
  // followed pilot. Keyed off followGaggle (NOT followMode) so grabbing the map — which
  // drops the camera to "free" — keeps the gaggle's thermals lit; the lock only clears
  // when you follow a single pilot / all (see cycleCamMode).
  function activeThermalKeys(): string[] {
    if (followGaggle() != null) {
      const ids = stats().filter((s) => s.state === "air" && s.gaggleId === followGaggle()).map((s) => s.key);
      if (ids.length) return ids;
    }
    const fk = followKey();
    if (fk && pathData.has(fk)) return [fk];
    const first = props.flights()[0];
    return first ? [keyOf(first)] : [];
  }
  // the single pilot whose thermal LIST the side panel shows (the followed one)
  const panelFlight = createMemo(() => {
    const fs = props.flights();
    const sk = selectedKey();
    return (
      (sk ? fs.find((f) => keyOf(f) === sk) : undefined) ??
      fs.find((f) => keyOf(f) === followKey()) ??
      fs[0] ??
      null
    );
  });
  const panelThermals = createMemo<Thermal[]>(() => {
    const f = panelFlight();
    return f ? thermalsFor(keyOf(f), f.track) : [];
  });
  // glides = the transitions between this pilot's thermals (derived from the same track)
  const glideCache = new Map<string, Glide[]>();
  function glidesFor(key: string, track?: Track): Glide[] {
    let c = glideCache.get(key);
    if (c) return c;
    const t = track ?? pathData.get(key)?.track;
    if (!t) return [];
    c = detectGlides(t, thermalsFor(key, t));
    glideCache.set(key, c);
    return c;
  }
  const panelGlides = createMemo<Glide[]>(() => {
    const f = panelFlight();
    return f ? glidesFor(keyOf(f), f.track) : [];
  });
  // glide ratio → short label (∞ when a "glide" net-gained), for the on-map glide badge
  const fmtLD = (ld: number) => (Number.isFinite(ld) ? (ld >= 10 ? ld.toFixed(0) : ld.toFixed(1)) : "∞");

  // lng/lat/alt polyline of the selected thermal/glide segment (for the map highlight),
  // or null when nothing is selected. Memoised so it only rebuilds on a new selection.
  const selHighlight = createMemo<number[][] | null>(() => {
    const sel = selSeg();
    const f = panelFlight();
    if (!sel || !f) return null;
    const segs = sel.kind === "thermal" ? panelThermals() : panelGlides();
    const s = segs[sel.idx];
    if (!s) return null;
    const tr = f.track;
    const out: number[][] = [];
    for (let i = s.i0; i <= s.i1; i++) out.push([tr[i][2], tr[i][1], tr[i][3]]);
    return out;
  });

  // clock domain: first launch → last landing, in time-of-day seconds
  const dayStart = createMemo(() => {
    const fs = props.flights();
    return fs.length ? Math.min(...fs.map(todOfLaunch)) : 0;
  });
  const dayEnd = createMemo(() => {
    const fs = props.flights();
    return fs.length ? Math.max(...fs.map((f) => todOfLaunch(f) + f.duration)) : 1;
  });
  // where a given flight is in its own track at the current time-of-day
  const relOf = (f: SessionFlight, tod: number) => tod - todOfLaunch(f);
  const stateOf = (f: SessionFlight, tod: number): FlightState => {
    const r = relOf(f, tod);
    return r < 0 ? "pre" : r > f.duration ? "landed" : "air";
  };

  // ── build static full-track path layers + live-state entries ────────
  function ensureLayers() {
    for (const f of props.flights()) {
      const key = keyOf(f);
      if (pathData.has(key)) continue;
      const col = rgb(f.color);
      // keep the full track; the trail shown is clipped to the current playhead each frame
      pathData.set(key, { track: f.track, color: col, vs: computeVs(f.track) });
      const p0 = f.track[0];
      live.set(key, {
        key, color: col, name: f.name,
        lat: p0[1], lon: p0[2], alt: p0[3], prevLat: p0[1], prevLon: p0[2],
        state: stateOf(f, playhead()),
      });
      if (followKey() === null) setFollowKey(key);
    }
  }
  // Tear down every per-pilot cache entry for a flight that left the room, so its trail,
  // glider, labels and thermals all vanish and nothing dangles. (groundZ is keyed by
  // coordinate, not pilot, so it needs no pruning.) Resetting the trips + start-marker
  // sigs forces those shared layers to rebuild without this pilot.
  function dropFlight(key: string) {
    live.delete(key);
    pathData.delete(key);
    trailCache.delete(key);
    tripsCache.delete(key);
    thermalCache.delete(key);
    glideCache.delete(key);
    lastTri.delete(key);
    if (isHidden(key)) toggleHidden(key); // drop it from the hidden set
    // hand the follow cam to a remaining flight (the removed one is already out of
    // props.flights() by the time this runs); null only if the room is now empty.
    if (followKey() === key) { const nxt = props.flights()[0]; setFollowKey(nxt ? keyOf(nxt) : null); }
    if (hoverKey() === key) setHoverKey(null);
    if (selectedKey() === key) setSelectedKey(null);
    tripsDataSig = ""; startSig = "";
  }

  // NB: read .length so this effect actually SUBSCRIBES to flight appends/removes. A bare
  // `props.flights()` reads no tracked key, so when the map isn't ready on the first
  // run it captured no deps and never re-ran — new flights only appeared on a page
  // refresh. Tracking length re-runs it on every add/remove (drawing once the map is ready).
  createEffect(() => {
    props.flights().length;
    if (!mapReady) return;
    // prune any flight that left the room (X button / remote flight_removed) BEFORE redraw
    const liveKeys = new Set(props.flights().map(keyOf));
    for (const key of [...pathData.keys()]) if (!liveKeys.has(key)) dropFlight(key);
    ensureLayers();
    frameLayers();
  });

  // X button on a pilot row → ask the room to drop this flight (the server keeps the
  // .igc). The actual cache teardown happens in the prune effect above once the flight
  // leaves props.flights() — covering our own removal and remote ones identically.
  const removePilot = (key: string) => {
    const f = props.flights().find((x) => keyOf(x) === key);
    if (f) props.onRemoveFlight?.(f.fingerprint);
  };

  // ── inline pilot rename ──────────────────────────────────────────────
  // Click a pilot's name in the list → edit it in place; Enter/blur commits, Escape cancels.
  // editKey (the pilot being edited) + editDraft (the working text) live HERE, not in the
  // list Row: the stats list refreshes ~4×/s and recreates its rows, which would blow away
  // any Row-local edit state. While an edit is open we also FREEZE that refresh (see loop),
  // so the focused input isn't torn out mid-type.
  const [editKey, setEditKey] = createSignal<string | null>(null);
  const [editDraft, setEditDraft] = createSignal("");
  const beginRename = (key: string, name: string) => { setEditDraft(name); setEditKey(key); };
  const cancelRename = () => setEditKey(null);
  const commitRename = () => {
    const key = editKey();
    if (key === null) return; // already committed/cancelled (Enter then blur ⇒ no-op)
    const v = editDraft().trim();
    setEditKey(null);
    const f = props.flights().find((x) => keyOf(x) === key);
    if (f && v && v !== f.name) props.onRenameFlight?.(f.fingerprint, v);
  };

  // ── animation loop ──────────────────────────────────────────────────
  let raf = 0, last = 0, statAccum = 0, triAccum = 0;
  let drawAccum = 0, fpsFrames = 0, fpsAccum = 0, trailAccum = 0, posAccum = 0;
  const TRAIL_HZ = 12; // rebuild the heavy base trails ≤12×/s; gliders + tips stay 60 Hz

  // remember where the player is in THIS room (clock + camera) so a reload resumes here.
  // Throttled from the loop; also flushed on page hide.
  function savePos() {
    if (!mapReady) return;
    try {
      const c = map.getCenter();
      saveRoomPos(props.sessionId, {
        playhead: playhead(), center: [c.lng, c.lat],
        zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(),
        followMode: followMode(), followKey: followKey(),
        selectedKey: selectedKey(),
      });
    } catch { /* ignore */ }
  }
  const lastTri = new Map<string, number>();

  function loop(now: number) {
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (playing()) {
      let t = playhead() + dt * speed();
      if (t >= dayEnd()) { t = dayEnd(); setPlaying(false); }
      setPlayhead(t);
    }
    const tod = playhead(); // time of day
    for (const f of props.flights()) {
      const l = live.get(keyOf(f));
      if (!l) continue;
      // sample each flight at ITS OWN offset into the same wall-clock instant
      const [lat, lon, alt] = sampleTrack(f.track, relOf(f, tod));
      l.prevLat = l.lat; l.prevLon = l.lon;
      l.lat = lat; l.lon = lon; l.alt = alt;
      l.state = stateOf(f, tod);
    }
    // PERF: at 60fps we rebuild deck layers every frame. Throttled mode rebuilds
    // 6×/s — the flight positions still interpolate, they just refresh less often.
    drawAccum += dt;
    trailAccum += dt;
    if (highFps() || drawAccum >= 1 / 6) {
      drawAccum = 0;
      // refresh the heavy base trails at most TRAIL_HZ — the tip layer bridges the gap
      // to each live glider, so the trail growing a few frames late is invisible.
      let refreshTrails = true;
      if (trailAccum >= 1 / TRAIL_HZ) trailAccum = 0; else refreshTrails = false;
      const jt0 = performance.now();
      frameLayers(refreshTrails);
      updateCamera();
      jsMsAccum += performance.now() - jt0; jsMsFrames++;
    }

    // fps readout (1s window), + drain the debug metrics into the HUD
    fpsFrames++; fpsAccum += dt;
    if (fpsAccum >= 1) {
      setFps(Math.round(fpsFrames / fpsAccum));
      if (showDebug()) {
        setDbg({
          jsMs: jsMsFrames ? jsMsAccum / jsMsFrames : 0,
          layers: mLayers, trailPts: mTrailPts,
          cloudPts: 0,
          markers: [...live.values()].filter((l) => l.state === "air" && !renderHidden(l.key)).length,
        });
      }
      fpsFrames = 0; fpsAccum = 0; jsMsAccum = 0; jsMsFrames = 0;
    }

    statAccum += dt; triAccum += dt;
    // Skip the stats refresh while a pilot name is being edited inline — it rebuilds the
    // list rows, which would tear the focused rename input out from under the user.
    if (statAccum >= 0.25) { statAccum = 0; if (editKey() === null) recomputeStats(tod, triAccum >= 1); if (triAccum >= 1) triAccum = 0; }
    posAccum += dt;
    if (posAccum >= 1.5) { posAccum = 0; savePos(); } // persist room position ~every 1.5s
    if (mapReady) {
      const b = map.getBearing(); if (b !== lastBearing) { lastBearing = b; setMapBearing(b); }
      const pi = map.getPitch(); if (pi !== lastPitch) { lastPitch = pi; setMapPitch(pi); }
    }
    raf = requestAnimationFrame(loop);
  }

  // ground elevation under a coordinate, cached (terrain is static, so a point's
  // ground height never changes). Returns 0 when terrain is off or the tile that
  // covers the point hasn't loaded yet (null) — and does NOT cache the miss, so it
  // fills in on a later frame once the DEM tile arrives.
  const groundZ = new Map<string, number>();
  // Terrain elevation at a point. NB: map.queryTerrainElevation() is unreliable here — it
  // returns 0 even when the DEM tiles are fully loaded (its GPU read-back path fails, and
  // dies outright under swiftshader), which pinned every label to sea level and made AGL
  // read == MSL. The DEM data itself is correct, so read it CPU-side via the Terrain helper.
  function groundAt(lon: number, lat: number): number {
    if (!(hasTerrain && terrainOn())) return 0;
    const k = lon.toFixed(5) + "," + lat.toFixed(5);
    const cached = groundZ.get(k);
    if (cached !== undefined) return cached;
    const terr = (map as any).terrain;
    const e = terr?.getElevationForLngLatZoom?.(new maplibregl.LngLat(lon, lat), Math.floor(map.getZoom()));
    if (typeof e !== "number" || !isFinite(e)) return 0; // DEM tile not ready — retry next frame
    groundZ.set(k, e);
    return e;
  }

  // The ground shadow is a MapLibre GeoJSON line layer (NOT a deck layer). With 3D
  // terrain on, MapLibre drapes its own 2D line layers onto the terrain surface and
  // occludes them with the terrain's own depth — so the shadow hugs the hillside and
  // hills in front hide it, with no z-fighting. setStyle() wipes it, so (like terrain)
  // it must be re-attached on every style load.
  const SHADOW_SRC = "trail-shadows";
  function ensureShadowLayer() {
    if (!mapReady) return;
    try {
      if (!map.getSource(SHADOW_SRC)) {
        map.addSource(SHADOW_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      }
      if (!map.getLayer(SHADOW_SRC)) {
        map.addLayer({
          id: SHADOW_SRC,
          type: "line",
          source: SHADOW_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": 2.5,
            "line-opacity": 0.5,
            "line-blur": 0.4,
          },
        });
      }
    } catch (e) { console.warn("[xc3d] shadow layer:", e); }
  }

  // ── declutter solver: de-overlap the pilot name tags in SCREEN space ──
  // Greedy AABB relaxation over each tag's bottom-centre point (the tag's anchor, laid out
  // middle/bottom then lifted by NAME_DEF_OFF above the dot). We project each dot to the
  // ground screen point (map.project ignores altitude, but pilots in a gaggle share ~alt +
  // location, so the elevation parallax is ~equal across the cluster and cancels out of the
  // RELATIVE arrangement — and the tags themselves stay anchored to the true [lon,lat,alt]
  // dot, since only the pixel OFFSET is solved here). A weak spring pulls each tag back
  // toward its default spot so the cluster stays compact. Deterministic (stable input
  // order, fixed iteration count). Fills declutterOffsets keyed by pilot.
  function solveDeclutter(nd: { key: string; name: string; lon: number; lat: number; altM: string; av: string }[]): void {
    const n = nd.length;
    const av = showAltVario();
    const bcx = new Float64Array(n), bcy = new Float64Array(n); // tag bottom-centre, screen px
    const ax = new Float64Array(n), ay = new Float64Array(n);   // dot (anchor) screen px
    const hw = new Float64Array(n), hh = new Float64Array(n);   // half-width, full height (px)
    for (let i = 0; i < n; i++) {
      const d = nd[i];
      const p = map.project([d.lon, d.lat] as any);
      ax[i] = p.x; ay[i] = p.y;
      // box estimate: widest of the two text lines × bold-12px char width + slab padding
      const chars = Math.max(d.name.length, (av ? d.av : d.altM).length);
      hw[i] = (chars * 7 + 16) / 2;
      hh[i] = 2 * 15 + 8; // two ~15px lines + padding
      bcx[i] = p.x + NAME_DEF_OFF[0];
      bcy[i] = p.y + NAME_DEF_OFF[1];
    }
    const ITER = 40;
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        // box centres (bottom-centre lifted by half the height)
        const dx = bcx[j] - bcx[i];
        const dy = (bcy[j] - hh[j] / 2) - (bcy[i] - hh[i] / 2);
        const px = (hw[i] + hw[j]) - Math.abs(dx);
        const py = (hh[i] / 2 + hh[j] / 2) - Math.abs(dy);
        if (px > 0 && py > 0) {
          // separate along the axis of least penetration, split evenly (+0.5 to break ties)
          if (px < py) {
            const push = (px / 2 + 0.5) * (dx < 0 ? -1 : 1);
            bcx[i] -= push; bcx[j] += push;
          } else {
            const push = (py / 2 + 0.5) * (dy < 0 ? -1 : 1);
            bcy[i] -= push; bcy[j] += push;
          }
        }
      }
      // weak pull back toward each tag's default spot above its own dot
      for (let i = 0; i < n; i++) {
        bcx[i] += 0.04 * (ax[i] + NAME_DEF_OFF[0] - bcx[i]);
        bcy[i] += 0.04 * (ay[i] + NAME_DEF_OFF[1] - bcy[i]);
      }
    }
    declutterOffsets.clear();
    for (let i = 0; i < n; i++) declutterOffsets.set(nd[i].key, [bcx[i] - ax[i], bcy[i] - ay[i]]);
  }


  // ── anchor-arrange declutter (the new mode) ──
  // Each tag wants to sit ABOVE its own dot with no line. When tags collide, the colliding
  // group fans out around their dots by a fixed rule — 2: to the sides · 3: sides + up ·
  // 4: sides + up + down · >4: alternating sides, stacked — with an L-shaped leader from
  // each moved tag back to its dot. Momentum eases the motion and HOLDS a chosen side for a
  // couple seconds after the collision clears, so tags don't blink around.
  const GAP = 10;
  function solveAnchor(nd: { key: string; name: string; lon: number; lat: number; altM: string; av: string }[]): void {
    const n = nd.length;
    const av = showAltVario();
    const now = performance.now();
    const momentum = declutterMomentum();
    const ax = new Float64Array(n), ay = new Float64Array(n); // dot screen px
    const hw = new Float64Array(n), hh = new Float64Array(n); // tag half-width, full height
    for (let i = 0; i < n; i++) {
      const d = nd[i];
      const p = map.project([d.lon, d.lat] as any);
      ax[i] = p.x; ay[i] = p.y;
      const chars = Math.max(d.name.length, (av ? d.av : d.altM).length);
      hw[i] = (chars * 7 + 16) / 2;
      hh[i] = 2 * 15 + 8;
    }
    // collision graph at the ABOVE position (tag box centred at dot + NAME_DEF_OFF, lifted
    // up by half its height). Union-find into groups.
    const parent = new Int32Array(n); for (let i = 0; i < n; i++) parent[i] = i;
    const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const cx = (i: number) => ax[i] + NAME_DEF_OFF[0];
    const cy = (i: number) => ay[i] + NAME_DEF_OFF[1] - hh[i] / 2;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (Math.abs(cx(i) - cx(j)) < hw[i] + hw[j] && Math.abs(cy(i) - cy(j)) < hh[i] / 2 + hh[j] / 2) {
        parent[find(i)] = find(j);
      }
    }
    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; i++) { const r = find(i); (groups.get(r) ?? groups.set(r, []).get(r)!).push(i); }

    const poolFor = (sz: number): number[] =>
      sz === 2 ? [DIR_LEFT, DIR_RIGHT]
      : sz === 3 ? [DIR_LEFT, DIR_RIGHT, DIR_UP]
      : [DIR_LEFT, DIR_RIGHT, DIR_UP, DIR_DOWN];
    const targetFor = (i: number, dir: number, stack: number): [number, number] => {
      switch (dir) {
        case DIR_LEFT:  return [-(hw[i] + GAP), hh[i] / 2 + stack * (hh[i] + 4)];
        case DIR_RIGHT: return [ (hw[i] + GAP), hh[i] / 2 + stack * (hh[i] + 4)];
        case DIR_UP:    return [0, -(GAP + 2)];
        case DIR_DOWN:  return [0, hh[i] + GAP];
        default:        return [NAME_DEF_OFF[0], NAME_DEF_OFF[1]];
      }
    };

    const seen = new Set<string>();
    for (const members of groups.values()) {
      if (members.length <= 1) continue;
      // assign left→right by dot x; reuse a member's stored dir first (stability)
      members.sort((a, b) => ax[a] - ax[b]);
      const sz = members.length;
      const pool = poolFor(sz);
      const taken = new Set<number>();
      const dirOf = new Map<number, number>();
      // pass 1: keep stored dirs that are still in the pool
      for (const i of members) {
        const st = declutterState.get(nd[i].key);
        if (st && pool.includes(st.dir) && !taken.has(st.dir)) { taken.add(st.dir); dirOf.set(i, st.dir); }
      }
      // pass 2: fill the rest from the pool in order (cycling for >4)
      let pi = 0;
      for (const i of members) {
        if (dirOf.has(i)) continue;
        while (taken.has(pool[pi % pool.length]) && taken.size < pool.length) pi++;
        const dir = pool[pi % pool.length]; pi++;
        taken.add(dir); dirOf.set(i, dir);
      }
      // per-dir stack index (for >4: multiple tags share a side, stagger vertically)
      const stackCount = new Map<number, number>();
      for (const i of members) {
        const dir = dirOf.get(i)!;
        const stack = stackCount.get(dir) ?? 0; stackCount.set(dir, stack + 1);
        const [tx, ty] = targetFor(i, dir, stack);
        applyTarget(nd[i].key, ax[i], ay[i], tx, ty, dir, now, momentum, now + DECL_HOLD_MS);
        seen.add(nd[i].key);
      }
    }
    // non-colliding tags: hold their arrangement if still within the hold window, else ABOVE
    for (let i = 0; i < n; i++) {
      const key = nd[i].key;
      if (seen.has(key)) continue;
      const st = declutterState.get(key);
      if (momentum && st && st.heldUntil > now && st.dir !== DIR_NONE) {
        const [tx, ty] = targetFor(i, st.dir, 0);
        applyTarget(key, ax[i], ay[i], tx, ty, st.dir, now, momentum, st.heldUntil);
      } else {
        applyTarget(key, ax[i], ay[i], NAME_DEF_OFF[0], NAME_DEF_OFF[1], DIR_NONE, now, momentum, 0);
      }
    }
    // drop state for tags no longer present
    for (const k of [...declutterState.keys()]) if (!nd.some((d) => d.key === k)) declutterState.delete(k);
    declutterOffsets.clear();
    for (const [k, st] of declutterState) declutterOffsets.set(k, [st.ox, st.oy]);
  }
  // ease a tag's stored offset toward its target (or snap if momentum off), stamp dir + hold
  function applyTarget(key: string, _ax: number, _ay: number, tx: number, ty: number, dir: number, _now: number, momentum: boolean, heldUntil: number): void {
    let st = declutterState.get(key);
    if (!st) { st = { ox: tx, oy: ty, dir, heldUntil }; declutterState.set(key, st); return; }
    if (momentum) { st.ox += (tx - st.ox) * DECL_EASE; st.oy += (ty - st.oy) * DECL_EASE; }
    else { st.ox = tx; st.oy = ty; }
    st.dir = dir;
    if (heldUntil > st.heldUntil) st.heldUntil = heldUntil;
  }

  // push growing trails (past points only) + marker/label layers to deck each frame.
  // refreshTrails=false reuses the cached base trails (throttled) while still moving the
  // gliders, tips, labels and camera — see TRAIL_HZ in the loop.
  function frameLayers(refreshTrails = true) {
    if (!overlay) return;
    const tod = playhead();
    const relByKey = new Map<string, number>();
    for (const f of props.flights()) relByKey.set(keyOf(f), relOf(f, tod));

    const hv = hoverKey();
    const gpu = gpuTrails();
    // ── refresh each pilot's cached BASE trail (flown-so-far, no live tip) ──
    // Only rebuild+re-tesselate a pilot's polyline when its shape (sig) changes; on a
    // steady frame the stable array + wrapper let deck skip it entirely. Skipped
    // wholesale when the loop throttles trail refreshes, or in GPU-trail mode.
    if (refreshTrails && !gpu && !seekMode()) {
    let visTrailPts = 0;
    const budget = trailBudget(); // vertex budget from the Perf-tab slider (in the sig)
    for (const [key, pd] of pathData.entries()) {
      const rel = relByKey.get(key) ?? -1;
      let start = 0, end = -1, full = false;
      if (key === hv) {
        // hovered/pressed pilot: reveal the ENTIRE track, ignoring playhead + trimming
        start = 0; end = pd.track.length - 1; full = true;
      } else if (rel >= 0) {
        // only the points already flown; "full trails" off keeps the last trailPct%
        end = idxAtTime(pd.track, rel);
        start = trailFull() ? 0 : Math.max(0, end - Math.floor(pd.track.length * (trailPct() / 100)));
      }
      const sig = (full ? `full:${pd.track.length}` : `${start}:${end}`) + `:${budget}`;
      let c = trailCache.get(key);
      if (!c || c.sig !== sig) {
        // DECIMATE to the vertex budget: an IGC fixes a point every ~1 s, so a 4 h trail
        // is ~15k points — far more than a line needs. Striding to ~budget keeps the shape
        // but slashes what deck re-tesselates each grow frame (the play-time hot cost).
        const tr = pd.track, vsA = pd.vs, base = pd.color;
        const coords: number[][] = [];
        const colors: number[][] = []; // per-vertex climb/sink colour, parallel to coords
        const n = end - start + 1;
        if (n > 0) {
          const stride = n > budget ? Math.ceil(n / budget) : 1;
          for (let i = start; i <= end; i += stride) { coords.push([tr[i][2], tr[i][1], tr[i][3]]); colors.push(vsRGBA(base, vsA[i], 230)); }
          // always pin the exact last flown point so the moving tip joins seamlessly
          if ((end - start) % stride !== 0) { coords.push([tr[end][2], tr[end][1], tr[end][3]]); colors.push(vsRGBA(base, vsA[end], 230)); }
        }
        if (c) { c.coords = coords; c.wrap[0].path = coords; c.wrap[0].colors = colors; c.sig = sig; }
        else { c = { coords, wrap: [{ path: coords, colors }], sig }; trailCache.set(key, c); }
      }
      visTrailPts += c.coords.length;
    }
    mTrailPts = visTrailPts;
    }

    // ground shadow: feed the trails (lon/lat only) to the MapLibre line layer, which
    // drapes them on the terrain. Dropping the altitude is the whole point — MapLibre
    // paints the line at the ground under each point, so it follows the hills.
    const shadowSrc = map.getSource ? (map.getSource(SHADOW_SRC) as any) : null;
    if (shadowSrc) {
      const features = !shadows() ? [] : [...pathData.entries()]
        .filter(([key]) => !renderHidden(key))
        .map(([key, pd]) => {
          const coords = trailCache.get(key)?.coords ?? [];
          if (coords.length < 2) return null;
          return {
            type: "Feature",
            properties: { color: toHex(dim(pd.color)) },
            geometry: { type: "LineString", coordinates: coords.map((c) => [c[0], c[1]]) },
          };
        })
        .filter(Boolean);
      shadowSrc.setData({ type: "FeatureCollection", features });
    }
    // subtle dark drop-line from each airborne glider straight down to its ground shadow
    // — toggled with `dropLine`, on whenever shadows are on. ONE layer, N short segments.
    const dropData = !(shadows() && dropLine()) ? [] : [...live.values()]
      .filter((l) => l.state === "air" && !renderHidden(l.key))
      .map((l) => {
        const gz = groundAt(l.lon, l.lat);
        return { path: [[l.lon, l.lat, l.alt], [l.lon, l.lat, gz]], color: [...dim(dim(l.color)), 205] };
      });
    const dropLines = dropData.length
      ? [new PathLayer({
          id: "drops", data: dropData, getPath: (d: any) => d.path, getColor: (d: any) => d.color,
          getWidth: 1.5, widthUnits: "pixels", widthMinPixels: 1,
        })]
      : [];

    // hovered pilot is drawn even if hidden, wider + opaque. `data` is the pilot's STABLE
    // wrapper; deck only regenerates geometry when the sig updateTrigger changes.
    const paths = [...pathData.entries()].filter(([key]) => !renderHidden(key) || key === hv).map(([key, pd]) => {
      const c = trailCache.get(key);
      if (!c) return null; // not cached yet (launched during a throttled frame) — next refresh
      const hovered = key === hv;
      return new PathLayer({
        id: "path-" + key,
        data: c.wrap,
        getPath: (d: any) => d.path,
        getColor: (d: any) => d.colors, // per-vertex climb/sink colour
        getWidth: hovered ? 6 : 4,
        widthUnits: "pixels",
        widthMinPixels: 2,
        // no rounded joints/caps on the heavy base — each rounded joint tesselates an
        // arc (×tens of thousands). Bevel joints are ~free and indistinguishable at
        // trail scale; the short tip keeps rounded caps for a clean leading dot.
        capRounded: false,
        jointRounded: false,
        updateTriggers: { getPath: c.sig, getWidth: hovered, getColor: c.sig },
      });
    }).filter(Boolean);
    // moving trail TIP: last flown point → interpolated glider, for airborne non-hovered
    // pilots. Its own tiny layer (2 pts × N) so the heavy base trails needn't rebuild.
    const tipData = [...live.values()]
      .filter((l) => l.state === "air" && !renderHidden(l.key) && l.key !== hv)
      .map((l) => {
        const c = trailCache.get(l.key);
        const pd = pathData.get(l.key)!;
        const last = c && c.coords.length ? c.coords[c.coords.length - 1] : [pd.track[0][2], pd.track[0][1], pd.track[0][3]];
        return { path: [last, [l.lon, l.lat, l.alt]], color: [...pd.color, 230] };
      });
    const tips = tipData.length
      ? [new PathLayer({
          id: "trail-tips", data: tipData, getPath: (d: any) => d.path, getColor: (d: any) => d.color,
          getWidth: 4, widthUnits: "pixels", widthMinPixels: 2, capRounded: true, jointRounded: true,
        })]
      : [];
    // launch markers: a ▲ pinned at every flight's take-off point — STATIC (positions
    // never move), so rebuild the (SDF-costly) TextLayer only when the visible set changes.
    const startKeys = [...pathData.entries()].filter(([key]) => !renderHidden(key)).map(([key]) => key);
    const sSig = startKeys.join(",");
    if (!startLayer || sSig !== startSig) {
      const startPts = startKeys.map((key) => {
        const pd = pathData.get(key)!;
        return { key, color: pd.color, lon: pd.track[0][2], lat: pd.track[0][1], alt: pd.track[0][3] };
      });
      startLayer = new TextLayer({
        id: "starts",
        data: startPts,
        getPosition: (d: any) => [d.lon, d.lat, d.alt],
        getText: () => "▲",
        // ▲ (U+25B2) is outside deck.gl's default ASCII atlas — without this it renders as
        // a missing-glyph tofu box (a dark square slab), not a triangle. "auto" builds the
        // atlas from the actual glyphs used.
        characterSet: "auto",
        getColor: (d: any) => [...d.color, 255] as any,
        getSize: 15,
        billboard: true,
        background: true,
        getBackgroundColor: [10, 15, 20, 170],
        backgroundPadding: [3, 2],
      });
      startSig = sSig;
    }
    const startMarkers = startLayer;
    // only pilots actually in the air right now get a glider + label (hidden ones skipped)
    const pts = [...live.values()].filter((l) => l.state === "air" && !renderHidden(l.key));
    const markers = new ScatterplotLayer({
      id: "markers",
      data: pts,
      getPosition: (d: Live) => [d.lon, d.lat, d.alt],
      getFillColor: (d: Live) => [...d.color, 255] as any,
      getLineColor: [10, 15, 20, 255],
      lineWidthMinPixels: 1.5,
      stroked: true,
      billboard: true,
      radiusUnits: "pixels",
      getRadius: 6,
    });
    // ── pilot NAME bubbles floating ABOVE each glider ───────────────────
    // Each pilot's name floats just ABOVE their CURRENT-time dot (the live glider position
    // at the playhead) — the single on-map name tag, pinned to the same spot as the glider
    // markers and lifted a few pixels so it clears the dot. It rides along with the replay.
    // With the alt+vario toggle on, a second line (altitude + signed climb rate at the same
    // instant) stacks below the name, so each pilot reads: name / "1359m ▲+1.2" over the dot.
    // Positioned from `live` (updated per frame from the playhead), so it's identical in the
    // CPU-path and GPU-trips modes. Hidden pilots are skipped (a hovered one keeps its name).
    const nameData = [...pathData.entries()]
      .filter(([key]) => !renderHidden(key) || key === hv)
      .map(([key, pd]) => {
        const l = live.get(key);
        if (!l || l.state === "pre") return null; // not launched yet — nothing to label
        // climb rate at the current playhead index (same instant as the shown altitude)
        const rel = relByKey.get(key) ?? -1;
        const end = rel >= 0 ? idxAtTime(pd.track, rel) : pd.track.length - 1;
        const v = pd.vs[Math.max(0, Math.min(end, pd.vs.length - 1))] ?? 0;
        const altM = `${Math.round(l.alt)}m`;           // altitude — ALWAYS shown under the name
        const av = `${altM} ${v >= 0 ? "▲+" : "▼"}${v.toFixed(1)}`; // + signed vario when the toggle is on
        // position = the live glider dot (lat/lon/alt), so the tag tracks the current point
        return { key, name: l.name ?? "", lon: l.lon, lat: l.lat, alt: l.alt, color: pd.color, altM, av };
      })
      .filter(Boolean) as { key: string; name: string; lon: number; lat: number; alt: number; color: [number, number, number]; altM: string; av: string }[];
    // ── declutter: solve (throttled) the per-tag screen offsets so a gaggle's tags stop
    // stacking. No leader lines (removed — they didn't read well). When off, the tag offset
    // is the plain constant NAME_DEF_OFF — byte-for-byte as before.
    let namePixelOffset: any = NAME_DEF_OFF;
    if (labelsOn() && declutterLabels() && nameData.length > 1) {
      const now = performance.now();
      const anchor = declutterAnchor();
      // momentum needs to keep easing every frame; without it the throttle is fine
      if (anchor && declutterMomentum()) { if (now - lastDeclutterSolve >= 40) { lastDeclutterSolve = now; solveAnchor(nameData); } }
      else if (now - lastDeclutterSolve >= DECLUTTER_MS) { lastDeclutterSolve = now; (anchor ? solveAnchor : solveDeclutter)(nameData); }
      namePixelOffset = (d: any) => declutterOffsets.get(d.key) ?? NAME_DEF_OFF;
    } else if (declutterOffsets.size || declutterState.size) {
      declutterOffsets.clear();
      declutterState.clear();
    }
    // key+name (+ toggle) → re-atlas text. The per-frame alt/vario numbers refresh via the
    // new data reference re-running getText, so they need not be in the signature.
    const nameSig = (showAltVario() ? "av|" : "") + nameData.map((d) => d.key + ":" + d.name).join(",");
    const nameBubbles = new TextLayer({
      id: "path-names",
      data: nameData,
      getPosition: (d: any) => [d.lon, d.lat, d.alt],
      // altitude is ALWAYS on the 2nd line ("1359m"); the alt+vario toggle appends the signed
      // climb rate ("1359m ▲+1.2"). Name never shows bare — the current height reads at a glance.
      getText: (d: any) => (showAltVario() ? `${d.name}\n${d.av}` : `${d.name}\n${d.altM}`),
      // pilot names carry accents/diacritics (Jámbor, Björn, …) — "auto" builds the font
      // atlas from the actual names so those glyphs render instead of dropping to tofu.
      characterSet: "auto",
      getColor: [255, 255, 255, 255], // white reads on any pilot hue, on either basemap
      getSize: 12,
      billboard: true,
      background: true,
      // a darkened pilot-colour slab → the name reads as a colour-coded "bubble"
      getBackgroundColor: (d: any) => [d.color[0] * 0.5, d.color[1] * 0.5, d.color[2] * 0.5, 210] as any,
      backgroundPadding: [6, 3],
      fontWeight: 700,
      getTextAnchor: "middle" as any,
      // anchor the tag's BOTTOM and lift it above the dot, so name (+ alt/vario) stack upward
      getAlignmentBaseline: "bottom" as any,
      // default [0,-14] lift, OR the declutter solver's per-tag resolved offset (a screen
      // nudge off the same [lon,lat,alt] world anchor, so the tag stays on its dot).
      getPixelOffset: namePixelOffset,
      // depthTest off + rendered LAST (see the layers array) → the name/alt tag always sits
      // ABOVE the trails, gliders and terrain, never occluded by 3D geometry in front of it.
      parameters: { depthTest: false },
      updateTriggers: { getText: nameSig, getBackgroundColor: nameSig },
    });
    // ── GPU trails (TripsLayer) ── upload each pilot's decimated path + tod timestamps
    // ONCE (per budget); a currentTime uniform reveals the flown part and interpolates
    // the head to the live glider. Zero per-frame trail CPU: tripsData is a stable array
    // (deck never re-tesselates on playback), only currentTime changes each frame.
    let tripsLayers: any[] = [];
    if (gpu || seekMode()) {
      const budget = trailBudget();
      // GPU trail window: CPU mode draws only the last trailPct% of each flight's track,
      // which — since IGC fixes are ~evenly spaced — is that fraction of its DURATION.
      // TripsLayer.trailLength is a single fade window in the SAME units as getTimestamps
      // (seconds), applied to every pilot at once, so we convert the % to seconds against
      // the LONGEST visible flight: that (most prominent) trail then matches CPU exactly,
      // and shorter flights — naturally clamped by their own length — reveal at most their
      // whole track. Full trails / seek mode reveal everything with no fade (as before).
      let maxDurSec = 0;
      for (const pd of pathData.values()) { const tr = pd.track; if (tr.length) maxDurSec = Math.max(maxDurSec, tr[tr.length - 1][0] - tr[0][0]); }
      const trailLen = (trailFull() || seekMode()) ? 1e9 : Math.max(60, maxDurSec * (trailPct() / 100));
      const fByKey = new Map(props.flights().map((f) => [keyOf(f), f]));
      for (const [key, pd] of pathData.entries()) {
        const tsig = `${pd.track.length}:${budget}`;
        if (tripsCache.get(key)?.sig === tsig) continue;
        const f = fByKey.get(key);
        const tBase = f ? todOfLaunch(f) : 0; // rel-seconds → time-of-day, the shared clock
        const tr = pd.track, vsA = pd.vs, col = pd.color, n = tr.length;
        const stride = n > budget ? Math.ceil(n / budget) : 1;
        // path + tod timestamps + per-vertex climb/sink colour (bright for the flown
        // part; `colorsDim` is the same ramp dimmed, drawn as the "future" underlay).
        const path: number[][] = [], timestamps: number[] = [], colors: number[][] = [], colorsDim: number[][] = [];
        const push = (i: number) => { path.push([tr[i][2], tr[i][1], tr[i][3]]); timestamps.push(tBase + tr[i][0]); colors.push(vsRGBA(col, vsA[i], 230)); colorsDim.push(vsRGBA(col, vsA[i], 150, 0.5)); };
        for (let i = 0; i < n; i += stride) push(i);
        if (n > 0 && (n - 1) % stride !== 0) push(n - 1);
        tripsCache.set(key, { path, timestamps, colors, colorsDim, sig: tsig });
      }
      // stable shared data array — rebuilt only when the visible set / budget change.
      // In solo-visible mode the airborne set is part of "visible", so fold it in (only
      // then — no per-frame cost otherwise) so trips drop/return as pilots launch/land.
      const airSig = soloVisible() ? [...live.values()].filter((l) => l.state === "air").map((l) => l.key).sort().join(",") : "";
      const dsig = `${budget}:${[...pathData.keys()].join(",")}:${[...hidden()].join(",")}:${airSig}`;
      if (!tripsData || tripsDataSig !== dsig) {
        tripsData = [...pathData.entries()]
          .filter(([key]) => !renderHidden(key))
          .map(([key, pd]) => { const tc = tripsCache.get(key)!; return { path: tc.path, timestamps: tc.timestamps, colors: tc.colors, colorsDim: tc.colorsDim, color: pd.color }; });
        tripsDataSig = dsig;
      }
      mTrailPts = tripsData.reduce((s, d) => s + d.path.length, 0);
      const trips = tripsData.length
        ? [new TripsLayer({
            id: "trips",
            data: tripsData,
            getPath: (d: any) => d.path,
            getTimestamps: (d: any) => d.timestamps,
            getColor: (d: any) => d.colors, // per-vertex climb/sink colour
            getWidth: 4, widthUnits: "pixels", widthMinPixels: 2, capRounded: true, jointRounded: true,
            currentTime: playhead(),
            trailLength: trailLen, // fade window (s) — honours the trail-length setting, matching CPU mode
            updateTriggers: { getPath: budget, getTimestamps: budget, getColor: tripsDataSig },
          })]
        : [];
      // hovered pilot: reveal the ENTIRE track (its cached path IS the full decimated one)
      const hc = hv ? tripsCache.get(hv) : null;
      const hov = hc
        ? [new PathLayer({
            id: "trips-hover", data: [{ path: hc.path, colors: hc.colors }], getPath: (d: any) => d.path,
            getColor: (d: any) => d.colors,
            getWidth: 6, widthUnits: "pixels", widthMinPixels: 2, capRounded: true, jointRounded: true,
          })]
        : [];
      // seek mode: draw every visible pilot's FULL track dimmed (the "future"); the bright
      // TripsLayer above reveals only the flown-so-far part on top, so the track AHEAD of
      // the playhead reads darker. Static — rebuilt only when the set / budget change.
      const futureDim = seekMode() && tripsData && tripsData.length
        ? [new PathLayer({
            id: "seek-future", data: tripsData, getPath: (d: any) => d.path,
            getColor: (d: any) => d.colorsDim,
            getWidth: 3, widthUnits: "pixels", widthMinPixels: 1, capRounded: false, jointRounded: false,
            updateTriggers: { getPath: tripsDataSig, getColor: tripsDataSig },
          })]
        : [];
      tripsLayers = [...futureDim, ...trips, ...hov];
    }

    // ── per-track thermal markers: base ⊙ + top stat badge for the CURRENT and LAST
    // thermal of each active pilot. Capped at 2/pilot (current + last completed) so the
    // map stays legible during replay — the full list lives in the side panel. ──
    let thermalMarkerLayers: any[] = [];
    if (trackThermals()) {
      const bases: any[] = [];  // faint ⊙ ring at the thermal base (entry)
      const badges: any[] = []; // stat label at the thermal top (or live tip)
      for (const key of activeThermalKeys()) {
        const pd = pathData.get(key);
        if (!pd) continue;
        const ths = thermalsFor(key);
        if (!ths.length) continue;
        const rel = relByKey.get(key) ?? -1;
        if (rel < 0) continue;
        const col = pd.color;
        const cur = ths.find((th) => rel >= th.t0 && rel <= th.t1); // thermal we're in now
        let last: Thermal | null = null; // most recent thermal fully behind the playhead
        for (const th of ths) { if (th.t1 < rel) last = th; else break; }
        const show: { th: Thermal; live: boolean }[] = [];
        if (last) show.push({ th: last, live: false });
        if (cur) show.push({ th: cur, live: true });
        for (const { th, live } of show) {
          bases.push({ lon: th.entryLon, lat: th.entryLat, alt: th.alt0, color: col });
          if (live) {
            // still climbing — badge floats at the glider with the gain-so-far
            const alt = sampleTrack(pd.track, rel)[2];
            badges.push({ lon: th.entryLon, lat: th.entryLat, alt, color: col,
              text: `▲ +${Math.max(0, Math.round(alt - th.alt0))} m` });
          } else {
            badges.push({ lon: th.exitLon, lat: th.exitLat, alt: th.alt1, color: col,
              text: `+${th.gain | 0} m\n${th.avgClimb.toFixed(1)}↑ ${th.maxClimb.toFixed(1)}` });
          }
        }
      }
      if (bases.length) {
        thermalMarkerLayers.push(new ScatterplotLayer({
          id: "therm-base", data: bases,
          getPosition: (d: any) => [d.lon, d.lat, d.alt],
          getFillColor: (d: any) => [...d.color, 55] as any,
          getLineColor: (d: any) => [...d.color, 255] as any,
          stroked: true, filled: true, lineWidthMinPixels: 2,
          radiusUnits: "pixels", getRadius: 10, billboard: true,
        }));
      }
      if (badges.length) {
        thermalMarkerLayers.push(new TextLayer({
          id: "therm-badge", data: badges,
          getPosition: (d: any) => [d.lon, d.lat, d.alt],
          getText: (d: any) => d.text,
          getColor: [255, 255, 255, 255],
          getSize: 12, billboard: true, background: true,
          // the default font atlas is ASCII-only; "auto" builds it from the actual
          // strings so ▲ / ↑ render instead of tofu boxes.
          characterSet: "auto",
          getBackgroundColor: (d: any) => [d.color[0] * 0.45, d.color[1] * 0.45, d.color[2] * 0.45, 225] as any,
          backgroundPadding: [5, 3], getPixelOffset: [0, -14],
          fontWeight: 700, getTextAnchor: "middle" as any, getAlignmentBaseline: "bottom" as any,
        }));
      }
    }

    // ── glide badge: a stat label at the END of each active pilot's current + last glide
    // (the transition between thermals) — distance, sink, glide ratio. Steel-blue bg + a ▽
    // below the point, to read distinctly from the pilot-coloured thermal badges above. ──
    let glideMarkerLayers: any[] = [];
    if (trackThermals()) {
      const gbadges: any[] = [];
      for (const key of activeThermalKeys()) {
        const pd = pathData.get(key);
        if (!pd) continue;
        const gls = glidesFor(key);
        if (!gls.length) continue;
        const rel = relByKey.get(key) ?? -1;
        if (rel < 0) continue;
        const col = pd.color;
        const cur = gls.find((g) => rel >= g.t0 && rel <= g.t1); // glide we're in now
        let last: Glide | null = null; // most recent glide fully behind the playhead
        for (const g of gls) { if (g.t1 < rel) last = g; else break; }
        if (last)
          gbadges.push({ lon: last.endLon, lat: last.endLat, alt: last.alt1, color: col,
            text: `▽ ${last.distKm.toFixed(1)} km\n↓${last.avgSink.toFixed(1)} L/D ${fmtLD(last.ld)}` });
        if (cur) {
          // still gliding — badge at the glider with distance / L·D so far (straight-line
          // from the glide start; a live estimate, exact path total lands once it ends).
          const [clat, clon, calt] = sampleTrack(pd.track, rel);
          const distSoFar = haversine(cur.startLat, cur.startLon, clat, clon) / 1000;
          const lost = cur.alt0 - calt;
          const ld = lost > 0 ? (distSoFar * 1000) / lost : Infinity;
          gbadges.push({ lon: clon, lat: clat, alt: calt, color: col,
            text: `▽ ${distSoFar.toFixed(1)} km\nL/D ${fmtLD(ld)}` });
        }
      }
      if (gbadges.length) {
        glideMarkerLayers.push(new TextLayer({
          id: "glide-badge", data: gbadges,
          getPosition: (d: any) => [d.lon, d.lat, d.alt],
          getText: (d: any) => d.text,
          getColor: [255, 255, 255, 255],
          getSize: 11, billboard: true, background: true,
          characterSet: "auto",
          getBackgroundColor: [30, 58, 95, 220], // steel blue — "glide", vs pilot-colour "climb"
          backgroundPadding: [5, 3], getPixelOffset: [0, 14],
          fontWeight: 700, getTextAnchor: "middle" as any, getAlignmentBaseline: "top" as any,
        }));
      }
    }

    // ── glide-start markers: a teal dot + "↘ <alt> m" label at the ONSET of every glide the
    // followed pilot has flown so far (each transition out of a climb into a glide). Unlike the
    // 2-per-pilot thermal/glide badges, these ACCUMULATE — the whole point is to compare where
    // and how high each glide began — but still reveal in replay order (only glides whose start
    // the playhead has passed). Teal reads distinctly from the steel-blue glide-END badge, and
    // the ↘ icon + above-point label distinguishes an onset from the ▽ end badge below. ──
    let glideStartMarkerLayers: any[] = [];
    if (showGlideStarts()) {
      const dots: any[] = [];   // teal ring at the glide onset (leaving the climb)
      const labels: any[] = []; // "↘ <alt> m" — the altitude the glide began at
      for (const key of activeThermalKeys()) {
        if (renderHidden(key)) continue; // respect hidden trails, like every other per-pilot layer
        const pd = pathData.get(key);
        if (!pd) continue;
        const gls = glidesFor(key);
        if (!gls.length) continue;
        const rel = relByKey.get(key) ?? -1;
        if (rel < 0) continue;
        for (const g of gls) {
          if (g.t0 > rel) break; // glides are time-sorted → stop at the first onset ahead of the playhead
          dots.push({ lon: g.startLon, lat: g.startLat, alt: g.alt0 });
          labels.push({ lon: g.startLon, lat: g.startLat, alt: g.alt0, text: `↘ ${Math.round(g.alt0)} m` });
        }
      }
      if (dots.length) {
        glideStartMarkerLayers.push(new ScatterplotLayer({
          id: "glide-start-dot", data: dots,
          getPosition: (d: any) => [d.lon, d.lat, d.alt],
          getFillColor: [20, 110, 120, 90], getLineColor: [120, 220, 235, 255], // teal onset ring
          stroked: true, filled: true, lineWidthMinPixels: 2,
          radiusUnits: "pixels", getRadius: 7, billboard: true,
        }));
      }
      if (labels.length) {
        glideStartMarkerLayers.push(new TextLayer({
          id: "glide-start-label", data: labels,
          getPosition: (d: any) => [d.lon, d.lat, d.alt],
          getText: (d: any) => d.text,
          getColor: [255, 255, 255, 255],
          getSize: 11, billboard: true, background: true,
          characterSet: "auto", // build the atlas from the actual strings so ↘ renders (not tofu)
          getBackgroundColor: [20, 110, 120, 220], // teal — glide ONSET, vs steel-blue glide-END
          backgroundPadding: [5, 3], getPixelOffset: [0, -14],
          fontWeight: 700, getTextAnchor: "middle" as any, getAlignmentBaseline: "bottom" as any,
        }));
      }
    }

    // selected thermal/glide: a white-glow casing over that stretch of track. Two paths —
    // a wide soft halo + a crisp core — so it pops over terrain AND over the climb/sink
    // trail colours (a plain colour would camouflage into the same-hued trail). Static
    // per selection; rebuilt only when selHighlight changes (updateTriggers).
    const hl = selHighlight();
    const highlightLayers = hl
      ? [
          new PathLayer({
            id: "seg-hl-glow", data: [{ path: hl }], getPath: (d: any) => d.path,
            getColor: [255, 255, 255, 90], getWidth: 12, widthUnits: "pixels", widthMinPixels: 8,
            capRounded: true, jointRounded: true, updateTriggers: { getPath: hl },
          }),
          new PathLayer({
            id: "seg-hl-core", data: [{ path: hl }], getPath: (d: any) => d.path,
            getColor: [255, 255, 255, 255], getWidth: 3, widthUnits: "pixels", widthMinPixels: 2,
            capRounded: true, jointRounded: true, updateTriggers: { getPath: hl },
          }),
        ]
      : [];

    // ── map LABELS: named annotations pinned to the TERRAIN SURFACE. Each is placed at
    // [lon, lat, groundAt(lon,lat)] — the same cached DEM sampling the drop-lines and AGL
    // readouts use — so it sits ON the hillside and stays glued as you tilt/zoom (ground
    // z fills in over a few frames as DEM tiles arrive, since we resample every frame). A
    // pin dot + the name text, both billboard. Shown when the layer is on OR in edit mode.
    const showLbls = mapLabelsOn() || labelEditMode();
    const rawLbls = showLbls ? labels : [];
    // fresh array each frame (new ref) so deck re-reads getPosition → ground z settles as
    // tiles load; also lets the pin grow in edit mode for an easier click target.
    const lblData = rawLbls.map((l) => ({ id: l.id, name: l.name, lon: l.lon, lat: l.lat, gz: groundAt(l.lon, l.lat) }));
    const labelLayers = lblData.length
      ? [
          new ScatterplotLayer({
            id: "labels-pin", data: lblData,
            getPosition: (d: any) => [d.lon, d.lat, d.gz],
            getFillColor: [255, 214, 102, 235], getLineColor: [40, 30, 5, 255],
            stroked: true, filled: true, lineWidthMinPixels: 1.5,
            radiusUnits: "pixels", getRadius: labelEditMode() ? 7 : 5, billboard: true,
            // pickable in edit mode so a click hit-tests the label in the ACTUAL 3D scene
            // (deck picking respects the terrain z; map.project would miss when pitched).
            pickable: labelEditMode(),
            updateTriggers: { getRadius: labelEditMode() },
          }),
          new TextLayer({
            id: "labels-text", data: lblData,
            getPosition: (d: any) => [d.lon, d.lat, d.gz],
            getText: (d: any) => d.name,
            // annotation names carry accents too — "auto" atlases the actual glyphs used.
            characterSet: "auto",
            getColor: [255, 255, 255, 255],
            getSize: 13, billboard: true, background: true,
            getBackgroundColor: [120, 86, 10, 225], backgroundPadding: [6, 3],
            fontWeight: 700, getTextAnchor: "middle" as any, getAlignmentBaseline: "bottom" as any,
            getPixelOffset: [0, -12],
            updateTriggers: { getText: lblData.map((l) => l.id + ":" + l.name).join(",") },
          }),
        ]
      : [];

    // ground shadow lives in the MapLibre layer (draped, above); deck draws the
    // airborne stuff on top. Labels are optional (text rendering is costly).
    // In LABEL EDIT MODE we HIDE every tracklog (paths/trips/gliders/markers/badges/name
    // tags) so the labels are unmistakably the thing being edited; the labels layer stays.
    const trackLayers = labelEditMode()
      ? []
      : [
          ...(gpu || seekMode() ? tripsLayers : [...dropLines, ...paths, ...tips]),
          ...highlightLayers,
          startMarkers, markers,
          ...thermalMarkerLayers,
          ...glideMarkerLayers,
          ...glideStartMarkerLayers,
          // leader lines UNDER the tags (only when declutter moved some), then the pilot
          // name/alt tags LAST → drawn on top of every trail, glider and marker (with
          // depthTest off on the layer) so a label is never hidden behind the tracklogs.
          ...(labelsOn() ? [nameBubbles] : []),
        ];
    const layers = [
      // map labels draw EARLY → tracklogs render ON TOP of them (in edit mode the tracks
      // are hidden, so the labels are the only deck content and read clearly).
      ...labelLayers,
      ...trackLayers,
    ];
    overlay.setProps({ layers });
    mLayers = layers.length;
  }

  // per-frame damped RE-CENTRE toward a target centre. CENTRE-ONLY on purpose: we damp
  // the map centre toward the followed target and DON'T touch zoom/bearing/pitch, so the
  // user can freely orbit (mouse rotate/pitch) and wheel-zoom while following — the view
  // keeps the target centred without fighting the gesture. A gentle setCenter (not jumpTo)
  // won't interrupt an in-progress mouse gesture. Low factor = heavy momentum, so the
  // camera lags and glides after a gaggle instead of snapping frame-to-frame.
  const CAM_DAMP = 0.06;
  function dampCam(center: any) {
    const c = map.getCenter();
    const tlng = center.lng ?? center[0];
    const tlat = center.lat ?? center[1];
    map.setCenter([c.lng + (tlng - c.lng) * CAM_DAMP, c.lat + (tlat - c.lat) * CAM_DAMP]);
  }

  // A one-shot map.easeTo (enter-framing, angle presets, orbit keys, north reset, gaggle
  // lock-on) is an interruptible animation — and our per-frame setCenter calls map.stop()
  // internally, which would CANCEL it after a single frame. So each one-shot ease stamps a
  // short guard window here; while it's active updateCamera skips its recenter so the ease
  // can play out, then centre-only tracking resumes. (A hand wheel-zoom/orbit applies via
  // the map transform directly, isn't an easeTo, and so is never cancelled — no guard needed.)
  let camEaseUntil = 0;
  const guardEase = (ms: number) => { camEaseUntil = performance.now() + ms; };

  function updateCamera() {
    if (!mapReady) return;
    const mode = followMode();
    if (mode === "free") return;
    if (performance.now() < camEaseUntil) return; // let a one-shot ease finish uninterrupted
    if (mode === "gaggle") {
      const id = followGaggle();
      if (id != null) frameGaggle(id);
      return;
    }
    if (mode === "single") {
      const l = live.get(followKey() ?? "") ?? [...live.values()][0];
      if (!l) return;
      // centre-only chase: initial zoom is set once on enter, orbit/zoom stay by hand
      dampCam([l.lon, l.lat]);
    } else {
      // recentre on whoever is airborne (fall back to everyone before the first launch).
      // Centre-only — the initial fit is done once on enter (enterAllFrame).
      const air = [...live.values()].filter((l) => l.state === "air");
      const pts = air.length ? air : [...live.values()];
      if (!pts.length) return;
      const b = new maplibregl.LngLatBounds();
      pts.forEach((l) => b.extend([l.lon, l.lat]));
      dampCam(b.getCenter());
    }
  }

  function recomputeStats(tod: number, doTri: boolean) {
    const list = props.flights();
    // Gaggles are computed ONLY over pilots currently airborne, at the same wall-clock
    // instant. A landed pilot's position is frozen at their landing spot, so including
    // them would glue phantom members onto every cluster.
    const nodes: Node[] = [];
    for (const f of list) {
      const l = live.get(keyOf(f));
      if (l && l.state === "air") nodes.push({ key: l.key, lat: l.lat, lon: l.lon });
    }
    const g = gaggles(nodes, GAGGLE_THRESHOLD_M);
    const order = orderByProximity(nodes, g);

    const byKey = new Map<string, Stat>();
    for (const f of list) {
      const key = keyOf(f); const l = live.get(key); if (!l) continue;
      l.name = f.name; // keep the on-map glider label in sync after a rename
      const rel = relOf(f, tod);
      if (doTri) lastTri.set(key, l.state === "pre" ? 0 : freeTriangle(f.track, rel).distKm);
      let agl: number | null = null;
      if (hasTerrain && terrainOn() && l.state === "air") {
        const ground = groundAt(l.lon, l.lat); // fixed DEM read (queryTerrainElevation returns 0 here)
        if (ground > 0) agl = Math.max(0, l.alt - ground);
      }
      byKey.set(key, {
        key, name: f.name, color: f.color, alt: l.alt, agl,
        distKm: l.state === "pre" ? 0 : distFromStart(f.track, l.lat, l.lon),
        triKm: lastTri.get(key) ?? 0,
        gaggleId: g.get(key) ?? -1,
        state: l.state,
      });
    }
    // airborne first (grouped by gaggle / proximity), then everyone else
    const airborne = order.map((k) => byKey.get(k)!).filter(Boolean);
    const rest = list
      .map((f) => byKey.get(keyOf(f))!)
      .filter((s) => s && s.state !== "air");
    setStats([...airborne, ...rest]);
  }

  // ── init ────────────────────────────────────────────────────────────
  onMount(() => {
    // Creating the GL map can THROW on a device with no/blocked WebGL — that's the classic
    // "stuck forever" load, so catch it, name it on the loader, and stop (the Reload button
    // is the user's out). Everything past here is guarded to always reach setReady.
    try {
      map = new maplibregl.Map({
        container,
        style: basemapStyle(basemap(), MAP_TILER),
        center: [8.1, 46.8],
        zoom: 10,
        pitch: 55,
        maxPitch: 85,
        attributionControl: false,
        // no shift+drag box-zoom: on a replay map that rectangle reads as an area
        // SELECTION the app doesn't have, and it fights shift-modified interaction.
        // Pan / wheel-zoom / drag-rotate are untouched (follow modes still toggle
        // dragRotate on their own — see the follow camera below).
        boxZoom: false,
      });
    } catch (e: any) {
      setLoadError("Couldn't start the map engine — WebGL may be disabled or unsupported. " + (e?.message ?? e));
      return;
    }
    (window as any).xc3dMap = map; // debug hook (see xc3dSun) — inspect layers/style
    // Re-attach the sun hillshade after ANY style change. A basemap swap doesn't always
    // fire `style.load`: when MapLibre can diff the old style into the new one it patches
    // in place (and drops layers we added) without a reload event. `styledata` fires either
    // way, and ensureSunLayer() is a cheap no-op once the layer is there.
    map.on("styledata", () => { ensureSunLayer(); if (castShadows()) cast?.invalidate(); });
    // cast-shadow controller: assembles a viewport heightmap + ray-marches the sun. Recompute
    // only when the view settles (moveend) or the sun minute ticks — never per frame.
    cast = new CastShadow(map);
    (window as any).xc3dCast = () => cast?.dbg; // debug hook: last cast-shadow run diagnostics
    // the enable/sun effects below may have first run while `cast` was still null (map init is
    // async) — seed the controller's state now that it exists, so it doesn't sit disabled.
    const s0 = sunNow();
    if (s0) cast.setSun({ azimuthDeg: s0.azimuthDeg, altitudeDeg: s0.altitudeDeg });
    cast.setEnabled(castShadows());
    map.on("moveend", () => { if (castShadows()) cast?.schedule(); });
    // While PAUSED the render loop is idle, so a pan/zoom/rotate/pitch won't re-solve the
    // label declutter on its own — the deck overlay re-projects the anchored tags (they
    // ride their dots), but the screen-space arrangement can go stale on a big zoom. Nudge a
    // re-solve on map move, throttled by the same DECLUTTER_MS gate inside frameLayers so a
    // drag doesn't hammer it. (While PLAYING the loop already drives it — skip to avoid double
    // work.) frameLayers(false) reuses the cached trails — only the tags/leaders need it.
    map.on("move", () => {
      if (playing() || !declutterLabels() || !labelsOn()) return;
      if (performance.now() - lastDeclutterSolve < DECLUTTER_MS) return;
      frameLayers(false);
    });
    profMark("map-engine");
    setLoadStep(1); // engine up → now waiting on the base-map style
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    // basemaps change under the user; OpenTopoMap/Esri both require credit
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    map.on("error", (e: any) => {
      const m = e?.error?.message ?? String(e);
      console.warn("[xc3d] map error:", m);
      if (!ready()) setMapNote(m); // surface the last map complaint while still loading
    });

    // PANNING by hand (left-drag) deliberately moves the centre off the target, which is
    // incompatible with a locked centre — so a pan drops any follow cam back to "free".
    // Orbit (rotate/pitch) and wheel-ZOOM do NOT exit: while following we track the
    // target's centre only and leave zoom/bearing/pitch wherever the user's mouse left
    // them, so you can freely orbit+zoom a followed gaggle/pilot without dropping follow.
    // Programmatic moves (jumpTo/easeTo/setCenter) carry no originalEvent.
    // NB: keep followGaggle set — the camera stops chasing, but the gaggle stays the
    // thermal-overlay focus so moving the map doesn't extinguish its thermals.
    const exitToFree = (e: any) => {
      if (!e?.originalEvent) return;
      if (followMode() !== "free") { setFollowMode("free"); }
    };
    for (const ev of ["dragstart"]) map.on(ev, exitToFree);

    // seek mode: a click/tap near any visible track jumps the playhead to that point in
    // time. We pick against the decimated trip paths (≤budget verts each) — cheap enough
    // to brute-force on a one-off click — and read the matching tod timestamp. 2D pick
    // (ignores altitude), which is plenty for "grab the track roughly here".
    map.on("click", (e: any) => {
      if (!seekMode() || !mapReady || !e?.point) return;
      const px = e.point;
      let bestD2 = Infinity, bestT: number | null = null;
      for (const [key, tc] of tripsCache.entries()) {
        if (renderHidden(key)) continue;
        const path = tc.path, ts = tc.timestamps;
        for (let i = 0; i < path.length; i++) {
          const p = map.project([path[i][0], path[i][1]]);
          const dx = p.x - px.x, dy = p.y - px.y, d2 = dx * dx + dy * dy;
          if (d2 < bestD2) { bestD2 = d2; bestT = ts[i]; }
        }
      }
      const TH = 26; // px pick radius (finger-friendly)
      if (bestT != null && bestD2 <= TH * TH) {
        setPlayhead(Math.max(dayStart(), Math.min(dayEnd(), bestT)));
        if (!playing()) frameLayers(); // repaint now when paused (loop won't)
      }
    });

    // LABEL EDIT MODE clicks: hit-test the existing labels first (2D pick, like seek mode) —
    // a hit opens the rename/delete menu at the cursor; a miss opens "add a label here" at
    // the clicked lng/lat. The actual add/edit (with copy-on-write when viewing an external
    // collection) is done by the Room callbacks the menu buttons invoke.
    map.on("click", (e: any) => {
      if (!labelEditMode() || !mapReady || !e?.point || !e?.lngLat) return;
      const px = e.point;
      // hit-test existing labels via deck picking — it queries the rendered 3D scene, so a
      // terrain-elevated pin is picked where it's actually DRAWN (map.project ignores the
      // z and would miss badly when pitched). A hit opens rename/delete; a miss adds here.
      let hit: MapLabel | undefined;
      try {
        const info = overlay?.pickObject?.({ x: px.x, y: px.y, radius: 10, layerIds: ["labels-pin"] });
        const id = info?.object?.id;
        if (id != null) hit = labels.find((l) => l.id === id);
      } catch { /* picking unavailable — fall through to add */ }
      if (hit) {
        setLabelDraft(hit.name);
        setLabelMenu({ x: px.x, y: px.y, lng: hit.lon, lat: hit.lat, label: hit });
      } else {
        setLabelDraft("");
        setLabelMenu({ x: px.x, y: px.y, lng: e.lngLat.lng, lat: e.lngLat.lat });
      }
    });

    let setupDone = false;
    const setup = async () => {
      if (setupDone) return;
      setupDone = true;
      // resume where the player last was in THIS room (clock + camera), if saved
      const savedPos = loadRoomPos(props.sessionId);
      // CRITICAL PATH — must always reach setReady(true), whatever else fails.
      // Each stage PAINTS (await nextPaint) before its heavy synchronous work, so a
      // freeze shows the stage that's actually stuck — not a misleading earlier one.
      profMark("map-style");
      setLoadStep(2); // style is up → building the deck scene
      await nextPaint(); // paint "Building the scene" before the deck.gl GL compile below
      try {
        // deck renders in its own canvas ON TOP of the map: airborne trails, gliders,
        // labels and drop-lines always show. The GROUND shadow is NOT drawn here — it
        // lives in a real MapLibre line layer (ensureShadowLayer) so MapLibre drapes it
        // onto the terrain surface and hills occlude it correctly.
        // ↓ deck.gl program compilation — the likeliest multi-second stall on a weak
        //   GPU. It now hangs UNDER stage 2 "Building the scene", where it belongs.
        overlay = new MapboxOverlay({ interleaved: false, layers: [] });
        map.addControl(overlay);
        try { map.resize(); } catch {}
        mapReady = true;
        profMark("scene");
        setPlayhead(savedPos ? savedPos.playhead : dayStart()); // resume, else first launch
        setLoadStep(3); // scene up → placing the flights
        await nextPaint(); // paint "Placing the flights" before the per-flight build below
        // ↓ trail decimation + (if trackThermals is on) synchronous thermal/glide
        //   detection over every pilot — now attributed to stage 3, not stage 1.
        ensureLayers();
        frameLayers();
        last = 0;
        raf = requestAnimationFrame(loop);
      } catch (e: any) {
        console.error("[xc3d] map setup failed:", e);
        setMapNote("scene setup: " + (e?.message ?? e));
      } finally {
        setLoadStep(MAP_STEPS); // all stages done (or best-effort)
        profMark("ready");
        profReport(); // log the full load timeline (boot → fetch → parse → map → ready)
        setReady(true); // clear the loader no matter what
      }

      // extras — never block readiness
      try {
        if (savedPos) {
          // RESUME: drop back to the saved camera + follow state for this room
          setCamPitch(savedPos.pitch); setCamBearing(savedPos.bearing);
          setFollowMode(savedPos.followMode); setFollowKey(savedPos.followKey);
          // restore the selected pilot too, but only if they're still in this room
          if (savedPos.selectedKey && props.flights().some((f) => keyOf(f) === savedPos.selectedKey)) {
            setSelectedKey(savedPos.selectedKey);
          }
          map.jumpTo({ center: savedPos.center, zoom: savedPos.zoom, pitch: savedPos.pitch, bearing: savedPos.bearing });
        } else {
          // DEFAULT VIEW: start UP CLOSE on the launch area, tilted (3D) — not a wide
          // top-down overview of the whole day. Playback starts paused at the first
          // launch, so framing the take-off points at a close zoom drops you right by
          // the gliders. maxZoom caps how far IN we go; pitch/bearing use the cam aim.
          const b = new maplibregl.LngLatBounds();
          let any = false;
          for (const f of props.flights()) {
            const p0 = f.track[0];
            b.extend([p0[2], p0[1]]); any = true;
          }
          if (any) {
            const cam = map.cameraForBounds(b, {
              padding: 140, maxZoom: 13.5, bearing: camBearing(), pitch: camPitch(),
            } as any);
            if (cam) {
              map.jumpTo({ center: cam.center, zoom: cam.zoom ?? 13, bearing: camBearing(), pitch: camPitch() });
            } else {
              const c = b.getCenter();
              map.jumpTo({ center: [c.lng, c.lat], zoom: 13, bearing: camBearing(), pitch: camPitch() });
            }
          }
        }
      } catch (e) { console.warn("[xc3d] initial framing skipped:", e); }
      syncTerrain(); // apply 3D terrain now that the style is loaded and mapReady
      ensureShadowLayer(); // draped ground-shadow line layer
      ensureSunLayer(); // sun-angle hillshade over the DEM (if the Sun toggle is on)
      applySky();
    };
    // trigger on style.load (does NOT wait for base tiles), or immediately if ready,
    // plus a short fallback so a missed event can never leave us stuck on the loader.
    if (map.isStyleLoaded()) setup();
    else map.on("style.load", setup);
    setTimeout(setup, 1500);
  });

  onMount(() => {
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // flush the room position on tab hide/close (pagehide fires on mobile bfcache too)
  onMount(() => {
    const flush = () => savePos();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => { if (document.hidden) savePos(); });
    onCleanup(() => window.removeEventListener("pagehide", flush));
  });

  // A pilot-row press/hover pins that pilot's FULL track (hoverKey). The stats list
  // re-renders ~4×/s, so a row's node can be swapped out between pointerdown and
  // pointerup — the row's own release handler is then lost and the reveal sticks
  // (a whole track frozen on the map while you scrub). Clearing from the window
  // guarantees any release/cancel, anywhere, unpins it.
  onMount(() => {
    const clear = () => setHoverKey(null);
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    onCleanup(() => {
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
    });
  });

  // swap the basemap. setStyle() wipes every source we added (incl. terrain), so the
  // terrain has to be re-attached once the new style is up.
  // NB: the map is created with the initial basemap in onMount, so track what's
  // actually applied and skip no-op re-sets. (A previous `firstStyle` flag was
  // consumed by the initial !mapReady bail-out, which silently swallowed the
  // FIRST real basemap switch.)
  let appliedBasemap = basemap();
  createEffect(() => {
    const id = basemap();
    if (!mapReady) return;
    if (id === appliedBasemap) return; // already showing this basemap
    appliedBasemap = id;
    map.setStyle(basemapStyle(id, MAP_TILER));
    map.once("style.load", () => {
      hasTerrain = false; syncTerrain(); ensureShadowLayer(); ensureSunLayer(); applySky();
    });
  });

  // terrain on/off (also re-applied after a basemap swap)
  createEffect(() => { terrainOn(); if (mapReady) syncTerrain(); });

  // In GANG (gaggle) follow, mouse orbit is disabled — hand-rotating a locked group fought
  // the centre tracking and felt broken. Orbit the gang with the , / . keys instead (they
  // ease the bearing around the centred centroid). Re-enabled in every other mode.
  createEffect(() => {
    const gang = followMode() === "gaggle";
    if (!map) return;
    if (gang) { map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); }
    else { map.dragRotate.enable(); map.touchZoomRotate.enableRotation(); }
  });

  // blue sky + soft horizon haze. setSky is wiped by setStyle, so re-apply after swaps.
  function applySky() {
    if (!mapReady) return;
    try {
      (map as any).setSky({
        "sky-color": "#3a8fe0",
        "sky-horizon-blend": 0.7,
        "horizon-color": "#bfe0ff",
        "horizon-fog-blend": 0.6,
        "fog-color": "#eaf5ff",
        "fog-ground-blend": 0.7,
      });
    } catch (e) { console.warn("[xc3d] sky:", e); }
  }

  // Tab / hideUI also strips the built-in map nav + attribution controls. NB: hide the
  // individual `.maplibregl-ctrl` widgets, NOT the whole `.maplibregl-control-container` —
  // the deck.gl overlay canvas (tracks/gliders/launch triangles + the name/alt labels) is
  // added via map.addControl(overlay) and so lives INSIDE that container. Hiding the
  // container blanked the whole scene; scoping to `.maplibregl-ctrl` leaves the deck
  // overlay (and the base map, which is a separate sibling canvas) untouched.
  createEffect(() => {
    const hide = hideUI();
    if (!container) return;
    container.querySelectorAll<HTMLElement>(".maplibregl-ctrl")
      .forEach((el) => (el.style.display = hide ? "none" : ""));
  });

  // The MapTiler terrain-rgb DEM source. Shared by the 3D terrain mesh (setTerrain) and
  // the sun hillshade layer — either can be on without the other, so adding the source is
  // split out from syncTerrain(). setStyle() wipes it, hence the getSource() guard.
  function ensureDemSource(): boolean {
    if (!MAP_TILER) return false;
    if (!map.getSource("terrain")) {
      map.addSource("terrain", {
        type: "raster-dem",
        url: `https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${MAP_TILER}`,
        // MapTiler terrain-rgb PNG tiles are 512×512 px (verified: the served
        // tile is 512²). raster-dem's tileSize MUST match the real tile size or
        // MapLibre samples the DEM at the wrong resolution → flat mesh. 512 is
        // also MapLibre's raster-dem default; an earlier "fix" wrongly set 256.
        tileSize: 512,
      });
    }
    return true;
  }

  function syncTerrain() {
    if (!mapReady) return;
    const want = terrainOn() && !!MAP_TILER;
    try {
      if (!want) {
        if (hasTerrain) { map.setTerrain(null as any); hasTerrain = false; }
        return;
      }
      if (hasTerrain) return;
      if (!ensureDemSource()) return;
      map.setTerrain({ source: "terrain", exaggeration: 1 });
      hasTerrain = true;
    } catch (e) { console.warn("[xc3d] terrain:", e); }
  }

  // ── SUN: terrain shading from the real sun angle at the playhead ──────────────
  // A MapLibre `hillshade` layer over the same terrain-rgb DEM. Hillshade shades from the
  // DEM's surface NORMALS — dot(normal, light) — which is exactly the thermal question:
  // which slopes are square to the sun right now (cooking) and which are in their own
  // shade. NB it is NOT a cast shadow: a peak does not shadow the valley behind it.
  // Being a map layer it composites over ANY basemap, shades only the terrain, and sits
  // under the deck.gl overlay (deck draws on its own canvas above the map).
  const SUN_LAYER = "sun-hillshade";
  // A SECOND, identical hillshade pass stacked on the first: at the top of the slider one
  // pass alone bottoms out at a dark grey (~RGB 18) because partially-averted slopes only
  // blend a fraction of the shadow colour and alpha×exaggeration are already maxed. A second
  // multiplicative pass compounds those darks toward true black. It only fades IN above the
  // default (see sunBoost): at ≤50 % it's fully transparent, so low/default look unchanged.
  const SUN_LAYER_2 = "sun-hillshade-2";
  // The shaded (sun-facing-away) side is tinted by sunShadeCol (black by default; the Base
  // tab's swatch row picks it), the lit side left untouched, so the slider reads as plain
  // "how dark is the shade" — up to pitch black at 100 %. Colour and opacity are independent:
  // this picks the RGB, the sunShade slider drives the alpha.
  const hexToRgbTriple = (hex: string): string => {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
    if (!m) return "0, 0, 0";
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  };
  /** the hillshade's shadow colour at the CURRENT slider value (0–100 % → alpha 0–1) */
  const sunShadeColor = () => `rgba(${hexToRgbTriple(sunShadeCol())}, ${(sunShade() / 100).toFixed(3)})`;
  // second-pass strength: 0 at slider ≤50 % (the default), ramping to 1 at 100 %. So the
  // extra darkness is only ever ADDED at the top end; the base look never regresses.
  const sunBoost = () => Math.max(0, Math.min(1, (sunShade() / 100 - 0.5) / 0.5));
  /** the second pass's shadow colour — same tint, alpha = the boost ramp */
  const sunShadeColor2 = () => `rgba(${hexToRgbTriple(sunShadeCol())}, ${sunBoost().toFixed(3)})`;

  /** Where to insert the hillshade: above the basemap's raster/fill tiles, but BELOW the
   *  first line/symbol layer (roads, contours, place names on the vector basemaps) so the
   *  map's own linework stays readable through the shading. Raster basemaps have no such
   *  layer → undefined = on top of the tiles. Our own layers are skipped. */
  function sunBeforeId(): string | undefined {
    for (const l of map.getStyle().layers ?? []) {
      if (l.id === SUN_LAYER || l.id === SUN_LAYER_2 || l.id === SHADOW_SRC) continue;
      if (l.type === "line" || l.type === "symbol") return l.id;
    }
    return undefined;
  }

  // one hillshade pass — same paint recipe for both stacked layers; only the shadow colour
  // (its alpha) differs (the base pass follows the slider, the boost pass the ramp).
  const sunPaint = (shadow: string) => ({
    // the shaded side at the given colour, the lit side fully transparent. NB read the live
    // signals through the colour helpers rather than hard-coding a default — a basemap swap
    // re-attaches these layers and must keep the chosen tint + strength.
    "hillshade-shadow-color": shadow,
    "hillshade-highlight-color": "rgba(0, 0, 0, 0)",
    "hillshade-accent-color": "rgba(0, 0, 0, 0)",
    // anchor "map" ⇒ illumination-direction is a real compass bearing (deg CW from
    // north), i.e. the sun azimuth — it stays put when the camera rotates.
    "hillshade-illumination-anchor": "map",
    "hillshade-illumination-direction": 180,
    "hillshade-exaggeration": 0.7,
  });

  function ensureSunLayer() {
    if (!mapReady) return;
    try {
      if (!sunOn()) {
        if (map.getLayer(SUN_LAYER_2)) map.removeLayer(SUN_LAYER_2);
        if (map.getLayer(SUN_LAYER)) map.removeLayer(SUN_LAYER);
        return;
      }
      if (map.getLayer(SUN_LAYER) && map.getLayer(SUN_LAYER_2)) return;
      if (!ensureDemSource()) return;
      const before = sunBeforeId();
      // base pass, then the darkening pass on top of it (both below the basemap's linework)
      if (!map.getLayer(SUN_LAYER)) {
        map.addLayer({ id: SUN_LAYER, type: "hillshade", source: "terrain", paint: sunPaint(sunShadeColor()) } as any, before);
      }
      if (!map.getLayer(SUN_LAYER_2)) {
        map.addLayer({ id: SUN_LAYER_2, type: "hillshade", source: "terrain", paint: sunPaint(sunShadeColor2()) } as any, before);
      }
      applySun(true);
    } catch (e) {
      // Nearly always "Style is not done loading" — a basemap swap is still in flight, so
      // getStyle()/addLayer() are off limits. Retry on the next style event. (NB: do NOT
      // gate on map.isStyleLoaded() instead — on a vector basemap that stays false while
      // tiles stream in, and `idle` may never fire under the animating deck.gl overlay.)
      console.warn("[xc3d] sun layer (will retry):", e);
      map.once("styledata", () => ensureSunLayer());
    }
  }

  // sun position for the CURRENT playhead: the room's flight date supplies the day, the
  // playhead the time-of-day (both UTC); the first flight's launch point supplies lat/lon
  // (the sun moves ~1° per 100 km, far below hillshade fidelity, so any point in the room
  // is fine). Memoised on the playhead MINUTE so it recomputes a few times a second at
  // most, not every animation frame — the sun moves 0.25°/minute.
  const sunClock = createMemo(() => Math.floor(playhead() / 60));
  const sunNow = createMemo(() => {
    sunClock(); // track the coarse clock only
    const f = props.flights()[0];
    if (!f) return null;
    const [lat, lon] = f.launch;
    const when = instantOf(f.launchEpoch, playhead());
    return { when, ...sunPosition(when, lat, lon) };
  });

  /** push the current sun angle into the hillshade paint props */
  function applySun(force = false) {
    if (!mapReady) return;
    // self-heal: the clock ticks a few times a second, so if a style swap ate the layer
    // (or its add lost a race) it comes straight back rather than silently staying off.
    if (!map.getLayer(SUN_LAYER)) { if (sunOn()) ensureSunLayer(); return; }
    const s = sunNow();
    if (!s) return;
    const has2 = map.getLayer(SUN_LAYER_2);
    try {
      map.setPaintProperty(SUN_LAYER, "hillshade-shadow-color", sunShadeColor());
      if (has2) map.setPaintProperty(SUN_LAYER_2, "hillshade-shadow-color", sunShadeColor2());
      // Night (sun below the horizon): nothing is lit, so shading is meaningless — fade
      // the layer(s) out rather than freezing them at the last twilight angle.
      if (s.altitudeDeg <= 0) {
        map.setPaintProperty(SUN_LAYER, "hillshade-exaggeration", 0);
        if (has2) map.setPaintProperty(SUN_LAYER_2, "hillshade-exaggeration", 0);
        return;
      }
      map.setPaintProperty(SUN_LAYER, "hillshade-illumination-direction", s.azimuthDeg);
      if (has2) map.setPaintProperty(SUN_LAYER_2, "hillshade-illumination-direction", s.azimuthDeg);
      // A LOW sun rakes across the slopes (long shading, strong contrast); a HIGH midday
      // sun lights almost everything from above and the mask flattens out. Map altitude
      // 0°→90° onto exaggeration 0.9→0.35, with the first few degrees above the horizon
      // eased in so sunrise/sunset don't pop.
      const alt = Math.min(90, s.altitudeDeg);
      const ease = Math.min(1, alt / 3); // 0→1 over the first 3° above the horizon
      const byAlt = 0.9 - 0.55 * (alt / 90);
      // …but exaggeration also SCALES how strongly the shadow colour lands, so alpha alone
      // can't reach pitch black under a high sun. Let the slider pull exaggeration up
      // towards its 1.0 max as it climbs: at 0 % it's the pure altitude curve, at 100 %
      // it's fully saturated (alpha 1 × exaggeration 1 = genuinely black shade).
      const shade = sunShade() / 100;
      const exag = ease * (byAlt + (1 - byAlt) * shade);
      map.setPaintProperty(SUN_LAYER, "hillshade-exaggeration", exag);
      // second pass shares the direction + exaggeration; its own shadow-alpha (the boost
      // ramp) is what fades it in only at the top of the slider, so it deepens the darks
      // without touching low/default. Its alpha 0 below 50 % ⇒ genuinely no contribution.
      if (has2) map.setPaintProperty(SUN_LAYER_2, "hillshade-exaggeration", exag);
      if (force) {
        console.log(
          `[xc3d] sun ${s.when.toISOString()} az=${s.azimuthDeg.toFixed(1)}° alt=${s.altitudeDeg.toFixed(1)}°`,
        );
      }
    } catch (e) { console.warn("[xc3d] sun paint:", e); }
  }

  // toggle on/off, and re-drive the angle whenever the (coarse) clock moves
  createEffect(() => { sunOn(); if (mapReady) ensureSunLayer(); });
  createEffect(() => { sunNow(); applySun(); });
  // shade strength: re-apply on every slider drag (colour alpha AND exaggeration), without
  // waiting for the next clock minute to tick sunNow().
  createEffect(() => { sunShade(); applySun(); });
  // shade colour: re-apply on every swatch pick (drives the RGB of both passes' shadow colour)
  createEffect(() => { sunShadeCol(); applySun(); });
  // ── cast shadows (sun v2): enable/disable + feed the current sun angle ──
  createEffect(() => { const on = castShadows(); cast?.setEnabled(on); });
  createEffect(() => { const s = sunNow(); if (s) cast?.setSun({ azimuthDeg: s.azimuthDeg, altitudeDeg: s.altitudeDeg }); });
  // handy for checking the solar math (and poking the map) from the console / a browser test
  (window as any).xc3dSun = () => sunNow();

  onCleanup(() => { cancelAnimationFrame(raf); if (map) map.remove(); });

  // ── UI actions ──────────────────────────────────────────────────────
  const bumpSpeed = (d: number) => setSpeedIdx((i) => Math.max(0, Math.min(SPEEDS.length - 1, i + d)));
  // [ / ] — shorten / lengthen the trail drawn behind each glider (drives trailPct, honoured
  // by both the CPU PathLayer and the GPU TripsLayer). "Full trails" is the top of the range:
  // stepping down from full drops into a finite %, stepping up past 100% snaps back to full.
  const bumpTrail = (d: number) => {
    if (trailFull()) {
      if (d > 0) return;                          // full is already the longest — no-op
      setTrailFull(false);
      setTrailPct(Math.max(2, 100 + d * TRAIL_STEP)); // first visible step below full
      return;
    }
    const next = trailPct() + d * TRAIL_STEP;
    if (next >= 100 && d > 0) { setTrailFull(true); return; } // past the top ⇒ back to full
    setTrailPct(Math.max(2, Math.min(100, next)));
  };
  const togglePlay = () => {
    if (!playing() && playhead() >= dayEnd()) setPlayhead(dayStart());
    setPlaying((p) => !p);
  };
  const seekBy = (d: number) =>
    setPlayhead((t) => Math.max(dayStart(), Math.min(dayEnd(), t + d)));

  // camera angle preset — one-shot swing to the preset around the CURRENT centre. Works
  // in EVERY mode (free and follow): the per-frame follow is centre-only now, so it won't
  // undo the bearing/pitch — the preset sticks and you can orbit/zoom further by hand.
  const applyAngle = (k: string) => {
    const a = ANGLES[k];
    if (!a || !mapReady) return;
    setCamPitch(a.pitch);
    setCamBearing(a.bearing);
    guardEase(350);
    map.easeTo({ pitch: a.pitch, bearing: a.bearing, duration: 350 });
  };
  // , / . orbit the camera left / right around the current centre — one-shot ease, in
  // free AND follow (centre-only tracking keeps the new bearing).
  const rotateCam = (deg: number) => {
    if (!mapReady) return;
    setCamBearing((b) => (((b + deg) % 360) + 360) % 360);
    guardEase(200);
    map.easeTo({ bearing: camBearing(), duration: 200 });
  };

  // gaggle follow: cycle through the gaggles currently in the air
  const gaggleIds = () => groups().gaggles.map((g) => g.id);
  const cycleGaggle = (dir: 1 | -1) => {
    const ids = gaggleIds();
    if (!ids.length) return;
    const cur = followGaggle();
    const i = cur == null ? -1 : ids.indexOf(cur);
    const next = ids[(i + dir + ids.length * 2) % ids.length];
    focusGaggle(next);
  };
  // pilot follow: cycle followKey through the pilots currently airborne (stats() order),
  // flying to each as we go.
  const cyclePilot = (dir: 1 | -1) => {
    const keys = stats().filter((s) => s.state === "air").map((s) => s.key);
    if (!keys.length) return;
    const cur = followKey();
    const i = cur == null ? -1 : keys.indexOf(cur);
    setFollowKey(keys[(i + dir + keys.length * 2) % keys.length]);
    setFollowGaggle(null);
    if (followMode() !== "single") setFollowMode("single");
    enterSingleFrame();
  };
  // h / g dispatcher — meaning depends on the current camera mode:
  //   pilot mode  → next/prev PILOT
  //   gaggle mode → next/prev GAGGLE
  //   free / all  → JUMP into gaggle mode (focus a gaggle) — cycleGaggle sets the mode.
  const cycleFollow = (dir: 1 | -1) => {
    if (followMode() === "single") cyclePilot(dir);
    else cycleGaggle(dir);
  };
  // camera-mode looper: one button cycles all → pilot → gaggle → free (skipping gaggle when
  // there are none). Replaces the four separate cam-mode buttons.
  const CAM_ORDER: FollowMode[] = ["all", "single", "gaggle", "free"];
  const camLabel = (m: FollowMode) => (m === "single" ? "pilot" : m);
  const cycleCamMode = () => {
    const i = CAM_ORDER.indexOf(followMode());
    for (let s = 1; s <= CAM_ORDER.length; s++) {
      const next = CAM_ORDER[(i + s) % CAM_ORDER.length];
      if (next === "gaggle") { if (gaggleIds().length) { cycleGaggle(1); return; } continue; }
      // switching to an explicit pilot/all target releases the gaggle thermal lock, so the
      // overlay follows the new target. "free" does NOT — it's just a loose camera (same
      // as grabbing the map), and should keep the gaggle's thermals lit.
      if (next === "single" || next === "all") setFollowGaggle(null);
      setFollowMode(next);
      // one-shot ENTER framing: set a sensible zoom/fit ONCE, then per-frame tracking is
      // centre-only (so the user's later orbit/zoom sticks). gaggle frames via focusGaggle.
      if (next === "single") enterSingleFrame();
      else if (next === "all") enterAllFrame();
      return;
    }
  };
  // one-shot ENTER framing for pilot-follow: fly to the followed pilot at a sensible close
  // zoom + the current aim, then per-frame centre-only tracking takes over.
  const enterSingleFrame = () => {
    if (!mapReady) return;
    const l = live.get(followKey() ?? "") ?? [...live.values()][0];
    if (!l) return;
    guardEase(500);
    map.easeTo({ center: [l.lon, l.lat], zoom: 13.2, bearing: camBearing(), pitch: camPitch(), duration: 500 });
  };
  // one-shot ENTER framing for all-follow: fit everyone airborne once, at the current aim.
  const enterAllFrame = () => {
    if (!mapReady) return;
    const air = [...live.values()].filter((l) => l.state === "air");
    const pts = air.length ? air : [...live.values()];
    if (!pts.length) return;
    const b = new maplibregl.LngLatBounds();
    pts.forEach((l) => b.extend([l.lon, l.lat]));
    const cam = map.cameraForBounds(b, { padding: 90, maxZoom: 14, bearing: camBearing(), pitch: camPitch() } as any);
    if (cam) { guardEase(500); map.easeTo({ center: cam.center, zoom: cam.zoom ?? 12, bearing: camBearing(), pitch: camPitch(), duration: 500 }); }
  };
  // jump straight into all-follow (`w` / control-panel button): camera fits + tracks every
  // pilot visible on screen, releasing any single/gaggle lock. Distinct from `c`, which
  // cycles modes; this always lands on "all" and re-frames.
  const enterAllFollow = () => {
    setFollowGaggle(null);
    setFollowKey(null);
    setFollowMode("all");
    enterAllFrame();
  };
  // point the camera at a gaggle and lock on to it, preserving the current angle
  const focusGaggle = (id: number) => {
    setFollowGaggle(id);
    setFollowMode("gaggle");
    frameGaggle(id, true);
  };
  const frameGaggle = (id: number, animate = false) => {
    if (!mapReady) return;
    const members = stats().filter((s) => s.state === "air" && s.gaggleId === id);
    if (!members.length) return;
    const b = new maplibregl.LngLatBounds();
    for (const m of members) {
      const l = live.get(m.key);
      if (l) b.extend([l.lon, l.lat]);
    }
    if (animate) {
      // initial lock-on: fit the group ONCE at the current aim (angle presets / orbit),
      // then per-frame centre-only tracking takes over so the user can orbit/zoom by hand.
      const cam = map.cameraForBounds(b, {
        padding: 140,
        maxZoom: 13.5,
        bearing: camBearing(),
        pitch: camPitch(),
      } as any);
      if (!cam) return;
      guardEase(500);
      map.easeTo({ center: cam.center, zoom: cam.zoom ?? 12, bearing: camBearing(), pitch: camPitch(), duration: 500 });
    } else {
      dampCam(b.getCenter()); // centre-only re-frame; keep the user's zoom/orbit
    }
  };

  // ── keyboard ────────────────────────────────────────────────────────
  function onKey(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    // Don't hijack typing in text fields (room name, pilot filter, rename). The timeline
    // scrubber is <input type="range">, which isn't typing — keep hotkeys (space/j/k/…)
    // live while it's focused, so clicking to scrub doesn't kill play/pause.
    if (el && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable ||
        (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range"))) return;
    let hit = true;
    switch (e.key) {
      case " ": togglePlay(); break;
      case "k": seekBy(SEEK_SMALL); break;
      case "j": seekBy(-SEEK_SMALL); break;
      case "PageUp": seekBy(SEEK_BIG); break;
      case "PageDown": seekBy(-SEEK_BIG); break;
      case "q": bumpSpeed(1); break;
      case "a": bumpSpeed(-1); break;
      case "h": cycleFollow(1); break;  // next: pilot (in pilot mode) / gaggle (else)
      case "g": cycleFollow(-1); break; // prev
      case ",": rotateCam(-15); break;
      case ".": rotateCam(15); break;
      case "[": bumpTrail(-1); break;
      case "]": bumpTrail(1); break;
      case "m": toggleGrayscale(); break;
      case "b": setShowGraph((v) => !v); break;
      case "c": cycleCamMode(); break;            // cycle camera mode: all → pilot → gaggle → free
      case "w": showOffscreen(); break;           // show pilots whose current dot is off screen
      case "p": setShowControls((v) => !v); break; // controls panel (moved off `c`)
      case "s": hideOffscreen(); break;           // hide pilots whose current dot is off screen
      case "x": setSeekMode((v) => !v); break;    // seek mode (was `s`; moved to free `s` for solo-visible)
      case "t": toggleThermals(); break;
      case "f": setShowDebug((v) => !v); break;
      case "l": setLabelEditMode((v) => !v); break; // label edit mode (hide tracks, click to add/edit)
      case "Tab": setHideUI((v) => !v); break; // world only
      case "?": setShowHelp((v) => !v); break;
      case "Escape": setShowHelp(false); setHideUI(false); break;
      default:
        if (ANGLES[e.key]) applyAngle(e.key);
        else hit = false;
    }
    if (hit) e.preventDefault();
  }
  const airborneCount = () => stats().filter((s) => s.state === "air").length;
  const gaggleCount = () => new Set(stats().filter((s) => s.state === "air").map((s) => s.gaggleId)).size;

  // Group the airborne pilots into their gaggles so each flying-together group reads as
  // one visual block. Real gaggles (2+) first (biggest first), then solo pilots, then
  // everyone who isn't in the air.
  const groups = createMemo(() => {
    const air = stats().filter((s) => s.state === "air");
    const byGaggle = new Map<number, Stat[]>();
    for (const s of air) {
      if (!byGaggle.has(s.gaggleId)) byGaggle.set(s.gaggleId, []);
      byGaggle.get(s.gaggleId)!.push(s);
    }
    const packs = [...byGaggle.entries()]
      .map(([id, members]) => ({ id, members }))
      .sort((a, b) => b.members.length - a.members.length || a.id - b.id);
    return {
      gaggles: packs.filter((p) => p.members.length > 1),
      solo: packs.filter((p) => p.members.length === 1).flatMap((p) => p.members),
      grounded: stats().filter((s) => s.state !== "air"),
    };
  });

  // ── timeline markers (computed frontend from the tracks) ────────────
  // fraction 0..1 of a time-of-day across the visible clock domain
  const pct = (t: number) => {
    const a = dayStart(), b = dayEnd();
    return b > a ? ((t - a) / (b - a)) * 100 : 0;
  };
  // inverse of pct(): map a client x inside `el` back to a time-of-day and seek there.
  // Used by the world-only (Tab) bottom edge strip, which has no <input type=range>.
  const scrubEdge = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return;
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setPlayhead(dayStart() + f * (dayEnd() - dayStart()));
    if (!playing()) frameLayers(); // paused: nothing else would redraw the scene
  };
  // whole-hour marks across the visible clock domain — subtle gridlines + HH labels so you
  // can read wall-clock at a glance on the seek bar. Every hour boundary from dayStart→dayEnd.
  const hourMarks = createMemo(() => {
    const a = dayStart(), b = dayEnd();
    const out: { sec: number; label: string }[] = [];
    if (b <= a) return out;
    for (let s = Math.ceil(a / 3600) * 3600; s <= b; s += 3600) {
      out.push({ sec: s, label: String(Math.floor(s / 3600) % 24).padStart(2, "0") });
    }
    return out;
  });
  // each flight's takeoff + landing instant (time-of-day)
  const takeoffs = createMemo(() =>
    props.flights().map((f) => {
      const t0 = todOfLaunch(f);
      return { key: keyOf(f), name: f.name, color: f.color, t0, t1: t0 + f.duration };
    }),
  );
  // NB: gaggle spawn/join/split ticks used to be sampled here and drawn on the seek
  // track. They cluttered the bar (and cost a 400-sample clustering sweep) for markers
  // nobody read — the live gaggle dock is the place for that. Removed.

  // flights as an interval graph (Gantt): sorted by take-off, each given a stack row.
  // Rendered as thin colored bars above the seek track when the ≡ toggle is on.
  const intervals = createMemo(() =>
    [...takeoffs()].sort((a, b) => a.t0 - b.t0).map((f, i) => ({ ...f, row: i })),
  );
  // lift the flag labels clear of the interval bars when both overlays are on
  const flagBottom = () => (showIntervals() ? `calc(100% + ${intervals().length * 5 + 8}px)` : "100%");

  // one timeline flag — big, padded, NAME highlighted in the pilot's colour, with the
  // military take-off (▲) / landing (▼) time under it. Vertical so flags never collide.
  const FlagLabel = (p: { name: string; color: string; t: number; kind: "takeoff" | "landing" }) => (
    <div
      class="absolute pointer-events-none flex flex-col items-center"
      style={{ left: `${pct(p.t)}%`, bottom: flagBottom(), transform: "translateX(-50%)", "z-index": "2" }}
    >
      <span style={{ "writing-mode": "vertical-rl", transform: "rotate(180deg)", "line-height": "1.05" }}>
        <span
          style={{
            display: "inline-block", background: p.color, color: "#10151b",
            "font-weight": "800", "font-size": "11px", padding: "3px 3px",
            "border-radius": "4px", "white-space": "nowrap",
          }}
        >
          {p.name}
        </span>
        <span
          style={{
            display: "inline-block", "margin-top": "2px", "font-size": "9px",
            "font-weight": "700", color: p.color, background: "rgba(0,0,0,0.6)",
            padding: "2px 2px", "border-radius": "3px", "white-space": "nowrap",
          }}
        >
          {p.kind === "takeoff" ? "▲ " : "▼ "}{fmtHM(p.t)}
        </span>
      </span>
      <span style={{ width: "2px", height: "9px", background: p.color, opacity: "0.8" }} />
    </div>
  );

  // ── shared UI fragments (rendered in desktop rails OR the mobile ☰ menu) ──
  const BrandButtons = () => <BrandBar onAddFlight={props.onAddFlight} hasOwnFlight={props.hasOwnFlight} />;

  // Room title header: shows the human-readable room name, falling back to the room CODE
  // (sessionId) when no title is set. The code stays the identity (QR/URL) — this is only a
  // label. Edited from the ⚙ Settings "Room name" input; updates live via the WS message.
  const roomLabel = () => (props.roomTitle?.() || "").trim() || props.sessionId;
  const RoomTitle = () => (
    <span
      class="panel px-3 py-2 font-bold shrink-0 truncate"
      style={{ "max-width": isMobile() ? "9rem" : "16rem", color: "var(--text)" }}
      title={`Room: ${roomLabel()} · code ${props.sessionId} — rename in ⚙ Settings`}
    >
      {roomLabel()}
    </span>
  );

  // Reset the camera to north-up. One-shot ease in every mode (free AND follow) — the
  // per-frame follow is centre-only, so the north-up bearing sticks.
  const resetNorth = () => {
    setCamBearing(0);
    if (mapReady) { guardEase(300); map.easeTo({ bearing: 0, duration: 300 }); }
  };
  // 3D compass rose: the disc tilts BACK with the map pitch (rotateX) and spins with the
  // bearing (rotateZ), so it reads like a gimballed compass seen at the camera's own
  // angle — the red tip still points to true north. Click to snap back to north-up.
  // `bare` (full-screen HUD): strip the button housing/disc, leave only the needle — with a
  // drop-shadow so the red tip still reads over any basemap.
  const Compass = (bare = false) => (
    <button
      class={bare ? "" : "btn panel"}
      title="Compass — click to face north"
      onClick={resetNorth}
      style={{
        width: "38px", height: "38px", padding: "0", "border-radius": "50%",
        display: "flex", "align-items": "center", "justify-content": "center",
        "flex-shrink": 0, perspective: "90px",
        ...(bare ? { background: "transparent", border: "none", cursor: "pointer" } : {}),
      }}
    >
      <svg
        width="26" height="26" viewBox="0 0 24 24"
        style={{
          transform: `rotateX(${mapPitch()}deg) rotateZ(${-mapBearing()}deg)`,
          "transform-origin": "center",
          ...(bare ? { filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))" } : {}),
        }}
      >
        {/* tilted disc: filled so the ellipse reads as a 3D face, with a rim (housing only) */}
        {!bare && <circle cx="12" cy="12" r="11" fill="color-mix(in srgb, var(--bg-panel-solid) 80%, transparent)" stroke="var(--border)" stroke-width="1" />}
        {/* north half (red, tip up) + south half (dim) */}
        <polygon points="12,2 8.5,12 15.5,12" fill="#ef4444" />
        <polygon points="12,22 8.5,12 15.5,12" fill="var(--text-dim)" />
        <circle cx="12" cy="12" r="1.5" fill="var(--text)" />
      </svg>
    </button>
  );

  // (Label edit mode now lives ONLY inside Settings › Labels (a button with the `l` hotkey);
  // the old outside 🏷 rail toggle was removed.)

  // The unified, tabbed settings drawer (Base · Layers · View · Labels · Perf) — the ☰ entry.
  const SettingsBar = () => (
    <SettingsMenu
      roomTitle={props.roomTitle} roomCode={props.sessionId} onRenameRoom={props.onRenameRoom}
      basemap={basemap} onBasemap={setBasemap} hasToken={!!MAP_TILER}
      grayscale={grayscale} onGrayscale={setGrayscale}
      lightness={lightness} onLightness={setLightness}
      sun={sunOn} onSun={setSunOn}
      sunShade={sunShade} onSunShade={setSunShade}
      sunShadeColor={sunShadeCol} onSunShadeColor={setSunShadeCol}
      castShadows={castShadows} onCastShadows={setCastShadows}
      terrain={terrainOn} onTerrain={setTerrainOn}
      shadows={shadows} onShadows={setShadows}
      dropLine={dropLine} onDropLine={setDropLine}
      trailFull={trailFull} onTrailFull={setTrailFull}
      trailPct={trailPct} onTrailPct={setTrailPct}
      trailBudget={trailBudget} onTrailBudget={setTrailBudget}
      gpuTrails={gpuTrails} onGpuTrails={setGpuTrails}
      labels={labelsOn} onLabels={setLabelsOn}
      declutterLabels={declutterLabels} onDeclutterLabels={setDeclutterLabels}
      declutterAnchor={declutterAnchor} onDeclutterAnchor={setDeclutterAnchor}
      declutterMomentum={declutterMomentum} onDeclutterMomentum={setDeclutterMomentum}
      // map labels (annotations) — the whole Labels tab (client-side; JSON share)
      mapLabels={mapLabelsOn} onMapLabels={setMapLabelsOn}
      labelEdit={labelEditMode} onLabelEdit={setLabelEditMode}
      roomLabels={() => labels} onDeleteLabel={deleteLabelById}
      onExportLabels={exportLabels} onCopyLabelsJSON={copyLabelsJSON} onImportLabels={importLabels}
      // View tab — controls moved off the bottom-right panel
      soloVisible={soloVisible} onSoloVisible={setSoloVisible}
      seekMode={seekMode} onSeekMode={setSeekMode}
      showIntervals={showIntervals} onShowIntervals={setShowIntervals}
      showFlags={showFlags} onShowFlags={setShowFlags}
      showGraph={showGraph} onShowGraph={setShowGraph}
      trackThermals={trackThermals} onTrackThermals={() => toggleThermals()}
      glideStarts={showGlideStarts} onGlideStarts={setShowGlideStarts}
      highFps={highFps} onHighFps={setHighFps}
      fps={fps}
      onHelp={() => setShowHelp(true)}
      isMobile={isMobile}
    />
  );

  return (
    <div class="relative h-full w-full">
      {/* explicit fill — don't rely on utility classes for the GL canvas size */}
      <div ref={container} style={{ position: "absolute", top: "0", left: "0", right: "0", bottom: "0" }} />

      <Show when={!ready()}>
        <LoadScreen
          activeStage={() => MAP_STAGE_BASE + loadStep()}
          fraction={() => overallFraction(MAP_STAGE_BASE + loadStep(), 0)}
          error={loadError} note={mapNote} onReload={() => location.reload()}
        />
      </Show>

      {/* ── debug / benchmark HUD (`f`) — shows even in world-only mode ── */}
      <Show when={showDebug()}>
        <DebugHud fps={fps} dbg={dbg} highFps={highFps} trailFull={trailFull} />
      </Show>

      {/* Tab hides every panel/control and leaves only the map ("just the world") */}
      <Show when={!hideUI()}>
      {/* ── DESKTOP: brand rail top-left, settings top-right; gaggle dock on the left ── */}
      <Show when={!isMobile()}>
        <div class="absolute top-3 left-3 flex items-center gap-2 z-10 flex-wrap">
          {BrandButtons()}
          {RoomTitle()}
        </div>
        <div class="absolute top-3 right-3 z-10 flex items-center gap-2">
          {Compass()}
          {SettingsBar()}
        </div>
      </Show>

      {/* gaggle counter: collapsible colour strip on the left edge (mobile + desktop) */}
      <GaggleDock
        isMobile={isMobile} showGaggles={showGaggles} setShowGaggles={setShowGaggles}
        groups={groups} stats={stats} airborneCount={airborneCount}
        followGaggle={followGaggle} followMode={followMode} focusGaggle={focusGaggle}
        isHidden={isHidden} toggleHidden={toggleHidden} setHoverKey={setHoverKey}
        showAllTrails={showAllTrails} hideAllTrails={hideAllTrails} invertTrails={invertTrails}
        applyNameFilter={applyNameFilter}
        showAltVario={showAltVario} setShowAltVario={setShowAltVario}
        onSelectPilot={setSelectedKey} selectedKey={selectedKey}
        onRemove={removePilot}
        editKey={editKey} editDraft={editDraft} setEditDraft={setEditDraft}
        beginRename={beginRename} commitRename={commitRename} cancelRename={cancelRename}
      />

      {/* ── MOBILE: a compact top action bar (no hamburger) + a gaggle quick-follow row ── */}
      <Show when={isMobile()}>
        {/* action bar — brand · QR · ＋ · compass · ⚙ Settings (opens its own centered modal).
            Deliberately shorter than the desktop rails: no room title (it's in ⚙ Settings ›
            Room name + the QR) and no 🏷 label toggle (⚙ Settings › Labels, or the `l`
            hotkey) — with those two the row overflowed and scrolled on a phone. */}
        <div class="absolute top-3 left-3 right-3 z-30 flex items-center gap-2 overflow-x-auto"
             style={{ "scrollbar-width": "none" }}>
          <BrandBar compact onAddFlight={props.onAddFlight} hasOwnFlight={props.hasOwnFlight} />
          {Compass()}
          {SettingsBar()}
        </div>

        {/* gaggle quick-follow chips — own row below the bar. Tap → fly to that gaggle. */}
        <Show when={groups().gaggles.length > 0}>
          <div class="absolute top-16 left-3 right-3 z-30 flex gap-1.5 overflow-x-auto"
               style={{ "scrollbar-width": "none" }}>
            <For each={groups().gaggles}>
              {(g, i) => (
                <button
                  class="btn panel px-2 py-1.5 flex items-center gap-1.5 shrink-0"
                  classList={{ "btn-accent": followGaggle() === g.id && followMode() === "gaggle" }}
                  onClick={() => focusGaggle(g.id)}
                  title={`Follow Gaggle ${i() + 1} (${g.members.length} pilots)`}
                >
                  <span class="flex items-center" style={{ "margin-right": "1px" }}>
                    <For each={g.members.slice(0, 5)}>
                      {(m, j) => (
                        <span style={{
                          width: "9px", height: "9px", "border-radius": "50%",
                          background: m.color, border: "1px solid rgba(0,0,0,0.5)",
                          "margin-left": j() === 0 ? "0" : "-3px",
                        }} />
                      )}
                    </For>
                  </span>
                  <span class="text-xs font-bold leading-none">G{i() + 1}</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </Show>

      {/* ── controls: collapsible window, sits ABOVE the seek bar, bottom-right ── */}
      {/* On mobile the thermal panel is a bottom sheet at the same anchor, so lift the
          controls above it (17rem sheet + gap); desktop puts the panel top-right, no lift. */}
      <div class="absolute z-10 flex flex-col gap-2"
           classList={{ "right-3 items-end": !isMobile(), "left-3 right-3 items-stretch": isMobile() }}
           style={{
             bottom:
               isMobile() && trackThermals() && showThermalPanel()
                 ? `calc(${showGraph() ? "13.5rem" : "4.5rem"} + 17.5rem)`
                 : showGraph() ? "13.5rem" : "4.5rem",
           }}>
        {/* collapsed → nothing here; the 🎛 toggle on the seek bar (and `c`) reopens it */}
        <Show when={showControls()}>
          {/* no title bar — the 🎛 button on the seek bar (and `c`) hides/shows this */}
          <div class="panel px-3 py-2 flex flex-col gap-2 scroll-y"
               style={{ "min-width": isMobile() ? "0" : "18rem", "max-height": isMobile() ? "48vh" : "none" }}>
            {/* transport */}
            <div class="flex items-center gap-2">
              <button class="btn btn-accent" onClick={togglePlay} title="Play / pause (space)">
                {playing() ? "⏸" : "▶"}
              </button>
              <button class="btn" onClick={() => seekBy(-SEEK_SMALL)} title="Back 30s (j)">⟲</button>
              <button class="btn" onClick={() => seekBy(SEEK_SMALL)} title="Forward 30s (k)">⟳</button>
              <div class="w-px h-6 mx-0.5" style={{ background: "var(--border)" }} />
              <button class="btn" onClick={() => bumpSpeed(-1)} title="Slower (a)">−</button>
              <span class="text-sm tabular-nums w-12 text-center" title="Playback speed">{speed()}×</span>
              <button class="btn" onClick={() => bumpSpeed(1)} title="Faster (q)">＋</button>
            </div>

            {/* camera: a single looping mode button + follow-all. (Alt graph, thermals,
                solo/seek, intervals/flags moved to Settings › View.) */}
            <div class="flex items-center gap-1.5">
              <button
                class="btn text-xs flex-1 text-left"
                classList={{ "btn-accent": followMode() !== "free" }}
                onClick={cycleCamMode}
                title="Camera mode — click to cycle: all → pilot → gaggle → free (h/g cycles gaggles)"
              >
                ⟳ cam: <span class="font-bold">{camLabel(followMode())}</span><Hotkey k="c" />
              </button>
              <button class="btn text-xs" classList={{ "btn-accent": followMode() === "all" }}
                onClick={enterAllFollow}
                title="Follow all — fit + track every pilot visible on screen">⛶ all</button>
            </div>

            <Show when={followMode() === "single"}>
              <select
                class="btn text-xs w-full" value={followKey() ?? ""}
                onChange={(e) => setFollowKey(e.currentTarget.value)}
                style={{ "background-color": "var(--bg-panel-solid)" }}
              >
                <For each={props.flights()}>{(f) => <option value={keyOf(f)}>{f.name}</option>}</For>
              </select>
            </Show>
          </div>
        </Show>
      </div>

      {/* ── altitude graph (own strip, above the seek bar) ── */}
      <Show when={showGraph()}>
        <div class="absolute left-3 right-3 z-10" style={{ bottom: "4.5rem" }}>
          <AltitudeGraph
            flights={props.flights}
            playhead={playhead}
            dayStart={dayStart}
            dayEnd={dayEnd}
            onSeek={(t) => setPlayhead(t)}
            onClose={() => setShowGraph(false)}
            // click a pilot's barogram line → select them (like clicking on the map / dock)
            onSelectPilot={setSelectedKey}
            // …and focus the clicked climb/glide row. setSelectedKey clears selSeg via the
            // effect above, so set the picked seg AFTER that runs (setTimeout drains it first),
            // then redraw so the map highlight appears while paused.
            onPickSegment={(key, seg) => {
              setSelectedKey(key);
              setTimeout(() => { setSelSeg(seg); if (!playing()) frameLayers(); }, 0);
            }}
            // same segment source the ThermalPanel table uses → the focused idx matches a row
            thermalsFor={(key) => { const f = props.flights().find((x) => keyOf(x) === key); return f ? thermalsFor(key, f.track) : []; }}
            glidesFor={(key) => { const f = props.flights().find((x) => keyOf(x) === key); return f ? glidesFor(key, f.track) : []; }}
          />
        </div>
      </Show>

      {/* ── per-tracklog thermal stats panel — top-right on desktop, bottom strip on
          mobile. Lists the followed pilot's detected climbs; ✕ / t hides it. ── */}
      <Show when={trackThermals() && showThermalPanel() && panelFlight()}>
        <div
          class="absolute z-10"
          style={{
            top: isMobile() ? "auto" : "3.5rem",
            bottom: isMobile() ? (showGraph() ? "13.5rem" : "4.5rem") : "auto",
            right: "0.75rem",
            left: isMobile() ? "0.75rem" : "auto",
            "max-width": isMobile() ? "none" : "23rem",
          }}
        >
          <ThermalPanel
            name={panelFlight()!.name}
            color={panelFlight()!.color}
            thermals={panelThermals}
            glides={panelGlides}
            t0={() => todOfLaunch(panelFlight()!)}
            playhead={playhead}
            onSeek={(t) => { setPlayhead(t); if (!playing()) frameLayers(); }}
            selectedSeg={selSeg}
            onSelectSeg={(kind, idx) => { setSelSeg({ kind, idx }); if (!playing()) frameLayers(); }}
            onClose={() => setShowThermalPanel(false)}
          />
        </div>
      </Show>

      {/* ── seek bar: its own strip, nothing else in it ── */}
      <div class="absolute bottom-0 left-0 right-0 z-10"
           classList={{ "p-3": !isMobile(), "p-2": isMobile() }}>
        <div class="panel flex items-center"
             classList={{ "px-4 py-2 gap-3": !isMobile(), "px-2 py-1.5 gap-2": isMobile() }}>
          {/* start/end clocks eat width on a phone — drop them there, keep the live clock */}
          <span class="text-xs tabular-nums" classList={{ hidden: isMobile() }} style={{ color: "var(--text-dim)" }}>{fmtClock(dayStart())}</span>

          {/* the track carries overlay markers (takeoffs + gaggle split/join/spawn) */}
          <div class="flex-1 relative">
            {/* whole-hour delimiters: faint full-height gridline + a subtle HH label at the top.
                Rendered first → sits behind the flight markers and the scrubber thumb. */}
            <For each={hourMarks()}>
              {(h) => (
                <div class="absolute pointer-events-none" style={{ left: `${pct(h.sec)}%`, top: 0, bottom: 0, "z-index": 0 }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "1px", transform: "translateX(-50%)", background: "var(--text-dim)", opacity: "0.2" }} />
                  <div style={{ position: "absolute", top: 0, left: 0, transform: "translate(-50%,-1px)", "font-size": "8px", "line-height": 1, color: "var(--text-dim)", opacity: "0.55", "font-variant-numeric": "tabular-nums" }}>{h.label}</div>
                </div>
              )}
            </For>
            {/* interval graph (≡): thin colored bar per flight, take-off → landing */}
            <Show when={showIntervals()}>
              <div class="absolute left-0 right-0" style={{ bottom: "100%", height: "0" }}>
                <For each={intervals()}>
                  {(f) => (
                    <div
                      class="rounded-full"
                      title={`${f.name} · ${fmtHM(f.t0)}–${fmtHM(f.t1)}`}
                      onClick={() => setPlayhead(f.t0)}
                      style={{
                        position: "absolute",
                        left: `${pct(f.t0)}%`,
                        width: `${Math.max(0.4, pct(f.t1) - pct(f.t0))}%`,
                        bottom: `${f.row * 5}px`,
                        height: "3px",
                        background: f.color,
                        opacity: "0.9",
                        cursor: "pointer",
                        "pointer-events": "auto",
                      }}
                    />
                  )}
                </For>
              </div>
            </Show>

            {/* take-off + landing flag labels (🚩 toggle) */}
            <Show when={showFlags()}>
              <For each={takeoffs()}>
                {(to) => (
                  <>
                    <FlagLabel name={to.name} color={to.color} t={to.t0} kind="takeoff" />
                    <FlagLabel name={to.name} color={to.color} t={to.t1} kind="landing" />
                  </>
                )}
              </For>
            </Show>

            {/* takeoff circles + landing diamonds sitting on the track */}
            <For each={takeoffs()}>
              {(to) => (
                <>
                  <div
                    class="absolute pointer-events-none rounded-full"
                    title={`${to.name} · takeoff ${fmtHM(to.t0)}`}
                    style={{
                      left: `${pct(to.t0)}%`, top: "50%",
                      transform: "translate(-50%,-50%)",
                      width: "8px", height: "8px",
                      background: to.color, border: "1px solid rgba(0,0,0,0.55)",
                    }}
                  />
                  <div
                    class="absolute pointer-events-none"
                    title={`${to.name} · landed ${fmtHM(to.t1)}`}
                    style={{
                      left: `${pct(to.t1)}%`, top: "50%",
                      transform: "translate(-50%,-50%) rotate(45deg)",
                      width: "7px", height: "7px",
                      background: to.color, border: "1px solid rgba(0,0,0,0.55)",
                    }}
                  />
                </>
              )}
            </For>

            <input
              type="range" min={dayStart()} max={dayEnd()} step={1} value={playhead()}
              class="seek w-full accent-[var(--accent)]"
              style={{ position: "relative", "z-index": 1, background: "transparent" }}
              title="Time of day — drag to scrub (j/k, PgUp/PgDn)"
              onInput={(e) => setPlayhead(+e.currentTarget.value)}
            />
          </div>

          <span class="text-xs tabular-nums" classList={{ hidden: isMobile() }} style={{ color: "var(--text-dim)" }}>{fmtClock(dayEnd())}</span>
          <span class="text-sm tabular-nums font-bold" style={{ color: "var(--accent)" }} title="Current time of day (UTC)">
            {fmtClock(playhead())}
          </span>
          {/* the ▤ interval + 🚩 flag toggles now live inside the controls panel (below) */}
          {/* controls panel toggle — the one button that hides/shows the controls */}
          <button
            class="btn text-sm px-2 py-1"
            classList={{ "btn-accent": showControls() }}
            onClick={() => setShowControls((v) => !v)}
            title="Show / hide the controls panel (c)"
          >
            🎛
          </button>
          {/* always-visible play/pause — the one in the controls panel is a click away
              behind 🎛, and playback is the thing you reach for most. Rightmost so it
              sits under the thumb on a phone. */}
          <button
            class="btn btn-accent text-sm px-2 py-1"
            onClick={togglePlay}
            title="Play / pause (space)"
          >
            {playing() ? "⏸" : "▶"}
          </button>
        </div>
      </div>

      {/* ── keyboard help ── */}
      <Show when={showHelp()}>
        <HelpModal onClose={() => setShowHelp(false)} />
      </Show>
      </Show>

      {/* ── full-screen HUD (Tab / world-only): keep just two readouts, backgrounds stripped —
          a bare compass needle top-right + the live clock bottom-right, both with a text/drop
          shadow so they read on light AND dark basemaps. ── */}
      <Show when={hideUI()}>
        <div class="absolute top-3 right-3 z-10">
          {Compass(true)}
        </div>
        <div
          class="absolute bottom-3 right-4 z-10 text-sm tabular-nums font-bold pointer-events-none"
          style={{ color: "var(--accent)", "text-shadow": "0 0 3px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.7)" }}
          title="Current time of day (UTC)"
        >
          {fmtClock(playhead())}
        </div>
        {/* the ONLY timeline affordance in world-only mode: a hairline progress bar welded to
            the bottom edge, plus a 20px-tall invisible hit strip over it that click/drag-scrubs
            (x across the viewport → time in [dayStart,dayEnd]). The strip is the only thing that
            eats pointer events — the rest of the map keeps its normal drag/zoom/orbit — and it
            only exists while hideUI(), so the regular seek bar is never shadowed. */}
        <div
          class="absolute bottom-0 left-0 right-0 z-20"
          style={{ height: "20px", cursor: "ew-resize", "touch-action": "none" }}
          title="Drag to scrub"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            scrubEdge(e.currentTarget, e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubEdge(e.currentTarget, e.clientX);
          }}
        >
          <div
            class="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{ height: "3px", background: "rgba(0,0,0,0.35)", "box-shadow": "0 0 3px rgba(0,0,0,0.5)" }}
          >
            <div
              class="absolute top-0 bottom-0 left-0"
              style={{ width: `${pct(playhead())}%`, background: "var(--accent)", opacity: "0.9" }}
            />
          </div>
        </div>
      </Show>

      {/* ── label edit context menu — shown at the cursor in label edit mode: "add a label
          here" on an empty-map click, or rename/delete when an existing label was clicked.
          Editing while viewing an external collection copies it here first (copy-on-write). ── */}
      <Show when={labelMenu()}>
        {(m) => (
          <div
            class="panel absolute z-40 p-2 flex flex-col gap-2"
            style={{
              left: `${Math.max(6, Math.min(m().x, (container?.clientWidth ?? 9999) - 216))}px`,
              top: `${Math.max(6, Math.min(m().y, (container?.clientHeight ?? 9999) - 150))}px`,
              "min-width": "204px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold" style={{ color: "var(--accent)" }}>
                {m().label ? "✎ Edit label" : "📍 Add label here"}
              </span>
              <button class="btn text-xs" onClick={() => setLabelMenu(null)} title="Close">✕</button>
            </div>
            <input
              type="text" class="w-full text-sm" placeholder="label name"
              value={labelDraft()}
              onInput={(e) => setLabelDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); m().label ? confirmRenameLabel() : confirmAddLabel(); }
                else if (e.key === "Escape") { e.preventDefault(); setLabelMenu(null); }
              }}
              ref={(el) => setTimeout(() => el.focus(), 0)}
            />
            <div class="flex items-center gap-1.5">
              <Show
                when={m().label}
                fallback={<button class="btn btn-accent text-xs flex-1" onClick={confirmAddLabel}>Add label</button>}
              >
                <button class="btn btn-accent text-xs flex-1" onClick={confirmRenameLabel}>Rename</button>
                <button class="btn text-xs" onClick={confirmDeleteLabel} title="Delete this label">🗑</button>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
