import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Status } from "./types";

/** Public fields of one of the citizen's own reports. No ai.* and no timeline notes, by design. */
export interface MyReport { ref: string; title: string; category: Category; area: string; status: Status; createdAt: string }

export const PAGE_SIZE = 10;
export const STATUS_FILTERS = ["all", "received", "acknowledged", "referred", "resolved"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const parseFilter = (v: string | string[] | undefined): StatusFilter => {
  const s = Array.isArray(v) ? v[0] : v;
  return (STATUS_FILTERS as readonly string[]).includes(s ?? "") ? (s as StatusFilter) : "all";
};

export const parsePage = (v: string | string[] | undefined): number => {
  const n = Number.parseInt(Array.isArray(v) ? v[0] : (v ?? ""), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

export function countByStatus(list: MyReport[]): Record<StatusFilter, number> {
  const out: Record<StatusFilter, number> = { all: list.length, received: 0, acknowledged: 0, referred: 0, resolved: 0 };
  for (const r of list) out[r.status]++;
  return out;
}

/** Filters by status, then returns the requested page (clamped into range). */
export function selectPage(list: MyReport[], filter: StatusFilter, page: number) {
  const rows = filter === "all" ? list : list.filter((r) => r.status === filter);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  return { rows: rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), total: rows.length, page: current, totalPages };
}

/** URL for a filter/page combination. "all" and page 1 are the defaults, so they are left out. */
export function reportsHref(base: string, filter: StatusFilter, page = 1, extra?: Record<string, string>) {
  const q = new URLSearchParams(extra);
  if (filter !== "all") q.set("status", filter);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

type Row = { ref: string; title: string; category: Category; area: string | null; status: Status; created_at: string };

/**
 * The signed-in citizen's own reports, newest first.
 * TEMPORARY: store.ts has no list-by-user function, so this selects public columns only, filtered by reporter_id.
 * Backend should replace it with `listMyCases` (see docs/design-system.md, task 1.5).
 */
export async function listMyReports(sb: SupabaseClient, userId: string): Promise<MyReport[]> {
  const { data, error } = await sb.from("cases").select("ref,title,category,area,status,created_at").eq("reporter_id", userId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({ ref: r.ref, title: r.title, category: r.category, area: r.area ?? "", status: r.status, createdAt: r.created_at }));
}
