import { api } from "@/lib/api-client";

export type FollowType = "issue" | "area" | "category" | "project";
export interface FollowRow { id: string; type: FollowType; target: string; label?: string; created_at: string }

/** Public count of people who said "me too". Only the number is public, never who. */
export const fetchAffectedCount = (ref: string) => api<{ affected_count?: number }>(`/issues/${encodeURIComponent(ref)}`).then((r) => r.data.affected_count ?? 0);
export const setAffected = (ref: string, on: boolean) =>
  api<{ affected_count: number }>(`/issues/${encodeURIComponent(ref)}/affected`, { method: on ? "POST" : "DELETE" }).then((r) => r.data.affected_count);

export const fetchFollows = () => api<FollowRow[]>("/me/follows").then((r) => r.data);
export const addFollow = (type: FollowType, target: string) => api<FollowRow>("/me/follows", { body: { type, target } }).then((r) => r.data);
export const removeFollow = (id: string) => api<{ id: string }>(`/me/follows/${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) => r.data);
export const findFollow = (list: FollowRow[] | undefined, type: FollowType, target: string) => list?.find((f) => f.type === type && f.target === target);

export const sendFeedback = (ref: string, rating: number) => api<unknown>(`/issues/${encodeURIComponent(ref)}/feedback`, { body: { rating } });
/** Reopen (resolved or closed, inside the window) and appeal (rejected) use the same route; the server decides which it is. */
export const sendReopen = (ref: string, reason: string) => api<unknown>(`/issues/${encodeURIComponent(ref)}/reopen`, { body: { reason } });

export const REPORT_REASONS = { Spam: "spam", Abuse: "abuse", Private: "personal_data", False: "false_information", Other: "other" } as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const reportContent = (type: "issue" | "idea" | "question" | "media" | "idea_argument" | "idea_comment", ref: string, reason: ReportReason, details?: string) =>
  api<unknown>("/reports", { body: { type, ref, reason: REPORT_REASONS[reason], ...(details?.trim() ? { details: details.trim() } : {}) } });
