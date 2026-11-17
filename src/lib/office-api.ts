import { api } from "@/lib/api-client";

const enc = encodeURIComponent;

export interface OfficeEvent { event_type: string; from_status: string | null; to_status: string | null; public_message: string | null; internal_note: string | null; is_public: boolean; created_at: string }
export interface Assignment { assigned_to: string; assigned_at: string; unassigned_at: string | null; reason: string | null }
export interface OfficeDetail { ref: string; events: OfficeEvent[]; assignments: Assignment[] }

export const fetchOfficeIssue = (ref: string) => api<OfficeDetail>(`/office/issues/${enc(ref)}`).then((r) => r.data);
export const fetchMyId = () => api<{ id: string }>("/me/profile").then((r) => r.data.id);

/** Internal note (staff only) or public reply. A public one is on the citizen's timeline: the caller confirms first. */
export const postNote = (ref: string, note: string, isPublic: boolean) => api<unknown>(`/office/issues/${enc(ref)}/update`, { body: { note: note.trim(), public: isPublic } });
export const assignTo = (ref: string, assignee: string, reason?: string) => api<unknown>(`/office/issues/${enc(ref)}/assign`, { body: { assignee, ...(reason ? { reason } : {}) } });

/** The notes a staff screen shows: internal ones and public replies, newest last. Status changes are not notes. */
export function splitNotes(events: OfficeEvent[]) {
  const internal = events.filter((e) => e.internal_note && !e.is_public);
  const publicReplies = events.filter((e) => e.event_type === "note" && e.is_public && e.public_message);
  return { internal, publicReplies };
}
export const currentAssignee = (a: Assignment[]) => a.filter((x) => !x.unassigned_at).at(-1)?.assigned_to;

// AI suggestions: nothing here changes a case; staff decide, and the decision is audited.
export type SuggestionKind = "summary" | "missing_information" | "reply_draft";
export interface Citation { fact: string; label: string }
export interface Suggestion { id: string | null; type: SuggestionKind; payload: Record<string, unknown>; citations: Citation[]; confidence: number | null }
export interface CopilotResult { source: "ai" | "fallback"; suggestions: Suggestion[] }
export const runCopilot = (ref: string) => api<CopilotResult>(`/office/issues/${enc(ref)}/copilot`, { method: "POST" }).then((r) => r.data);

export interface RoutingSuggestion { id: string; agency_name_bn: string; agency_name_en: string; reason: string | null; citations: { source_name: string; source_url: string | null; fetched_at: string | null }[]; confidence: number | null; method: string }
export interface RoutingResult { available: boolean; suggestion: RoutingSuggestion | null; reason?: string }
export const runRouting = (ref: string) => api<RoutingResult>(`/office/issues/${enc(ref)}/routing`, { method: "POST" }).then((r) => r.data);

export interface DuplicateCandidate { suggestion_id: string; ref: string; score: number; reasons: Record<string, unknown> }
export interface DuplicatesResult { available: boolean; candidates: DuplicateCandidate[] }
export const runDuplicates = (ref: string) => api<DuplicatesResult>(`/office/issues/${enc(ref)}/duplicates`, { method: "POST" }).then((r) => r.data);

export type DecisionKind = "accept" | "edit" | "dismiss";
export const decideSuggestion = (id: string, decision: DecisionKind, finalValue?: Record<string, unknown>) =>
  api<{ id: string; decision: string }>(`/ai/suggestions/${enc(id)}/decision`, { body: { decision, ...(finalValue ? { final_value: finalValue } : {}) } }).then((r) => r.data);

// Announcements
export interface Announcement { ref: string; constituency_key: string; title: string; body: string; published_at: string; is_sample?: boolean }
export const fetchAnnouncements = (constituency: string) => api<Announcement[]>(`/announcements?${new URLSearchParams({ constituency, limit: "20" })}`).then((r) => r.data);
export const publishAnnouncement = (constituency: string, title: string, body: string, key: string) =>
  api<{ ref: string }>("/office/announcements", { body: { constituency, title: title.trim(), body: body.trim(), publish: true }, idempotencyKey: key }).then((r) => r.data);
export const withdrawAnnouncement = (ref: string) => api<unknown>(`/office/announcements/${enc(ref)}/withdraw`, { method: "POST" });
