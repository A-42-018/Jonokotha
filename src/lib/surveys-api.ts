import { api } from "@/lib/api-client";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";

/** Surveys and satisfaction (B7.6). Contract: docs/api-v1.md "Surveys, satisfaction, commitments, priorities" (branch claude/backend-phase7). Rating (1 to 5) and fixed choices only, no free text. */
export interface SurveyRow { ref: string; constituency_key: string; title: string; description: string | null; status: "open" | "closed"; closes_at: string | null; opened_at: string | null; closed_at: string | null; is_sample?: boolean }
export interface SurveyQuestion { id: string; position: number; kind: "rating" | "choice"; prompt: string; options: string[] | null }
export interface SurveyDetail extends SurveyRow { questions: SurveyQuestion[] }
export type Answer = number | string;
const q = encodeURIComponent;

export const fetchSurveys = (constituency: string): Promise<OrPlanned<SurveyRow[]>> =>
  readOrPlanned<SurveyRow[]>(`/surveys?${new URLSearchParams({ constituency, limit: "20" })}`).then((r) => (r.kind === "ok" && !Array.isArray(r.data) ? { ...r, data: [] } : r));
export const fetchSurvey = (ref: string) => api<SurveyDetail>(`/surveys/${q(ref)}`).then((r) => r.data);
export const submitSurvey = (ref: string, answers: Record<string, Answer>, key: string) => api<unknown>(`/surveys/${q(ref)}/responses`, { body: { answers }, idempotencyKey: key });

/** Every question must be answered (server rule). Returns the ids still missing. */
export const missingAnswers = (qs: SurveyQuestion[], a: Record<string, Answer | undefined>) => qs.filter((x) => a[x.id] === undefined || a[x.id] === "").map((x) => x.id);

export interface SurveyResults { ref: string; status?: string; respondents: number | null; results_shown: boolean; questions: { id: string; position: number; kind: "rating" | "choice"; prompt: string; average: number | null; counts: Record<string, number> }[] | null }
export const fetchSurveyResults = (ref: string) => api<SurveyResults>(`/surveys/${q(ref)}/results`).then((r) => r.data);

export interface Satisfaction { days: number; ratings: number | null; suppressed: boolean; average: number | null; distribution: Record<string, number> | null; last_updated?: string }
export const fetchSatisfaction = (constituency: string, days = 90): Promise<OrPlanned<Satisfaction>> => readOrPlanned(`/analytics/satisfaction?${new URLSearchParams({ constituency, days: String(days) })}`);
/** The server returns the figure only from 5 ratings. Anything else is "not enough ratings yet", never a zero. */
export function satisfactionView(s: Satisfaction): { average: number; n: number; dist: [string, number][] } | null {
  if (s.suppressed || typeof s.ratings !== "number" || s.ratings < 5 || typeof s.average !== "number") return null;
  return { average: Math.round(s.average * 10) / 10, n: s.ratings, dist: Object.entries(s.distribution ?? {}).sort(([a], [b]) => Number(a) - Number(b)) };
}

// Office ----------------------------------------------------------------------------------------------------------------------------------------------
export interface OfficeSurvey { ref: string; title: string; status: "draft" | "open" | "closed" | "cancelled"; closes_at: string | null }
export const fetchOfficeSurveys = (): Promise<OrPlanned<OfficeSurvey[]>> => readOrPlanned("/office/surveys");
export type NewQuestion = { kind: "rating"; prompt: string } | { kind: "choice"; prompt: string; options: string[] };
export const createSurvey = (b: { constituency: string; title: string; description?: string; questions: NewQuestion[]; closes_at?: string }, key: string) => api<{ ref: string }>("/office/surveys", { body: b, idempotencyKey: key }).then((r) => r.data);
export const setSurveyStatus = (ref: string, status: "open" | "closed" | "cancelled") => api<unknown>(`/office/surveys/${q(ref)}/status`, { body: { status } });
