package main

import (
	"log"
	"os"
	"path/filepath"
)

// DemoSessionID is a fixed room seeded on startup so a fresh deploy always has
// something to watch. The home page links to /s/demo.
const DemoSessionID = "demo"

type demoFlight struct{ file, name, color string }

// The 8 St. André flights from 2024-08-24 — two gangs of four (warm / cool).
var demoFlights = []demoFlight{
	{"2024-08-24-XCT-ATT-10-att-gang-1.igc", "att", "#ff5252"},
	{"2024-08-24-XCT-ATI-10-andras-gang-1.igc", "andras", "#ff9800"},
	{"2024-08-24-XCT-TDU-09-dude-gang-1.igc", "dude", "#ffd600"},
	{"2024-08-24-XCT-KBE-10-kopp-gang-1.igc", "kopp", "#ff8a3d"},
	{"2024-08-24-XCT-ARA-09-radnai-andras-gang-2.igc", "radnai", "#2fb8ff"},
	{"2024-08-24-XCT-XXX-01-pempoke-gang-2.igc", "pempoke", "#46d17a"},
	{"2024-08-24-XCT-TKE-10-kerekes-tom-gang-2i.igc", "kerekes", "#8e63ff"},
	{"2024-08-24-XCT-XXX-01-jonas-peti-gang-2.igc", "jonas", "#00c9a7"},
}

// SeedDemo creates the demo room from the bundled test IGCs, once. Idempotent:
// if the room already exists it does nothing. Missing files are logged, not fatal.
func SeedDemo(st *Store, dir, igcDir string) {
	if st.SessionExists(DemoSessionID) {
		return
	}
	if err := st.CreateSessionWithID(DemoSessionID); err != nil {
		log.Printf("demo: create session: %v", err)
		return
	}
	n := 0
	for _, d := range demoFlights {
		raw, err := os.ReadFile(filepath.Join(dir, d.file))
		if err != nil {
			log.Printf("demo: read %s: %v", d.file, err)
			continue
		}
		f, err := ParseIGC(d.file, raw)
		if err != nil {
			log.Printf("demo: parse %s: %v", d.file, err)
			continue
		}
		fid, _, err := st.UpsertFlight(f)
		if err != nil {
			log.Printf("demo: store %s: %v", d.file, err)
			continue
		}
		saveIGC(igcDir, f.Fingerprint, raw) // archive the demo file too

		if err := st.LinkFlight(DemoSessionID, fid, d.name, d.color); err != nil {
			log.Printf("demo: link %s: %v", d.file, err)
			continue
		}
		n++
	}
	log.Printf("demo: seeded room /s/%s with %d flights", DemoSessionID, n)
}
