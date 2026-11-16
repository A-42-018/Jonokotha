import { api } from "@/lib/api-client";

export type NoticeType = "issue_status" | "new_in_area" | "question_reply" | "question_message" | "idea_decision" | "announcement" | "project_update";
export interface ApiNotice { id: string; type: NoticeType; title: string; body: string; ref: string | null; read_at: string | null; created_at: string; en: { title?: string; body?: string } | null }
export type Kind = "status" | "reply" | "area" | "idea";

export const KIND: Record<NoticeType, Kind> = {
  issue_status: "status", question_reply: "reply", question_message: "reply", new_in_area: "area", announcement: "area", project_update: "area", idea_decision: "idea",
};
/** Where a notification leads. The text itself is generic by design (no issue content). */
export function noticeHref(n: Pick<ApiNotice, "type" | "ref">): string {
  if (n.type === "issue_status" && n.ref) return `/issue/${n.ref}`;
  if (n.type === "question_reply" || n.type === "question_message") return "/ask/inbox";
  if (n.type === "idea_decision") return "/ideas";
  return "/area";
}
export const noticeText = (n: ApiNotice, lang: "bn" | "en") => (lang === "en" && n.en?.title ? { title: n.en.title, body: n.en.body ?? "" } : { title: n.title, body: n.body });

export async function fetchNotices(cursor?: string) {
  const q = new URLSearchParams({ limit: "20" });
  if (cursor) q.set("cursor", cursor);
  const { data, page } = await api<ApiNotice[]>(`/me/notifications?${q}`);
  return { items: data, next: page?.next_cursor ?? null };
}
export const markRead = (id: string) => api<unknown>(`/me/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
export const markAllRead = () => api<unknown>("/me/notifications/read-all", { method: "POST" });
