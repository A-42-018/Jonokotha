import { api } from "@/lib/api-client";
import type { ExploreIssue } from "@/lib/explore";
import type { Category, Status } from "@/lib/types";

/** One item of `GET /api/v1/issues` (docs/api-v1.md). Only the fields the list screen uses. */
export interface PublicIssue {
  ref: string; title: string; category: Category; area: string; legacy_status: Status; created_at: string;
  is_sample: boolean; affected_count?: number; location?: { lat: number; lng: number; approximate: true } | null;
}

/** API item to the row Explore shows. Positions are already snapped by the server; "updated" is the creation time until the list carries one. */
export function toExploreIssue(i: PublicIssue): ExploreIssue {
  return {
    ref: i.ref, title: i.title, category: i.category, status: i.legacy_status, area: i.area, createdAt: i.created_at, updatedAt: i.created_at,
    ...(i.location ? { lat: i.location.lat, lng: i.location.lng } : {}),
    ...(typeof i.affected_count === "number" ? { supports: i.affected_count } : {}),
    ...(i.is_sample ? { sample: true } : {}),
  };
}

export const PAGE_SIZE = 50;

export async function fetchIssuesPage(cursor: string | undefined, category: string, from?: string) {
  const q = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) q.set("cursor", cursor);
  if (category !== "all") q.set("category", category);
  if (from) q.set("from", from);
  const { data, page } = await api<PublicIssue[]>(`/issues?${q}`);
  return { items: data.map(toExploreIssue), next: page?.next_cursor ?? null };
}
