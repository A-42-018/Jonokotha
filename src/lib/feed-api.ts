import { api } from "@/lib/api-client";
import type { ExploreIssue } from "@/lib/explore";
import { TO_LEGACY } from "@/lib/transitions";
import type { Category, IssueStatus } from "@/lib/types";

/** One item of `GET /me/feed`: a public issue plus `why` it is here (what you follow), or null. */
export interface FeedItem {
  ref: string; title: string; category: Category; area: string; status: IssueStatus; created_at: string; is_sample: boolean;
  why: "issue" | "area" | "category" | null;
}
export type FeedRow = ExploreIssue & { why: FeedItem["why"] };

export const toFeedRow = (i: FeedItem): FeedRow => ({
  ref: i.ref, title: i.title, category: i.category, status: TO_LEGACY[i.status] ?? "received", area: i.area, createdAt: i.created_at, updatedAt: i.created_at,
  ...(i.is_sample ? { sample: true } : {}), why: i.why,
});

export async function fetchFeed(personalized: boolean) {
  const { data } = await api<FeedItem[]>(`/me/feed?${new URLSearchParams({ personalized: String(personalized), limit: "10" })}`);
  return data.map(toFeedRow);
}
