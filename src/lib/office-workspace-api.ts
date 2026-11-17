import { api } from "@/lib/api-client";
import type { ApiIdea } from "@/lib/ideas-api";

const enc = encodeURIComponent;

// ---- Cases (GET /office/issues, docs/api-v1.md Office) ----
export interface OfficeIssue { ref: string; title: string; category: string; area: string | null; status: string; priority: string | null; assigned_to: string | null; created_at: string; updated_at: string; is_sample?: boolean }
export const fetchOfficeIssues = (assigned?: "me" | "none") =>
  api<OfficeIssue[]>(`/office/issues?${new URLSearchParams({ limit: "50", ...(assigned ? { assigned } : {}) })}`).then((r) => r.data);

// ---- Ideas review (decision on an idea, public reason) ----
export type IdeaDecision = "under_consideration" | "planned" | "declined";
export const IDEA_DECISIONS: readonly IdeaDecision[] = ["under_consideration", "planned", "declined"];
/** A decline needs a reason (server rule); every reason is shown to citizens. */
export const decisionNeedsNote = (d: IdeaDecision) => d === "declined";
export const fetchIdeasForReview = (constituency: string) => api<ApiIdea[]>(`/ideas?${new URLSearchParams({ constituency, limit: "50" })}`).then((r) => r.data);
export const decideIdea = (ref: string, decision: IdeaDecision, note: string) =>
  api<unknown>(`/office/ideas/${enc(ref)}/decision`, { body: { decision, ...(note.trim() ? { note: note.trim() } : {}) } });

// ---- Questions and messages inbox ----
export interface OfficeQuestion { ref: string; title: string; body: string; status: string; visibility: string; assigned_to?: string | null; created_at: string; last_message_at: string }
export const fetchOfficeQuestions = () => api<OfficeQuestion[]>("/office/questions?limit=50").then((r) => r.data);
export const assignQuestion = (ref: string, assignee: string | null) => api<unknown>(`/office/questions/${enc(ref)}/assign`, { body: { assignee } });
export const replyToQuestion = (ref: string, body: string, key: string) => api<unknown>(`/questions/${enc(ref)}/messages`, { body: { body: body.trim() }, idempotencyKey: key });

// ---- Projects (create, milestones, delay notes) ----
export interface NewProject { constituency: string; title: string; description?: string; status: string; budget_text?: string; start_date?: string; expected_end_date?: string; source_url?: string; source_checked_at?: string }
/** Empty strings are not sent: the API rejects unknown or empty values. */
export function projectBody(f: Record<string, string>, constituency: string): NewProject {
  const out: Record<string, string> = { constituency, title: (f.title ?? "").trim(), status: f.status || "planned" };
  for (const k of ["description", "budget_text", "start_date", "expected_end_date", "source_url", "source_checked_at"]) if ((f[k] ?? "").trim()) out[k] = f[k].trim();
  return out as unknown as NewProject;
}
/** A source link must come with the date it was checked (server rule), so the form says so before sending. */
export const sourceNeedsDate = (f: Record<string, string>) => !!(f.source_url ?? "").trim() && !(f.source_checked_at ?? "").trim();
export const createProject = (b: NewProject, key: string) => api<{ ref: string }>("/office/projects", { body: b, idempotencyKey: key }).then((r) => r.data);
export const addMilestone = (ref: string, title: string, due?: string) => api<unknown>(`/office/projects/${enc(ref)}/milestones`, { body: { title: title.trim(), ...(due ? { due_date: due } : {}) } });
/** A delayed step needs a note (server rule); the form asks for it. */
export const milestoneNeedsNote = (status: string) => status === "delayed";
export const setMilestone = (ref: string, id: string, status: string, note: string) => api<unknown>(`/office/projects/${enc(ref)}/milestones/${enc(id)}`, { body: { status, ...(note.trim() ? { note: note.trim() } : {}) } });

// ---- Staff invitations ----
export type InviteRole = "case_officer" | "agency_liaison";
/** An office manager invites these two roles into their own office; MP and manager invitations are made by an admin. */
export const MANAGER_INVITE_ROLES: readonly InviteRole[] = ["case_officer", "agency_liaison"];
export interface Invitation { id: string; email: string; office_role: string; status: string; expires_at: string; created_at: string; accepted_at: string | null; constituency?: string }
export const fetchInvitations = () => api<Invitation[]>("/office/invitations").then((r) => r.data);
export const invite = (email: string, constituency: string, role: InviteRole, key: string) => api<unknown>("/office/invitations", { body: { email: email.trim(), constituency, role }, idempotencyKey: key });
export const revokeInvitation = (id: string) => api<unknown>(`/office/invitations/${enc(id)}/revoke`, { method: "POST" });

// ---- Analytics reports (frozen snapshot, approved by a manager before it is public) ----
export interface OfficeReport { id: string; period_days: number; status: string; narrative: string | null; created_at: string; approved_at: string | null; constituency?: string }
export const fetchOfficeReports = () => api<OfficeReport[]>("/office/analytics/reports").then((r) => r.data);
export const createOfficeReport = (constituency: string, days: number, key: string) => api<unknown>("/office/analytics/reports", { body: { constituency, days }, idempotencyKey: key });
export const setReportStatus = (id: string, action: "approve" | "withdraw") => api<unknown>(`/office/analytics/reports/${enc(id)}/${action}`, { method: "POST" });
