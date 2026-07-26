package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/base32"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

// Flight is a parsed, deduplicated track.
type Flight struct {
	ID          int64      `json:"-"`
	Fingerprint string     `json:"fingerprint"`
	Filename    string     `json:"filename"`
	Pilot       string     `json:"pilot"`
	Date        string     `json:"date"`
	LaunchEpoch int64      `json:"launchEpoch"`
	Launch      [3]float64 `json:"launch"` // lat, lon, alt
	Duration    int        `json:"duration"`
	// Track points: [t(relative s), lat, lon, gpsAlt, pressAlt]
	Track [][5]float64 `json:"track"`
}

// SessionFlight is a flight as it appears in a room (per-uploader name/color).
type SessionFlight struct {
	Name  string `json:"name"`
	Color string `json:"color"`
	Flight
}

// FlightMeta is a flight WITHOUT its (multi-MB) track — everything the room list needs
// to show the pilot before the track itself is fetched separately by fingerprint.
type FlightMeta struct {
	Fingerprint string     `json:"fingerprint"`
	Filename    string     `json:"filename"`
	Pilot       string     `json:"pilot"`
	Date        string     `json:"date"`
	LaunchEpoch int64      `json:"launchEpoch"`
	Launch      [3]float64 `json:"launch"` // lat, lon, alt
	Duration    int        `json:"duration"`
}

// SessionFlightMeta is a SessionFlight minus the track (per-uploader name/color + meta).
type SessionFlightMeta struct {
	Name  string `json:"name"`
	Color string `json:"color"`
	FlightMeta
}

func OpenStore(path string) (*Store, error) {
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // simple; avoids write contention
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS flights (
  id INTEGER PRIMARY KEY,
  fingerprint TEXT UNIQUE NOT NULL,
  filename TEXT,
  pilot TEXT,
  date TEXT,
  launch_epoch INTEGER,
  launch_lat REAL, launch_lon REAL, launch_alt REAL,
  duration INTEGER,
  track TEXT NOT NULL,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT,
  title TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS session_flights (
  session_id TEXT NOT NULL,
  flight_id INTEGER NOT NULL,
  name TEXT,
  color TEXT,
  added_at TEXT,
  PRIMARY KEY (session_id, flight_id)
);
`)
	if err != nil {
		return err
	}
	// Idempotent add for DBs created before `sessions.title` existed. CREATE TABLE IF NOT
	// EXISTS above leaves an old table's columns alone, so ADD COLUMN here backfills it;
	// on a fresh DB (or a second start) the column already exists — ignore that error.
	if _, err := s.db.Exec(`ALTER TABLE sessions ADD COLUMN title TEXT DEFAULT ''`); err != nil &&
		!strings.Contains(err.Error(), "duplicate column") {
		return err
	}
	return nil
}

func nowStr() string { return time.Now().UTC().Format(time.RFC3339) }

func newID(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b))[:n]
}

func (s *Store) CreateSession() (string, error) {
	id := newID(8)
	_, err := s.db.Exec(`INSERT INTO sessions(id, created_at) VALUES(?,?)`, id, nowStr())
	return id, err
}

// CreateSessionWithID creates a session with a fixed id (used for the demo room).
func (s *Store) CreateSessionWithID(id string) error {
	_, err := s.db.Exec(`INSERT OR IGNORE INTO sessions(id, created_at) VALUES(?,?)`, id, nowStr())
	return err
}

func (s *Store) SessionExists(id string) bool {
	var x string
	err := s.db.QueryRow(`SELECT id FROM sessions WHERE id=?`, id).Scan(&x)
	return err == nil
}

// SessionTitle returns a room's human-readable display title (may be ""). The room's
// id/CODE is immutable — this is only an optional label shown in the title header.
func (s *Store) SessionTitle(id string) (string, error) {
	var title string
	err := s.db.QueryRow(`SELECT title FROM sessions WHERE id=?`, id).Scan(&title)
	return title, err
}

// RenameSession sets a room's human-readable display title (the id/CODE is never
// touched). An empty title is allowed — it clears the label back to the code. Reports
// whether a row was actually updated (false ⇒ no such session, so the caller 404s).
func (s *Store) RenameSession(id, title string) (bool, error) {
	res, err := s.db.Exec(`UPDATE sessions SET title=? WHERE id=?`, title, id)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// UpsertFlight inserts a parsed flight, or returns the existing one by fingerprint.
func (s *Store) UpsertFlight(f *Flight) (int64, bool, error) {
	var id int64
	err := s.db.QueryRow(`SELECT id FROM flights WHERE fingerprint=?`, f.Fingerprint).Scan(&id)
	if err == nil {
		return id, true, nil // already existed
	}
	if err != sql.ErrNoRows {
		return 0, false, err
	}
	trackJSON, _ := json.Marshal(f.Track)
	res, err := s.db.Exec(`INSERT INTO flights
	  (fingerprint, filename, pilot, date, launch_epoch, launch_lat, launch_lon, launch_alt, duration, track, created_at)
	  VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
		f.Fingerprint, f.Filename, f.Pilot, f.Date, f.LaunchEpoch,
		f.Launch[0], f.Launch[1], f.Launch[2], f.Duration, string(trackJSON), nowStr())
	if err != nil {
		return 0, false, err
	}
	id, _ = res.LastInsertId()
	return id, false, nil
}

// LinkFlight associates a flight with a session (per-uploader name/color). Idempotent.
func (s *Store) LinkFlight(sessionID string, flightID int64, name, color string) error {
	_, err := s.db.Exec(`INSERT OR IGNORE INTO session_flights(session_id, flight_id, name, color, added_at)
	  VALUES(?,?,?,?,?)`, sessionID, flightID, name, color, nowStr())
	return err
}

// UnlinkFlight removes a flight from a session by dropping ONLY the join row. The
// global flights row and the archived .igc are left untouched, so the track can be
// re-added later (via linkExisting) without re-uploading the file. Reports whether a
// row was actually removed (false ⇒ it wasn't in this room, so the caller 404s).
func (s *Store) UnlinkFlight(sessionID, fingerprint string) (bool, error) {
	res, err := s.db.Exec(`DELETE FROM session_flights
	  WHERE session_id=? AND flight_id=(SELECT id FROM flights WHERE fingerprint=?)`,
		sessionID, fingerprint)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// RenameFlight changes a flight's per-room display name (only session_flights.name for
// THIS room — the global flights row and the archived .igc are untouched). Reports
// whether a row was actually updated (false ⇒ it wasn't in this room, so the caller 404s).
func (s *Store) RenameFlight(sessionID, fingerprint, name string) (bool, error) {
	res, err := s.db.Exec(`UPDATE session_flights SET name=?
	  WHERE session_id=? AND flight_id=(SELECT id FROM flights WHERE fingerprint=?)`,
		name, sessionID, fingerprint)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// SessionFlights returns all flights in a room, ordered by add time.
func (s *Store) SessionFlights(sessionID string) ([]SessionFlight, error) {
	rows, err := s.db.Query(`
	  SELECT sf.name, sf.color, f.fingerprint, f.filename, f.pilot, f.date,
	         f.launch_epoch, f.launch_lat, f.launch_lon, f.launch_alt, f.duration, f.track
	  FROM session_flights sf JOIN flights f ON f.id = sf.flight_id
	  WHERE sf.session_id=? ORDER BY sf.added_at`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SessionFlight
	for rows.Next() {
		var sf SessionFlight
		var trackJSON string
		if err := rows.Scan(&sf.Name, &sf.Color, &sf.Fingerprint, &sf.Filename, &sf.Pilot,
			&sf.Date, &sf.LaunchEpoch, &sf.Launch[0], &sf.Launch[1], &sf.Launch[2],
			&sf.Duration, &trackJSON); err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(trackJSON), &sf.Track)
		out = append(out, sf)
	}
	return out, rows.Err()
}

// SessionFlightsMeta returns all flights in a room WITHOUT their tracks, ordered by add
// time. It deliberately does NOT SELECT the `track` column, so the room list loads without
// pulling (or unmarshalling) megabytes of coordinates — each track is fetched on its own by
// fingerprint via /api/flights/{fp}/track and cached immutably in the browser.
func (s *Store) SessionFlightsMeta(sessionID string) ([]SessionFlightMeta, error) {
	rows, err := s.db.Query(`
	  SELECT sf.name, sf.color, f.fingerprint, f.filename, f.pilot, f.date,
	         f.launch_epoch, f.launch_lat, f.launch_lon, f.launch_alt, f.duration
	  FROM session_flights sf JOIN flights f ON f.id = sf.flight_id
	  WHERE sf.session_id=? ORDER BY sf.added_at`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SessionFlightMeta
	for rows.Next() {
		var sf SessionFlightMeta
		if err := rows.Scan(&sf.Name, &sf.Color, &sf.Fingerprint, &sf.Filename, &sf.Pilot,
			&sf.Date, &sf.LaunchEpoch, &sf.Launch[0], &sf.Launch[1], &sf.Launch[2],
			&sf.Duration); err != nil {
			return nil, err
		}
		out = append(out, sf)
	}
	return out, rows.Err()
}

// TrackByFingerprint loads just ONE flight's track by its fingerprint (content-addressed,
// so this is global — not session-scoped). Returns ok=false (no error) if unknown, so the
// handler can 404 cleanly.
func (s *Store) TrackByFingerprint(fp string) ([][5]float64, bool, error) {
	var trackJSON string
	err := s.db.QueryRow(`SELECT track FROM flights WHERE fingerprint=?`, fp).Scan(&trackJSON)
	if err == sql.ErrNoRows {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	var track [][5]float64
	if err := json.Unmarshal([]byte(trackJSON), &track); err != nil {
		return nil, false, err
	}
	return track, true, nil
}

// FlightInSession reports whether a fingerprint is already linked in a room.
func (s *Store) FlightInSession(sessionID, fingerprint string) (bool, error) {
	var x int
	err := s.db.QueryRow(`SELECT 1 FROM session_flights sf JOIN flights f ON f.id=sf.flight_id
	  WHERE sf.session_id=? AND f.fingerprint=?`, sessionID, fingerprint).Scan(&x)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func (s *Store) FlightIDByFingerprint(fp string) (int64, error) {
	var id int64
	err := s.db.QueryRow(`SELECT id FROM flights WHERE fingerprint=?`, fp).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("flight not found: %w", err)
	}
	return id, nil
}

// GetFlightByFingerprint loads a full flight (incl. track) by its fingerprint.
func (s *Store) GetFlightByFingerprint(fp string) (*Flight, int64, error) {
	var f Flight
	var id int64
	var trackJSON string
	err := s.db.QueryRow(`SELECT id, fingerprint, filename, pilot, date,
	  launch_epoch, launch_lat, launch_lon, launch_alt, duration, track
	  FROM flights WHERE fingerprint=?`, fp).Scan(&id, &f.Fingerprint, &f.Filename,
		&f.Pilot, &f.Date, &f.LaunchEpoch, &f.Launch[0], &f.Launch[1], &f.Launch[2],
		&f.Duration, &trackJSON)
	if err != nil {
		return nil, 0, err
	}
	json.Unmarshal([]byte(trackJSON), &f.Track)
	return &f, id, nil
}
