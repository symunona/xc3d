import { useNavigate } from "@solidjs/router";
import { createSignal, Show, For, onMount } from "solid-js";
import { createSession, renameSession } from "../lib/api";
import { getRooms, forgetRoom, relTime, type RoomRec } from "../lib/rooms";
import { dismissSplash } from "../lib/splash";
import { randomRoomName } from "../lib/roomName";
import { setPendingFiles } from "../lib/pendingUpload";

export default function Home() {
  const nav = useNavigate();
  onMount(dismissSplash); // landing painted — drop the boot splash
  const [busy, setBusy] = createSignal(false);
  const [drag, setDrag] = createSignal(false);
  const [rooms, setRooms] = createSignal<RoomRec[]>(getRooms());

  function remove(r: RoomRec, e: MouseEvent) {
    e.stopPropagation();
    const label = r.name || r.id;
    const ok = confirm(
      `Remove "${label}" from your rooms?\n\n` +
        `This only forgets it on this device — the room and its tracklogs stay ` +
        `on the server and can be reopened with the room link.`,
    );
    if (!ok) return;
    forgetRoom(r.id);
    setRooms(getRooms());
  }

  // Create a room and go to it. If IGC files are given, stash them so the new room opens
  // straight into the upload panel with them pre-filled (room creation is automatic — you
  // just drop your flight).
  async function create(files?: File[]) {
    if (busy()) return;
    setBusy(true);
    try {
      if (files && files.length) setPendingFiles(files);
      const id = await createSession();
      renameSession(id, randomRoomName()).catch(() => {}); // friendly default name, best-effort
      nav(`/s/${id}`);
    } catch (e) {
      setBusy(false);
      alert("could not create room");
    }
  }

  const igcOnly = (list: FileList | null): File[] =>
    list ? [...list].filter((f) => /\.igc$/i.test(f.name)) : [];

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    const files = igcOnly(e.dataTransfer?.files ?? null);
    if (files.length) create(files);
  }

  return (
    <div class="h-full flex items-center justify-center p-4">
      <div class="panel p-6 sm:p-8 w-full max-w-md text-center">
        <div class="text-4xl mb-2">🪂</div>
        <h1 class="text-2xl font-bold mb-1" style={{ color: "var(--accent)" }}>XC3D</h1>
        <p class="mb-5 text-sm" style={{ color: "var(--text-dim)" }}>
          3D flight analysis for XC pilots. Drop your IGC, share your flights, learn from
          each other, fly safe!
        </p>

        {/* drop / pick zone — dropping a flight AUTO-creates a room and opens its upload */}
        <label
          class="block w-full rounded-xl cursor-pointer transition-colors"
          style={{
            border: `2px dashed ${drag() ? "var(--accent)" : "var(--border)"}`,
            background: drag() ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
            padding: "1.5rem 1rem",
          }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <input
            type="file" accept=".igc" multiple style={{ display: "none" }}
            onChange={(e) => { const f = igcOnly(e.currentTarget.files); e.currentTarget.value = ""; if (f.length) create(f); }}
          />
          <div class="text-sm font-semibold" style={{ color: drag() ? "var(--accent)" : "var(--text)" }}>
            {busy() ? "creating room…" : "Drop your .igc here — or click to pick"}
          </div>
          <div class="text-[11px] mt-1" style={{ color: "var(--text-dim)" }}>
            a room is made automatically · share the QR so others can add theirs
          </div>
        </label>

        {/* always-available demo room (seeded server-side) */}
        <button
          class="btn w-full mt-2 flex items-center justify-center gap-2"
          onClick={() => nav("/s/demo")}
          title="Watch a ready-made replay: 8 real XC flights, two gaggles, in the French Alps"
        >
          ▶ Watch the demo replay
          <span class="text-xs" style={{ color: "var(--text-dim)" }}>8 flights · Alps</span>
        </button>

        {/* keep the empty-room path (share the QR before you have a flight to add) */}
        <button
          class="mt-3 text-xs underline"
          style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
          disabled={busy()}
          onClick={() => create()}
        >
          or open an empty room to share
        </button>

        <Show when={rooms().length > 0}>
          <div class="mt-6 text-left">
            <div class="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>
              Your rooms
            </div>
            <div class="flex flex-col gap-1.5 max-h-64 overflow-auto">
              <For each={rooms()}>
                {(r) => (
                  <div class="group relative">
                    <button
                      class="btn flex items-center gap-2 text-left w-full pr-9"
                      onClick={() => nav(`/s/${r.id}`)}
                    >
                      <span class="text-base">🪂</span>
                      <span class="flex-1 min-w-0">
                        <span class="text-sm truncate" classList={{ "font-mono": !r.name }}>
                          {r.name || r.id}
                        </span>
                        <span class="text-[11px] ml-2" style={{ color: "var(--text-dim)" }}>
                          {r.name ? `${r.id} · ` : ""}{r.flights} flight{r.flights === 1 ? "" : "s"} · {relTime(r.ts)}
                        </span>
                      </span>
                    </button>
                    {/* remove-from-history: hover-reveal on desktop, always shown on touch */}
                    <button
                      class="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-sm leading-none opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 hover:bg-[var(--panel-2,rgba(255,255,255,0.1))]"
                      style={{ color: "var(--text-dim)" }}
                      title="Remove from your rooms (keeps tracklogs on the server)"
                      aria-label={`Remove ${r.name || r.id} from your rooms`}
                      onClick={(e) => remove(r, e)}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
