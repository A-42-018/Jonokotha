/** Hand-drawn contour rings for the footer's background (decoration only). Paths are computed once at module load from a fixed shape, so the markup is
 *  static and identical on server and client. */

const TAU = Math.PI * 2;

/** One wobbly closed contour ring around (cx, cy). */
function ring(cx: number, cy: number, r: number, seed: number) {
  const pts: string[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const k = 1 + 0.09 * Math.sin(3 * a + seed) + 0.05 * Math.sin(5 * a + seed * 2.1) + 0.03 * Math.cos(7 * a - seed);
    pts.push(`${(cx + Math.cos(a) * r * k * 1.25).toFixed(1)},${(cy + Math.sin(a) * r * k).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

type Hill = { cx: number; cy: number; rings: number; step: number; seed: number };
const contours = (hills: Hill[]) =>
  hills.flatMap(({ cx, cy, rings, step, seed }) => Array.from({ length: rings }, (_, i) => ring(cx, cy, 28 + i * step, seed + i * 0.18))).join("");

export const FOOTER_RINGS = contours([
  { cx: 1180, cy: 60, rings: 8, step: 30, seed: 1.2 },
  { cx: 120, cy: 330, rings: 5, step: 34, seed: 3.4 },
]);
