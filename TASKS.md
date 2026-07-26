# xc3d — task queue

Working agreement (this project): **serial, one task at a time. Commit directly to `main`
and push. No feature branches** (a shared checkout with a second session's livegaggle work
caused a branch-switch that rolled the tree back mid-task). When the user says "subagent",
**append the item here** rather than spawning parallel agents.

Before any deploy/commit: `git branch --show-current` == `main`, and spot-check a known
change is present (e.g. `grep -c isNullIsland xc3d/backend/igc.go` → 3).
Deploy = `just serve-tracklogs` from `xc3d/`. Heavy 3D / GPU-visual results must be
verified on **xayah** (real GPU), not the VPS swiftshader. Leave `live/livegaggle/**` alone.

Current: web **v0.1.78**, prod = para.tmpx.space (nginx → :8090). main == origin/main.

## Queue (in order)

1. **Sun shade colour selector + deeper black** — DONE 2026-07-23 (a22f80e, v0.1.93).
   Colour picker (Settings › Base; black default + 5 dark tints) drives shadow RGB; slider
   drives alpha; `sunShadeColor` pref. Darker top-end via a 2nd stacked `sun-hillshade-2`
   pass ramped in only above 50% (pixel-identical at ≤50%). xayah: darkest shaded px
   luminance 32→9.3 at 100%.

2. **Welcome / upload screen pass** (`Upload.tsx`) — DONE 2026-07-23 (a8d4f4a, 6139055).
   - Editable room-name input on the welcome (renameSession + WS via onRenameRoom).
   - Generated default name `<Two Words> · YYYY-MM-DD` (`lib/roomName.ts`), set on room
     create in Home.tsx, pre-filled + editable.
   - Removed the global colour selector — no colour UI until the first .igc is staged.
     (Re-adds from "previous uploads" now use the saved profile colour silently.)

3. **Hide-non-visible-tracklogs toggle + hotkey** — DONE 2026-07-23.
   - Hotkey **`s`** (user's call; `a` kept as speed-down). Seek-mode moved off `s` → **`x`**.
   - "Solo visible" = hide every tracklog except pilots **airborne at the playhead**;
     clock-following (landed / pre-launch drop out + return); layers on top of the manual
     hidden set, never mutates it (toggle off restores). Central render predicate
     `renderHidden(key)` = manual-hidden OR (soloVisible && !airborneNow); replaced the
     per-layer `hidden().has()` filters. Control-panel button (👁 solo) under a new "tracks"
     row. GPU-trips `dsig` folds in the airborne set only when solo is on (no idle cost).
   - Also NEW (user): **`w`** = follow-all-visible (jump straight to camera "all" + re-fit,
     releasing single/gaggle lock) + a ⛶ all control-panel button.
   - Also NEW (user): **`<Hotkey>` component** (`ui/Hotkey.tsx`) renders an inline `(k)`
     marker; applied to the control-panel labelled buttons.

4. **Sun v2 — cast shadows (DEM ray-march)** — STAGE 1 DONE 2026-07-23 (`castShadow.ts`).
   Additive `castShadows` flag, default off, Settings › Base under the sun shade slider.
   Does NOT touch the hillshade. Implementation: assemble a VIEWPORT-WIDE heightmap from
   token-free Terrarium DEM tiles (a cast shadow crosses tile borders, so per-tile can't
   work), ray-march every pixel toward the sun (az/alt from the replay clock), drape the
   occlusion mask back as ONE image overlay below the basemap linework. Recompute on
   enable / moveend / sun-minute only (never per frame); parallel tile fetch with an 8 s
   timeout so a stalled DEM tile can't wedge it.
   VERIFIED (VPS render + numeric): coverage 65.6% at alt 5.9° (low sun) vs 0% at alt 56.5°
   (midday) — long shadows low, shrinking toward noon, exactly the acceptance. Visual
   screenshot confirms directional cast shadows draped on terrain.
   NOT done: xayah GPU pixel-verify (VPS swiftshader rendered the demo fine + the mask is
   CPU/deterministic, so numeric coverage was the proof). STAGE 2 (deferred): a per-fragment
   GPU custom layer (sharper + faster than the CPU raster), soft penumbra, a strength slider.

5. **About blurb in the help modal** (`ui/HelpModal.tsx`). — DONE 2026-07-23, Short
   variant chosen: "Built to understand how the XC pilots in my club actually fly, and to
   make real post-flight retrospectives possible. In 3D you can see what a flat track
   hides: where the climb was, when the gaggle split, how the glide worked out." Rendered
   as an "About" section above the version footer in the `?` modal.

6. **Home "Your rooms" list — show room NAME not code.** The recent-rooms list on the
   welcome/home screen (`Home.tsx`) prints the room `id` (code). If the room has a
   human-readable title, show that instead (fall back to the code when unnamed). Persist
   the title into the localStorage room record (`rooms.ts` `RoomRec.name`), set it on room
   load + on live `room_renamed`. — DONE 2026-07-23.

7. **Label declutter / leader-line toggle** — DONE 2026-07-23 (e0a99c0, v0.1.95).
   "Declutter labels" toggle (Settings › Perf, default off): greedy AABB push-apart solver
   (`solveDeclutter` in Player.tsx) spreads overlapping `path-names` tags in screen space via
   per-label getPixelOffset off the world anchor; faint `name-leaders` LineLayer from each
   moved tag → its dot; ~7.5 Hz throttle on play + map move. OFF = byte-identical old behaviour.
   (Scope: pilot name tags only, not the map-annotation labels.)

8. **Display times in LOCAL time zone (not UTC).** All clocks currently render UTC
   (`fmtClock`/`fmtHM` in `player/format.ts`; titles say "(UTC)"): the seek-bar clock,
   start/end, hour delimiters, flag labels, hover tooltips, full-screen HUD clock, etc.
   Show local time instead. OPEN DECISION (asked user): local = the VIEWER's browser zone,
   or the FLIGHT SITE's zone (derived from launch lat/lon — correct for a retrospective when
   the viewer is elsewhere, but needs a tz lookup or a longitude/offset approximation)?
   Whichever: convert consistently everywhere, update the "(UTC)" labels, keep the
   underlying UTC seconds as the source of truth (only the DISPLAY changes).

9. **Sun cast-shadow recompute throttle / debounce** (`castShadow.ts`) — DONE 2026-07-23
   (da15237, v0.1.94). Trailing-edge debounce (350ms, 2s max-wait cap) + in-flight coalescer
   (rerun once with latest sun/viewport); swap was already update-in-place so the old mask
   stays painted until the new one is ready. xayah: 20 rapid changes → 0 during + 1 settle.

10. **Sun v2 stage-2 — GPU cast shadows** (`castShadow.ts`) — DONE 2026-07-23 (d513269,
   v0.1.96). PRIMARY shipped: offscreen WebGL2 R32F heightmap texture + fullscreen-triangle
   fragment shader porting `march()` line-for-line (`marchGpu()`), readPixels → same
   drape-in-place overlay. CPU `march()` kept as graceful fallback (WebGL2 missing / shader
   fail / context loss / `window.xc3dCastForceCpu`). xayah: GPU ~9ms vs CPU ~78ms
   (~8.8×), coverage matches within 1.1%. STRETCH (custom-layer per-frame, no readback, soft
   penumbra) NOT done — deferred.

### UI/UX cleanup batch — queued 2026-07-26 (do in order)

**Decisions locked (2026-07-26):** 18 → new "View" tab, grouped (Tracks/Timeline/Analysis).
16 → document-only mobile scheme (don't build two-tap nav). 15 → remove WORLD thermal-cloud
tab+engine, KEEP+move per-track 🌀 therm. 14 → keep per-room label storage BUT maintain a
global user set that auto-seeds any new/unseen room (seed-on-first-load + merge-on-save).

**Commit A DONE + deployed v0.1.98 + VERIFIED on xayah GPU (2026-07-26):** tasks 12, 17, 19.
(GPU headless testing was blocked; cracked it — see [[xayah-headless-gpu-webgl-recipe]]:
Xvfb + google-chrome --use-angle=vulkan + Vulkan-loader/mesa upgrades; agent-browser
--session to dodge the livegaggle :9333 collision.)

11. [DONE v0.1.99] **Settings → hamburger on desktop too; slide-in panel from the right.** Currently the
    settings panel is desktop-only-something-else; make the hamburger the entry on ALL
    breakpoints. Panel slides in from the right edge. KEEP the tabs, but restyle them to look
    more tab-like (proper tab affordance, not plain buttons).

12. [DONE v0.1.98] **New defaults: sun ON, cast-shadows ON.** Flip the initial prefs so a fresh
    viewer/room opens with both enabled.

13. [DONE v0.1.99] **Move LABEL edit-mode toggle INTO the settings tab.** Remove the external (outside)
    button and the checkmark-style variant. Keep a single button inside the tab. Show its
    hotkey on the button (via the existing `<Hotkey>` component, see task 3).

14. [DONE v0.1.99] **Universal per-user label handling.** Labels persist automatically to localStorage and
    auto-reload for the user on EVERY map — per USER, not per ROOM. (Today they're per-room.)

15. [DONE v0.1.99] **Remove the "show thermals" tab + its functionality entirely.**

16. [DONE v0.1.100] **Always-visible HELP (?) button at the top of the slide-in menu.** Keep the modal.
    Build a LARGE keyboard-layout visual with the functions labelled on the keys. Add a new
    tab in the help modal for MOBILE / touch view; auto-default which tab opens based on the
    device (touch → mobile tab, else keyboard tab). Mobile tab: show the two-tap navigation,
    with arrows pointing to the controller items.

17. [DONE v0.1.98] **Control panel (bottom-right): remove the angles line.** Not needed.

18. [DONE v0.1.99] **Move tracks/seek, intervals, flags, alt, thermals controls into the side menu.**
    Propose an organization pattern for grouping them (report the proposed layout before
    building).

19. [DONE v0.1.98] **Fix `w`/`s` semantics.** They're not what's assumed. `w` should SHOW, `s` should HIDE
    — toggling the checkmarks based on which pilots are NOT visible on the CURRENT screen
    (judged by the actual current playhead position/dot, NOT any part of the whole line).

20. [DONE v0.1.101] **Label declutter rework (supersedes task 7's greedy solver).**
    - No collision → label sits directly ABOVE the pilot dot, no leader line.
    - Collision → arrange the colliders: 2 collide → 2 to the sides; 3 → 2 sides + 1 up;
      4 → 2 sides + up & down; more → revert to sides, break lines.
    - Leader lines always horizontal/vertical, or a two-component (L-shaped) path.
    - Add MOMENTUM so tags don't blink around fast: remember last position, keep pushing
      slowly, and if they were colliding last frame keep the chosen alignment for a few sec.
    - Under "declutter labels" give checkmark options for the different modes so the user can
      tune the params and pick the right behaviour.

## Deferred / noted (not queued unless asked)

- **Terrain/shadow re-attach hole**: the pre-existing 3D-terrain + ground-shadow re-attach
  only listens to `style.load`, so it can silently drop on a basemap *diff*-patch (same
  bug the sun layer had to work around by re-attaching on `styledata`). The sun layer is
  fixed; the terrain/shadow one is not.
- Throwaway test rooms on prod (`7qvrwerl`, `grjbmszl`, etc.) — harmless; no delete-session
  endpoint exists. Add one if we want cleanup.
- Re-add-from-"previous uploads" list has no per-row colour swatch (see task 2 note).
