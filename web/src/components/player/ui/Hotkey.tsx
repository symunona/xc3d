// Small inline keyboard-hint marker, e.g. (s) — shown next to buttons/labels so the
// hotkey is discoverable on-screen without opening the `?` cheat-sheet. Purely decorative
// (aria-hidden); the real binding lives in the Player keyboard handler.
export default function Hotkey(props: { k: string; class?: string }) {
  return (
    <span
      class={"ml-1 font-mono text-[10px] leading-none opacity-70 " + (props.class ?? "")}
      style={{ color: "var(--text-dim)" }}
      aria-hidden="true"
    >
      ({props.k})
    </span>
  );
}
