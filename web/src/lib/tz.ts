// Flight-site timezone: map a launch lat/lon to the local wall-clock, DST-correct, so the
// replay clock reads in the timezone the flights are actually in (not UTC).
import tzlookup from "tz-lookup";

// IANA zone for a launch lat/lon, e.g. "Europe/Paris". null if the lookup fails.
export function siteTz(lat: number, lon: number): string | null {
  try {
    return tzlookup(lat, lon);
  } catch {
    return null;
  }
}

// UTC offset in SECONDS east of UTC for `tz` at `epochSec` (handles DST for that date).
// e.g. Europe/Paris in July → +7200 (CEST). Uses the toLocaleString round-trip trick.
export function tzOffsetSec(tz: string, epochSec: number): number {
  const d = new Date(epochSec * 1000);
  const asUTC = new Date(d.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const asTz = new Date(d.toLocaleString("en-US", { timeZone: tz })).getTime();
  return Math.round((asTz - asUTC) / 1000);
}

// Short zone label at that instant, e.g. "GMT+2". Best-effort; "local" on failure.
export function tzLabel(tz: string, epochSec: number): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date(epochSec * 1000));
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "local";
  } catch {
    return "local";
  }
}
