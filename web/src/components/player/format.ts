// Pure formatting + colour helpers used across the Player.
import { createSignal } from "solid-js";
import type { SessionFlight } from "../../lib/types";

// The underlying playback clock is TIME OF DAY in UTC (seconds since UTC midnight), so
// pilots line up at the real moment they were together and flights from different days
// compare on one clock. DISPLAY is shifted into the flight-site's local timezone by this
// room-wide offset (seconds east of UTC), set once the flights load (lib/tz + Player).
// fmtClock/fmtHM read the signal, so every clock shows local with no prop threading — and
// being a signal, callers re-render when it resolves.
export const [clockOffset, setClockOffset] = createSignal(0);
export const [clockLabel, setClockLabel] = createSignal("UTC");

export const todOfLaunch = (f: SessionFlight) => ((f.launchEpoch % 86400) + 86400) % 86400;

const wrapDay = (s: number) => (((Math.floor(s) % 86400) + 86400) % 86400);
const pad = (n: number) => String(n).padStart(2, "0");

// wall-clock HH:MM:SS in the flight-site's local time
export function fmtClock(s: number): string {
  s = wrapDay(s + clockOffset());
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// military HH:MM (24h) in the flight-site's local time
export function fmtHM(s: number): string {
  s = wrapDay(s + clockOffset());
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
}

// hour-of-day (0–23) at the local clock, for the seek-bar hour ticks
export function localHour(s: number): number {
  return Math.floor(wrapDay(s + clockOffset()) / 3600);
}

export function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// darkened variant of a colour — used for ground shadow tint + vertical drop-line
export const dim = (c: [number, number, number]): [number, number, number] => [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6];

// rgb triple → "#rrggbb", for MapLibre data-driven paint (the draped shadow layer)
export const toHex = (c: [number, number, number]): string =>
  "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
