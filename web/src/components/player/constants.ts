// Static config for the Player: camera presets, seek/speed steps, map + thermal knobs.

// camera angle presets, bound to number keys
// bearing convention here: 0 = looking north (viewer to the SOUTH), 90 = viewer to the
// WEST, 180 = viewer to the NORTH, 270 = viewer to the EAST — hence the "from X" labels.
export const ANGLES: Record<string, { label: string; pitch: number; bearing: number; hint: string }> = {
  "1": { label: "top", pitch: 0, bearing: 0, hint: "Top-down (map view)" },
  "2": { label: "S 45°", pitch: 45, bearing: 0, hint: "From the south, 45° tilt" },
  "3": { label: "W 45°", pitch: 45, bearing: 90, hint: "From the west, 45° tilt" },
  "4": { label: "N 60°", pitch: 60, bearing: 180, hint: "From the north, 60° tilt" },
  "5": { label: "E 45°", pitch: 45, bearing: 270, hint: "From the east, 45° tilt" },
  "6": { label: "S 60°", pitch: 60, bearing: 0, hint: "From the south, 60° tilt (steeper)" },
  "7": { label: "prof", pitch: 80, bearing: 90, hint: "Low side-on 'profile' view (from the west)" },
};

export const SEEK_SMALL = 30;   // j / k
export const SEEK_BIG = 300;    // PageUp / PageDown

export const TRAIL_STEP = 5;    // [ / ] step the trail-length % (matches the slider's range)

// Default vertices per trail (the Perf "trail detail" slider seeds from this). GPU trails
// (TripsLayer) upload once and reveal by a uniform, so high counts are ~free — hence a
// generous default. It's also the stride-decimation cap for the CPU PathLayer fallback,
// where higher = costlier per frame; drop the slider there if the fallback stutters.
export const MAX_TRAIL_PTS = 10000;

// doubling up to 32, then linear steps of 32 up to 256 (fine control at high speed)
export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256];

export const MAP_TILER = import.meta.env.VITE_MAP_TILER_ACCESS_TOKEN as string | undefined;

// World COPC point cloud of paraglider climbs (thermal.tmpx.space). CORS-open, byte-range.
export const THERMALS_MANIFEST =
  (import.meta.env.VITE_THERMALS_MANIFEST as string) || "https://copc.tmpx.space/world/manifest.json";
// (follow-day season ± days and time-of-day ± minutes are now user sliders — see thermalPrefs)

// Gaggles = pilots flying together. Single-linkage over this radius, so it must sit
// BELOW the gap between two separate flying groups or their chains merge into one blob.
// A real gaggle is pilots on the same thermal or gliding to the next; Alpine thermal
// spacing is ~2-4 km, so 3 km keeps a genuine climbing group linked while splitting
// distinct groups apart. (Was 10 km — too coarse, it collapsed everyone into one gaggle.)
export const GAGGLE_THRESHOLD_M = 3000;

// keyboard cheat-sheet shown in the help modal (the handlers live in the keyboard code)
export const KEYS: Array<[string, string]> = [
  ["space", "play / pause"],
  ["j / k", "seek ∓30s"],
  ["PgUp / PgDn", "seek ∓5min"],
  ["q / a", "speed up / down"],
  ["h / g", "next / prev — pilot or gaggle (by cam mode)"],
  ["c", "cycle camera mode (all · pilot · gaggle · free)"],
  ["w", "show pilots whose current dot is off screen"],
  ["1 – 7", "camera angles (top · S/W/N/E oblique · profile)"],
  [", / .", "orbit camera left / right (gang: mouse orbit off)"],
  ["[ / ]", "trail shorter / longer"],
  ["m", "grayscale basemap on / off"],
  ["b", "altitude graph"],
  ["p", "controls panel"],
  ["s", "hide pilots whose current dot is off screen"],
  ["x", "seek mode (click track to jump)"],
  ["f", "fps / render details"],
  ["l", "label edit mode"],
  ["Tab", "hide all UI (world only)"],
  ["?", "this help"],
];
