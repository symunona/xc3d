import { createSignal, createEffect, Show, For } from "solid-js";
import ColorPicker from "./ColorPicker";
import { linkFlight } from "../lib/api";
import { distinctColor } from "../lib/colors";
import { getUploads, recordUpload, type UploadRec } from "../lib/uploads";
import type { SessionFlight } from "../lib/types";

// one picked file + the (editable) name & color it will be uploaded under
interface Row { id: number; file: File; name: string; color: string }
let nextRowId = 0;

// Read the pilot name held in an IGC header, client-side, so we can pre-fill it.
// Mirrors the backend parse (backend/igc.go): HFPLT… or any header containing PILOT,
// value after the first ':'. Only the first ~16 KB is read — headers sit at the top.
async function readPilotName(f: File): Promise<string> {
  try {
    const head = await f.slice(0, 16384).text();
    for (const line of head.split(/\r?\n/)) {
      const up = line.toUpperCase();
      if (up.startsWith("HFPLT") || up.includes("PILOT")) {
        const i = line.indexOf(":");
        if (i >= 0) {
          const v = line.slice(i + 1).trim();
          if (v) return v;
        }
      }
    }
  } catch {}
  return "";
}

export default function Upload(props: {
  sessionId: string;
  roomTitle?: string; // optional human-readable room name; else we show the room CODE
  onRenameRoom?: (next: string) => void; // persist the room title (renameSession + live WS)
  name: string;
  color: string;
  takenColors: string[];
  onName: (n: string) => void;
  onColor: (c: string) => void;
  onDone: (added: SessionFlight[]) => void; // re-add (link) path only — instant, one flight
  onUpload: (reqs: { file: File; name: string; color: string }[]) => void; // hand rows to Room
  externalErr?: () => string; // error bounced back from Room (e.g. a blocking batch added nothing)
  compact?: boolean; // shown as overlay inside a room
  onCancel?: () => void; // present when the room already has flights to watch
  initialFiles?: File[]; // files handed in from a full-screen drop on the room
}) {
  const [rows, setRows] = createSignal<Row[]>([]);
  const [openColor, setOpenColor] = createSignal<number | null>(null); // row id whose picker is open
  const [drag, setDrag] = createSignal(false);
  const [err, setErr] = createSignal("");
  const [prev, setPrev] = createSignal<UploadRec[]>(getUploads());
  const [linking, setLinking] = createSignal<string | null>(null);

  // persist each newly-added flight to this browser's cross-session history
  function remember(added: SessionFlight[]) {
    for (const f of added) {
      recordUpload({
        fingerprint: f.fingerprint,
        filename: f.filename,
        name: f.name,
        color: f.color,
        date: f.date,
        duration: f.duration,
        sessionId: props.sessionId,
        ts: Date.now(),
      });
    }
    setPrev(getUploads());
  }

  // re-add a past flight to this room by fingerprint (no file needed)
  async function readd(rec: UploadRec) {
    setErr("");
    setLinking(rec.fingerprint);
    try {
      const added = await linkFlight(props.sessionId, rec.fingerprint, props.name || rec.name, props.color);
      remember(added);
      props.onDone(added);
    } catch (e: any) {
      if (e?.status === 409) setErr("that flight is already in this room");
      else if (e?.status === 404) setErr("that track isn't on the server anymore — re-upload the .igc");
      else setErr(String(e?.message ?? e));
      setLinking(null);
    }
  }

  // add files to the list (append, deduped by name+size), pre-filling each row's
  // name from the pilot held in the file (falling back to the profile name).
  async function pick(list: FileList | File[] | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => /\.igc$/i.test(f.name));
    if (arr.length === 0) return;
    const have = new Set(rows().map((r) => r.file.name + ":" + r.file.size));
    const fresh = arr.filter((f) => !have.has(f.name + ":" + f.size));
    // each new row gets a color distinct from ones already in the room and from
    // the rows staged so far — so a multi-drop spreads across the palette instead
    // of every flight landing on the same hue.
    const used = [...props.takenColors, ...rows().map((r) => r.color)];
    const added: Row[] = [];
    for (const file of fresh) {
      const name = (await readPilotName(file)) || props.name || "";
      const color = distinctColor(name, used);
      used.push(color);
      added.push({ id: nextRowId++, file, name, color });
    }
    setRows((prev) => [...prev, ...added]);
  }

  // consume files handed in by a room-level full-screen drop (reactive: a new
  // array reference each drop). Guard on identity so we don't re-pick the same set.
  let lastInit: File[] | undefined;
  createEffect(() => {
    const f = props.initialFiles;
    if (f && f.length && f !== lastInit) {
      lastInit = f;
      pick(f);
    }
  });

  function setRowName(id: number, name: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, name } : r)));
  }
  function setRowColor(id: number, color: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, color } : r)));
  }
  function removeRow(id: number) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    if (openColor() === id) setOpenColor(null);
  }

  function submit() {
    const rs = rows();
    if (rs.length === 0) { setErr("drop at least one .igc file"); return; }
    setErr("");
    // Hand the staged rows to Room, which owns the (now per-file, sequential) upload — a
    // blocking full-screen progress for a new room, or non-blocking toasts over a live one.
    // Names go AS-IS — blank when blank — so the server can fall back to the pilot parsed
    // from the .igc (its parse is authoritative); forcing a value here used to clobber a
    // good "HFPLTPILOTINCHARGE:…" name with "pilot". Dup / invalid tracks are reported by
    // Room (blocking: bounced back into this panel via externalErr; toasts: as "already added").
    props.onUpload(rs.map((r) => ({ file: r.file, name: r.name.trim(), color: r.color })));
  }

  return (
    <div class="panel p-6 w-full max-w-lg">
      <div class="flex items-start justify-between gap-2 mb-1">
        <div class="min-w-0">
          {/* The welcome heading is the ROOM (its title, else its code) — not the user's
              name. Per-pilot names come from each .igc; the profile name below is only a
              fallback. In-room ("add another flight") we keep the action-titled header. */}
          <Show when={!props.compact} fallback={<h2 class="text-xl font-bold">Add your flight to this room</h2>}>
            {/* The room NAME is editable right here on the welcome screen — commits on
                blur / Enter via onRenameRoom (renameSession + live WS). Empty → the room
                code shows as the placeholder; the code (the real, immutable id) is always
                shown below. */}
            <div class="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Name this room</div>
            <input
              type="text"
              class="text-2xl font-bold w-full bg-transparent outline-none"
              style={{ border: "none", "border-bottom": "1px solid var(--border)", "border-radius": 0, padding: "2px 0" }}
              value={props.roomTitle ?? ""}
              placeholder={`Room ${props.sessionId}`}
              title="Give this room a name (or leave it as the code)"
              onChange={(e) => props.onRenameRoom?.(e.currentTarget.value.trim())}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
            <div class="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>code <span class="font-mono">{props.sessionId}</span></div>
          </Show>
        </div>
        <Show when={props.onCancel}>
          <button class="btn text-sm shrink-0" onClick={() => props.onCancel!()}>
            ✕ back to replay
          </button>
        </Show>
      </div>
      <p class="mb-4 text-sm" style={{ color: "var(--text-dim)" }}>
        {props.compact
          ? "Drop one or more .igc tracklogs — duplicates are detected by fingerprint."
          : "Drop your .igc tracklog(s) to launch the replay. Duplicates are detected by fingerprint."}
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDrag(false); pick(e.dataTransfer?.files ?? null); }}
        class="rounded-xl p-6 text-center mb-4 cursor-pointer"
        style={{
          border: `2px dashed ${drag() ? "var(--accent)" : "var(--border)"}`,
          background: drag() ? "rgba(255,122,47,0.08)" : "transparent",
        }}
        onClick={() => document.getElementById("filepick")!.click()}
      >
        <input
          id="filepick" type="file" accept=".igc" multiple hidden
          onChange={(e) => pick(e.currentTarget.files)}
        />
        <span class="block mb-3" style={{ color: "var(--text-dim)" }}>
          {rows().length > 0 ? "drop more files here" : "drag & drop your tracklogs here"}
        </span>
        {/* explicit picker button — the dashed area alone read as decoration, so give the
            click target a real, accent-outlined button. The whole zone still opens the
            picker (and still accepts drops); this just makes the affordance obvious. */}
        <button
          type="button"
          class="btn text-sm font-semibold"
          style={{ "border-color": "var(--accent)", color: "var(--accent)" }}
          onClick={(e) => { e.stopPropagation(); document.getElementById("filepick")!.click(); }}
        >
          ⭱ Choose .igc files
        </button>
      </div>

      {/* per-file rows: filename + editable name (pre-filled from the held pilot) + remove */}
      <Show when={rows().length > 0}>
        <div class="mb-4 flex flex-col gap-2">
          <div class="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            {rows().length} flight{rows().length > 1 ? "s" : ""} — names auto-filled from each .igc
          </div>
          <For each={rows()}>
            {(r) => (
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-[11px] w-28 shrink-0 truncate" title={r.file.name} style={{ color: "var(--text-dim)" }}>
                    {r.file.name}
                  </span>
                  <input
                    type="text" class="flex-1 min-w-0" value={r.name} placeholder="name (from .igc)"
                    onInput={(e) => setRowName(r.id, e.currentTarget.value)}
                  />
                  <button
                    type="button" class="shrink-0" title="Pick this flight's color"
                    onClick={() => setOpenColor((o) => (o === r.id ? null : r.id))}
                    style={{
                      "background-color": r.color, width: "26px", height: "26px",
                      "border-radius": "8px", cursor: "pointer",
                      outline: openColor() === r.id ? "2px solid var(--text)" : "none",
                      "outline-offset": "2px",
                    }}
                  />
                  <button
                    class="btn text-sm shrink-0 px-2" title="Remove this file"
                    onClick={() => removeRow(r.id)}
                  >
                    ✕
                  </button>
                </div>
                <Show when={openColor() === r.id}>
                  <div class="pl-28">
                    <ColorPicker
                      value={r.color}
                      taken={[...props.takenColors, ...rows().filter((o) => o.id !== r.id).map((o) => o.color)]}
                      onChange={(c) => { setRowColor(r.id, c); setOpenColor(null); }}
                    />
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* NO global name field: pilot names come from the .igc itself (readPilotName pre-fills
          each staged row, and the server's own parse is authoritative). props.name / onName
          still exist as the profile fallback used by the re-add path below — there's just no
          textbox for it any more. Fix a bad name in the per-row input above. */}

      {/* No colour UI until a file is staged — each staged .igc gets its own per-row
          picker above. Re-adds from "previous uploads" below use the saved profile
          colour (props.color) silently. */}

      <Show when={err() || props.externalErr?.()}>
        <div class="mb-3 text-sm" style={{ color: "var(--danger)" }}>{err() || props.externalErr?.()}</div>
      </Show>

      <button class="btn btn-accent w-full text-lg" onClick={submit}>
        {props.compact ? "＋ add flight" : "Launch replay"}
      </button>

      <Show when={prev().length > 0}>
        <div class="mt-6">
          <div class="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>
            Your previous uploads — tap to add to this room
          </div>
          <div class="flex flex-col gap-1.5 max-h-52 overflow-auto">
            <For each={prev()}>
              {(rec) => (
                <button
                  class="btn flex items-center gap-2 text-left"
                  disabled={linking() !== null}
                  onClick={() => readd(rec)}
                  title={rec.fingerprint}
                >
                  <span style={{ "background-color": rec.color, width: "10px", height: "10px", "border-radius": "3px", "flex-shrink": 0 }} />
                  <span class="flex-1 min-w-0 truncate text-sm">
                    {rec.name} · {rec.filename}
                  </span>
                  <span class="text-[11px]" style={{ color: "var(--text-dim)" }}>
                    {rec.date || ""}{" "}
                    {linking() === rec.fingerprint ? "adding…" : "＋"}
                  </span>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
