import { useParams } from "@solidjs/router";
import { createSignal, createMemo, onMount, onCleanup, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { getSessionMeta, getTrack, roomWS, removeFlight, renameFlight, renameSession, uploadFlight } from "../lib/api";
import { loadProfile, saveProfile, hasUploaded, markUploaded } from "../lib/session";
import { recordRoom } from "../lib/rooms";
import { takePendingFiles } from "../lib/pendingUpload";
import { recordUpload } from "../lib/uploads";
import type { SessionFlight, UploadJob } from "../lib/types";
import { registerHeightmapProtocol } from "../lib/heightmap";
import { dismissSplash } from "../lib/splash";
import { profStart, profMark } from "../lib/profile";
import LoadScreen, { overallFraction } from "./LoadScreen";
import Upload from "./Upload";
import UploadProgress from "./UploadProgress";
import UploadToasts from "./UploadToasts";
import Player from "./player/Player";

// A file the user asked to add — collected by the Upload panel, uploaded by Room so BOTH
// the blocking new-room screen and the non-blocking toasts share one per-file code path.
interface UploadReq { file: File; name: string; color: string }

// Why a room failed to load, in the user's terms. Three genuinely different stories:
//  · `.status` 404  → the room really is gone (or was never there).
//  · no `.status`   → fetch REJECTED, so we never got an answer at all: offline, DNS,
//                     timeout, server down. Nothing is wrong with the room — retry.
//  · other `.status`→ the server answered, badly. Name the code so it's reportable.
// (Everything used to collapse into "Room not found. It may have expired.", which lied
// to anyone who merely walked into a tunnel.) navigator.onLine only sharpens the wording
// of the network case — it's never the thing that decides the case, since a "yes" from
// it means "there's a link", not "the link goes anywhere".
function loadErrorMessage(e: any): string {
  const status = e?.status;
  if (status === 404) return "Room not found. It may have expired.";
  if (status) return `Server error (${status}). Try again in a moment.`;
  return navigator.onLine === false
    ? "You're offline — reconnect and hit Reload."
    : "Can't reach the server — check your connection and hit Reload.";
}

// This module is the lazy Room chunk. Registering the hyps:// relief protocol here (a
// maplibre global side-effect, idempotent) means it's ready by the time Player builds
// the map, without pulling maplibre into the landing-page bundle.
registerHeightmapProtocol();

export default function Room() {
  const params = useParams();
  const sid = params.id;
  // Anchor the load profiler at the earliest room code, then drop the boot splash.
  profStart();
  // Room chunk finished downloading + mounted → drop the boot splash / progress bar.
  onMount(dismissSplash);

  const [flights, setFlights] = createStore<SessionFlight[]>([]);
  // the room's optional human-readable title (the `sid` CODE stays the immutable identity);
  // seeded from the loaded session JSON, kept live via the `room_renamed` WS message below.
  const [title, setTitle] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal("");
  // room-load progress: stage 0 = fetching each flight's track (count %), 1 = tracks in.
  // Each track is a separate immutable-cached request, so dlLoaded/dlTotal are flight COUNTS
  // (loaded / total), not bytes — a reload serves them from cache and races to 100%.
  const [loadStage, setLoadStage] = createSignal(0);
  const [dlLoaded, setDlLoaded] = createSignal(0);
  const [dlTotal, setDlTotal] = createSignal(0);
  // name + color come from the global profile and are restored on every load
  const profile = loadProfile();
  const [name, setNameSig] = createSignal(profile.name);
  const [color, setColorSig] = createSignal(profile.color);
  const [uploaded, setUploaded] = createSignal(hasUploaded(sid));
  const [showUpload, setShowUpload] = createSignal(false);
  // full-screen drop: highlight while a file is dragged over the window, and files
  // dropped anywhere on the page get handed to the Upload panel.
  const [dropActive, setDropActive] = createSignal(false);
  const [dropped, setDropped] = createSignal<File[]>([]);
  // ── upload orchestration (owned here so the two presentations share one code path) ──
  // blocking full-screen progress, used ONLY for a new/empty room's first upload:
  const [blockJobs, setBlockJobs] = createStore<UploadJob[]>([]);
  const [blocking, setBlocking] = createSignal(false);
  // set when a blocking batch added NOTHING — bounced back into the Upload panel as its error
  const [uploadErr, setUploadErr] = createSignal("");
  // non-blocking status chips, used when adding to a room that's already replaying:
  const [toasts, setToasts] = createStore<UploadJob[]>([]);
  let jobSeq = 0;

  // persist to the global profile the moment either changes
  const setName = (n: string) => { setNameSig(n); saveProfile(n, color()); };
  const setColor = (c: string) => { setColorSig(c); saveProfile(name(), c); };

  const takenColors = createMemo(() => flights.map((f) => f.color));

  function addFlight(f: SessionFlight) {
    if (flights.some((x) => x.fingerprint === f.fingerprint && x.name === f.name)) return;
    setFlights(flights.length, f);
  }
  // Drop a flight from the room's list (a fingerprint is unique within a room). Used both
  // by the X button's own removal and by the `flight_removed` broadcast from other clients.
  function removeFlightLocal(fp: string) {
    setFlights(flights.filter((x) => x.fingerprint !== fp));
  }
  // The X button asks the server to unlink the flight (keeps the .igc), then drops it
  // locally. Other clients update via the `flight_removed` WS message below.
  async function onRemoveFlight(fp: string) {
    try {
      await removeFlight(sid, fp);
    } catch (e) {
      console.error("[xc3d] remove flight failed:", e);
      return; // leave it in the list — the removal didn't take
    }
    removeFlightLocal(fp);
  }
  // Rename a flight in the room's list (by fingerprint — unique within a room). Used by
  // both our own inline rename and the `flight_renamed` broadcast from other clients.
  function renameFlightLocal(fp: string, name: string) {
    const i = flights.findIndex((x) => x.fingerprint === fp);
    if (i >= 0) setFlights(i, "name", name);
  }
  // The pilot-list inline rename asks the server to persist the new name, then the server
  // echoes `flight_renamed` (below) to every client — including us. We update locally
  // up-front so it feels instant, and roll back if the server rejects it.
  async function onRenameFlight(fp: string, name: string) {
    const prev = flights.find((x) => x.fingerprint === fp)?.name;
    renameFlightLocal(fp, name); // optimistic
    try {
      await renameFlight(sid, fp, name);
    } catch (e) {
      console.error("[xc3d] rename flight failed:", e);
      if (prev !== undefined) renameFlightLocal(fp, prev); // revert — the rename didn't take
    }
  }
  // The Settings "Room name" input asks the server to persist the new title, then the
  // server echoes `room_renamed` (below) to every client — including us. We update the
  // signal up-front so it feels instant, and roll back if the server rejects it. Mirrors
  // onRenameFlight; the room CODE (`sid`) is never touched — this is a display label only.
  async function onRenameRoom(next: string) {
    const prev = title();
    setTitle(next); // optimistic
    try {
      await renameSession(sid, next);
    } catch (e) {
      console.error("[xc3d] rename room failed:", e);
      setTitle(prev); // revert — the rename didn't take
    }
  }

  // Trap the mobile back gesture. A left-edge swipe (and the Android system back)
  // otherwise navigates the SPA back to the landing page, yanking you out of the
  // immersive player mid-replay. Push a sentinel history entry and re-push it on
  // every popstate, so a back gesture is absorbed and you stay in the room. The
  // 🪂 logo (a real "/" link) is the deliberate way out. Touch devices only —
  // desktop back keeps working normally.
  onMount(() => {
    if (!matchMedia("(pointer: coarse)").matches) return;
    history.pushState(null, "", location.href);
    const onPop = () => history.pushState(null, "", location.href);
    window.addEventListener("popstate", onPop);
    onCleanup(() => window.removeEventListener("popstate", onPop));
  });

  // Files dropped on the LANDING page auto-created this room; take them now so the upload
  // panel opens pre-filled (mustUpload is already true for a fresh empty room).
  onMount(() => {
    const pf = takePendingFiles();
    if (pf.length) setDropped(pf);
  });

  onMount(async () => {
    try {
      // 1) tiny metadata payload (no tracks) → title + the flight list.
      const meta = await getSessionMeta(sid);
      setTitle(meta.title ?? "");
      const metaFlights = meta.flights ?? [];
      profMark("meta", metaFlights.length + " flights");
      setDlTotal(metaFlights.length);
      setDlLoaded(0);

      // 2) fetch each flight's track by fingerprint, LIMITED concurrency so we don't fire
      //    dozens of parallel requests. Cached fingerprints resolve from the browser's HTTP
      //    cache instantly (immutable), so a reload — or a load after someone adds ONE new
      //    flight — only truly downloads the new tracks. Assemble in original order.
      const full: SessionFlight[] = new Array(metaFlights.length);
      let done = 0;
      let next = 0;
      let ok = 0; // tracks that actually landed
      let lastErr: any; // last per-track failure, kept to classify a total wipeout
      const CONC = 6;
      const worker = async () => {
        for (;;) {
          const i = next++;
          if (i >= metaFlights.length) return;
          const mf = metaFlights[i];
          try {
            full[i] = { ...mf, track: await getTrack(mf.fingerprint) };
            ok++;
          } catch (e) {
            console.error("[xc3d] track fetch failed:", mf.fingerprint, e);
            lastErr = e;
          }
          setDlLoaded(++done);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(CONC, metaFlights.length) }, worker),
      );
      // A track or two failing stays tolerated — we replay whatever arrived. But if the
      // metadata came through and then NOT ONE track did, the connection almost certainly
      // died mid-load, and dropping into an empty player would report a perfectly full
      // room as empty. Fail the load instead (retryable). Re-throwing the last track error
      // keeps its classification: no `.status` → "can't reach the server", 404 on every
      // single track → the room's data really is gone, which is what "expired" means.
      if (metaFlights.length > 0 && ok === 0) throw lastErr ?? new Error("no tracks loaded");
      profMark("tracks");
      setLoadStage(1); // all tracks in → hand off to the WebGL boot stages
      setFlights(full.filter(Boolean)); // drop any that failed to fetch
      setLoaded(true);
      recordRoom(sid, metaFlights.length, title()); // remember this room (+ its title) for the home screen
    } catch (e: any) {
      console.error("[xc3d] room load failed:", e);
      setError(loadErrorMessage(e)); // 404 vs offline vs server error — see above
    }
    const ws = roomWS(sid, (m) => {
      if (m.type === "flight_added") addFlight(m.flight);
      if (m.type === "flight_removed") removeFlightLocal(m.fingerprint);
      if (m.type === "flight_renamed") renameFlightLocal(m.fingerprint, m.name);
      if (m.type === "room_renamed") { setTitle(m.title ?? ""); recordRoom(sid, flights.length, m.title ?? ""); }
    });
    onCleanup(() => ws.close());

    // ── window-level drag & drop: drop an .igc anywhere on the page ──────────
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    let depth = 0; // dragenter/leave fire per element; count to know when we truly left
    const onEnter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDropActive(true); };
    const onOver = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); };
    const onLeave = (e: DragEvent) => { if (!hasFiles(e)) return; depth--; if (depth <= 0) { depth = 0; setDropActive(false); } };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0; setDropActive(false);
      const arr = Array.from(e.dataTransfer?.files ?? []).filter((f) => /\.igc$/i.test(f.name));
      if (!arr.length) return;
      setDropped(arr); // new array ref each drop → Upload's effect re-picks
      setShowUpload(true);
    };
    // any drop clears the overlay — even onto the Upload panel, whose own onDrop
    // stopPropagation()s and would otherwise swallow the window drop, leaving depth
    // stuck > 0 and the hover overlay glued on. Capture phase runs before that.
    const onDropReset = () => { depth = 0; setDropActive(false); };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDropReset, true);
    window.addEventListener("drop", onDrop);
    onCleanup(() => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDropReset, true);
      window.removeEventListener("drop", onDrop);
    });
  });

  function onUploaded(added: SessionFlight[]) {
    added.forEach(addFlight);
    setUploaded(true);
    markUploaded(sid);
    saveProfile(name(), color());
    setShowUpload(false); // back to the player
  }

  // Upload ONE file, driving its UploadJob through the phases via `patch`. Records it in
  // this browser's cross-session history and returns the linked flight (or null when the
  // server dropped it as a dup / invalid .igc, or on error). Does NOT add to the scene —
  // the caller decides when (immediately for a live room, all-at-once for a new room).
  async function uploadOne(req: UploadReq, patch: (u: Partial<UploadJob>) => void): Promise<SessionFlight | null> {
    try {
      const added = await uploadFlight(sid, req.file, req.name, req.color, (frac) => {
        // frac>=1 means the bytes are all sent and we're awaiting the server = "processing"
        patch(frac >= 1 ? { phase: "processing", frac: 1 } : { phase: "uploading", frac });
      });
      if (added.length) {
        const f = added[0];
        recordUpload({
          fingerprint: f.fingerprint, filename: f.filename, name: f.name, color: f.color,
          date: f.date, duration: f.duration, sessionId: sid, ts: Date.now(),
        });
        patch({ phase: "done", frac: 1 });
        return f;
      }
      patch({ phase: "skipped", frac: 1, message: "already in this room (or not a valid .igc)" });
      return null;
    } catch (e: any) {
      patch({ phase: "error", frac: 1, message: String(e?.message ?? e) });
      return null;
    }
  }

  // NEW / empty room → BLOCKING screen: upload each file sequentially behind a full-screen
  // progress that extends LoadScreen's look, then drop into the player. If nothing linked,
  // bounce back into the Upload panel with the "already added / not valid" message.
  async function runBlocking(reqs: UploadReq[]) {
    setUploadErr("");
    setBlockJobs(reqs.map((r) => ({
      id: jobSeq++, name: r.name || r.file.name, color: r.color, filename: r.file.name,
      phase: "pending" as const, frac: 0,
    })));
    setBlocking(true);
    const added: SessionFlight[] = [];
    for (let i = 0; i < reqs.length; i++) {
      const f = await uploadOne(reqs[i], (u) => setBlockJobs(i, u));
      if (f) added.push(f);
    }
    setBlocking(false);
    if (added.length === 0) {
      setUploadErr(reqs.length === 1
        ? "that track is already in this room (or isn't a valid .igc)"
        : "nothing new added — those tracks are already in this room (or aren't valid .igc)");
      return;
    }
    // add them all at once so the player mounts once, right as the screen clears
    onUploaded(added);
  }

  // EXISTING room → NON-BLOCKING toasts: the panel already closed; each file reports its
  // progress in a chip over the running player, is added to the scene the moment it links,
  // and its chip auto-dismisses a few seconds after it settles.
  async function runToasts(reqs: UploadReq[]) {
    const ids = reqs.map((r) => {
      const id = jobSeq++;
      setToasts(toasts.length, {
        id, name: r.name || r.file.name, color: r.color, filename: r.file.name,
        phase: "pending" as const, frac: 0,
      });
      return id;
    });
    for (let i = 0; i < reqs.length; i++) {
      const id = ids[i];
      const at = () => toasts.findIndex((t) => t.id === id);
      const f = await uploadOne(reqs[i], (u) => { const k = at(); if (k >= 0) setToasts(k, u); });
      if (f) { addFlight(f); setUploaded(true); markUploaded(sid); saveProfile(name(), color()); }
      // auto-dismiss this chip a few seconds after it settles
      const id2 = id;
      setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id2)), 3500);
    }
  }

  // Entry point handed to the Upload panel: it collects the rows, we own the upload.
  function onUpload(reqs: UploadReq[]) {
    if (reqs.length === 0) return;
    if (mustUpload()) {
      runBlocking(reqs); // new/empty room
    } else {
      setShowUpload(false); // let the player keep running; report via toasts
      runToasts(reqs);
    }
  }

  // You can always just WATCH a room. The upload screen only takes over when the
  // room is empty (nothing to watch yet) or when you explicitly ask to add a flight.
  const mustUpload = () => flights.length === 0;
  const uploadOpen = () => showUpload() || mustUpload();

  return (
    <Show
      when={loaded()}
      fallback={
        <div class="relative h-full w-full">
          <LoadScreen
            activeStage={loadStage}
            fraction={() => overallFraction(loadStage(), dlTotal() ? dlLoaded() / dlTotal() : 0)}
            detail={() => (loadStage() === 0 && dlTotal() ? `${dlLoaded()} / ${dlTotal()} flights` : null)}
            error={() => error() || null}
            onReload={() => location.reload()}
          />
        </div>
      }
    >
      {/* the player is always mounted once there are flights, so opening the upload
          panel doesn't tear down / reload the map */}
      <Show when={flights.length > 0}>
        <Player
          flights={() => flights}
          sessionId={sid}
          roomTitle={title}
          selfName={name()}
          hasOwnFlight={uploaded()}
          onAddFlight={() => setShowUpload(true)}
          onRemoveFlight={onRemoveFlight}
          onRenameFlight={onRenameFlight}
          onRenameRoom={onRenameRoom}
        />
      </Show>

      <Show when={uploadOpen()}>
        {/* scroll-safe centering: `min-h-full` + a flex child centers the panel when it
            fits and scrolls from the TOP (not the clipped middle) when it's taller than
            the viewport — the classic flex-center + overflow trap the old wrapper hit. */}
        <div
          class="fixed inset-0 z-30 overflow-y-auto p-4"
          style={{ background: mustUpload() ? "var(--bg)" : "rgba(0,0,0,0.75)" }}
          onClick={() => { if (!mustUpload()) setShowUpload(false); }}
        >
          <div class="min-h-full flex items-center justify-center">
            <div onClick={(e) => e.stopPropagation()} class="w-full max-w-lg">
              <Upload
                sessionId={sid}
                roomTitle={title()}
                onRenameRoom={onRenameRoom}
                name={name()}
                color={color()}
                takenColors={takenColors()}
                onName={setName}
                onColor={setColor}
                onDone={onUploaded}
                onUpload={onUpload}
                externalErr={() => uploadErr()}
                compact={flights.length > 0}
                onCancel={mustUpload() ? undefined : () => setShowUpload(false)}
                initialFiles={dropped()}
              />
            </div>
          </div>
        </div>
      </Show>

      {/* blocking new-room upload progress — covers everything until the flights land */}
      <Show when={blocking()}>
        <UploadProgress jobs={() => blockJobs} />
      </Show>

      {/* non-blocking status chips for adds to a room that's already replaying */}
      <Show when={toasts.length > 0}>
        <UploadToasts toasts={() => toasts} />
      </Show>

      {/* full-screen drop overlay — shown while a file is dragged over the page.
          pointer-events:none so it never eats the drag events (window handles them). */}
      <Show when={dropActive()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: "rgba(0,0,0,0.6)", "pointer-events": "none" }}
        >
          <div
            class="rounded-2xl flex flex-col items-center justify-center gap-3 text-center"
            style={{
              border: "3px dashed var(--accent)",
              background: "rgba(255,122,47,0.10)",
              width: "100%", height: "100%",
            }}
          >
            <span style={{ "font-size": "3rem" }}>🪂</span>
            <span class="text-2xl font-bold">Drop your .igc here</span>
            <span class="text-sm" style={{ color: "var(--text-dim)" }}>
              one or more tracklogs — release to add them to this room
            </span>
          </div>
        </div>
      </Show>
    </Show>
  );
}
