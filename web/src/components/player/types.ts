// Shared value/state types for the Player and its primitives.

export type FollowMode = "all" | "single" | "free" | "gaggle";
export type FlightState = "pre" | "air" | "landed";

export interface Stat {
  key: string; name: string; color: string;
  alt: number; agl: number | null; distKm: number; triKm: number;
  gaggleId: number; state: FlightState;
}

export interface Live {
  key: string; color: [number, number, number]; name: string;
  lat: number; lon: number; alt: number; prevLat: number; prevLon: number;
  state: FlightState;
}

// per-frame render breakdown shown in the debug HUD (`f`)
export interface Dbg { jsMs: number; layers: number; trailPts: number; cloudPts: number; markers: number; }

// airborne pilots partitioned into gaggles (2+) / solo / everyone on the ground
export interface Groups {
  gaggles: { id: number; members: Stat[] }[];
  solo: Stat[];
  grounded: Stat[];
}
