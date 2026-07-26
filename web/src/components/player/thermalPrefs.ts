// Thermal-overlay settings persist across sessions (localStorage).

export const THERMAL_LS_KEY = "xc3d.thermals.v1";

export interface ThermalPrefs {
  on: boolean;
  followDay: boolean; // true = follow day-time window, false = all time
  climb: [number, number];
  sample: number;
  size: number;
  opacity: number;
  budget: number;   // render point budget — max points pushed to the layer (near-dense, far-sparse)
  doyBand: number;   // follow-day season half-window, ± days (default 21 = 3 weeks)
  todWindow: number; // follow-day time-of-day half-window, ± minutes (default 30)
}

export const THERMAL_DEFAULTS: ThermalPrefs = {
  on: false, followDay: true, climb: [-5, 5], sample: 100, size: 40, opacity: 0.55,
  budget: 400000, doyBand: 21, todWindow: 30,
};

export function loadThermalPrefs(): ThermalPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(THERMAL_LS_KEY) || "{}");
    return {
      on: !!p.on,
      followDay: p.followDay !== false, // default on
      climb: Array.isArray(p.climb) && p.climb.length === 2 ? [+p.climb[0], +p.climb[1]] : [-5, 5],
      sample: Number.isFinite(p.sample) ? p.sample : 100,
      size: Number.isFinite(p.size) ? p.size : 40,
      opacity: Number.isFinite(p.opacity) ? p.opacity : 0.55,
      budget: Number.isFinite(p.budget) ? p.budget : 400000,
      doyBand: Number.isFinite(p.doyBand) ? p.doyBand : 21,
      todWindow: Number.isFinite(p.todWindow) ? p.todWindow : 30,
    };
  } catch {
    return { ...THERMAL_DEFAULTS };
  }
}
