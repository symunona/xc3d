# xc3d — handoff / status (2026-07-15)

Paragliding XC flight-replay **rooms**. Create a room, drop IGC tracklogs, share a
QR — everyone replays the day together in 3D on one wall-clock. Self-contained app
under `xc3d/`, independent of the rest of thermal-scraper.

## Run it

```bash
cd xc3d
just setup            # go mod tidy + pnpm install (first time)
just serve-tracklogs  # build bundle + serve SPA+API+WS from ONE Go origin, in tmux
just url              # prints the tailscale URL to open / share
just stop-tracklogs   # stop
just dev              # local hot-reload instead (Vite :38584 + backend :8090)
```

Served on the machine's **tailscale IP, port 38584** (single origin, bundled prod
build — NOT the Vite dev server; a dev server over a public proxy never finishes
loading). Publicly reachable via the user's reverse proxy at tracklogs.tmpx.space
→ that box proxies to `:38584`.

## ⚠️ Moving to a new machine — read this

1. **`.env` is gitignored and does NOT travel via git.** Recreate
   `xc3d/web/.env`:
   ```
   VITE_MAP_TILER_ACCESS_TOKEN=<maptiler key>
   ```
   The key currently in use is the same one in `../thermals-webapp/.env`
   (`VITE_MAP_TILER_ACCESS_TOKEN`). Without it: base map (OpenTopoMap/Esri) and
   flights still work, but **3D terrain, AGL, and Satellite-HD are disabled**
   (they gracefully no-op).
2. **Toolchain**: Go **1.26**, Node + **pnpm** (v11). Backend uses pure-Go
   `modernc.org/sqlite` (no cgo). First `pnpm install` needs esbuild's build script
   approved — `pnpm-workspace.yaml` has `allowBuilds: { esbuild: true }`; if pnpm
   still blocks it, run `pnpm rebuild esbuild` then build Vite via
   `node node_modules/vite/bin/vite.js build`.
3. **tailscale**: `serve-tracklogs` / `just url` call `tailscale ip -4`. On the new
   box, tailscale must be up. Override the bind with `XC3D_WEB_HOST` /
   `XC3D_WEB_PORT` if needed. Vite dev config also has `allowedHosts: true`
   for the public proxy.
4. **DB**: `backend/xc3d.db` (gitignored). Rooms live here; a fresh machine
   starts empty. Re-create the gang test room by uploading
   `test/24-08-24-flight-gang-test/*.igc` (see below).
5. **Reverse proxy**: must forward WebSocket `Upgrade` headers for `/api/.../ws`
   (live room sync), else uploads don't appear live for other viewers.

## Architecture

- **backend/** Go, no auth. SQLite (modernc). IGC parse + SHA-256 fingerprint
  dedupe. Per-room WebSocket broadcast. Endpoints: `POST /api/sessions`,
  `GET /api/sessions/{id}`, `POST /api/sessions/{id}/flights` (multipart),
  `POST /api/sessions/{id}/link` (re-add a stored flight by fingerprint),
  `GET /api/sessions/{id}/ws`. Serves the SPA from `web/dist` when
  `XC3D_DIST` is set. Env: `XC3D_ADDR`, `XC3D_DB`, `XC3D_DIST`.
- **web/** SolidJS + Vite + Tailwind v4, **MapLibre GL 4.7 + deck.gl 9** overlay
  (same stack as sibling thermals-webapp). All UI color in CSS vars in
  `src/styles.css` (`--p0..--p19` = 20 player colors).

## Features implemented & pushed to `main`

- Rooms; upload (drag-drop, fingerprint dedupe); **watch a room without uploading**
  (populated room opens straight into the player; "＋ add your flight" button).
- Global name+color profile in LS (restored every load); per-room upload history;
  recent rooms listed on the home screen.
- **Wall-clock (time-of-day) playback** — each flight sampled at its own offset into
  the same instant, so different days overlay. Seek bar reads UTC HH:MM:SS.
- **Gangs** = pilots flying together: airborne-gated, wall-clock, single-linkage
  union-find at **10 km**. Validated on 8 real tracks: 0% → 53% exact over the day,
  **92.5% during cruise**. Grouped into separate gang **cards** (top-right), form/
  merge/split live. Landed/not-launched pilots dimmed under "On the ground".
- Growing trails (reveal past points as the clock advances; tip tracks the glider).
- Camera: all / follow-pilot / **follow-gang** (preserves angle) / free; angle
  presets 1–4; altitude graph.
- **Keyboard**: space, j/k (±30s), PgUp/PgDn (±5min), q/a (speed), h/g (gang),
  1–4 (angles), b (graph), c (controls), ? (help). Hover hints everywhere.
- **Map menu**: Topo / Satellite (Esri) / Satellite-HD (MapTiler) / Plain;
  3D-terrain toggle; **path shadows** (ground projection); **Performance** section
  (full trails / labels / 60fps) with cost hints + live FPS.
- Collapsible controls window + collapsible gangs; seek bar on its own strip.
- Dark splash (no white flash); robust map setup (never stuck on the loader).

## Commit history (latest first)

`ba2a7fe` player keyboard/gang-follow/angles/collapsible-UI/layers/shadows/perf ·
`5117681` map layer + settings menu · `4fa02cb` altitude graph · `07a54cc` claude
chromium rule · `9c5abed` gang cards · `cea8227` watch-without-upload ·
`b8be789` wall-clock gangs · earlier: rooms, profile, prod-serve, map fixes.

## ⚠️ Verification status — IMPORTANT

The dev box is a **headless Raspberry Pi with only swiftshader (software GL)**. Once
the MapLibre+deck WebGL canvas renders, chromium can neither screenshot it nor
answer CDP evals (readback stalls). So this batch's UI is **compile-verified and
logic-verified, but NOT pixel-verified**. Confirmed before the stall: app mounts,
controls panel renders, the 4 camera-angle buttons are present. NOT visually
confirmed on this box: map imagery, terrain, **path shadows** (the "test this well"
item), the map menu open state, the altitude graph render, gang-follow at cruise.

**On the new machine (or any real GPU browser): open the gang room, seek to ~12:00
UTC, and eyeball:** two gang cards; ⦿ follow flying the camera to a gang; the
altitude graph traces; satellite/plain basemaps; and especially **path shadows**
(a dark projection of each trail on the ground) + the FPS delta as you toggle the
performance switches. These are the things I could not see here.

## Gang test fixture

`test/24-08-24-flight-gang-test/` — 8 real IGC (2026-08-24, St. André), 2 known
gangs of 4 encoded in filenames (`-gang-1` / `-gang-2`). Re-upload to a fresh room
to reproduce. Ground truth: g1 = att, andras(ATI), dude, kopp; g2 = radnai,
pempoke, kerekes, jonas. Launch spread 68 min → wall-clock alignment is essential.

## Deferred / TODO

- **3D thermal-COPC panel** (requested): a "3D thermal map" dropdown mirroring the
  thermals-webapp control panel, auto-filtered to the current season, with a
  default-on "point in day" filter so thermals shift as the replay clock advances.
  **Blocked**: needs the world/regional COPC tiles + must confirm the point schema
  carries time-of-day (not just day-of-year) for the day filter. The overnight
  world build (`resume-DEFG.sh` step G) **aborted** (`flight_bounds` +
  `flight_index NULL kind/bbox`) and was killed by a reboot — data not ready.
- Pixel-verify this batch on a GPU browser (see above).
- Bundle is ~1.6 MB (deck.gl); code-split if load time matters.
- Landing-card mobile width slightly clips on very narrow viewports (cosmetic).
