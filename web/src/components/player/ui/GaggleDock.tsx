import { For, Show, createSignal, type Setter } from "solid-js";
import type { Stat, FollowMode, Groups } from "../types";

// one stats row. Hovering (desktop) or pressing (touch) a row shows that pilot's
// WHOLE track on the map, ignoring the playhead + trail trimming.
function Row(p: {
  s: Stat; dim?: boolean;
  isHidden: (key: string) => boolean;
  toggleHidden: (key: string) => void;
  setHoverKey: Setter<string | null>;
  onSelect: (key: string) => void;
  onRemove: (key: string) => void;
  selected: boolean;
  // inline rename (state lives in the Player so the 4 Hz list refresh can't drop it)
  editKey: () => string | null;
  editDraft: () => string;
  setEditDraft: (v: string) => void;
  beginRename: (key: string, name: string) => void;
  commitRename: () => void;
  cancelRename: () => void;
}) {
  const editing = () => p.editKey() === p.s.key;
  return (
    <div
      class="flex items-center gap-2 py-1 px-1 rounded"
      style={{
        opacity: p.dim ? "0.45" : p.isHidden(p.s.key) ? "0.5" : "1", cursor: "pointer",
        background: p.selected ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "transparent",
      }}
      title="Click to show this pilot's thermals/glides; hold to reveal their full track"
      onPointerEnter={() => p.setHoverKey(p.s.key)}
      onPointerDown={() => { p.setHoverKey(p.s.key); p.onSelect(p.s.key); }}
      onPointerLeave={() => p.setHoverKey((k) => (k === p.s.key ? null : k))}
    >
      <input
        type="checkbox" checked={!p.isHidden(p.s.key)}
        onChange={() => p.toggleHidden(p.s.key)}
        title={p.isHidden(p.s.key) ? "Show this trail" : "Hide this trail"}
        style={{ "flex-shrink": 0, cursor: "pointer", "accent-color": p.s.color }}
      />
      <span style={{ "background-color": p.s.color, width: "10px", height: "10px", "border-radius": "3px", "flex-shrink": 0 }} />
      <div class="flex-1 min-w-0">
        <div class="text-sm truncate flex items-center gap-1">
          {/* click the name to rename in place; Enter/blur commits, Escape cancels */}
          <Show
            when={editing()}
            fallback={
              <span
                style={{ cursor: "text" }}
                title="Click to rename this pilot"
                onClick={(e) => { e.stopPropagation(); p.beginRename(p.s.key, p.s.name); }}
              >
                {p.s.name}
              </span>
            }
          >
            <input
              class="text-sm px-1 rounded min-w-0 w-28"
              style={{ background: "var(--bg-panel-solid)", color: "var(--text)", border: "1px solid var(--accent)" }}
              value={p.editDraft()}
              onInput={(e) => p.setEditDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); p.commitRename(); }
                else if (e.key === "Escape") { e.preventDefault(); p.cancelRename(); }
              }}
              onBlur={() => p.commitRename()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              ref={(el) => requestAnimationFrame(() => { el.focus(); el.select(); })}
            />
          </Show>
          <Show when={p.s.state === "pre"}>
            <span class="text-[10px] px-1 rounded" style={{ background: "var(--bg-panel-solid)", color: "var(--text-dim)" }}>
              not launched
            </span>
          </Show>
          <Show when={p.s.state === "landed"}>
            <span class="text-[10px] px-1 rounded" style={{ background: "var(--bg-panel-solid)", color: "var(--text-dim)" }}>
              landed
            </span>
          </Show>
        </div>
        <div class="text-[11px]" style={{ color: "var(--text-dim)" }}>
          {Math.round(p.s.alt)}m
          <Show when={p.s.agl != null}> · {Math.round(p.s.agl!)}m agl</Show>
          {" · "}▲{p.s.distKm.toFixed(1)}km · △{p.s.triKm.toFixed(1)}km
        </div>
      </div>
      {/* remove this flight from the room (the .igc stays on the server). stopPropagation
          so the click doesn't also select/hover the row. */}
      <button
        class="text-sm leading-none px-1 rounded"
        style={{ "flex-shrink": 0, color: "var(--text-dim)", cursor: "pointer", background: "transparent" }}
        title={`Remove ${p.s.name} from this room`}
        aria-label={`Remove ${p.s.name} from this room`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Remove ${p.s.name} from this room?\nThe tracklog stays on the server and can be re-added.`)) p.onRemove(p.s.key);
        }}
      >
        ✕
      </button>
    </div>
  );
}

// Left-edge gaggle dock: a folder ear that toggles the pilot list, which slides in from
// the strip. Collapsed = just the pilots' colours (3px). The list groups airborne
// pilots into their gaggles (flying together), then solo, then everyone on the ground.
export default function GaggleDock(props: {
  isMobile: () => boolean;
  showGaggles: () => boolean;
  setShowGaggles: Setter<boolean>;
  groups: () => Groups;
  stats: () => Stat[];
  airborneCount: () => number;
  followGaggle: () => number | null;
  followMode: () => FollowMode;
  focusGaggle: (id: number) => void;
  isHidden: (key: string) => boolean;
  toggleHidden: (key: string) => void;
  // bulk trail-visibility ops (header) — operate on ALL pilots at once
  showAllTrails: () => void;
  hideAllTrails: () => void;
  invertTrails: () => void;
  // push the current name filter into map visibility (matching shown, rest hidden)
  applyNameFilter: (query: string) => void;
  // on-map name bubbles: second line with altitude + climb rate
  showAltVario: () => boolean;
  setShowAltVario: Setter<boolean>;
  setHoverKey: Setter<string | null>;
  onSelectPilot: (key: string) => void;
  onRemove: (key: string) => void;
  selectedKey: () => string | null;
  // inline pilot rename — threaded straight through to each Row
  editKey: () => string | null;
  editDraft: () => string;
  setEditDraft: (v: string) => void;
  beginRename: (key: string, name: string) => void;
  commitRename: () => void;
  cancelRename: () => void;
}) {
  // shared rename props, spread onto every Row so the three lists stay in lockstep
  const renameProps = () => ({
    editKey: props.editKey, editDraft: props.editDraft, setEditDraft: props.setEditDraft,
    beginRename: props.beginRename, commitRename: props.commitRename, cancelRename: props.cancelRename,
  });
  // ── quick name filter ──
  // typing narrows the LIST rows live (case-insensitive substring); the "Apply" button
  // pushes the same selection onto the MAP (matching pilots visible, the rest hidden).
  const [filter, setFilter] = createSignal("");
  const q = () => filter().trim().toLowerCase();
  const matches = (s: Stat) => { const f = q(); return !f || s.name.toLowerCase().includes(f); };
  // groups with non-matching pilots dropped, so the visible rows narrow as you type. The
  // header counts still reflect the true (unfiltered) state — only the row lists narrow.
  const fGroups = (): Groups => {
    const g = props.groups();
    if (!q()) return g;
    return {
      gaggles: g.gaggles.map((x) => ({ ...x, members: x.members.filter(matches) })).filter((x) => x.members.length > 0),
      solo: g.solo.filter(matches),
      grounded: g.grounded.filter(matches),
    };
  };
  const noMatches = () => q() !== "" && fGroups().gaggles.length === 0 && fGroups().solo.length === 0 && fGroups().grounded.length === 0;

  // The pilots' colours, airborne first — shown as the collapsed dock's 3px strip.
  const stripPilots = () => {
    const g = props.groups();
    const air = [...g.gaggles.flatMap((x) => x.members), ...g.solo];
    return [
      ...air.map((s) => ({ color: s.color, air: true })),
      ...g.grounded.map((s) => ({ color: s.color, air: false })),
    ];
  };

  const list = (
    <>
      <div class="panel px-3 py-2 flex flex-col gap-2">
        {/* title row: live counts + collapse */}
        <div class="flex items-center gap-2">
          <span class="text-xs uppercase tracking-wide flex-1" style={{ color: "var(--text-dim)" }}>
            {props.airborneCount()} flying
            <Show when={props.groups().gaggles.length > 0}>
              {" · "}{props.groups().gaggles.length} gaggle{props.groups().gaggles.length === 1 ? "" : "s"}
            </Show>
          </span>
          <button
            class="btn text-[11px] py-0.5 px-1.5"
            onClick={() => props.setShowGaggles(false)}
            title="Collapse the pilot list"
          >
            ◂
          </button>
        </div>

        {/* trail visibility: flip every pilot's trail at once */}
        <div class="flex items-center gap-1">
          <span class="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Trails</span>
          <button class="btn text-[11px] py-0.5 px-1.5" onClick={() => props.showAllTrails()} title="Show every pilot's trail">All</button>
          <button class="btn text-[11px] py-0.5 px-1.5" onClick={() => props.hideAllTrails()} title="Hide every pilot's trail">None</button>
          <button class="btn text-[11px] py-0.5 px-1.5" onClick={() => props.invertTrails()} title="Flip each pilot's trail visibility">Invert</button>
        </div>

        {/* quick name filter: type to narrow the list; Apply hides non-matching tracklogs */}
        <div class="flex items-center gap-1">
          <input
            type="text" class="flex-1 min-w-0 text-sm px-1.5 py-0.5 rounded"
            style={{ background: "var(--bg-panel-solid)", color: "var(--text)", border: "1px solid var(--border)" }}
            placeholder="Filter pilots…"
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); props.applyNameFilter(filter()); } }}
          />
          <Show when={filter() !== ""}>
            <button
              class="btn text-[11px] py-0.5 px-1.5"
              onClick={() => { setFilter(""); }}
              title="Clear the filter text"
            >
              ✕
            </button>
          </Show>
          <button
            class="btn text-[11px] py-0.5 px-1.5"
            onClick={() => props.applyNameFilter(filter())}
            title="Hide every pilot whose name doesn't match (empty = show all)"
          >
            Apply
          </button>
        </div>

        {/* on-map labels: add altitude + climb rate under each pilot's name bubble */}
        <button
          class="btn text-[11px] py-0.5 px-1.5 self-start"
          classList={{ "btn-accent": props.showAltVario() }}
          onClick={() => props.setShowAltVario((v) => !v)}
          title="Show each pilot's current altitude + climb rate under their name on the map"
        >
          ⛰ alt + vario
        </button>
      </div>

      <Show when={props.stats().length === 0}>
        <div class="panel p-3 text-sm" style={{ color: "var(--text-dim)" }}>no pilots yet</div>
      </Show>
      <Show when={noMatches()}>
        <div class="panel p-3 text-sm" style={{ color: "var(--text-dim)" }}>no pilots match "{filter().trim()}"</div>
      </Show>

      {/* each gaggle = its own card, tinted with the gaggle's dominant colour */}
      <For each={fGroups().gaggles}>
        {(g, i) => (
          <div
            class="panel p-3"
            style={{
              "border-left": `3px solid ${g.members[0].color}`,
              background: "var(--bg-panel)",
              outline: props.followGaggle() === g.id && props.followMode() === "gaggle" ? "1px solid var(--accent)" : "none",
            }}
          >
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-xs font-bold uppercase tracking-wide" style={{ color: g.members[0].color }}>
                Gaggle {i() + 1}
              </span>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px]" style={{ color: "var(--text-dim)" }}>{g.members.length} together</span>
                <button
                  class="btn text-[11px] py-0.5 px-1.5"
                  classList={{ "btn-accent": props.followGaggle() === g.id && props.followMode() === "gaggle" }}
                  onClick={() => props.focusGaggle(g.id)}
                  title="Fly the camera to this gaggle and follow it (keys: h / g)"
                >
                  ⦿ follow
                </button>
              </div>
            </div>
            <div class="flex flex-col divide-y" style={{ "border-color": "var(--border)" }}>
              <For each={g.members}>
                {(s) => <Row s={s} isHidden={props.isHidden} toggleHidden={props.toggleHidden} setHoverKey={props.setHoverKey} onSelect={props.onSelectPilot} onRemove={props.onRemove} selected={props.selectedKey() === s.key} {...renameProps()} />}
              </For>
            </div>
          </div>
        )}
      </For>

      <Show when={fGroups().solo.length > 0}>
        <div class="panel p-3">
          <div class="text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--text-dim)" }}>Flying solo</div>
          <div class="flex flex-col divide-y" style={{ "border-color": "var(--border)" }}>
            <For each={fGroups().solo}>
              {(s) => <Row s={s} isHidden={props.isHidden} toggleHidden={props.toggleHidden} setHoverKey={props.setHoverKey} onSelect={props.onSelectPilot} onRemove={props.onRemove} selected={props.selectedKey() === s.key} {...renameProps()} />}
            </For>
          </div>
        </div>
      </Show>

      <Show when={fGroups().grounded.length > 0}>
        <div class="panel p-3">
          <div class="text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--text-dim)" }}>On the ground</div>
          <div class="flex flex-col divide-y" style={{ "border-color": "var(--border)" }}>
            <For each={fGroups().grounded}>
              {(s) => <Row s={s} dim isHidden={props.isHidden} toggleHidden={props.toggleHidden} setHoverKey={props.setHoverKey} onSelect={props.onSelectPilot} onRemove={props.onRemove} selected={props.selectedKey() === s.key} {...renameProps()} />}
            </For>
          </div>
        </div>
      </Show>
    </>
  );

  return (
    <div
      class="absolute left-0 z-10 flex items-stretch"
      style={{
        // clear the mobile top action bar, and the gaggle-chips row when it's shown
        top: props.isMobile() ? (props.groups().gaggles.length > 0 ? "6.75rem" : "4rem") : "4.75rem",
        "max-height": "calc(100vh - 9rem)",
      }}
    >
      {/* folder ear — the persistent left-edge tab that toggles the pilot list. The
          chevron flips (▸ closed / ◂ open); below it, each pilot's colour as a strip. */}
      <button
        class="panel flex flex-col items-center gap-1 py-2 px-1"
        style={{
          "border-radius": "0 12px 12px 0", cursor: "pointer", "min-height": "3rem",
          "box-shadow": "2px 0 6px rgba(0,0,0,0.25)",
          outline: props.showGaggles() ? "1px solid var(--accent)" : "none",
        }}
        onClick={() => props.setShowGaggles((v) => !v)}
        title={props.showGaggles() ? "Collapse pilot list" : "Expand pilot list"}
        aria-label={props.showGaggles() ? "Collapse pilot list" : "Expand pilot list"}
      >
        <span class="text-[11px] leading-none font-bold"
              style={{ color: props.showGaggles() ? "var(--accent)" : "var(--text-dim)" }}>
          {props.showGaggles() ? "◂" : "▸"}
        </span>
        <span class="text-base leading-none">🪂</span>
        <Show when={stripPilots().length > 0}>
          <div class="h-px w-3 my-0.5" style={{ background: "var(--border)" }} />
          <For each={stripPilots().slice(0, 40)}>
            {(p) => (
              <span
                style={{
                  width: "3px", "min-height": "8px", flex: "1",
                  background: p.color, opacity: p.air ? "1" : "0.4", "border-radius": "2px",
                }}
              />
            )}
          </For>
        </Show>
      </button>

      {/* sliding list — width animates open/closed so it glides out from the strip */}
      <div
        style={{
          overflow: "hidden",
          transition: "width .25s ease, opacity .2s ease",
          width: props.showGaggles() ? (props.isMobile() ? "min(19rem, calc(100vw - 2.5rem))" : "19rem") : "0",
          opacity: props.showGaggles() ? "1" : "0",
        }}
      >
        <div
          class="overflow-auto flex flex-col gap-2 pl-2 pr-1"
          style={{ width: props.isMobile() ? "min(19rem, calc(100vw - 2.5rem))" : "19rem", "max-height": "calc(100vh - 9rem)" }}
        >
          {list}
        </div>
      </div>
    </div>
  );
}
