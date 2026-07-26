# XC3D — 3D flight analysis for XC pilots (paragliding flight-replay rooms).
# backend: Go (serves API + WS + bundled SPA on :8090)   web: SolidJS + Vite

set shell := ["bash", "-uc"]

web_port := env_var_or_default("XC3D_WEB_PORT", "38584")
serve_port := env_var_or_default("XC3D_SERVE_PORT", "8090")

default:
    @just --list

# fail early if a required key is missing (copy web/.env.example → web/.env, fill it in).
check-env:
    #!/usr/bin/env bash
    set -euo pipefail
    env="{{justfile_directory()}}/web/.env"
    if [ ! -f "$env" ] || ! grep -qE '^VITE_MAP_TILER_ACCESS_TOKEN=.+' "$env"; then
      echo "✗ missing required key: VITE_MAP_TILER_ACCESS_TOKEN" >&2
      echo "  XC3D needs a (free) MapTiler token for the terrain DEM — 3D relief, AGL," >&2
      echo "  sun hillshade + cast shadows — and the MapTiler basemaps. Without it only" >&2
      echo "  the offline OpenTopoMap / Relief basemaps render." >&2
      echo "  → cp web/.env.example web/.env  and paste your token" >&2
      echo "    free token: https://cloud.maptiler.com/account/keys/" >&2
      exit 1
    fi
    echo "✓ env ok"

# install all deps (go modules + web node_modules)
setup:
    cd backend && go mod tidy
    cd web && pnpm install

# run Go backend alone on :8090
backend:
    cd backend && go run .

# run the Vite dev server on the tailscale IP (port {{web_port}})
web: check-env
    @echo "web → http://$(tailscale ip -4 2>/dev/null | head -1):{{web_port}}/"
    cd web && pnpm dev

# build the bundled SPA (web/dist) + the backend binary (bin/xc3d, which also serves dist)
build: check-env
    cd web && pnpm build
    cd backend && go build -o ../bin/xc3d .

# SERVE (production): build the bundled SPA and serve it + the API from ONE Go origin, in
# tmux. This is what the public host runs — nginx proxies xc3d.tmpx.space → :{{serve_port}}.
serve: check-env
    #!/usr/bin/env bash
    set -euo pipefail
    S=xc3d
    DIR="{{justfile_directory()}}"
    # auto-bump the patch version each build, baked into the bundle (shown in Help)
    ( cd "$DIR/web" && npm version patch --no-git-tag-version >/dev/null && echo "version $(node -p "require('./package.json').version")" )
    echo "building production bundle…"
    ( cd "$DIR/web" && node node_modules/vite/bin/vite.js build )
    tmux kill-session -t "$S" 2>/dev/null || true
    tmux new-session -d -s "$S" -n server -c "$DIR/backend"
    tmux send-keys   -t "$S:server" 'XC3D_ADDR=:{{serve_port}} XC3D_DIST="../web/dist" go run .' C-m
    IP=$(tailscale ip -4 2>/dev/null | head -1)
    echo "XC3D up in tmux '$S' — bundled SPA + API + WS on :{{serve_port}} (nginx → xc3d.tmpx.space)"
    echo "  open/share → http://${IP:-localhost}:{{serve_port}}/"
    echo "  after changes: just serve   ·   stop: just stop   ·   attach: just attach"

# stop the production tmux session
stop:
    tmux kill-session -t xc3d 2>/dev/null && echo "stopped" || echo "not running"

# attach to the running production session (Ctrl-b d to detach)
attach:
    tmux attach -t xc3d

# run backend + web dev together in the foreground (Ctrl-C stops both)
dev: check-env
    #!/usr/bin/env bash
    set -m
    trap 'kill 0' EXIT
    echo "web → http://$(tailscale ip -4 2>/dev/null | head -1):{{web_port}}/  (share this / QR)"
    ( cd backend && go run . ) &
    ( cd web && pnpm dev ) &
    wait

# wipe the local database
clean-db:
    rm -f backend/xc3d.db backend/xc3d.db-wal backend/xc3d.db-shm
