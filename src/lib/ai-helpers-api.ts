import { api, ApiError } from "@/lib/api-client";

export type Lang = "bn" | "en";

/** Which language a public text is written in: any Bangla letter means Bangla, else English. Used to pick the other one. */
export const detectLang = (text: string): Lang => (/[ঀ-৿]/.test(text) ? "bn" : "en");
export const otherLang = (l: Lang): Lang => (l === "bn" ? "en" : "bn");

export interface Translation { available: boolean; translation?: string; target: Lang; machine_translated: true }
/** `POST /ai/translate` (documented, live). The server cuts at 2000 characters, so longer text is cut here first. */
export const translate = (text: string, to: Lang) =>
  api<Translation>("/ai/translate", { body: { text: text.trim().slice(0, 2000), to } }).then((r) => r.data);

// ---- Idea Assistant: clarity suggestions (B5.10; built to this contract, the route is not on the server yet) ----
/** `POST /ai/ideas/clarity {title, body}` returns `{available, suggestions: [{text}]}`. Suggestions only; nothing is applied. */
export interface Clarity { available: boolean; suggestions: { text: string }[] }
export const fetchClarity = (title: string, body: string): Promise<Clarity> =>
  api<Clarity>("/ai/ideas/clarity", { body: { title: title.trim(), body: body.trim().slice(0, 2000) } }).then((r) => ({
    available: r.data?.available !== false,
    suggestions: (r.data?.suggestions ?? []).filter((s) => typeof s?.text === "string" && s.text.trim()),
  }));

/** The route is missing or switched off (404, 405, 501, 503): show "not switched on" instead of an error. */
export const isNotOn = (e: unknown) => e instanceof ApiError && [404, 405, 501, 503].includes(e.status);

// ---- Insight Agent briefs for offices (B5.10; built to this contract) ----
export type InsightStatus = "draft" | "reviewed" | "shared" | "withdrawn";
/** `GET /office/insights` returns `[{id, period_days, status, narrative, case_refs, created_at}]`. The narrative comes from aggregates only. */
export interface InsightBrief { id: string; period_days: number; status: InsightStatus; narrative: string; case_refs: string[]; created_at: string }
export const fetchInsights = () => api<InsightBrief[]>("/office/insights?limit=20").then((r) => r.data ?? []);
/** `POST /office/insights/{id}/review {action}`: a person reads the brief, then shares it or withdraws it. */
export const reviewInsight = (id: string, action: "share" | "withdraw") =>
  api<unknown>(`/office/insights/${encodeURIComponent(id)}/review`, { body: { action } });
/** Only a draft can be shared; a shared or reviewed one can be withdrawn; a withdrawn one has no action. */
export const nextActions = (s: InsightStatus): ("share" | "withdraw")[] => (s === "draft" ? ["share", "withdraw"] : s === "shared" || s === "reviewed" ? ["withdraw"] : []);
