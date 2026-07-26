// View/perf settings (Base · Layers · Perf) persist globally across rooms + sessions,
// and each room remembers where the player last was (clock + camera).
import type { BasemapId } from "../../lib/basemaps";
import type { FollowMode } from "./types";
import { MAP_TILER, MAX_TRAIL_PTS } from "./constants";

export const VIEW_LS_KEY = "xc3d.view.v1";

export interface ViewPrefs {
  basemap: BasemapId;
  terrain: boolean;
  shadows: boolean;
  dropLine: boolean;
  trailFull: boolean;
  trailPct: number;
  trailBudget: number;
  gpuTrails: boolean;
  labels: boolean;
  trackThermals: boolean; // per-tracklog thermal detection (markers + panel)
  glideStarts: boolean; // glide-analysis: a marker + start-altitude label at each glide's onset
  altVario: boolean; // second line (altitude + climb rate) under each on-map name bubble
  declutterLabels: boolean; // de-overlap the on-map pilot name tags in a gaggle + draw leader lines back to each dot
  declutterAnchor: boolean; // declutter MODE: true = anchor-above + arrange-around-dot (2 sides / 3 +up / 4 +down); false = the old push-apart spread solver
  declutterMomentum: boolean; // ease tag motion + hold a collision's chosen alignment for a few seconds (no fast blinking)
  grayscale: number; // 0–100 % desaturation of the BASEMAP only (tracks stay coloured)
  lightness: number; // CSS brightness() of the BASEMAP only: 0.3 (dark) … 1.0 (normal) … 1.7 (light)
  mapLabels: boolean; // show the terrain-fixed map LABELS layer (annotations), default on
  sun: boolean; // sun-angle terrain shading (hillshade driven by the replay clock), default off
  sunShade: number; // 0–100 % opacity of that shading (alpha of hillshade-shadow-color)
  sunShadeColor: string; // hex tint of the shaded side (RGB of hillshade-shadow-color); alpha is sunShade. Default black.
  castShadows: boolean; // sun v2: REAL cast shadows (DEM ray-march occlusion), additive, default off
}

export function viewDefaults(): ViewPrefs {
  return {
    basemap: "topo",
    terrain: !!MAP_TILER,
    shadows: false,
    dropLine: true,
    trailFull: true,
    trailPct: 35,
    trailBudget: MAX_TRAIL_PTS,
    gpuTrails: true,
    labels: true,
    trackThermals: false,
    glideStarts: false,
    altVario: false,
    declutterLabels: false,
    declutterAnchor: true,
    declutterMomentum: true,
    grayscale: 0,
    lightness: 1.0,
    mapLabels: true,
    sun: true,
    sunShade: 50,
    sunShadeColor: "#000000",
    castShadows: true,
  };
}

export function loadViewPrefs(): ViewPrefs {
  const d = viewDefaults();
  try {
    const p = JSON.parse(localStorage.getItem(VIEW_LS_KEY) || "{}");
    return {
      basemap: typeof p.basemap === "string" ? p.basemap : d.basemap,
      terrain: typeof p.terrain === "boolean" ? p.terrain : d.terrain,
      shadows: !!p.shadows,               // default off
      dropLine: p.dropLine !== false,     // default on
      trailFull: p.trailFull !== false,   // default on
      trailPct: Number.isFinite(p.trailPct) ? p.trailPct : d.trailPct,
      trailBudget: Number.isFinite(p.trailBudget) ? p.trailBudget : d.trailBudget,
      gpuTrails: p.gpuTrails !== false,   // default on
      labels: p.labels !== false,         // default on
      trackThermals: !!p.trackThermals,   // default off
      glideStarts: !!p.glideStarts,       // default off
      altVario: !!p.altVario,             // default off
      declutterLabels: !!p.declutterLabels, // default off (keeps today's stacked-tag behaviour)
      declutterAnchor: p.declutterAnchor !== false,   // default on (new anchor+arrange mode)
      declutterMomentum: p.declutterMomentum !== false, // default on
      grayscale: Number.isFinite(p.grayscale) ? Math.max(0, Math.min(100, p.grayscale)) : d.grayscale,
      lightness: Number.isFinite(p.lightness) ? Math.max(0.3, Math.min(1.7, p.lightness)) : d.lightness,
      mapLabels: p.mapLabels !== false, // default on
      sun: p.sun !== false,             // default on
      sunShade: Number.isFinite(p.sunShade) ? Math.max(0, Math.min(100, p.sunShade)) : d.sunShade,
      // #rrggbb only — anything else (bad/missing) falls back to black
      sunShadeColor: typeof p.sunShadeColor === "string" && /^#[0-9a-fA-F]{6}$/.test(p.sunShadeColor) ? p.sunShadeColor : d.sunShadeColor,
      castShadows: p.castShadows !== false,  // default on
    };
  } catch {
    return d;
  }
}

// ── panel / modal open-closed state — persists globally so a refresh (or the next room)
// restores the exact same chrome: which panels and overlays are open. Booleans only;
// stored separately from ViewPrefs so the two migrate independently. ──
export const PANEL_LS_KEY = "xc3d.panels.v1";

export interface PanelPrefs {
  controls: boolean; // the playback control bar
  gaggles: boolean; // gaggle dock (left colour strip)
  graph: boolean; // altitude graph
  thermalPanel: boolean; // per-flight thermal stats table
  flags: boolean; // takeoff/landing flags on the timeline
  intervals: boolean; // flight time-span Gantt
  hideUI: boolean; // Tab → world only, no chrome
  debug: boolean; // f → benchmark HUD
  help: boolean; // ? → help modal
}

export function panelDefaults(): PanelPrefs {
  return {
    // controls + gaggles default CLOSED on a fresh load — the map/world leads, and both
    // reopen from an always-visible affordance (the 🎛 toggle on the seek bar / `c`, and
    // the left-edge 🪂 folder-ear tab). Once the user opens either, that choice persists.
    controls: false, gaggles: false, graph: false, thermalPanel: true,
    flags: false, intervals: false, hideUI: false, debug: false, help: false,
  };
}

export function loadPanelPrefs(): PanelPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PANEL_LS_KEY) || "{}");
    return {
      // default CLOSED (=== true, not !== false): a first-time visitor with nothing stored
      // gets an uncluttered world; a returning visitor's saved open/closed state still wins.
      controls: p.controls === true, // default off (reopen: 🎛 on the seek bar / `c`)
      gaggles: p.gaggles === true, // default off (reopen: left-edge 🪂 folder-ear tab)
      graph: !!p.graph, // default off
      thermalPanel: p.thermalPanel !== false, // default on
      flags: !!p.flags, // default off
      intervals: !!p.intervals, // default off
      hideUI: !!p.hideUI, // default off
      debug: !!p.debug, // default off
      help: !!p.help, // default off
    };
  } catch {
    return panelDefaults();
  }
}

export function savePanelPrefs(p: PanelPrefs): void {
  try { localStorage.setItem(PANEL_LS_KEY, JSON.stringify(p)); } catch { /* private mode / quota */ }
}

// ── per-room player position: resume where you left off in a given room ──
export interface RoomPos {
  playhead: number;
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  followMode: FollowMode;
  followKey: string | null;
  selectedKey?: string | null; // the pilot whose stats/thermals are selected (room-specific)
}

const POS_PREFIX = "xc3d.pos.";

export function loadRoomPos(sid: string): RoomPos | null {
  try {
    const raw = localStorage.getItem(POS_PREFIX + sid);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!Number.isFinite(p?.playhead) || !Array.isArray(p?.center)) return null;
    return p as RoomPos;
  } catch {
    return null;
  }
}

export function saveRoomPos(sid: string, pos: RoomPos): void {
  try { localStorage.setItem(POS_PREFIX + sid, JSON.stringify(pos)); } catch { /* private mode / quota */ }
}
