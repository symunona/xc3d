import { createSignal, Show, onMount } from "solid-js";
import { Portal } from "solid-js/web";

export default function QrButton() {
  const [open, setOpen] = createSignal(false);
  const [dataUrl, setDataUrl] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const url = () => location.href;

  async function show() {
    // qrcode (~9 KB gz) is only needed on this click — load it lazily so it stays
    // out of the room bundle. render at high res; the <img> scales down crisply.
    const { default: QRCode } = await import("qrcode");
    setDataUrl(await QRCode.toDataURL(url(), { width: 1024, margin: 1, color: { dark: "#0b0f14", light: "#ffffff" } }));
    setOpen(true);
  }

  function copy() {
    navigator.clipboard?.writeText(url());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <button class="btn" title="Share this room" onClick={show}>▦ QR</button>
      <Show when={open()}>
        {/* Portal to <body> + a very high z so the QR sits ABOVE every panel/menu,
            and the whole card fits any screen (QR sized to leave room for the chrome). */}
        <Portal>
          <div
            class="fixed inset-0 flex items-center justify-center p-3"
            style={{ background: "rgba(0,0,0,0.82)", "z-index": "9999" }}
            onClick={() => setOpen(false)}
          >
            <div
              class="panel p-4 text-center flex flex-col items-center"
              style={{ "max-width": "96vw", "max-height": "96vh", width: "auto", overflow: "auto" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 class="text-lg font-bold mb-1">Join this flight room</h3>
              <p class="text-sm mb-3" style={{ color: "var(--text-dim)" }}>
                Scan to add your own IGC — it appears live for everyone here.
              </p>
              {/* square, sized to the smaller axis but leaving headroom for the header
                  + url row + buttons so nothing is ever pushed off-screen */}
              <img
                src={dataUrl()} alt="room QR"
                style={{
                  width: "min(80vw, 62vh)",
                  height: "min(80vw, 62vh)",
                  "border-radius": "12px",
                  "image-rendering": "pixelated",
                }}
              />
              <div class="mt-3 flex gap-2 items-center w-full" style={{ "max-width": "min(80vw, 62vh)" }}>
                <input type="text" class="flex-1 min-w-0 text-xs" readOnly value={url()} />
                <button class="btn" onClick={copy}>{copied() ? "copied ✓" : "copy"}</button>
              </div>
              <button class="btn mt-3 w-full" style={{ "max-width": "min(80vw, 62vh)" }} onClick={() => setOpen(false)}>close</button>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
}
