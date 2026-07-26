// Light season / local-time helpers for the thermal overlay.
//
// Split out of `thermals.ts` on purpose: Player needs these tiny pure functions
// (and the ThermalRanges shape) at render time to compute the follow-day filter,
// but the rest of thermals.ts drags in proj4 + deck.gl PointCloudLayer + the COPC
// reader. Keeping the helpers here lets Player import them statically while the
// heavy ThermalCloud is dynamic-import()ed only when "Show thermals" is on.

export interface ThermalRanges {
  climb: [number, number]; // vertical speed m/s
  minute: [number, number]; // minute-in-day, local
  doy: [number, number]; // season-rebased day-of-year
  sampleFrac: number; // 0..1 random subsample
}

// calendar day-of-year (1 Jan = day 0) for a UTC epoch, then rebased so 1 Mar = 0,
// matching the point cloud's PointSourceId convention. Wraps to [0,365].
export function seasonDoy(utcSec: number): number {
  const d = new Date(utcSec * 1000);
  const y = d.getUTCFullYear();
  const jan1 = Date.UTC(y, 0, 1);
  const calDoy = Math.floor((Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - jan1) / 86400000);
  // days from 1 Mar of the season the date falls in (Jan/Feb belong to the prev season)
  const mar1ThisYear = Math.floor((Date.UTC(y, 2, 1) - jan1) / 86400000); // 59 or 60
  let rebased = calDoy - mar1ThisYear;
  if (rebased < 0) rebased += 365; // Jan/Feb -> tail of the season
  return ((rebased % 365) + 365) % 365;
}

// The cloud stores minute-in-day in LOCAL CIVIL time (paraglider climbs peak ~14-16h
// local — a summer-DST civil clock, not solar). The xc3d playback clock is UTC
// seconds-of-day, so follow-day converts UTC -> local civil with this offset.
//
// We can't ship a full timezone DB, so we approximate the zone from longitude
// (round(lon/15) hours) plus a Northern-hemisphere summer DST hour. This is correct for
// most of the cloud's coverage (Central/Eastern Europe incl. Hungary/Austria/Alps) and
// for the user's home region; it is off by ~1h for countries that sit politically ahead
// of their solar zone (France, Spain). Follow-day is a fuzzy overlay, not a precise join —
// turn it off for the manual time slider.
export function civilOffsetMin(lon: number, dateUtcSec: number): number {
  const mon = new Date(dateUtcSec * 1000).getUTCMonth(); // 0..11
  const dst = mon >= 2 && mon <= 9 ? 1 : 0; // ~Mar–Oct European summer time
  return (Math.round(lon / 15) + dst) * 60;
}

// tod-seconds (UTC, 0..86400) + offset -> local minute-of-day, wrapped to [0,1440)
export function localMinuteOfDay(todSec: number, offsetMin: number): number {
  const m = todSec / 60 + offsetMin;
  return ((m % 1440) + 1440) % 1440;
}
