import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "topo" | "outdoor" | "satellite" | "satellite-hd" | "plain";

export interface Basemap {
  id: BasemapId;
  label: string;
  /** true = only available when a MapTiler token is configured */
  needsToken?: boolean;
  style: any;
  /** one-liner shown under the label in the menu */
  hint?: string;
}

// ── style specs ───────────────────────────────────────────────────────
// Every entry is a COMPLETE MapLibre v8 style: swapping basemap = map.setStyle(spec).

/** token-free OpenTopoMap raster — the app default (mirrors thermals-webapp) */
const TOPO: StyleSpecification = {
  version: 8,
  sources: {
    topo: {
      type: "raster",
      tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 17,
      attribution: "© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors",
    },
  },
  layers: [{ id: "topo", type: "raster", source: "topo" }],
};

/** token-free Esri World Imagery. NOTE the tile template is {z}/{y}/{x} — NOT z/x/y. */
const SATELLITE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

/**
 * MapTiler "Outdoor" — the Windy-style terrain basemap: hill-shading + elevation
 * contour lines (in metres) + marked trails, exactly the outdoor/topo look Windy
 * uses for its terrain map. It's a hosted VECTOR style, so we hand map.setStyle the
 * style.json URL (setStyle takes a URL or a spec). Needs the same MapTiler token as
 * the terrain-rgb DEM source; attribution rides along in the style. See maptiler.com.
 */
const outdoor = (token: string): string =>
  `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${token}`;

/** MapTiler satellite raster — needs the same token as the terrain-rgb source */
const satelliteHd = (token: string): StyleSpecification => ({
  version: 8,
  sources: {
    maptiler: {
      type: "raster",
      tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${token}`],
      tileSize: 256,
      maxzoom: 20,
      attribution: "© MapTiler © OpenStreetMap contributors",
    },
  },
  layers: [{ id: "maptiler", type: "raster", source: "maptiler" }],
});

/**
 * Client-side hypsometric relief: elevation-tinted terrain + hillshade + contour
 * lines, all drawn in-browser from the free Terrarium DEM via the `hyps://`
 * custom protocol (see lib/heightmap.ts). No server, no token. A neutral
 * background sits underneath so ocean / no-data tiles read cleanly.
 */
const PLAIN: StyleSpecification = {
  version: 8,
  sources: {
    hyps: {
      type: "raster",
      tiles: ["hyps://{z}/{x}/{y}"],
      tileSize: 256,
      maxzoom: 15,
      attribution: "Elevation: Mapzen / AWS Terrain Tiles",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#0b0f14" } },
    { id: "hyps", type: "raster", source: "hyps" },
  ],
};

/** The basemaps offered right now. `satellite-hd` appears only when a token exists. */
export function basemaps(maptilerToken?: string): Basemap[] {
  const list: Basemap[] = [
    { id: "topo", label: "Topo", style: TOPO, hint: "OpenTopoMap — contours + relief" },
    { id: "satellite", label: "Satellite", style: SATELLITE, hint: "Esri World Imagery" },
  ];
  if (maptilerToken) {
    // Windy-style outdoor terrain map (hill-shading + contour lines). Splice it right
    // after Topo so the two "contour" bases sit together in the picker.
    list.splice(1, 0, {
      id: "outdoor",
      label: "Outdoor (MapTiler)",
      needsToken: true,
      style: outdoor(maptilerToken),
      hint: "hill-shading + contour lines — Windy-style terrain",
    });
    list.push({
      id: "satellite-hd",
      label: "Satellite HD (MapTiler)",
      needsToken: true,
      style: satelliteHd(maptilerToken),
      hint: "sharper, zooms deeper — uses your token quota",
    });
  }
  list.push({
    id: "plain",
    label: "Relief",
    style: PLAIN,
    hint: "elevation-tinted terrain + contours (offline-drawn)",
  });
  return list;
}

/** Style spec for one id. Falls back to Topo (and to Esri if HD is asked for tokenless). */
export function basemapStyle(id: BasemapId, maptilerToken?: string): any {
  switch (id) {
    case "outdoor":
      return maptilerToken ? outdoor(maptilerToken) : TOPO; // tokenless → free OpenTopoMap contours
    case "satellite":
      return SATELLITE;
    case "satellite-hd":
      return maptilerToken ? satelliteHd(maptilerToken) : SATELLITE;
    case "plain":
      return PLAIN;
    case "topo":
    default:
      return TOPO;
  }
}
