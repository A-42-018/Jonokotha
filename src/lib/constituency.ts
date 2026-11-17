import { DEMO_CONSTITUENCY } from "./demo-data";

// Client-safe constituency helpers. The list itself lives in the database (search via /api/v1/constituencies/search);
// the browser remembers only the key of the chosen seat.
export const CONSTITUENCY_COOKIE = "constituency";
/** "demo-1" (sample area) or "bd-001".."bd-300" (real seats). */
export const KEY_RE = /^(demo-\d{1,3}|bd-\d{3})$/;
export interface Area { id: string; nameBn: string; nameEn: string; sample: boolean; vacant: boolean }
export const SAMPLE_AREA: Area = { ...DEMO_CONSTITUENCY, sample: true, vacant: false };

/** Browser only: remember the choice for a year. Not sensitive, so not httpOnly. */
export function saveConstituency(id: string) {
  if (!KEY_RE.test(id)) return;
  document.cookie = `${CONSTITUENCY_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}
