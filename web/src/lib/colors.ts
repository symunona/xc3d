// 20 distinct player colors — must mirror --p0..--p19 in styles.css.
export const PALETTE = [
  "#ff5252", "#ff9800", "#ffd600", "#a8e000",
  "#46d17a", "#00c9a7", "#26c6da", "#2fb8ff",
  "#5c7cff", "#8e63ff", "#c159ff", "#ff5cc8",
  "#ff6f91", "#b06a4a", "#7fd1ff", "#baff6a",
  "#ff8a3d", "#63ffd6", "#d0d0d0", "#ff3d7f",
];

// Deterministic hash → palette index, so a given name always maps to one color.
export function colorForName(name: string): string {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// Pick a color distinct from ones already taken, seeded from the name.
export function distinctColor(name: string, taken: string[]): string {
  const start = PALETTE.indexOf(colorForName(name));
  for (let i = 0; i < PALETTE.length; i++) {
    const c = PALETTE[(start + i) % PALETTE.length];
    if (!taken.includes(c)) return c;
  }
  return colorForName(name);
}
