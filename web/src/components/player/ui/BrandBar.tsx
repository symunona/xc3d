import { Show } from "solid-js";
import QrButton from "../../QrButton";

// Home link · QR · "add flight" — the desktop top-left rail and the mobile top bar.
// `compact` (mobile) drops the wordmark + goes icon-only on add-flight so it all fits
// one narrow row. Purely presentational; the add-flight action comes from Room.
export default function BrandBar(props: { onAddFlight?: () => void; hasOwnFlight?: boolean; compact?: boolean }) {
  return (
    <>
      <a
        href="/"
        class="panel px-3 py-2 flex items-center gap-2 shrink-0"
        style={{ "text-decoration": "none" }}
        title="Back to home"
      >
        <span class="text-lg leading-none">🪂</span>
        <Show when={!props.compact}>
          <span class="font-bold" style={{ color: "var(--accent)" }}>XC3D</span>
        </Show>
      </a>
      <QrButton />
      <Show when={props.onAddFlight}>
        <button
          class="btn shrink-0"
          classList={{ "btn-accent": !props.hasOwnFlight }}
          onClick={() => props.onAddFlight!()}
          title="Add your own IGC to this room"
          aria-label="Add your own IGC to this room"
        >
          {/* mobile: the ＋ glyph alone — the top bar has no room for the wording */}
          {props.compact ? "＋" : props.hasOwnFlight ? "＋ add flight" : "＋ add your flight"}
        </button>
      </Show>
    </>
  );
}
