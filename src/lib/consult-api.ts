import { api, ApiError } from "@/lib/api-client";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";

/** Consultations (B7.1). Contract: docs/api-v1.md "Consultations" on branch claude/backend-phase7. */
export type ConsultStatus = "open" | "closed" | "reported";
export type VoteKind = "agree" | "disagree" | "pass";
export interface ConsultationItem { ref: string; question: string; description: string | null; status: ConsultStatus; closes_at: string | null; statement_count: number | null; participant_count: number | null; is_sample?: boolean }
export interface Statement { id: string; text: string; kind: string; my_vote: VoteKind | null }
export interface ConsultationFull extends ConsultationItem { statements: Statement[]; next_statement_id: string | null }

export type Pattern = "common_ground" | "divided" | "mixed" | "low_support";
export interface AgreementRow { statement_id: string; text: string; votes: number | null; agree_pct: number | null; disagree_pct: number | null; pass_pct: number | null; groups: { group: string; votes: number; agree_pct: number | null }[]; pattern: Pattern | null }
export interface ConsultReport {
  consultation_ref: string; participants: number | null; groups: { group: string; size: number }[]; agreement: AgreementRow[]; hidden_groups: number;
  summary_bn: string | null; you_said_we_did: string | null; actions: { text: string; link_ref?: string }[]; published_at: string | null; is_sample?: boolean;
}

const q = encodeURIComponent;
export const fetchConsultations = (constituency: string, status: ConsultStatus): Promise<OrPlanned<ConsultationItem[]>> => readOrPlanned(`/consultations?${new URLSearchParams({ constituency, status })}`);
export const fetchConsultation = (ref: string) => api<ConsultationFull>(`/consultations/${q(ref)}`).then((r) => r.data);
export const fetchConsultReport = (ref: string) => api<ConsultReport>(`/consultations/${q(ref)}/report`).then((r) => r.data);
export const voteStatement = (ref: string, id: string, vote: VoteKind) => api<unknown>(`/consultations/${q(ref)}/statements/${q(id)}/vote`, { method: "PUT", body: { vote } });
export const addStatement = (ref: string, text: string, key: string) => api<unknown>(`/consultations/${q(ref)}/statements`, { body: { text }, idempotencyKey: key });

/** The statement to show next: the server's pointer, else the first without a vote. */
export function nextStatement(c: Pick<ConsultationFull, "statements" | "next_statement_id">): { statement: Statement; index: number } | null {
  const i = c.statements.findIndex((s) => s.id === c.next_statement_id);
  if (i >= 0) return { statement: c.statements[i], index: i };
  const j = c.statements.findIndex((s) => !s.my_vote);
  return j >= 0 ? { statement: c.statements[j], index: j } : null;
}

export const answered = (c: Pick<ConsultationFull, "statements">) => c.statements.filter((s) => s.my_vote).length;
export const groupName = (g: string, lang: "bn" | "en") => (lang === "bn" ? ({ A: "ক", B: "খ" } as Record<string, string>)[g] ?? g : g);
export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

// Office --------------------------------------------------------------------------------------------------------------------------------------------
export interface OfficeConsultationRow { ref: string; question: string; status: "draft" | "pending_approval" | "open" | "closed" | "reported" | "cancelled"; closes_at: string | null; constituency?: string }
export interface OfficeStatement { id: string; text: string; kind: string; status: "pending_review" | "approved" | "rejected"; reason: string | null }
export interface OfficeReport { status: string; participants: number | null; groups: ConsultReport["groups"]; agreement: AgreementRow[]; hidden_groups: number; ai_summary: string | null; summary_bn: string | null; you_said_we_did: string | null; actions: { text: string }[] | null; published_at: string | null }
export interface OfficeConsultation { ref: string; status: OfficeConsultationRow["status"]; question: string; description: string | null; closes_at: string | null; participants: number | null; participants_suppressed: boolean; statements: OfficeStatement[]; report: OfficeReport | null }

export const fetchOfficeConsultations = (): Promise<OrPlanned<OfficeConsultationRow[]>> => readOrPlanned("/office/consultations");
export const fetchOfficeConsultation = (ref: string) => api<OfficeConsultation>(`/office/consultations/${q(ref)}`).then((r) => r.data);
export const createConsultation = (b: { constituency: string; question: string; description?: string; seed_statements: string[]; closes_at: string }, key: string) =>
  api<{ ref: string; status: string }>("/office/consultations", { body: b, idempotencyKey: key }).then((r) => r.data);
export const setConsultationStatus = (ref: string, action: "open" | "close") => api<{ status?: string }>(`/office/consultations/${q(ref)}/status`, { body: { action } }).then((r) => r.data);
export const decideConsultation = (ref: string, decision: "approve" | "reject", note?: string) => api<unknown>(`/office/consultations/${q(ref)}/decision`, { body: { decision, ...(note ? { note } : {}) } });
export const moderateStatement = (ref: string, id: string, action: "approve" | "reject", reason?: string) => api<unknown>(`/office/consultations/${q(ref)}/statements/${q(id)}/moderate`, { body: { action, ...(reason ? { reason } : {}) } });
export const makeSummary = (ref: string) => api<{ ai_summary: string | null }>(`/office/consultations/${q(ref)}/summary`, { body: { generate_narrative: true } }).then((r) => r.data);
export const saveReport = (ref: string, b: { summary_bn: string; you_said_we_did?: string; actions: { text: string }[]; publish: boolean }) => api<unknown>(`/office/consultations/${q(ref)}/report`, { method: "PUT", body: b });

/** One non-empty trimmed line per entry. */
export const lines = (s: string, max: number) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, max);

/** The closing time the server wants: end of the chosen day, Dhaka time, as an ISO string with offset. */
export const closesAtFromDay = (day: string) => `${day}T23:59:00+06:00`;
