import { ApiError, parse, rpc, fromDbError, type Ctx, type Result } from "./api";
import { Lat, Lng } from "./geo";
import districts from "./data/bd-districts.json";
import { z } from "zod";

/**
 * "Find my seat from my location". Two steps, and it never guesses:
 *  1. An exact match on a verified seat boundary (constituency_candidates, `certain`) names the seat.
 *  2. Otherwise the point is placed in a district (outlines from geoBoundaries, CC BY 3.0 IGO; see scripts/build-district-boundaries.mjs) and that
 *     district's seats are listed for the person to choose from.
 * The point is used for this one lookup only: it is not stored or logged by this code. Server only (the outline file is not sent to browsers).
 */
type Ring = number[][]; // [lng, lat] pairs, closed
interface District { en: string; bn: string; rings: Ring[] }
const DISTRICTS = (districts as { districts: District[] }).districts;

/** Ray casting; the rings are plain outer rings. */
function inRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Squared distance in degrees from a point to a ring's edges (used only to forgive the simplified outline along coasts and borders). */
function ringDist2(lat: number, lng: number, ring: Ring): number {
  let best = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i], dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const u = len2 ? Math.max(0, Math.min(1, ((lng - ax) * dx + (lat - ay) * dy) / len2)) : 0;
    const ex = lng - (ax + u * dx), ey = lat - (ay + u * dy);
    best = Math.min(best, ex * ex + ey * ey);
  }
  return best;
}

/** The district that contains the point; failing that, the one whose outline is within about 1.5 km (the outlines are simplified). */
export function districtAt(lat: number, lng: number): District | null {
  for (const d of DISTRICTS) if (d.rings.some((r) => inRing(lat, lng, r))) return d;
  let near: District | null = null, best = 0.0135 ** 2;
  for (const d of DISTRICTS) for (const r of d.rings) { const m = ringDist2(lat, lng, r); if (m < best) { best = m; near = d; } }
  return near;
}

interface SeatRow { key: string; name_bn: string; name_en: string; district: string | null; seat_no: number | null; seat_status: "serving" | "vacant" | null; is_demo: boolean }
const COLS = "key,name_bn,name_en,district,seat_no,seat_status,is_demo";

export async function locateSeat(c: Ctx): Promise<Result> {
  const q = parse(z.object({ lat: z.coerce.number().pipe(Lat), lng: z.coerce.number().pipe(Lng) }), { lat: c.url.searchParams.get("lat"), lng: c.url.searchParams.get("lng") });

  // 1. Exact, verified boundary match.
  try {
    const rows = await rpc<{ key: string; certain: boolean }[]>(c.sb, "constituency_candidates", { p_lat: q.lat, p_lng: q.lng });
    if (rows.length === 1 && rows[0].certain) {
      const { data } = await c.sb.from("constituencies").select(COLS).eq("key", rows[0].key).eq("is_active", true).limit(1);
      if (data?.length) return { data: { method: "boundary", seat: data[0] as SeatRow, district: null, seats: [] } };
    }
  } catch { /* no boundary data or function in this database: fall through to the district step */ }

  // 2. District, then its seats.
  const d = districtAt(q.lat, q.lng);
  if (!d) return { data: { method: "none", seat: null, district: null, seats: [] } };
  const { data, error } = await c.sb.from("constituencies").select(COLS).eq("district", d.en).eq("is_active", true).order("seat_no", { ascending: true }).limit(40);
  if (error) throw fromDbError(error);
  if (!data?.length) throw new ApiError("not_found", "No seats are listed for this district yet.");
  return { data: { method: "district", seat: null, district: { name_en: d.en, name_bn: d.bn }, seats: data as SeatRow[] } };
}
