package main

import (
	"encoding/json"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
)

type Server struct {
	store  *Store
	hub    *Hub
	igcDir string // where raw uploaded .igc files are archived
}

func (s *Server) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/sessions", s.createSession)
	mux.HandleFunc("GET /api/sessions/{id}", s.getSession)
	mux.HandleFunc("PATCH /api/sessions/{id}", s.renameSession)
	mux.HandleFunc("POST /api/sessions/{id}/flights", s.uploadFlights)
	mux.HandleFunc("DELETE /api/sessions/{id}/flights/{fp}", s.removeFlight)
	mux.HandleFunc("PATCH /api/sessions/{id}/flights/{fp}", s.renameFlight)
	mux.HandleFunc("POST /api/sessions/{id}/link", s.linkExisting)
	mux.HandleFunc("GET /api/sessions/{id}/ws", s.ws)
	mux.HandleFunc("GET /api/flights/{fp}/track", s.getTrack)
	mux.HandleFunc("GET /api/flights/{fp}/igc", s.getIGC)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok"})
	})
}

func (s *Server) createSession(w http.ResponseWriter, r *http.Request) {
	id, err := s.store.CreateSession()
	if err != nil {
		httpErr(w, 500, err)
		return
	}
	writeJSON(w, 200, map[string]string{"id": id})
}

func (s *Server) getSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !s.store.SessionExists(id) {
		http.Error(w, "no such session", 404)
		return
	}
	title, err := s.store.SessionTitle(id)
	if err != nil {
		httpErr(w, 500, err)
		return
	}
	// Metadata only — NO track arrays. Each flight's track is fetched separately by
	// fingerprint (/api/flights/{fp}/track) and cached immutably in the browser, so a
	// reload (or a new upload) re-downloads only genuinely-new tracks. This response is
	// tiny and, since the flight LIST changes on upload, must never be cached.
	flights, err := s.store.SessionFlightsMeta(id)
	if err != nil {
		httpErr(w, 500, err)
		return
	}
	if flights == nil {
		flights = []SessionFlightMeta{}
	}
	w.Header().Set("Cache-Control", "no-cache")
	writeJSON(w, 200, map[string]any{"id": id, "title": title, "flights": flights})
}

// getTrack serves ONE flight's track as a JSON array [[t,lat,lon,gpsAlt,pressAlt],...] by
// fingerprint. A fingerprint→track mapping is immutable forever (the fingerprint is the
// sha256 of the IGC), so this is cached hard: reloading a room or adding a new flight reuses
// every already-seen track straight from the browser's HTTP cache — only new fingerprints
// hit the network. The route is global (content-addressed), not session-scoped. The client
// appends ?v=TRACK_CACHE_V and bumps that token if the track FORMAT ever changes, so stale
// immutable copies are cache-busted (a different URL is a different cache entry; the server
// ignores the param).
func (s *Server) getTrack(w http.ResponseWriter, r *http.Request) {
	fp := r.PathValue("fp")
	if !fpRe.MatchString(fp) { // guards against path traversal / junk keys
		http.Error(w, "bad fingerprint", 400)
		return
	}
	track, ok, err := s.store.TrackByFingerprint(fp)
	if err != nil {
		httpErr(w, 500, err)
		return
	}
	if !ok {
		http.Error(w, "not found", 404)
		return
	}
	trimTrackPrecision(track)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	writeJSON(w, 200, track)
}

// trimTrackPrecision rounds lat/lon to 6 decimal places (~0.11 m — far finer than any
// paraglider GPS) in place. Full float64 precision (e.g. 43.97656666666666) is nanometre
// noise that both bloats the JSON and defeats gzip (random trailing digits don't
// compress). Go's shortest-float encoder then prints the short form ("43.976567"). The
// track layout is [t, lat, lon, gpsAlt, pressAlt]; alt fields are already whole metres.
func trimTrackPrecision(track [][5]float64) {
	for i := range track {
		track[i][1] = math.Round(track[i][1]*1e6) / 1e6
		track[i][2] = math.Round(track[i][2]*1e6) / 1e6
	}
}

// uploadFlights: multipart form, field "files" (repeatable), plus name & color.
func (s *Server) uploadFlights(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !s.store.SessionExists(id) {
		http.Error(w, "no such session", 404)
		return
	}
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		httpErr(w, 400, err)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	color := strings.TrimSpace(r.FormValue("color"))
	if name == "" {
		name = "pilot"
	}
	if color == "" {
		color = "#ff5722"
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		http.Error(w, "no files", 400)
		return
	}
	// per-file names, index-aligned with "files"; blank falls back to the parsed
	// pilot name, then the form-level name. Absent entirely => all use `name`.
	names := r.MultipartForm.Value["names"]
	// per-file colors, index-aligned with "files"; blank falls back to the
	// form-level color. Absent entirely => all use `color`.
	colors := r.MultipartForm.Value["colors"]

	var added []SessionFlight
	for i, fh := range files {
		fd, err := fh.Open()
		if err != nil {
			log.Printf("open %s: %v", fh.Filename, err)
			continue
		}
		raw, _ := io.ReadAll(fd)
		fd.Close()

		flight, err := ParseIGC(fh.Filename, raw)
		if err != nil {
			log.Printf("parse %s: %v", fh.Filename, err)
			continue
		}
		// per-file name: explicit row value > parsed pilot > form-level name
		fname := name
		if i < len(names) {
			if n := strings.TrimSpace(names[i]); n != "" {
				fname = n
			} else if flight.Pilot != "" {
				fname = flight.Pilot
			}
		}
		// per-file color: explicit row value > form-level color
		fcolor := color
		if i < len(colors) {
			if c := strings.TrimSpace(colors[i]); c != "" {
				fcolor = c
			}
		}
		// Skip if this exact track is already in this room.
		if in, _ := s.store.FlightInSession(id, flight.Fingerprint); in {
			continue
		}
		fid, _, err := s.store.UpsertFlight(flight) // dedupes globally by fingerprint
		if err != nil {
			log.Printf("store %s: %v", fh.Filename, err)
			continue
		}
		saveIGC(s.igcDir, flight.Fingerprint, raw) // archive the original file

		if err := s.store.LinkFlight(id, fid, fname, fcolor); err != nil {
			log.Printf("link %s: %v", fh.Filename, err)
			continue
		}
		added = append(added, SessionFlight{Name: fname, Color: fcolor, Flight: *flight})
	}

	// Broadcast each newly added flight to the room.
	for i := range added {
		s.hub.Broadcast(id, map[string]any{"type": "flight_added", "flight": added[i]})
	}
	if added == nil {
		added = []SessionFlight{}
	}
	writeJSON(w, 200, map[string]any{"added": added})
}

// linkExisting adds an already-stored flight (by fingerprint) to a room, so a
// pilot can re-fly a past track in a new room without re-uploading the file.
func (s *Server) linkExisting(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !s.store.SessionExists(id) {
		http.Error(w, "no such session", 404)
		return
	}
	var body struct{ Fingerprint, Name, Color string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpErr(w, 400, err)
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" {
		body.Name = "pilot"
	}
	if body.Color == "" {
		body.Color = "#ff5722"
	}
	flight, fid, err := s.store.GetFlightByFingerprint(body.Fingerprint)
	if err != nil {
		http.Error(w, "flight not on server — upload the file", 404)
		return
	}
	if in, _ := s.store.FlightInSession(id, body.Fingerprint); in {
		http.Error(w, "already in this room", 409)
		return
	}
	if err := s.store.LinkFlight(id, fid, body.Name, body.Color); err != nil {
		httpErr(w, 500, err)
		return
	}
	sf := SessionFlight{Name: body.Name, Color: body.Color, Flight: *flight}
	s.hub.Broadcast(id, map[string]any{"type": "flight_added", "flight": sf})
	writeJSON(w, 200, map[string]any{"added": []SessionFlight{sf}})
}

// removeFlight drops a flight from a room (by fingerprint). Within a room a fingerprint
// maps to exactly one join row, so it's an unambiguous key. The archived .igc and the
// global flights row are intentionally kept — only the session link goes.
func (s *Server) removeFlight(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	fp := r.PathValue("fp")
	if !s.store.SessionExists(id) {
		http.Error(w, "no such session", 404)
		return
	}
	removed, err := s.store.UnlinkFlight(id, fp)
	if err != nil {
		httpErr(w, 500, err)
		return
	}
	if !removed {
		http.Error(w, "flight not in this room", 404)
		return
	}
	s.hub.Broadcast(id, map[string]any{"type": "flight_removed", "fingerprint": fp})
	w.WriteHeader(http.StatusNoContent)
}

// renameFlight changes a flight's per-room display name (session_flights.name) by
// fingerprint — within a room a fingerprint maps to exactly one join row. The body is
// {"name":"..."}; a blank name is rejected. On success the new name is broadcast so every
// other client relabels the pilot live, like uploadFlights does for a newly added flight.
func (s *Server) renameFlight(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	fp := r.PathValue("fp")
	if !s.store.SessionExists(id) {
		http.Error(w, "no such session", 404)
		return
	}
	var body struct{ Name string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpErr(w, 400, err)
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		http.Error(w, "empty name", 400)
		return
	}
	renamed, err := s.store.RenameFlight(id, fp, name)
	if err != nil {
		httpErr(w, 500, err)
		return
	}
	if !renamed {
		http.Error(w, "flight not in this room", 404)
		return
	}
	s.hub.Broadcast(id, map[string]any{"type": "flight_renamed", "fingerprint": fp, "name": name})
	writeJSON(w, 200, map[string]any{"fingerprint": fp, "name": name})
}

// renameSession sets a room's human-readable display TITLE (sessions.title). The room's
// id/CODE stays immutable — this only relabels the title header. The body is {"title":"..."};
// an empty/blank title is allowed and clears the label back to the code. On success the new
// title is broadcast so every other client updates its header live, like renameFlight does.
func (s *Server) renameSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !s.store.SessionExists(id) {
		http.Error(w, "no such session", 404)
		return
	}
	var body struct{ Title string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpErr(w, 400, err)
		return
	}
	title := strings.TrimSpace(body.Title)
	renamed, err := s.store.RenameSession(id, title)
	if err != nil {
		httpErr(w, 500, err)
		return
	}
	if !renamed {
		http.Error(w, "no such session", 404)
		return
	}
	s.hub.Broadcast(id, map[string]any{"type": "room_renamed", "title": title})
	writeJSON(w, 200, map[string]any{"id": id, "title": title})
}

func (s *Server) ws(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	s.hub.add(id, c)
	defer func() {
		s.hub.remove(id, c)
		c.Close()
	}()
	// read loop (keeps conn alive, drains pings/close)
	for {
		if _, _, err := c.ReadMessage(); err != nil {
			return
		}
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func httpErr(w http.ResponseWriter, code int, err error) {
	log.Printf("http %d: %v", code, err)
	http.Error(w, err.Error(), code)
}
