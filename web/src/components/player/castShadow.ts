// Cast shadows (sun v2) — REAL terrain occlusion, additive over the sun hillshade.
//
// The hillshade (sun.ts / SUN_LAYER) shades each slope by its own normal — dot(normal,
// light). That answers "is this face turned toward the sun", but a peak does NOT throw a
// shadow across the valley behind it. This module does: it assembles a viewport-wide
// heightmap from the DEM and marches a ray from every pixel toward the sun; if any terrain
// along that ray rises above the ray's climbing height, the pixel is occluded → painted
// dark. Long shadows at a low sun, shrinking toward midday — the whole point.
//
// Why a viewport-wide heightmap (not per-tile like heightmap.ts): a cast shadow crosses
// tile borders — a peak in one tile darkens the valley two tiles away — so a tile-local
// pass would clip every shadow at the tile edge. We stitch the covering tiles into one
// grid, march across the whole thing, then drape the result back as ONE image overlay.
//
// CPU, on-demand: triggered by enable / map moveend / sun-minute change, but TRAILING-EDGE
// DEBOUNCED (see schedule()) — a scrub or a playing replay ticks the sun-minute over and over,
// so we wait for the triggers to settle and recompute ONCE at the latest sun/viewport instead
// of churning per tick. The previous mask stays painted throughout (update-in-place swap, never
// detach mid-build) so there's no flicker. Token-free Terrarium DEM (same source as
// heightmap.ts), so it works without a MapTiler key.
//
// Stage 2 — the HOT march now runs on the GPU (marchGpu): an offscreen WebGL2 context uploads
// the stitched heightmap as an R32F texture and ray-marches per output texel in a fragment
// shader (a faithful port of the CPU march() below). The RGBA mask is read back and draped via
// the SAME ImageSource path — everything around the march (tile fetch, stitch, debounce/coalesce,
// drape-in-place) is unchanged. march() (CPU) stays as the fallback: WebGL2 unavailable, a
// float-texture upload the driver rejects, or context loss all fall back to it, so the feature
// never goes dark. Force the fallback for a verify pass with `window.xc3dCastForceCpu=true`.

import maplibregl from "maplibre-gl";

const TILE = 256;
const TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const EARTH_CIRC = 40075016.686; // equatorial circumference, metres

const SRC = "cast-shadow-src";
const LAYER = "cast-shadow-layer";

// ── web-mercator tile math ──────────────────────────────────────────────
const lon2tile = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const lat2tile = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const tile2lon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const tile2lat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

interface SunPos { azimuthDeg: number; altitudeDeg: number; }

export class CastShadow {
  private map: maplibregl.Map;
  private tiles = new Map<string, Float32Array>(); // decoded elevations per z/x/y (256²)
  private enabled = false;
  private sun: SunPos = { azimuthDeg: 180, altitudeDeg: 45 };
  private strength = 0.5; // 0..1 darkness of a fully-occluded pixel
  private lastKey = ""; // guards against redundant recomputes (same view+sun)
  lastCoverage = 0; // fraction of the last heightmap that came out occluded (debug/verify hook)
  dbg: any = {};    // last-run diagnostics (verify hook)
  private busy = false;
  private pending = false;
  private canvas = document.createElement("canvas");
  // ── trailing-edge debounce (see schedule()) ──
  private debTimer: ReturnType<typeof setTimeout> | undefined;
  private burstAt = 0; // when the current un-serviced burst of triggers began
  private static DEBOUNCE_MS = 350;  // wait this long after the LAST trigger before recomputing
  private static MAX_WAIT_MS = 2000; // …but never starve longer than this under continuous change
  runs = 0; // cumulative recompute count (verify hook — see xc3dCast)
  // ── GPU march (stage 2) ── offscreen WebGL2, lazily initialised on first march
  private gl: WebGL2RenderingContext | null = null;
  private glCanvas = document.createElement("canvas");
  private glProg: WebGLProgram | null = null;
  private glTex: WebGLTexture | null = null;
  private glUniforms: Record<string, WebGLUniformLocation | null> = {};
  private gpuOk: boolean | undefined; // undefined = not yet tried; false = unsupported/lost → CPU

  constructor(map: maplibregl.Map) { this.map = map; }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      if (this.debTimer !== undefined) { clearTimeout(this.debTimer); this.debTimer = undefined; }
      this.detach(); this.lastKey = ""; return;
    }
    this.schedule();
  }
  setSun(sun: SunPos) { this.sun = sun; if (this.enabled) this.schedule(); }
  // force a full redo (e.g. a basemap swap wiped our layer): drop the dedupe key + recompute
  invalidate() { this.lastKey = ""; if (this.enabled) this.schedule(); }
  setStrength(s: number) { this.strength = Math.max(0, Math.min(1, s)); if (this.enabled) this.schedule(); }

  // remove our layer + source (a basemap swap wipes them; re-attach happens on next update)
  detach() {
    try {
      if (this.map.getLayer(LAYER)) this.map.removeLayer(LAYER);
      if (this.map.getSource(SRC)) this.map.removeSource(SRC);
    } catch { /* style mid-swap — it's already gone */ }
  }

  // Trailing-edge debounce. The march is CPU-expensive, so while the user is scrubbing the
  // timeline or the replay is playing, the playhead-minute (and thus setSun) ticks over and
  // over — we must NOT recompute per tick. Instead we wait until the triggers SETTLE
  // (DEBOUNCE_MS of quiet) and then fire ONCE, at the latest sun/viewport. A MAX_WAIT cap
  // guarantees we still refresh under genuinely continuous change (fast playback) rather than
  // starving forever. The old shadow stays painted the whole time — nothing detaches here.
  schedule() {
    if (!this.enabled) return;
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (this.debTimer === undefined) this.burstAt = now; // first trigger of a fresh burst
    else clearTimeout(this.debTimer);
    const waited = now - this.burstAt;
    const delay = Math.min(CastShadow.DEBOUNCE_MS, Math.max(0, CastShadow.MAX_WAIT_MS - waited));
    this.debTimer = setTimeout(() => { this.debTimer = undefined; this.run(); }, delay);
  }

  // In-flight guard: coalesce to the LATEST. If a run is requested while one is marching, mark
  // it dirty and rerun exactly once more (with the then-current sun/viewport) when it finishes,
  // so a backlog of expensive recomputes can never pile up.
  private run() {
    if (this.busy) { this.pending = true; return; }
    this.busy = true;
    this.recompute().catch((e) => console.warn("[xc3d] cast-shadow:", e)).finally(() => {
      this.busy = false;
      if (this.pending) { this.pending = false; this.run(); }
    });
  }

  // pick a DEM zoom for the current view that keeps the stitched grid bounded (≤ ~16 tiles)
  private pickZoom(b: maplibregl.LngLatBounds): number {
    let z = Math.max(7, Math.min(13, Math.round(this.map.getZoom())));
    for (; z >= 6; z--) {
      const x0 = Math.floor(lon2tile(b.getWest(), z)), x1 = Math.floor(lon2tile(b.getEast(), z));
      const y0 = Math.floor(lat2tile(b.getNorth(), z)), y1 = Math.floor(lat2tile(b.getSouth(), z));
      if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 16) return z;
    }
    return 6;
  }

  private async fetchTile(z: number, x: number, y: number): Promise<Float32Array | null> {
    const key = `${z}/${x}/${y}`;
    const hit = this.tiles.get(key);
    if (hit) return hit;
    const url = TERRARIUM_URL.replace("{z}", `${z}`).replace("{x}", `${x}`).replace("{y}", `${y}`);
    try {
      // hard timeout: a stalled DEM tile must never wedge the whole recompute (busy stays
      // true forever, no shadows ever paint). A missing tile just leaves that patch flat.
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) return null;
      const bmp = await createImageBitmap(await resp.blob());
      const c = document.createElement("canvas"); c.width = TILE; c.height = TILE;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0, TILE, TILE);
      if (typeof bmp.close === "function") bmp.close();
      const d = ctx.getImageData(0, 0, TILE, TILE).data;
      const elev = new Float32Array(TILE * TILE);
      for (let i = 0; i < elev.length; i++) {
        const j = i * 4;
        elev[i] = d[j] * 256 + d[j + 1] + d[j + 2] / 256 - 32768;
      }
      if (this.tiles.size > 400) this.tiles.clear(); // crude cap — keeps memory sane on the VPS
      this.tiles.set(key, elev);
      return elev;
    } catch { return null; }
  }

  private async recompute() {
    if (!this.enabled) return;
    const sun = this.sun;
    const b = this.map.getBounds();
    const z = this.pickZoom(b);
    const x0 = Math.floor(lon2tile(b.getWest(), z)), x1 = Math.floor(lon2tile(b.getEast(), z));
    const y0 = Math.floor(lat2tile(b.getNorth(), z)), y1 = Math.floor(lat2tile(b.getSouth(), z));
    // dedupe: same tile window + same sun-minute + strength ⇒ nothing to redo
    const key = `${z}:${x0},${y0},${x1},${y1}:${Math.round(sun.azimuthDeg)}:${Math.round(sun.altitudeDeg)}:${this.strength.toFixed(2)}`;
    if (key === this.lastKey) return;

    // Night (or sun on the horizon): everything is in shadow / undefined — just clear.
    if (sun.altitudeDeg <= 0.5) { this.detach(); this.lastKey = key; return; }

    const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
    const W = cols * TILE, H = rows * TILE;
    const height = new Float32Array(W * H);
    // fetch all covering tiles in parallel (each with its own timeout), then stitch the ones
    // that arrived into one contiguous heightmap. A tile that failed just stays flat (0).
    const jobs: Promise<void>[] = [];
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        jobs.push(this.fetchTile(z, x0 + tx, y0 + ty).then((elev) => {
          if (!elev) return; // ocean / missing / timed-out → left at 0
          const ox = tx * TILE, oy = ty * TILE;
          for (let py = 0; py < TILE; py++) {
            const dstRow = (oy + py) * W + ox, srcRow = py * TILE;
            for (let px = 0; px < TILE; px++) height[dstRow + px] = elev[srcRow + px];
          }
        }));
      }
    }
    await Promise.all(jobs);
    if (!this.enabled) return; // toggled off while tiles were in flight

    // metres per heightmap pixel at this zoom + the view-centre latitude
    const latMid = (b.getNorth() + b.getSouth()) / 2;
    const mpp = (EARTH_CIRC * Math.cos((latMid * Math.PI) / 180)) / (TILE * 2 ** z);

    let hMin = Infinity, hMax = -Infinity;
    for (let i = 0; i < height.length; i += 997) { const h = height[i]; if (h < hMin) hMin = h; if (h > hMax) hMax = h; }

    // GPU march when available; fall back to the CPU march() on any WebGL2 failure so the
    // feature never goes dark. Time just the march (the shared toDataURL/drape below is not
    // counted) so the dbg hook reports a like-for-like GPU-vs-CPU number.
    const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    let rgba = this.marchGpu(height, W, H, mpp, sun);
    const gpu = rgba !== null;
    if (!rgba) rgba = this.march(height, W, H, mpp, sun);
    const marchMs = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0) * 10) / 10;
    this.runs++;
    this.dbg = { runs: this.runs, gpu, marchMs, z, cols, rows, W, H, mpp: Math.round(mpp), hMin: Math.round(hMin), hMax: Math.round(hMax), coverage: this.lastCoverage, alt: Math.round(sun.altitudeDeg * 10) / 10 };

    // paint onto our canvas and hand it to (or update) the image source
    this.canvas.width = W; this.canvas.height = H;
    const ctx = this.canvas.getContext("2d")!;
    ctx.putImageData(new ImageData(rgba, W, H), 0, 0);
    const nw: [number, number] = [tile2lon(x0, z), tile2lat(y0, z)];
    const se: [number, number] = [tile2lon(x1 + 1, z), tile2lat(y1 + 1, z)];
    const coords: [number, number][] = [[nw[0], nw[1]], [se[0], nw[1]], [se[0], se[1]], [nw[0], se[1]]];
    const url = this.canvas.toDataURL("image/png");
    this.attach(url, coords);
    this.lastKey = key;
  }

  // ray-march the shadow mask → RGBA (black where occluded, transparent where lit)
  private march(height: Float32Array, W: number, H: number, mpp: number, sun: SunPos): Uint8ClampedArray {
    const out = new Uint8ClampedArray(W * H * 4);
    let shaded = 0, sampled = 0;
    const az = (sun.azimuthDeg * Math.PI) / 180;
    // pixel-space step TOWARD the sun: +x = east, +y = south (down). East=sin(az), North=cos(az).
    const sx = Math.sin(az), sy = -Math.cos(az);
    const tanAlt = Math.tan((sun.altitudeDeg * Math.PI) / 180);
    const STEP = 1.4;          // px per march step (a touch over 1 → fewer steps, still tight)
    const MAX_STEPS = 260;     // caps a long low-sun ray (≈ MAX_STEPS*STEP*mpp metres of reach)
    const BIAS = 2;            // metres — don't self-shadow on the pixel's own micro-relief
    const alphaMax = Math.round(this.strength * 255);
    const stride = 2;          // compute every 2nd pixel (2×2 blocks) — 4× faster, imperceptible

    for (let y = 0; y < H; y += stride) {
      for (let x = 0; x < W; x += stride) {
        const e0 = height[y * W + x];
        sampled++;
        let occluded = false;
        let fx = x, fy = y, dist = 0;
        for (let k = 0; k < MAX_STEPS; k++) {
          fx += sx * STEP; fy += sy * STEP; dist += STEP * mpp;
          const ix = fx | 0, iy = fy | 0;
          if (ix < 0 || iy < 0 || ix >= W || iy >= H) break; // marched off the heightmap
          const rayH = e0 + dist * tanAlt + BIAS; // the ray's height at this distance
          if (height[iy * W + ix] > rayH) { occluded = true; break; }
          if (dist * tanAlt > 4500) break; // the ray has climbed above any Alpine peak — lit
        }
        if (!occluded) continue;
        shaded++;
        // fill the stride×stride block so the coarse grid tiles the full image
        for (let by = 0; by < stride; by++) {
          const yy = y + by; if (yy >= H) break;
          for (let bx = 0; bx < stride; bx++) {
            const xx = x + bx; if (xx >= W) break;
            const j = (yy * W + xx) * 4;
            out[j + 3] = alphaMax; // RGB stays 0 (black); alpha carries the shadow
          }
        }
      }
    }
    this.lastCoverage = sampled ? shaded / sampled : 0;
    return out;
  }

  // ── GPU march ───────────────────────────────────────────────────────────
  // Lazily build the offscreen WebGL2 context + program. Returns false (once, cached in gpuOk)
  // if WebGL2 is unavailable or the shader won't compile — recompute() then rides the CPU march.
  private gpuInit(): boolean {
    if (this.gpuOk !== undefined) return this.gpuOk && !!this.gl && !this.gl.isContextLost();
    try {
      const gl = this.glCanvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
      if (!gl) { this.gpuOk = false; return false; }
      // fullscreen triangle from gl_VertexID → clip space; no attribute buffers needed
      const vs = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0,0.0,1.0); }`;
      // Per-texel ray-march — a line-for-line port of march(). gl_FragCoord is bottom-origin, so
      // fbY=0 is heightmap row 0 (north); we index the texture by (px,py)=gl_FragCoord directly,
      // and readPixels' bottom-up rows then land top-down in the ImageData exactly like the CPU
      // path — no flip. sx=sin(az), sy=-cos(az): +x east, +y south in heightmap-index space.
      const fs = `#version 300 es
precision highp float; precision highp int;
uniform highp sampler2D uHeight;
uniform float uMpp,uSx,uSy,uTanAlt,uAlpha,uStep,uBias,uClimbMax;
uniform int uMaxSteps;
out vec4 fragColor;
void main(){
  ivec2 sz = textureSize(uHeight,0); int W=sz.x, H=sz.y;
  int px=int(gl_FragCoord.x), py=int(gl_FragCoord.y);
  if(px>=W||py>=H){ fragColor=vec4(0.0); return; }
  float e0 = texelFetch(uHeight, ivec2(px,py),0).r;
  float fx=float(px), fy=float(py), dist=0.0; bool occ=false;
  for(int k=0;k<uMaxSteps;k++){
    fx+=uSx*uStep; fy+=uSy*uStep; dist+=uStep*uMpp;
    int ix=int(floor(fx)), iy=int(floor(fy));
    if(ix<0||iy<0||ix>=W||iy>=H) break;               // marched off the heightmap
    if(texelFetch(uHeight, ivec2(ix,iy),0).r > e0 + dist*uTanAlt + uBias){ occ=true; break; }
    if(dist*uTanAlt > uClimbMax) break;               // ray above any Alpine peak — lit
  }
  fragColor = occ ? vec4(0.0,0.0,0.0,uAlpha) : vec4(0.0); // RGB 0 (black); alpha carries the shadow
}`;
      const prog = this.compile(gl, vs, fs);
      if (!prog) { this.gpuOk = false; return false; }
      this.gl = gl; this.glProg = prog;
      for (const n of ["uHeight","uMpp","uSx","uSy","uTanAlt","uAlpha","uStep","uBias","uClimbMax","uMaxSteps"])
        this.glUniforms[n] = gl.getUniformLocation(prog, n);
      this.glTex = gl.createTexture();
      this.gpuOk = true; return true;
    } catch { this.gpuOk = false; return false; }
  }

  private compile(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
    const mk = (type: number, src: string) => {
      const sh = gl.createShader(type)!; gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn("[xc3d] cast-shadow shader:", gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null; }
      return sh;
    };
    const vs = mk(gl.VERTEX_SHADER, vsSrc), fs = mk(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram()!; gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn("[xc3d] cast-shadow link:", gl.getProgramInfoLog(p)); return null; }
    return p;
  }

  // GPU port of march(): upload the heightmap as an R32F texture, render the shader above over a
  // W×H framebuffer, read back the RGBA mask. Same result as march() (within the CPU pass's 2×2
  // stride — the GPU computes every texel, so it's a touch sharper). Returns null on any GL
  // failure so recompute() falls back to the CPU march.
  private marchGpu(height: Float32Array, W: number, H: number, mpp: number, sun: SunPos): Uint8ClampedArray | null {
    if ((globalThis as any).xc3dCastForceCpu === true) return null; // verify hook: force CPU
    if (!this.gpuInit()) return null;
    const gl = this.gl!;
    if (gl.isContextLost()) { this.gpuOk = false; return null; }
    try {
      this.glCanvas.width = W; this.glCanvas.height = H;
      gl.viewport(0, 0, W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.glTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); // integer index sampling, like fx|0
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, W, H, 0, gl.RED, gl.FLOAT, height);
      if (gl.getError() !== gl.NO_ERROR) { this.gpuOk = false; return null; } // driver rejected the float upload
      gl.useProgram(this.glProg);
      const az = (sun.azimuthDeg * Math.PI) / 180;
      const u = this.glUniforms;
      gl.uniform1i(u.uHeight, 0);
      gl.uniform1f(u.uMpp, mpp);
      gl.uniform1f(u.uSx, Math.sin(az));   // east
      gl.uniform1f(u.uSy, -Math.cos(az));  // south (down in heightmap index space) — matches march()
      gl.uniform1f(u.uTanAlt, Math.tan((sun.altitudeDeg * Math.PI) / 180));
      gl.uniform1f(u.uAlpha, Math.round(this.strength * 255) / 255); // == march()'s alphaMax after readback
      gl.uniform1f(u.uStep, 1.4);      // STEP
      gl.uniform1f(u.uBias, 2);        // BIAS metres
      gl.uniform1f(u.uClimbMax, 4500); // above any Alpine peak → lit
      gl.uniform1i(u.uMaxSteps, 260);  // MAX_STEPS
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      if (gl.getError() !== gl.NO_ERROR) return null;
      // coverage — occluded fraction, comparable to march()'s lastCoverage (here over every texel)
      let shaded = 0; const total = W * H;
      for (let i = 3; i < buf.length; i += 4) if (buf[i] !== 0) shaded++;
      this.lastCoverage = total ? shaded / total : 0;
      return new Uint8ClampedArray(buf.buffer);
    } catch (e) { console.warn("[xc3d] cast-shadow GPU:", e); return null; }
  }

  private attach(url: string, coords: [number, number][]) {
    try {
      const src = this.map.getSource(SRC) as maplibregl.ImageSource | undefined;
      if (src) { src.updateImage({ url, coordinates: coords }); return; }
      this.map.addSource(SRC, { type: "image", url, coordinates: coords });
      this.map.addLayer(
        { id: LAYER, type: "raster", source: SRC, paint: { "raster-opacity": 1, "raster-fade-duration": 0, "raster-resampling": "linear" } } as any,
        this.beforeId(),
      );
    } catch (e) {
      // style still loading after a basemap swap — retry once it settles
      this.map.once("styledata", () => { if (this.enabled) this.schedule(); });
    }
  }

  // sit above the basemap tiles but below its linework/labels (like the sun hillshade)
  private beforeId(): string | undefined {
    for (const l of this.map.getStyle().layers ?? []) {
      if (l.id === LAYER || l.id === SRC) continue;
      if (l.type === "line" || l.type === "symbol") return l.id;
    }
    return undefined;
  }
}
