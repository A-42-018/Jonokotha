import type { StyleSpecification } from "maplibre-gl";

// OSM standard tiles: fine for an MVP demo with attribution; heavy production use needs a tile provider
// (OSM tile usage policy). Bangladesh street-level coverage is good. Swap TILES for a provider later.
export const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
// Cluster-count labels need a glyph server; MapLibre demo fonts are fine for a demo, self-host for production.
export const GLYPHS = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
// Worker file copied to public/vendor (see its README): the bundled default URL does not resolve.
export const WORKER = "/vendor/maplibre-gl-worker.mjs";
/** Map moves jump instead of gliding when the OS asks for reduced motion (WCAG 2.3.3). */
export const mapAnimate = () => typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
export const CENTER: [number, number] = [90.3687, 23.8069];

export const osmStyle = (): StyleSpecification => ({
  version: 8,
  glyphs: GLYPHS,
  sources: { osm: { type: "raster", tiles: [TILES], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" } },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
});
