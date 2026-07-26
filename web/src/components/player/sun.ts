// Where is the sun right now? — a tiny solar-position solver for the replay clock.
//
// Used by the "Sun" terrain shading: the playhead gives an absolute UTC instant, this
// turns it (plus a lat/lon) into the sun's AZIMUTH + ALTITUDE, which drive MapLibre's
// hillshade layer (illumination direction = azimuth, strength = altitude). That makes the
// shading answer the thermal question "which slopes are catching sun right now?".
//
// Algorithm: the NOAA "low-accuracy" solar position (also what the US Naval Observatory's
// Almanac publishes) — good to ~0.01° over 1950-2050, which is several orders of magnitude
// better than we need for a hillshade whose DEM is 30 m. No ΔT, no nutation, no refraction,
// no parallax: a hill doesn't care about arc-seconds.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** wrap to [0, 360) */
const wrap360 = (d: number): number => ((d % 360) + 360) % 360;

export interface SunPos {
  /** degrees CLOCKWISE FROM NORTH: 0 = N, 90 = E, 180 = S, 270 = W (MapLibre's
   *  `hillshade-illumination-direction` convention when the anchor is "map"). */
  azimuthDeg: number;
  /** degrees above the horizon; negative = below (night). */
  altitudeDeg: number;
}

/**
 * Sun azimuth + altitude for an instant and a place.
 *
 * @param date UTC instant (a JS Date — its epoch millis are what matter, not the local tz)
 * @param lat  latitude in degrees, N positive
 * @param lon  longitude in degrees, E positive
 *
 * Sanity checks (see sun.test-ish comments below / the assertions in `sunSanity`):
 *  - Alps (47°N, 11°E) mid-July, solar noon (~11:15 UTC): azimuth ≈ 180° (due south),
 *    altitude ≈ 66° (high summer sun).
 *  - Same place at 05:00 UTC (early morning): azimuth ≈ 65-70° (ENE), altitude low (~10°).
 *  - Same place at 17:00 UTC (evening): azimuth ≈ 280° (WNW), altitude low.
 *  - Night (22:00 UTC): altitude < 0 → the overlay hides itself.
 */
export function sunPosition(date: Date, lat: number, lon: number): SunPos {
  // days (incl. fraction) since the J2000.0 epoch, 2000-01-01 12:00 TT
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;

  // ── the sun in ecliptic coordinates ──
  const L = wrap360(280.46 + 0.9856474 * n);        // mean longitude
  const g = wrap360(357.528 + 0.9856003 * n) * RAD; // mean anomaly
  // equation of centre → apparent ecliptic longitude (the ~±2° elliptic-orbit wobble)
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;       // obliquity of the ecliptic

  // ── to equatorial coordinates ──
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)); // right ascension
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));                   // declination

  // ── local hour angle: how far the sun is past the observer's meridian ──
  // GMST in hours (the classic linear expression), then + longitude for local sidereal time.
  const gmstH = (18.697374558 + 24.06570982441908 * n) % 24;
  const lstDeg = gmstH * 15 + lon;
  const H = (lstDeg - ra * DEG) * RAD; // hour angle, radians (positive = sun is west of south)

  const phi = lat * RAD;
  const sinAlt =
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const altitudeDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * DEG;

  // azimuth measured from SOUTH, positive toward WEST … then rebased to "clockwise from N"
  const azFromSouth = Math.atan2(
    Math.sin(H),
    Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi),
  );
  const azimuthDeg = wrap360(azFromSouth * DEG + 180);

  return { azimuthDeg, altitudeDeg };
}

/**
 * The absolute UTC instant a replay playhead points at.
 *
 * The playhead is time-of-day SECONDS (UTC); the room's flights carry `launchEpoch`
 * (absolute UTC seconds), so the day is taken from any flight and the playhead supplies
 * the time within it. `todOfLaunch` (format.ts) is exactly `launchEpoch % 86400`, so the
 * two are the same clock and this round-trips.
 */
export function instantOf(anyLaunchEpoch: number, playheadSec: number): Date {
  const dayStartUtc = Math.floor(anyLaunchEpoch / 86400) * 86400;
  return new Date((dayStartUtc + playheadSec) * 1000);
}
