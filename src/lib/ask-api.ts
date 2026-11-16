import { api } from "@/lib/api-client";
import type { Emergency } from "@/lib/types";

export type QuestionStatus = "pending_review" | "open" | "answered" | "closed" | "hidden";
export interface MyQuestion { ref: string; constituency_key: string; visibility: "private" | "public"; title: string; body: string; status: QuestionStatus; created_at: string; last_message_at: string }
export interface ThreadMessage { author_kind: "citizen" | "office"; body: string; created_at: string }
export interface QuestionThread extends MyQuestion { messages: ThreadMessage[] }
export interface Asked { ref: string; pii_removed: string[]; emergency?: Emergency }

/** The API has a title and a body only: the chosen topic becomes the first line of the body, so the office sees it. */
export const askBody = (topicLabel: string, message: string) => `${topicLabel}\n\n${message.trim()}`;

export const askQuestion = (constituency: string, visibility: "private" | "public", title: string, body: string, key: string) =>
  api<Asked>("/questions", { body: { constituency, visibility, title: title.trim(), body }, idempotencyKey: key }).then((r) => r.data);
export const fetchMyQuestions = () => api<MyQuestion[]>("/me/questions?limit=50").then((r) => r.data);
export const fetchThread = (ref: string) => api<QuestionThread>(`/questions/${encodeURIComponent(ref)}`).then((r) => r.data);
export const postReply = (ref: string, body: string, key: string) =>
  api<{ pii_removed: string[] }>(`/questions/${encodeURIComponent(ref)}/messages`, { body: { body: body.trim() }, idempotencyKey: key }).then((r) => r.data);

/** A public question from `GET /api/v1/questions` (approved by a moderator). Asker identity is never in it. */
export interface PublicQuestion { ref: string; constituency_key: string; title: string; body: string; status: QuestionStatus; created_at: string; last_message_at: string; message_count: number; is_sample?: boolean }
export async function fetchPublicQuestions(constituency: string, cursor?: string) {
  const q = new URLSearchParams({ limit: "10", constituency });
  if (cursor) q.set("cursor", cursor);
  const { data, page } = await api<PublicQuestion[]>(`/questions?${q}`);
  return { items: data, next: page?.next_cursor ?? null };
}
