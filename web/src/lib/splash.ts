// Dismiss the static boot splash defined in index.html.
//
// The splash is intentionally left up by index.tsx after mount so that a shared-room
// deep link keeps showing the download-progress bar while the lazy Room chunk
// (maplibre/deck.gl, ~390 KB) streams in. Whichever route actually paints calls this
// once its content is on screen. Idempotent — safe to call more than once.
export function dismissSplash(): void {
  const el = document.getElementById("splash");
  if (!el) return;
  // let index.html's progress interval notice it's gone and stop
  el.remove();
}
