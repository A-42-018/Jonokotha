import { DEMO_CONSTITUENCY } from "./demo-data";

// Client-safe constituency list and cookie helpers. Phase 0 has one sample entry only.
export const CONSTITUENCY_COOKIE = "constituency";
export const CONSTITUENCIES = [{ ...DEMO_CONSTITUENCY, sample: true }] as const;
export type ConstituencyId = (typeof CONSTITUENCIES)[number]["id"];

export function findConstituency(id: string | null | undefined) {
  return CONSTITUENCIES.find((c) => c.id === id) ?? null;
}

/** Browser only: remember the choice for a year. Not sensitive, so not httpOnly. */
export function saveConstituency(id: string) {
  document.cookie = `${CONSTITUENCY_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}
