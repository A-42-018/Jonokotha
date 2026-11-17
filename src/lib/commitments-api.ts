import { api } from "@/lib/api-client";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";

/** Commitment tracker (B7.7). Contract: docs/api-v1.md "Surveys, satisfaction, commitments, priorities" (branch claude/backend-phase7). Everything here is the office's own record, labelled so. */
export const COMMITMENT_STATUSES = ["planned", "in_progress", "delivered", "delayed", "dropped"] as const;
export type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];
export interface Commitment { ref: string; constituency_key: string; title: string; description: string | null; status: CommitmentStatus; due_date: string | null; published_at: string | null; updated_at: string; announcement_ref: string | null; project_ref: string | null; idea_ref: string | null; label: "office_commitment"; is_sample?: boolean }
export interface CommitmentEvent { from_status: string | null; to_status: string; note: string | null; evidence_url: string | null; evidence_text: string | null; created_at: string }
export interface CommitmentFull extends Commitment { history: CommitmentEvent[] }
const q = encodeURIComponent;

export const fetchCommitments = (constituency: string, status?: CommitmentStatus): Promise<OrPlanned<Commitment[]>> =>
  readOrPlanned<Commitment[]>(`/commitments?${new URLSearchParams({ constituency, limit: "50", ...(status ? { status } : {}) })}`).then((r) => (r.kind === "ok" && !Array.isArray(r.data) ? { ...r, data: [] } : r));
export const fetchCommitment = (ref: string) => api<CommitmentFull>(`/commitments/${q(ref)}`).then((r) => ({ ...r.data, history: Array.isArray(r.data.history) ? r.data.history : [] }));

/** A commitment counts as late when it is still open after its due date. The server stores only what the office marked; this is a reading aid, never a status. */
export const isLate = (c: Pick<Commitment, "status" | "due_date">, now = Date.now()) =>
  !!c.due_date && (c.status === "planned" || c.status === "in_progress") && Date.parse(`${c.due_date}T23:59:59+06:00`) < now;

export function summary(list: Pick<Commitment, "status">[]): Record<CommitmentStatus, number> {
  const out = { planned: 0, in_progress: 0, delivered: 0, delayed: 0, dropped: 0 };
  for (const c of list) if (c.status in out) out[c.status]++;
  return out;
}

// Office -------------------------------------------------------------------------------------------------------------------------------------------
export interface OfficeCommitment { ref: string; title: string; status: "draft" | "pending_approval" | CommitmentStatus; due_date: string | null; published_at: string | null; created_at: string }
export const fetchOfficeCommitments = (): Promise<OrPlanned<OfficeCommitment[]>> => readOrPlanned("/office/commitments");
export const createCommitment = (b: { constituency: string; title: string; description?: string; due_date?: string; announcement_ref?: string; project_ref?: string; idea_ref?: string; publish: boolean }, key: string) =>
  api<{ ref: string; status: string }>("/office/commitments", { body: b, idempotencyKey: key }).then((r) => r.data);
export const decideCommitment = (ref: string, decision: "approve" | "reject", note?: string) => api<unknown>(`/office/commitments/${q(ref)}/decision`, { body: { decision, ...(note ? { note } : {}) } });
export const setCommitmentStatus = (ref: string, b: { status: "in_progress" | "delivered" | "delayed" | "dropped"; note?: string; evidence_url?: string; evidence_text?: string }) => api<unknown>(`/office/commitments/${q(ref)}/status`, { body: b });

/** The server's rules: delivered needs evidence (a link or text of 10+ characters); delayed and dropped need a public reason of 10+ characters. */
export function statusProblem(s: "in_progress" | "delivered" | "delayed" | "dropped", note: string, url: string, text: string): "note" | "evidence" | "url" | null {
  if ((s === "delayed" || s === "dropped") && note.trim().length < 10) return "note";
  if (s === "delivered") {
    if (url.trim() && !/^https:\/\/\S+$/.test(url.trim())) return "url";
    if (!url.trim() && text.trim().length < 10) return "evidence";
  }
  return null;
}

// Project feedback (B5.5) -----------------------------------------------------------------------------------------------------------------------------
export interface FeedbackSummary { feedback_count: number; average_rating: number | null }
export const fetchProjectFeedback = (ref: string) => api<FeedbackSummary>(`/projects/${q(ref)}/feedback`).then((r) => r.data);
export const sendProjectFeedback = (ref: string, rating: number, comment: string, key: string) => api<unknown>(`/projects/${q(ref)}/feedback`, { body: { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) }, idempotencyKey: key });
