import type { Category, Status } from "./types";
import { matchesQuery } from "./translit";

/** One row in Explore. Public fields only. `lat`/`lng` are already approximate (see `approxCoord`). */
export interface ExploreIssue {
  ref: string;
  title: string;
  category: Category;
  status: Status;
  area: string;
  createdAt: string;
  updatedAt: string;
  /** Approximate position, or undefined when the report has none (it then shows in the list only). */
  lat?: number;
  lng?: number;
  /** Count of "me too" supports. Sample rows only until the API exposes it. */
  supports?: number;
  /** Constituency id, so "follow area" can match. */
  areaId?: string;
  /** True for demo rows: always labelled "নমুনা" in the UI. */
  sample?: boolean;
}

export type SortKey = "latest" | "updated" | "nearby";
export type DateRange = "all" | "7" | "30" | "90";
export interface Filters { q: string; category: Category | "all"; status: Status | "all"; range: DateRange }
export const NO_FILTERS: Filters = { q: "", category: "all", status: "all", range: "all" };

/** Public map positions are rounded to 2 decimals (about 1.1 km): never a precise address (§16). */
export function approxCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}

export function filterIssues(list: ExploreIssue[], f: Filters, now: number, catLabel: (c: Category) => string, statusLabel: (s: Status) => string): ExploreIssue[] {
  const q = f.q.trim().toLowerCase();
  const since = f.range === "all" ? 0 : now - Number(f.range) * 86_400_000;
  return list.filter((i) => {
    if (f.category !== "all" && i.category !== f.category) return false;
    if (f.status !== "all" && i.status !== f.status) return false;
    if (since && new Date(i.createdAt).getTime() < since) return false;
    if (!q) return true;
    return matchesQuery(`${i.title} ${i.area} ${catLabel(i.category)} ${statusLabel(i.status)}`, q);
  });
}

export function sortIssues(list: ExploreIssue[], key: SortKey, origin?: { lat: number; lng: number }): ExploreIssue[] {
  const copy = [...list];
  const time = (s: string) => new Date(s).getTime();
  if (key === "updated") return copy.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
  if (key === "nearby" && origin) {
    const d = (i: ExploreIssue) => (i.lat === undefined || i.lng === undefined ? Infinity : haversineKm(origin, { lat: i.lat, lng: i.lng }));
    return copy.sort((a, b) => d(a) - d(b));
  }
  return copy.sort((a, b) => time(b.createdAt) - time(a.createdAt));
}

/** Newest `updatedAt` in the list, shown as "data last updated". */
export function lastUpdated(list: ExploreIssue[]): string | undefined {
  return list.reduce<string | undefined>((m, i) => (!m || i.updatedAt > m ? i.updatedAt : m), undefined);
}
export const nowMs = () => Date.now();
