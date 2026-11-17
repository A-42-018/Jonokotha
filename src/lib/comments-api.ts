import { api, ApiError } from "@/lib/api-client";

/**
 * Comments on ideas (masterplan 7.5). BACKEND GAP: `docs/api-v1.md` has no comments route yet, so this is the contract the UI expects:
 *   GET  /ideas/{ref}/comments?cursor=   -> published comments, plus the caller's own pending ones (`mine: true`)
 *   POST /ideas/{ref}/comments {body}    -> 201, the comment as `pending_review`; Idempotency-Key; 429 when too many
 * A 404 means the server has no such route, and the UI says comments are not switched on instead of failing.
 */
export type CommentStatus = "published" | "pending_review" | "hidden";
export interface IdeaComment { id: string; body: string; status: CommentStatus; created_at: string; mine: boolean; pii_removed?: string[] }

export const commentsUnavailable = (e: unknown) => e instanceof ApiError && e.status === 404;

export async function fetchComments(ref: string, cursor?: string) {
  const q = new URLSearchParams({ limit: "20" });
  if (cursor) q.set("cursor", cursor);
  const { data, page } = await api<IdeaComment[]>(`/ideas/${encodeURIComponent(ref)}/comments?${q}`);
  return { items: data, next: page?.next_cursor ?? null };
}

export const postComment = (ref: string, body: string, key: string) =>
  api<IdeaComment>(`/ideas/${encodeURIComponent(ref)}/comments`, { body: { body: body.trim() }, idempotencyKey: key }).then((r) => r.data);

export const validComment = (s: string) => s.trim().length >= 3 && s.trim().length <= 1000;
