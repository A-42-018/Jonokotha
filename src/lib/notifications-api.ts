import { api } from "@/lib/api-client";

export type NoticeType = "issue_status" | "new_in_area" | "question_reply" | "question_message" | "idea_decision" | "announcement" | "project_update" | R11Type;
/** Release 1.1 types (B7.13). A server without the Phase 7 migrations rejects them in `muted_types`, so Settings offers them only when `GET /features` says Phase 7 is on. */
export type R11Type = "consultation_opened" | "consultation_report" | "idea_update" | "area_alert" | "checkin_response";
export interface ApiNotice { id: string; type: NoticeType; title: string; body: string; ref: string | null; read_at: string | null; created_at: string; en: { title?: string; body?: string } | null }
export type Kind = "status" | "reply" | "area" | "idea";

export const KIND: Record<NoticeType, Kind> = {
  issue_status: "status", question_reply: "reply", question_message: "reply", new_in_area: "area", announcement: "area", project_update: "area", idea_decision: "idea",
  consultation_opened: "area", consultation_report: "area", idea_update: "idea", area_alert: "area", checkin_response: "area",
};
/** A type this client does not know (a newer server) is shown as an area notice rather than breaking the list. */
export const kindOf = (type: string): Kind => (KIND as Record<string, Kind>)[type] ?? "area";
/** Where a notification leads. The text itself is generic by design (no issue content). */
export function noticeHref(n: Pick<ApiNotice, "type" | "ref">): string {
  if (n.type === "issue_status" && n.ref) return `/issue/${n.ref}`;
  if (n.type === "question_reply" || n.type === "question_message") return "/ask/inbox";
  if (n.type === "idea_decision" || n.type === "idea_update") return "/ideas";
  if ((n.type === "consultation_opened" || n.type === "consultation_report") && n.ref) return `/consultations/${n.ref}${n.type === "consultation_report" ? "/report" : ""}`;
  if (n.type === "checkin_response" && n.ref) return `/projects/${n.ref}`;
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

/** Types a person can switch off one by one (PUT /me/notification-preferences `muted_types`). Same list as the server's. */
export const MUTABLE_TYPES: readonly NoticeType[] = ["issue_status", "question_reply", "question_message", "new_in_area", "announcement", "project_update", "idea_decision"];
/** The new muted list after switching one type on or off; others are kept, no duplicates. */
export const MUTABLE_R11: readonly R11Type[] = ["consultation_opened", "consultation_report", "idea_update", "area_alert", "checkin_response"];
export function toggleMuted(muted: readonly string[], type: NoticeType, on: boolean): string[] {
  const rest = muted.filter((m) => m !== type);
  return on ? rest : [...rest, type];
}
/** Only an https link is shown as the status page. */
export function safeStatusUrl(v: string | undefined | null): string | null {
  try { const u = new URL(v ?? ""); return u.protocol === "https:" ? u.href : null; } catch { return null; }
}
