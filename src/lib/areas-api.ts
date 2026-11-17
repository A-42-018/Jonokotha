import { api, ApiError } from "@/lib/api-client";
import type { Lookup } from "@/lib/mp-api";

/**
 * Administrative hierarchy client (F5.9, backend B5.7). Contract (docs/frontend.md "F5.9 progress"):
 *   GET /areas?parent=<id>          children of one area; no parent = the top level (districts). Labels for the level come from the server.
 *   GET /areas/{id}/constituencies  every constituency the area can belong to, same shape as /representatives/lookup.
 * The server has not shipped B5.7, so a 404/501 is read as "cascade not switched on" and the screen says so.
 */
export interface Area { id: string; name_bn: string; name_en: string }
export interface AreaLevel { level: string; label_bn: string; label_en: string; areas: Area[] }

export const fetchAreas = (parent?: string) =>
  api<AreaLevel>(`/areas${parent ? `?${new URLSearchParams({ parent })}` : ""}`).then((r) => r.data);
export const fetchAreaConstituencies = (id: string) =>
  api<Lookup>(`/areas/${encodeURIComponent(id)}/constituencies`).then((r) => r.data);

/** The hierarchy endpoints are missing on this server (not an outage). */
export const isNotSwitchedOn = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 501);

/** One dropdown per level walked so far. `chain` holds the chosen id at each level, in order. */
export function trimChain(chain: readonly string[], level: number, id: string): string[] {
  return id ? [...chain.slice(0, level), id] : chain.slice(0, level);
}

/** The area the citizen is narrowing to: the deepest one chosen. */
export const deepest = (chain: readonly string[]) => chain[chain.length - 1];

/** More than one possible constituency: ask the citizen to confirm, never pick for them. */
export const needsConfirm = (l: Lookup | undefined) => !!l && l.matches.length > 1;

export const MY_AREA_KEY = "jk-my-area";
/** The area a citizen confirmed, kept on this device only until the server can store it (B5.7). */
export interface MyArea { key: string; name_bn: string; name_en: string; sample: boolean }
