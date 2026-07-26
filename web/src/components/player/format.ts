// Pure formatting + colour helpers used across the Player.
import type { SessionFlight } from "../../lib/types";

// The playback clock is TIME OF DAY (seconds since UTC midnight), NOT time since
// each pilot's own launch. That way pilots line up at the real moment they were
// together — and flights from different days can be compared on one clock.
export const todOfLaunch = (f: SessionFlight) => ((f.launchEpoch % 86400) + 86400) % 86400;

// wall-clock HH:MM:SS
export function fmtClock(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600) % 24, m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// military HH:MM (24h), wrapped to a day
export function fmtHM(s: number): string {
  s = (((Math.floor(s) % 86400) + 86400) % 86400);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
