import { render } from "solid-js/web";
import { lazy } from "solid-js";
import { Router, Route, Navigate } from "@solidjs/router";
import "./styles.css";
import Home from "./components/Home";

// Room (and everything it drags in — maplibre-gl, deck.gl, the hyps:// relief protocol)
// is code-split into its own chunk, loaded only when you enter a /s/:id room. The landing
// page ships without the ~390 KB map/GL payload, so it paints on a slow connection.
const Room = lazy(() => import("./components/Room"));

render(
  () => (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/s/:id" component={Room} />
      <Route path="*" component={() => <Navigate href="/" />} />
    </Router>
  ),
  document.getElementById("root")!,
);

// NOTE: the static #splash is NOT dropped here. On a shared-room deep link the Room
// chunk (maplibre/deck) is still downloading at this point, so tearing the splash down
// now would flash an empty page. Each route dismisses it once its own content is ready:
// Home immediately (see components/Home.tsx), Room after its chunk mounts (Room.tsx),
// while index.html's splash script shows a real download-progress bar in the meantime.
