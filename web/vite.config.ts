import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// App version — read fresh each build (serve-tracklogs auto-bumps the patch first).
const APP_VERSION = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

// Bind the dev server to this machine's tailscale IP so the room is reachable
// from phones/other nodes on the tailnet (but not the public internet).
// Falls back to 0.0.0.0 if tailscale isn't up.
function tailscaleIP(): string {
  try {
    const ip = execSync("tailscale ip -4", { encoding: "utf8" }).trim().split("\n")[0];
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
  } catch {}
  return "0.0.0.0";
}

const HOST = process.env.XC3D_WEB_HOST || tailscaleIP();
const PORT = Number(process.env.XC3D_WEB_PORT || 38584);
const BACKEND = process.env.XC3D_BACKEND || "http://localhost:8090";

export default defineConfig({
  plugins: [solid()],
  define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(APP_VERSION) },
  build: {
    // Emit a manifest (served at /asset-manifest.json) so the boot splash can resolve
    // the Room chunk's files and show a real download-progress bar. Plain filename (not
    // the default .vite/manifest.json) to dodge nginx dotfile blocks.
    manifest: "asset-manifest.json",
    rollupOptions: {
      output: {
        // Split maplibre-gl (~40% of the JS, pure ESM) out of the Room chunk so a room
        // deep-link fetches it in parallel with the rest and the progress bar gets a
        // second real milestone. deck.gl is left in the Room chunk on purpose — forcing
        // it into its own manual chunk drags Rollup's CJS-interop helper along and turns
        // the whole thing into a static dep of the (otherwise tiny) landing entry.
        manualChunks(id) {
          if (id.includes("node_modules") && id.includes("maplibre")) return "maplibre";
        },
      },
    },
  },
  server: {
    host: HOST,
    port: PORT,
    strictPort: true,
    // exposed publicly via reverse proxy (e.g. tracklogs.tmpx.space) — accept any Host
    allowedHosts: true,
    // HMR websocket must reach the browser over the same tailscale address
    hmr: { host: HOST, clientPort: PORT },
    // everything under /api (REST + the /ws upgrade) tunnels to the Go backend
    proxy: {
      "/api": {
        target: BACKEND,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
