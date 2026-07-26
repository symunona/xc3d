// Client-side hypsometric (elevation-tinted) relief basemap with contour lines.
//
// Registers a MapLibre custom protocol `hyps://{z}/{x}/{y}` that:
//   1. fetches the free, token-free AWS/Mapzen Terrarium DEM tile for z/x/y,
//   2. decodes elevation per pixel,
//   3. paints a hypsometric color ramp + NW hillshade + contour lines,
//   4. returns the result as a PNG ArrayBuffer.
//
// No server, no API key, no external deps — everything is drawn in a canvas.

import maplibregl from "maplibre-gl";

// Free open Terrarium DEM (256×256, maxzoom ~15).
// Elevation decode (meters): elev = (R*256 + G + B/256) - 32768
const TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TILE = 256;

// ── hypsometric ramp ─────────────────────────────────────────────────────
// Classic physical-relief palette: bluish for sea / very low, greens for
// lowland, tan/brown for mid elevations, grey → white for the high peaks.
// Sorted ascending by elevation (meters). Colors linearly interpolated.
type Stop = { e: number; c: [number, number, number] };
const RAMP: Stop[] = [
  { e: -50, c: [90, 120, 150] }, // below/at sea — muted blue-grey
  { e: 0, c: [120, 150, 175] }, // shoreline
  { e: 1, c: [86, 140, 92] }, // lush lowland green
  { e: 200, c: [120, 165, 100] },
  { e: 500, c: [170, 190, 120] }, // yellow-green
  { e: 900, c: [206, 190, 140] }, // tan
  { e: 1500, c: [190, 160, 118] }, // brown
  { e: 2200, c: [160, 128, 100] }, // darker brown
  { e: 3000, c: [150, 140, 138] }, // rocky grey
  { e: 4000, c: [200, 200, 205] }, // light grey
  { e: 5500, c: [245, 245, 248] }, // snow / white
];

function rampColor(e: number): [number, number, number] {
  if (e <= RAMP[0].e) return RAMP[0].c;
  const last = RAMP[RAMP.length - 1];
  if (e >= last.e) return last.c;
  for (let i = 1; i < RAMP.length; i++) {
    const b = RAMP[i];
    if (e <= b.e) {
      const a = RAMP[i - 1];
      const t = (e - a.e) / (b.e - a.e);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * t,
        a.c[1] + (b.c[1] - a.c[1]) * t,
        a.c[2] + (b.c[2] - a.c[2]) * t,
      ];
    }
  }
  return last.c;
}

// Contour interval by zoom: coarse when zoomed out, fine when zoomed in.
function contourInterval(z: number): number {
  if (z >= 13) return 25;
  if (z >= 11) return 50;
  if (z >= 9) return 100;
  return 200;
}

// A canvas that works whether or not OffscreenCanvas exists.
function makeCanvas(w: number, h: number): { canvas: any; ctx: any } {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    return { canvas, ctx: canvas.getContext("2d")! };
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

// Canvas → PNG ArrayBuffer, for either canvas flavour.
async function canvasToPng(canvas: any): Promise<ArrayBuffer> {
  let blob: Blob;
  if (typeof canvas.convertToBlob === "function") {
    blob = await canvas.convertToBlob({ type: "image/png" });
  } else {
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b: Blob | null) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
    );
  }
  return await blob.arrayBuffer();
}

// A fully-transparent PNG tile, used for oceans / fetch failures so the map
// keeps working (the background layer shows through).
let EMPTY_TILE: Promise<ArrayBuffer> | null = null;
function emptyTile(): Promise<ArrayBuffer> {
  if (!EMPTY_TILE) {
    const { canvas } = makeCanvas(TILE, TILE);
    EMPTY_TILE = canvasToPng(canvas); // untouched canvas = transparent
  }
  return EMPTY_TILE;
}

// Render one hypsometric tile from a decoded DEM ImageData.
async function renderTile(dem: ImageData, z: number): Promise<ArrayBuffer> {
  const src = dem.data;
  const n = TILE * TILE;

  // Decode elevation for every pixel first (needed by hillshade + contours).
  const elev = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    elev[i] = src[j] * 256 + src[j + 1] + src[j + 2] / 256 - 32768;
  }

  const { canvas, ctx } = makeCanvas(TILE, TILE);
  const out = ctx.createImageData(TILE, TILE);
  const dst = out.data;

  const interval = contourInterval(z);

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = y * TILE + x;
      const e = elev[i];

      // Base hypsometric color.
      let [r, g, b] = rampColor(e);

      // ── simple hillshade ──────────────────────────────────────────────
      // Slope from neighbor elevations; light from the NW. Clamp neighbors
      // at the tile edge (no cross-tile lookups — good enough visually).
      const xl = x > 0 ? i - 1 : i;
      const xr = x < TILE - 1 ? i + 1 : i;
      const yu = y > 0 ? i - TILE : i;
      const yd = y < TILE - 1 ? i + TILE : i;
      const dzdx = (elev[xr] - elev[xl]) * 0.5;
      const dzdy = (elev[yd] - elev[yu]) * 0.5;
      // NW light: positive when the slope faces up-left. Scaled down so it
      // shades rather than blows out; 1.0 = flat.
      const shade = Math.max(0.55, Math.min(1.25, 1 + (dzdx - dzdy) * 0.06));
      r *= shade;
      g *= shade;
      b *= shade;

      // ── contour lines ─────────────────────────────────────────────────
      // Draw a thin brown line where elevation crosses a contour multiple.
      // Detect a crossing by comparing this pixel's band to the E/S neighbor.
      const band = Math.floor(e / interval);
      const crossesE = Math.floor(elev[xr] / interval) !== band;
      const crossesS = Math.floor(elev[yd] / interval) !== band;
      if (e > 0 && (crossesE || crossesS)) {
        // darken toward a muted brown contour ink
        r = r * 0.55 + 90 * 0.45;
        g = g * 0.55 + 60 * 0.45;
        b = b * 0.55 + 40 * 0.45;
      }

      const j = i * 4;
      dst[j] = Math.max(0, Math.min(255, r));
      dst[j + 1] = Math.max(0, Math.min(255, g));
      dst[j + 2] = Math.max(0, Math.min(255, b));
      dst[j + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
  return await canvasToPng(canvas);
}

// The protocol loader (MapLibre v4 signature).
async function loader(
  params: { url: string },
  abortController: AbortController,
): Promise<{ data: ArrayBuffer }> {
  // url form: hyps://{z}/{x}/{y}
  const m = params.url.match(/hyps:\/\/(\d+)\/(\d+)\/(\d+)/);
  if (!m) return { data: await emptyTile() };
  const z = +m[1],
    x = +m[2],
    y = +m[3];

  const url = TERRARIUM_URL.replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));

  try {
    const resp = await fetch(url, { signal: abortController.signal });
    // 404/204 over oceans or missing tiles → transparent tile.
    if (!resp.ok) return { data: await emptyTile() };
    const bmp = await createImageBitmap(await resp.blob());

    // Draw DEM into a scratch canvas and read it back.
    const { ctx } = makeCanvas(TILE, TILE);
    ctx.drawImage(bmp, 0, 0, TILE, TILE);
    if (typeof bmp.close === "function") bmp.close();
    const dem = ctx.getImageData(0, 0, TILE, TILE);

    return { data: await renderTile(dem, z) };
  } catch (err) {
    // Aborted tiles or any failure: never throw — hand back an empty tile so
    // the map keeps rendering.
    return { data: await emptyTile() };
  }
}

// Idempotent registration.
let registered = false;
export function registerHeightmapProtocol(): void {
  if (registered) return;
  registered = true;
  maplibregl.addProtocol("hyps", loader as any);
}
