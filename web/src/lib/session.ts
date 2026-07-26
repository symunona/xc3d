// Identity model:
//  - name + color are a GLOBAL profile (one per browser), restored on every load
//    and across every room, persisted the moment they change.
//  - "have I uploaded here?" is per-room.
import { colorForName } from "./colors";

const RAND_NAMES = [
  "eagle", "kestrel", "condor", "swift", "falcon", "raven",
  "buzzard", "kite", "harrier", "osprey", "vulture", "hawk",
];

export function autoName(): string {
  const n = RAND_NAMES[Math.floor(Math.random() * RAND_NAMES.length)];
  return `${n}-${Math.floor(Math.random() * 900 + 100)}`;
}

export interface Profile {
  name: string;
  color: string;
}

const PROFILE_KEY = "xc3d:profile";
const upKey = (sid: string) => `xc3d:up:${sid}`;

// Load the persisted profile, or mint (and save) a random one on first ever visit.
export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.name && p.color) return p;
    }
  } catch {}
  const name = autoName();
  const p: Profile = { name, color: colorForName(name) };
  saveProfile(p.name, p.color);
  return p;
}

export function saveProfile(name: string, color: string) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, color }));
  } catch {}
}

export function hasUploaded(sid: string): boolean {
  try {
    return localStorage.getItem(upKey(sid)) === "1";
  } catch {
    return false;
  }
}

export function markUploaded(sid: string) {
  try {
    localStorage.setItem(upKey(sid), "1");
  } catch {}
}
