# XC3D 🪂

3D flight analysis for XC pilots. Drop your IGC, share your flights, learn from each
other, fly safe.

Rooms. Make room, drop `.igc`, share QR. Everyone adds their flight — whole day replays
together in 3D on one clock. Terrain, sun + cast shadows, per-track thermals, gaggles,
camera-follow, your own map labels.

## Stack

- **web/** — SolidJS + Vite + Tailwind. MapLibre GL basemap + deck.gl 3D overlay: GPU
  trails, glider dots, name tags at true altitude over terrain. Colors = CSS vars.
- **backend/** — Go, no auth. SQLite (pure-Go `modernc.org/sqlite`). IGC parse + SHA-256
  fingerprint dedupe. Per-room WebSocket broadcast. Serves API + bundled SPA from ONE
  origin (`:8090`).

## Run

```bash
just setup                    # go mod tidy + pnpm install (first time)
cp web/.env.example web/.env  # then paste a free MapTiler token into it
just dev                      # hot-reload: Vite :38584 + backend :8090
just build                    # bundle SPA + backend binary (bin/xc3d)
just serve                    # PRODUCTION: build + serve SPA+API+WS from one Go origin, in tmux
just stop                     # stop it   ·   just attach   ·   just url
```

`just build` / `just serve` fail fast when the MapTiler key is missing (`just check-env`).

## Keys

One key, in `web/.env` (gitignored — copy from `web/.env.example`):

| var | why |
|-----|-----|
| `VITE_MAP_TILER_ACCESS_TOKEN` | terrain DEM → 3D relief, AGL, sun hillshade + cast shadows, MapTiler basemaps. Free tier fine. Missing → only the offline Topo/Relief maps. |

Backend env (optional): `XC3D_ADDR` (`:8090`), `XC3D_DB` (`xc3d.db`), `XC3D_DIST`
(`../web/dist`), `XC3D_SERVE_PORT`, `XC3D_WEB_PORT`.

## How it works

- `POST /api/sessions` → room id. Land → drop `.igc` → room auto-made → upload panel.
- Upload fingerprints each track (SHA-256); dup tracks reused, not re-parsed.
- New flights broadcast over WS → appear live for everyone in the room.
- Player: 3D terrain, seek bar, play/speed, camera modes (all · pilot · gaggle · free),
  sun hillshade + real DEM cast shadows, per-track thermal analysis, gaggle detection,
  map labels (your own pinned markers), altitude graph, keyboard + touch controls.
- Clock = seconds from each flight's own launch → different days still replay together.

## Why host it

Self-host = own your club's flights. Free: one small Go binary + SQLite, a ~4 GB box is
plenty, runs fine next to other services on a tiny VPS. No accounts, no per-IP limits, no
cloud lock-in. Pilots drop IGCs into a room, you keep the data, everyone learns from the
same 3D replay. `just serve` behind nginx + a subdomain and it's live.

## Docs

`HANDOFF.md` — status + gotchas. `TASKS.md` — task history / queue.
