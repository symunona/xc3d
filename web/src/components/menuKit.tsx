// Shared building blocks for the settings menu (SettingsMenu): a toggle row,
// a labelled slider, a min/max range pair, a section heading, and the fixed-popover
// dropdown shell that escapes the overflow-auto rail.
import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";

/** one toggle row: label + dim cost hint, clickable across its whole width */
export function ToggleRow(props: {
  label: string;
  hint?: string;
  title?: string;
  value: () => boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      title={props.title ?? props.hint ?? props.label}
      onClick={() => props.onChange(!props.value())}
      class="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-lg"
      style={{ background: "transparent", border: "1px solid transparent", color: "var(--text)", cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span
        aria-hidden="true"
        class="flex items-center justify-center text-[10px] font-bold"
        style={{
          width: "14px", height: "14px", "margin-top": "2px", "flex-shrink": 0, "border-radius": "4px",
          border: `1px solid ${props.value() ? "var(--accent)" : "var(--border)"}`,
          background: props.value() ? "var(--accent)" : "transparent", color: "#10151b",
        }}
      >
        {props.value() ? "✓" : ""}
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm leading-tight">{props.label}</span>
        <Show when={props.hint}>
          <span class="block text-[10px] leading-tight mt-0.5" style={{ color: "var(--text-dim)" }}>{props.hint}</span>
        </Show>
      </span>
    </button>
  );
}

/** a labelled single-line text input; commits on Enter or blur (Escape reverts).
 *  `value` seeds the field; the parent persists via `onCommit`. Used for the room name. */
export function TextRow(props: {
  label: string; hint?: string; placeholder?: string;
  value: () => string; onCommit: (v: string) => void;
}) {
  let inp!: HTMLInputElement;
  const commit = () => props.onCommit(inp.value.trim());
  return (
    <div class="px-2 py-1.5">
      <div class="flex items-center justify-between text-[10px]" style={{ color: "var(--text-dim)" }}>
        <span>{props.label}</span>
        <Show when={props.hint}><span>{props.hint}</span></Show>
      </div>
      <input
        ref={inp}
        type="text"
        class="w-full text-sm"
        style={{ "margin-top": "3px" }}
        placeholder={props.placeholder}
        value={props.value()}
        onChange={commit} // fires on blur / Enter
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); inp.blur(); } // blur → onChange commits
          else if (e.key === "Escape") { inp.value = props.value(); inp.blur(); } // revert
        }}
      />
    </div>
  );
}

export function SectionHead(props: { children: any }) {
  return (
    <div class="text-[10px] font-bold uppercase tracking-wider px-2 pt-1 pb-1" style={{ color: "var(--text-dim)" }}>
      {props.children}
    </div>
  );
}

/** a single labelled slider */
export function SliderRow(props: {
  label: string; min: number; max: number; step: number;
  value: () => number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div class="px-2 py-1.5">
      <div class="flex items-center justify-between text-[10px]" style={{ color: "var(--text-dim)" }}>
        <span>{props.label}</span>
        <span class="tabular-nums font-bold" style={{ color: "var(--accent)" }}>{props.fmt(props.value())}</span>
      </div>
      <input
        type="range" min={props.min} max={props.max} step={props.step} value={props.value()}
        class="w-full" style={{ "accent-color": "var(--accent)", "margin-top": "2px" }}
        onInput={(e) => props.onChange(+e.currentTarget.value)}
      />
    </div>
  );
}

/** a labelled min/max pair of range sliders (deck filterRange is just [lo,hi]) */
export function RangeRow(props: {
  label: string; min: number; max: number; step: number;
  lo: () => number; hi: () => number; onLo: (v: number) => void; onHi: (v: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <div class="px-2 py-1.5">
      <div class="flex items-center justify-between text-[10px]" style={{ color: "var(--text-dim)" }}>
        <span>{props.label}</span>
        <span class="tabular-nums font-bold" style={{ color: "var(--accent)" }}>
          {props.fmt(props.lo())}–{props.fmt(props.hi())}
        </span>
      </div>
      <input
        type="range" min={props.min} max={props.max} step={props.step} value={props.lo()}
        class="w-full" style={{ "accent-color": "var(--accent)", "margin-top": "2px" }}
        onInput={(e) => props.onLo(Math.min(+e.currentTarget.value, props.hi()))}
      />
      <input
        type="range" min={props.min} max={props.max} step={props.step} value={props.hi()}
        class="w-full" style={{ "accent-color": "var(--accent)" }}
        onInput={(e) => props.onHi(Math.max(+e.currentTarget.value, props.lo()))}
      />
    </div>
  );
}

/** two-state segmented control (e.g. "All time" ↔ "Follow day-time window") */
export function Segmented(props: {
  a: string; b: string; aHint?: string; bHint?: string;
  value: () => boolean; // true = option A active
  onChange: (aActive: boolean) => void;
}) {
  const btn = (active: boolean, label: string, hint: string | undefined, on: () => void) => (
    <button
      type="button" title={hint} onClick={on}
      class="flex-1 text-xs px-2 py-1 rounded-md"
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#10151b" : "var(--text)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        cursor: "pointer", "font-weight": active ? 700 : 400,
      }}
    >
      {label}
    </button>
  );
  return (
    <div class="flex gap-1 px-2 py-1.5">
      {btn(props.value(), props.a, props.aHint, () => props.onChange(true))}
      {btn(!props.value(), props.b, props.bHint, () => props.onChange(false))}
    </div>
  );
}

/** A dropdown button whose panel is portalled to <body> as a fixed popover, so the
 *  overflow-auto rail can't clip it. Closes on outside-click / Escape. */
export function Dropdown(props: {
  label: string;
  active?: () => boolean; // tint the button (e.g. overlay enabled)
  title?: string;
  children: any;
}) {
  const [open, setOpen] = createSignal(false);
  const [pos, setPos] = createSignal({ top: 0, right: 8 });
  let root!: HTMLDivElement;
  let btn!: HTMLButtonElement;
  let panelEl: HTMLDivElement | undefined;

  const toggle = () => {
    const willOpen = !open();
    if (willOpen && btn) {
      const r = btn.getBoundingClientRect();
      setPos({ top: Math.round(r.bottom + 8), right: Math.round(Math.max(8, window.innerWidth - r.right)) });
    }
    setOpen(willOpen);
  };
  const onDocClick = (e: MouseEvent) => {
    if (!open()) return;
    const t = e.target as Node;
    if (!root.contains(t) && !(panelEl && panelEl.contains(t))) setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
  onMount(() => { document.addEventListener("click", onDocClick); document.addEventListener("keydown", onKey); });
  onCleanup(() => { document.removeEventListener("click", onDocClick); document.removeEventListener("keydown", onKey); });

  return (
    <div ref={root} class="relative">
      <button
        ref={btn} class="btn" classList={{ "btn-accent": open() || !!props.active?.() }}
        title={props.title ?? props.label} onClick={toggle}
      >
        {props.label}
      </button>
      <Show when={open()}>
        <Portal>
          <div
            ref={panelEl}
            class="panel p-2 flex flex-col gap-1 overflow-auto"
            style={{ position: "fixed", top: `${pos().top}px`, right: `${pos().right}px`, width: "240px", "max-height": "70vh", "z-index": 60 }}
          >
            {props.children}
          </div>
        </Portal>
      </Show>
    </div>
  );
}
