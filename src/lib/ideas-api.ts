import { api } from "@/lib/api-client";
import type { Idea, IdeaStatus } from "@/lib/ideas";
import type { Category } from "@/lib/types";

/** One idea from `GET /api/v1/ideas` (docs/api-v1.md). `support_count` is a count only, never who. */
export interface ApiIdea {
  ref: string; constituency_key: string; category: Category | null; title: string; body: string;
  status: "pending_review" | "published" | "under_consideration" | "planned" | "declined";
  decision_note: string | null; created_at: string; is_sample?: boolean; support_count: number;
}

// API statuses to the labels citizens see: a published idea is open for support, a decline is "not planned".
const STATUS: Record<ApiIdea["status"], IdeaStatus> = {
  pending_review: "moderation", published: "submitted", under_consideration: "under_consideration", planned: "planned", declined: "not_planned",
};

export function toIdea(i: ApiIdea): Idea {
  return {
    id: i.ref, title: i.title, summary: i.body, category: i.category ?? "other", area: "", supports: i.support_count,
    status: STATUS[i.status] ?? "submitted", createdAt: i.created_at,
    ...(i.decision_note ? { reason: i.decision_note } : {}), ...(i.is_sample ? { sample: true } : {}),
  };
}

export async function fetchIdeasPage(constituency: string, category: string, cursor?: string) {
  const q = new URLSearchParams({ limit: "50", constituency });
  if (category !== "all") q.set("category", category);
  if (cursor) q.set("cursor", cursor);
  const { data, page } = await api<ApiIdea[]>(`/ideas?${q}`);
  return { items: data.map(toIdea), next: page?.next_cursor ?? null };
}

export const setSupport = (ref: string, on: boolean) =>
  api<{ support_count?: number; count?: number }>(`/ideas/${encodeURIComponent(ref)}/support`, { method: on ? "POST" : "DELETE" })
    .then((r) => r.data.support_count ?? r.data.count);

export interface SimilarIdea { ref: string; title: string; support_count: number; score: number }
export const fetchSimilar = (constituency: string, text: string) =>
  api<SimilarIdea[]>(`/ideas/new/similar?${new URLSearchParams({ constituency, text })}`).then((r) => r.data);

export interface IdeaDraft { title: string; problem: string; solution: string; benefit: string; area: string; category: string; cost: string }

/** The API takes a title and one body: the form's parts become labelled paragraphs, so nothing the person wrote is dropped. */
export function ideaBody(f: IdeaDraft, label: { problem: string; solution: string; benefit: string; area: string; cost: string }, costLabel: string): string {
  const part = (l: string, v: string) => (v.trim() ? `${l}: ${v.trim()}` : "");
  return [part(label.problem, f.problem), part(label.solution, f.solution), part(label.benefit, f.benefit), part(label.area, f.area), part(label.cost, costLabel)]
    .filter(Boolean).join("\n\n");
}

export const postIdea = (constituency: string, f: IdeaDraft, body: string, key: string) =>
  api<{ ref: string; status: string; pii_removed: string[] }>("/ideas", { body: { constituency, category: f.category, title: f.title.trim(), body }, idempotencyKey: key }).then((r) => r.data);

/** One idea (`GET /api/v1/ideas/{ref}`), for the shareable link. A 404 means it is not public (or not yours). */
export const fetchIdea = (ref: string) => api<ApiIdea>(`/ideas/${encodeURIComponent(ref)}`).then((r) => toIdea(r.data));
