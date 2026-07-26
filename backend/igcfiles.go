package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
)

// Raw uploaded .igc files are archived on disk, one per SHA-256 fingerprint, so the
// original tracklog is kept (the DB only holds the parsed track). Idempotent.
var fpRe = regexp.MustCompile(`^[a-f0-9]{64}$`)

func saveIGC(dir, fingerprint string, raw []byte) {
	if dir == "" || !fpRe.MatchString(fingerprint) {
		return
	}
	p := filepath.Join(dir, fingerprint+".igc")
	if _, err := os.Stat(p); err == nil {
		return // already archived
	}
	if err := os.WriteFile(p, raw, 0o644); err != nil {
		log.Printf("archive igc %s: %v", fingerprint, err)
	}
}

// getIGC serves an archived raw .igc by fingerprint (download the original file).
func (s *Server) getIGC(w http.ResponseWriter, r *http.Request) {
	fp := r.PathValue("fp")
	if !fpRe.MatchString(fp) { // guards against path traversal
		http.Error(w, "bad fingerprint", 400)
		return
	}
	p := filepath.Join(s.igcDir, fp+".igc")
	if _, err := os.Stat(p); err != nil {
		http.Error(w, "not archived", 404)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", `attachment; filename="`+fp+`.igc"`)
	http.ServeFile(w, r, p)
}
