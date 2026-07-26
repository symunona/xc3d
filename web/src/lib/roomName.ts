// A friendly generated default room name — two flying-flavoured words + today's date,
// e.g. "Soaring Frogs · 2026-07-23". Applied to a freshly created room so it isn't just a
// random code; fully editable on the welcome screen (Upload.tsx) and in Settings.

const ADJ = [
  "Flying", "Soaring", "Thermalling", "Gliding", "Drifting",
  "Climbing", "Wheeling", "Spiralling", "Ridging", "Coring",
];
const NOUN = [
  "Monkeys", "Frogs", "Eagles", "Buzzards", "Storks",
  "Ravens", "Falcons", "Swifts", "Kites", "Condors",
];

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// Local calendar date as YYYY-MM-DD (the user names rooms date-first, e.g. "2026-07-21 CB").
function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function randomRoomName(): string {
  return `${pick(ADJ)} ${pick(NOUN)} · ${todayISO()}`;
}
