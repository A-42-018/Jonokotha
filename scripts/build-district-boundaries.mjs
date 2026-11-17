// Builds src/lib/data/bd-districts.json (district outlines for "find my seat from my location") from the geoBoundaries ADM2 file.
// Usage: node scripts/build-district-boundaries.mjs <geoBoundaries-BGD-ADM2_simplified.geojson> [tolerance-degrees]
// Source: geoBoundaries gbOpen BGD ADM2 (build 12 Dec 2023), licence CC BY 3.0 IGO, https://www.geoboundaries.org/ . Names are mapped to the
// district spelling used by the seat list (supabase/seed/data/mps-13th-*.json) so they match constituencies.district.
import { readFileSync, writeFileSync } from "node:fs";

const [, , input, tolArg] = process.argv;
if (!input) { console.error("usage: node scripts/build-district-boundaries.mjs <adm2.geojson> [tolerance]"); process.exit(1); }
const TOL = Number(tolArg ?? 0.001);
const ALIAS = { Barisal: "Barishal", Bogra: "Bogura", Brahamanbaria: "Brahmanbaria", Chittagong: "Chattogram", Comilla: "Cumilla", Jessore: "Jashore", Khagrachhari: "Khagrachari", Maulvibazar: "Moulvibazar", Nawabganj: "Chapai Nawabganj", Netrakona: "Netrokona" };

const seats = JSON.parse(readFileSync("supabase/seed/data/mps-13th-2026-11-16.json", "utf8")).seats;
const bn = new Map(seats.map((s) => [s.district_en, s.district_bn]));
const geo = JSON.parse(readFileSync(input, "utf8"));
if (geo.type !== "FeatureCollection" || geo.features.length !== 64) throw new Error("expected 64 district features");

// Douglas-Peucker on an open or closed ring (iterative, squared distance in degrees).
function simplify(pts, tol) {
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop(); let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const u = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      const ex = px - (ax + u * dx), ey = py - (ay + u * dy), d = ex * ex + ey * ey;
      if (d > max) { max = d; idx = i; }
    }
    if (max > t2 && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const r = (n) => Math.round(n * 1e4) / 1e4;
const out = [];
for (const f of geo.features) {
  const en = ALIAS[f.properties.shapeName] ?? f.properties.shapeName;
  if (!bn.has(en)) throw new Error(`no seat district named ${en}`);
  const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
  const rings = [];
  for (const poly of polys) {
    const ring = simplify(poly[0], TOL).map(([x, y]) => [r(x), r(y)]);
    if (ring.length >= 4) rings.push(ring); // outer rings only (districts have no holes that matter here); drops slivers
  }
  out.push({ en, bn: bn.get(en), rings });
}
for (const d of bn.keys()) if (!out.some((o) => o.en === d)) throw new Error(`seat district ${d} has no outline`);
out.sort((a, b) => a.en.localeCompare(b.en));
writeFileSync("src/lib/data/bd-districts.json", JSON.stringify({
  source: "geoBoundaries gbOpen BGD ADM2 (build 2023-12-12), simplified",
  licence: "CC BY 3.0 IGO",
  url: "https://www.geoboundaries.org/",
  tolerance_deg: TOL,
  districts: out,
}));
console.log(out.length, "districts,", out.reduce((n, d) => n + d.rings.reduce((m, g) => m + g.length, 0), 0), "points");
