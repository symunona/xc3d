#!/usr/bin/env python3
"""One-off repair: strip garbage GPS fixes from ALREADY-STORED xc3d tracks.

Mirrors the parse-time cleaning in backend/igc.go (added at the same time), for flights
that were uploaded before it existed:

  (a) NULL ISLAND — loggers write B-records before the GPS locks: the altimeter reads
      but lat/lon are 0,0. Left in, the first such fix becomes the flight's "launch",
      so the takeoff marker sits in the Atlantic and the trail streaks 5000 km to the
      real launch. (Tibor Zakuczi's track had 25 of these.)
  (b) IMPOSSIBLE JUMP — a GPS teleport away from the last kept fix. The allowance
      scales with the time gap so a legitimate fix after a signal outage survives;
      after `MAX_SKIP_RUN` consecutive over-limit fixes we accept and re-anchor, so a
      track that genuinely moved isn't truncated.

Dropping leading fixes rebases the flight: `track[i][0]` is seconds RELATIVE to launch
and `launch_epoch` is the absolute launch time, so we shift both to keep the absolute
wall-clock (launch_epoch + t) identical — otherwise multi-pilot replay sync drifts.

    python3 clean_tracks.py --db backend/xc3d.db            # dry run (default)
    python3 clean_tracks.py --db backend/xc3d.db --write
"""
import argparse
import json
import math
import sqlite3
import sys

MAX_FIX_SPEED_MS = 50.0   # 180 km/h — far above any paraglider, far below a teleport
MIN_FIX_JUMP_M = 1000.0   # floor so 1 s fixes aren't held to a few metres
MAX_SKIP_RUN = 3          # consecutive over-limit fixes → accept + re-anchor


def is_null_island(lat, lon):
    return abs(lat) < 1e-3 and abs(lon) < 1e-3


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(a)))


def clean(track):
    """-> (cleaned_track, n_dropped). Track rows are [t, lat, lon, gpsAlt, pressAlt]."""
    out = []
    last = None          # (lat, lon, t) of the last KEPT fix
    skipped = 0
    for p in track:
        t, lat, lon = p[0], p[1], p[2]
        if is_null_island(lat, lon):
            continue
        if last is not None:
            dt = max(1.0, t - last[2])
            allowance = max(MIN_FIX_JUMP_M, MAX_FIX_SPEED_MS * dt)
            if haversine_m(last[0], last[1], lat, lon) > allowance:
                skipped += 1
                if skipped < MAX_SKIP_RUN:
                    continue
            skipped = 0
        out.append(list(p))
        last = (lat, lon, t)
    return out, len(track) - len(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--write", action="store_true", help="apply (default is a dry run)")
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        "SELECT id, fingerprint, pilot, track, launch_epoch, launch_lat, launch_lon,"
        " launch_alt, duration FROM flights"
    ).fetchall()

    touched = 0
    for r in rows:
        try:
            track = json.loads(r["track"])
        except Exception:
            print(f"  ! {r['fingerprint'][:12]} unreadable track — skipped", file=sys.stderr)
            continue
        if not track:
            continue
        cleaned, dropped = clean(track)
        if dropped == 0:
            continue
        if len(cleaned) < 2:
            print(f"  ! {r['fingerprint'][:12]} ({r['pilot']}) would drop to <2 pts — skipped")
            continue

        # rebase: keep absolute wall-clock (launch_epoch + t) identical
        shift = cleaned[0][0]
        if shift:
            for p in cleaned:
                p[0] -= shift
        new_epoch = int(r["launch_epoch"] + shift)
        nlat, nlon, nalt = cleaned[0][1], cleaned[0][2], cleaned[0][3]
        new_dur = int(cleaned[-1][0])

        touched += 1
        print(
            f"  {r['fingerprint'][:12]} {r['pilot'][:22]:22s} "
            f"dropped {dropped:4d}/{len(track):6d}  "
            f"launch ({r['launch_lat']:.4f},{r['launch_lon']:.4f})->({nlat:.4f},{nlon:.4f})  "
            f"epoch +{int(shift)}s  dur {r['duration']}->{new_dur}"
        )
        if args.write:
            con.execute(
                "UPDATE flights SET track=?, launch_epoch=?, launch_lat=?, launch_lon=?,"
                " launch_alt=?, duration=? WHERE id=?",
                (json.dumps(cleaned), new_epoch, nlat, nlon, nalt, new_dur, r["id"]),
            )

    if args.write:
        con.commit()
    con.close()
    print(f"\n{touched} flight(s) {'repaired' if args.write else 'would be repaired'} "
          f"of {len(rows)} total")


if __name__ == "__main__":
    main()
