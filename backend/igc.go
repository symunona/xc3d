package main

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

// ── GPS signal cleaning ────────────────────────────────────────────────────────
// Loggers emit garbage fixes: 0,0 before the GPS locks, and occasional teleports.
// Left in, a leading 0,0 run becomes the flight's "launch" and streaks the trail in
// from the Atlantic (see Tibor Zakuczi's track: 25 leading 0,0 fixes, then a
// 5,149 km "jump" in 1 s to the real Chamonix takeoff).
const (
	// A paraglider tops out well under 30 m/s ground speed; 50 m/s (180 km/h) is a
	// generous ceiling that never touches a real fast glide but kills any teleport.
	maxFixSpeedMS = 50.0
	// Floor for the per-gap allowance so 1 s fixes aren't held to a few metres.
	minFixJumpM = 1000.0
	// Consecutive over-limit fixes after which we accept and re-anchor — the track
	// genuinely moved (long outage), so don't throw the rest of the flight away.
	maxSkipRun = 3
)

// isNullIsland reports the "GPS hasn't locked yet" fix at 0°N 0°E.
func isNullIsland(lat, lon float64) bool {
	return math.Abs(lat) < 1e-3 && math.Abs(lon) < 1e-3
}

// haversineM is great-circle distance in metres.
func haversineM(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000.0
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLon := (lon2 - lon1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return 2 * R * math.Asin(math.Min(1, math.Sqrt(a)))
}

// ParseIGC parses raw IGC bytes into a Flight (fingerprint = sha256 of content).
func ParseIGC(name string, raw []byte) (*Flight, error) {
	sum := sha256.Sum256(raw)
	f := &Flight{
		Fingerprint: hex.EncodeToString(sum[:]),
		Filename:    name,
	}

	var date time.Time
	haveDate := false
	sc := bufio.NewScanner(bytes.NewReader(raw))
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)

	var prevSecs int = -1
	var dayOffset int64 = 0
	var firstEpoch int64 = -1
	// last KEPT fix, for the jump gate below
	var lastLat, lastLon float64
	var lastEpoch int64
	var kept, skipped int

	for sc.Scan() {
		line := strings.TrimRight(sc.Text(), "\r\n")
		if len(line) == 0 {
			continue
		}
		switch line[0] {
		case 'H':
			up := strings.ToUpper(line)
			if strings.Contains(up, "FDTE") {
				if d, ok := parseIGCDate(line); ok {
					date = d
					haveDate = true
				}
			} else if strings.HasPrefix(up, "HFPLT") || strings.Contains(up, "PILOT") {
				if i := strings.Index(line, ":"); i >= 0 {
					f.Pilot = strings.TrimSpace(line[i+1:])
				}
			}
		case 'B':
			p, ok := parseBRecord(line)
			if !ok {
				continue
			}
			secs := p.h*3600 + p.m*60 + p.s
			if prevSecs >= 0 && secs < prevSecs {
				dayOffset += 86400 // midnight rollover
			}
			prevSecs = secs
			var epoch int64
			if haveDate {
				epoch = date.Unix() + int64(secs) + dayOffset
			} else {
				epoch = int64(secs) + dayOffset
			}
			// ── signal cleaning ────────────────────────────────────────────────
			// (a) NULL ISLAND: loggers emit B-records before the GPS has locked — the
			// altimeter already reads but lat/lon are 0,0 (in the Atlantic off Africa).
			// Never a real fix; drop it. Left in, it became the "launch" and drew a
			// 5000 km line across the map to the real takeoff.
			if isNullIsland(p.lat, p.lon) {
				continue
			}
			// (b) IMPOSSIBLE JUMP: a GPS teleport away from the last KEPT fix. The
			// allowance scales with the time gap, so a legitimate fix after a signal
			// outage isn't nuked (only a genuinely superhuman speed is). If several in
			// a row exceed it the track really did move, so re-anchor rather than
			// discard the rest of the flight.
			if kept > 0 {
				dt := float64(epoch - lastEpoch)
				if dt < 1 {
					dt = 1
				}
				maxJump := maxFixSpeedMS * dt
				if maxJump < minFixJumpM {
					maxJump = minFixJumpM
				}
				if haversineM(lastLat, lastLon, p.lat, p.lon) > maxJump {
					skipped++
					if skipped < maxSkipRun {
						continue
					}
				}
				skipped = 0
			}
			// The FIRST kept fix defines launch + the relative-time base, so dropping
			// leading garbage also rebases t (absolute wall-clock = LaunchEpoch + t
			// stays correct for multi-pilot replay sync).
			// GPS alt is 0 on some loggers — fall back to pressure alt, and do it BEFORE
			// setting Launch so the launch altitude matches the first track point's.
			alt := p.alt
			if alt == 0 && p.palt != 0 {
				alt = p.palt
			}
			if firstEpoch < 0 {
				firstEpoch = epoch
				f.LaunchEpoch = epoch
				f.Launch = [3]float64{p.lat, p.lon, alt}
			}
			t := float64(epoch - firstEpoch)
			f.Track = append(f.Track, [5]float64{t, p.lat, p.lon, alt, float64(p.palt)})
			lastLat, lastLon, lastEpoch, kept = p.lat, p.lon, epoch, kept+1
		}
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}
	if len(f.Track) < 2 {
		return nil, fmt.Errorf("no track points in %s", name)
	}
	if haveDate {
		f.Date = date.Format("2006-01-02")
	}
	f.Duration = int(f.Track[len(f.Track)-1][0])
	return f, nil
}

type bRec struct {
	h, m, s    int
	lat, lon   float64
	alt, palt  float64
}

func parseBRecord(l string) (bRec, bool) {
	if len(l) < 35 {
		return bRec{}, false
	}
	var r bRec
	var err error
	r.h, err = atoiN(l, 1, 3)
	if err != nil {
		return r, false
	}
	r.m, _ = atoiN(l, 3, 5)
	r.s, _ = atoiN(l, 5, 7)

	// lat: DDMMmmm[N/S] at 7..15
	latDeg, _ := atoiN(l, 7, 9)
	latMin, _ := atoiN(l, 9, 14) // MMmmm (5 digits => minutes*1000)
	r.lat = float64(latDeg) + float64(latMin)/1000.0/60.0
	if l[14] == 'S' || l[14] == 's' {
		r.lat = -r.lat
	}
	// lon: DDDMMmmm[E/W] at 15..24
	lonDeg, _ := atoiN(l, 15, 18)
	lonMin, _ := atoiN(l, 18, 23)
	r.lon = float64(lonDeg) + float64(lonMin)/1000.0/60.0
	if l[23] == 'W' || l[23] == 'w' {
		r.lon = -r.lon
	}
	// pressure alt 25..30, gps alt 30..35
	if pa, e := atoiN(l, 25, 30); e == nil {
		r.palt = float64(pa)
	}
	if ga, e := atoiN(l, 30, 35); e == nil {
		r.alt = float64(ga)
	}
	return r, true
}

func atoiN(s string, a, b int) (int, error) {
	if b > len(s) {
		return 0, fmt.Errorf("range")
	}
	return strconv.Atoi(strings.TrimSpace(s[a:b]))
}

// parseIGCDate handles HFDTE120523 and HFDTEDATE:120523,01 forms (DDMMYY).
func parseIGCDate(l string) (time.Time, bool) {
	digits := make([]byte, 0, 6)
	// take the run of 6 digits after the last ':' or after "FDTE"
	src := l
	if i := strings.Index(l, ":"); i >= 0 {
		src = l[i+1:]
	}
	for i := 0; i < len(src) && len(digits) < 6; i++ {
		if src[i] >= '0' && src[i] <= '9' {
			digits = append(digits, src[i])
		} else if len(digits) > 0 {
			break
		}
	}
	if len(digits) != 6 {
		return time.Time{}, false
	}
	dd, _ := strconv.Atoi(string(digits[0:2]))
	mm, _ := strconv.Atoi(string(digits[2:4]))
	yy, _ := strconv.Atoi(string(digits[4:6]))
	year := 2000 + yy
	if yy > 70 {
		year = 1900 + yy
	}
	if mm < 1 || mm > 12 || dd < 1 || dd > 31 {
		return time.Time{}, false
	}
	return time.Date(year, time.Month(mm), dd, 0, 0, 0, 0, time.UTC), true
}
