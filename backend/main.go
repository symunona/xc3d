package main

import (
	"compress/gzip"
	"log"
	"net/http"
	"os"
	"strings"
)

func main() {
	dbPath := env("XC3D_DB", "xc3d.db")
	st, err := OpenStore(dbPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer st.Close()

	// where raw uploaded .igc files are archived (one per fingerprint)
	igcDir := env("XC3D_IGC_DIR", "igc")
	if err := os.MkdirAll(igcDir, 0o755); err != nil {
		log.Printf("igc dir %s: %v", igcDir, err)
	}
	log.Printf("archiving uploaded IGC files to %s/", igcDir)

	// seed the demo room (idempotent) from the bundled test IGCs
	SeedDemo(st, env("XC3D_DEMO_DIR", "../test/24-08-24-flight-gang-test"), igcDir)

	hub := NewHub()
	srv := &Server{store: st, hub: hub, igcDir: igcDir}

	mux := http.NewServeMux()
	srv.Routes(mux)

	// Optional: serve built SPA from ../web/dist if present.
	dist := env("XC3D_DIST", "../web/dist")
	if _, err := os.Stat(dist); err == nil {
		mux.Handle("/", spaHandler(dist))
		log.Printf("serving SPA from %s", dist)
	}

	addr := env("XC3D_ADDR", ":8090")
	log.Printf("xc3d listening on %s (db=%s)", addr, dbPath)
	if err := http.ListenAndServe(addr, withCORS(withGzip(mux))); err != nil {
		log.Fatal(err)
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// spaHandler serves static files and falls back to index.html for client routes.
//
// Cache policy (this is what makes a deploy show up immediately):
//   - Vite emits content-hashed files under /assets/ — the name changes when the bytes
//     do, so they're safe to cache forever (immutable).
//   - index.html and every other unhashed file (copc-bundle.js, laz-perf.wasm, favicon)
//     MUST be revalidated each load ("no-cache"), or the browser keeps serving a stale
//     index.html that points at /assets/ bundles a new build has already deleted.
func spaHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := dir + r.URL.Path
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			if strings.HasPrefix(r.URL.Path, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache")
			}
			fs.ServeHTTP(w, r)
			return
		}
		// client-side route → the SPA shell; never let it go stale
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, dir+"/index.html")
	})
}

// withGzip compresses responses for clients that accept gzip. The session JSON is
// huge and highly compressible (repeated coords/ints) — the demo room's ~8 MB payload
// shrinks to ~1 MB — and the JS/wasm assets roughly halve. Neither nginx (gzip_types is
// unset → text/html only, and gzip_proxied is off) nor the Go static server compressed
// anything before this, so room loading shipped ~10 MB uncompressed.
//
// Skips: websocket upgrades (gzip would break the connection hijack — detected by the
// Upgrade header, since nginx sets Connection:upgrade on *every* proxied request), Range
// requests (let the file server answer them raw), and clients that don't advertise gzip.
func withGzip(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") ||
			r.Header.Get("Upgrade") != "" ||
			r.Header.Get("Range") != "" {
			h.ServeHTTP(w, r)
			return
		}
		gzw := &gzipResponseWriter{ResponseWriter: w}
		defer gzw.Close()
		h.ServeHTTP(gzw, r)
	})
}

// gzipResponseWriter gzips the body lazily — it leaves empty responses (204/304) and
// their Content-Length untouched, and only rewrites headers once real bytes are written.
type gzipResponseWriter struct {
	http.ResponseWriter
	gz    *gzip.Writer
	wrote bool
}

func (g *gzipResponseWriter) init(code int) {
	if g.wrote {
		return
	}
	g.wrote = true
	if code == http.StatusNoContent || code == http.StatusNotModified {
		g.ResponseWriter.WriteHeader(code) // no body — nothing to compress
		return
	}
	h := g.Header()
	h.Del("Content-Length") // no longer valid once compressed → nginx re-chunks
	h.Set("Content-Encoding", "gzip")
	h.Add("Vary", "Accept-Encoding")
	g.gz = gzip.NewWriter(g.ResponseWriter)
	g.ResponseWriter.WriteHeader(code)
}

func (g *gzipResponseWriter) WriteHeader(code int) { g.init(code) }

func (g *gzipResponseWriter) Write(b []byte) (int, error) {
	if !g.wrote {
		g.init(http.StatusOK)
	}
	if g.gz != nil {
		return g.gz.Write(b)
	}
	return g.ResponseWriter.Write(b)
}

func (g *gzipResponseWriter) Close() {
	if g.gz != nil {
		g.gz.Close()
	}
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}
