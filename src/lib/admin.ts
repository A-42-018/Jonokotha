import type { CaseRecord, Category } from "./types";

/**
 * SAMPLE admin data (নমুনা): the verification queue, moderation queue and AI run log have no backend tables or endpoints yet.
 * Invented for review only. Real rows must come from the API; every screen shows the sample label.
 */
export type ReviewKind = "verification" | "moderation";
export type VerifyAction = "approve" | "reject";
export type ModAction = "approve" | "request_edit" | "hide" | "reject" | "escalate";

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  titleBn: string; titleEn: string;
  detailBn: string; detailEn: string;
  /** Risk signals shown to reviewers (moderation only). */
  risks: ("phone" | "abuse" | "duplicate" | "reported_many")[];
  at: string;
}

export const SAMPLE_REVIEW: ReviewItem[] = [
  { id: "v1", kind: "verification", titleBn: "নমুনা জনপ্রতিনিধি ১ — প্রোফাইল যাচাই", titleEn: "Sample Representative 1 — profile verification", detailBn: "সূত্র: example.invalid/mp-1 (নমুনা)। অফিসের ইমেইল ডোমেইন সূত্রের সঙ্গে মিলিয়ে দেখতে হবে।", detailEn: "Source: example.invalid/mp-1 (sample). Office email domain must be matched to the source.", risks: [], at: "2026-11-15T08:00:00Z" },
  { id: "v2", kind: "verification", titleBn: "নমুনা অফিস কর্মী — অ্যাকাউন্ট যাচাই", titleEn: "Sample office staff — account verification", detailBn: "এমপি অফিসের কর্মী হিসেবে অনুরোধ (নমুনা)। নিয়োগপত্র বা অফিসের নিশ্চয়তা দরকার।", detailEn: "Request to be office staff (sample). Needs an appointment letter or office confirmation.", risks: [], at: "2026-11-14T08:00:00Z" },
  { id: "m1", kind: "moderation", titleBn: "সমস্যায় ফোন নম্বর আছে (নমুনা)", titleEn: "Report contains a phone number (sample)", detailBn: "নমুনা: বিবরণে একটি মোবাইল নম্বরের মতো সংখ্যা পাওয়া গেছে।", detailEn: "Sample: the description contains a mobile-number-like string.", risks: ["phone"], at: "2026-11-16T05:00:00Z" },
  { id: "m2", kind: "moderation", titleBn: "আইডিয়ায় আপত্তিকর ভাষার রিপোর্ট (নমুনা)", titleEn: "Idea reported for abusive language (sample)", detailBn: "নমুনা: ৩ জন রিপোর্ট করেছেন। এআই লক্ষণ দিয়েছে, সিদ্ধান্ত মানুষকে নিতে হবে।", detailEn: "Sample: reported by 3 people. AI flagged it; a person must decide.", risks: ["abuse", "reported_many"], at: "2026-11-15T20:00:00Z" },
  { id: "m3", kind: "moderation", titleBn: "সম্ভাব্য নকল সমস্যা (নমুনা)", titleEn: "Possible duplicate report (sample)", detailBn: "নমুনা: একই লেখার আরেকটি সমস্যা আগেই আছে।", detailEn: "Sample: an identical report already exists.", risks: ["duplicate"], at: "2026-11-14T20:00:00Z" },
];

export interface AuditRow { id: string; itemId: string; action: string; reason: string; at: string }
export const REASON_MIN = 10;
export const validReason = (r: string) => r.trim().length >= REASON_MIN;

/** Records a decision. A reason is mandatory: returns null (no audit row) when it is missing. */
export function decide(itemId: string, action: string, reason: string, at: string): AuditRow | null {
  if (!validReason(reason)) return null;
  return { id: `${itemId}-${at}`, itemId, action, reason: reason.trim(), at };
}

/** Sample AI run log row (§17). Prompt text and report content are never shown here, only metadata. */
export interface AiRun { id: string; at: string; agent: string; model: string; promptVersion: string; ref: string; confidence: number; humanDecision: "accepted" | "edited" | "dismissed" | "pending"; latencyMs: number }
export const SAMPLE_AI_RUNS: AiRun[] = [
  { id: "r1", at: "2026-11-16T05:10:00Z", agent: "intake", model: "claude-sonnet-5-5", promptVersion: "intake-v3", ref: "JK-SAMPLE-101", confidence: 0.82, humanDecision: "edited", latencyMs: 1850 },
  { id: "r2", at: "2026-11-16T05:32:00Z", agent: "routing", model: "claude-sonnet-5-5", promptVersion: "route-v2", ref: "JK-SAMPLE-102", confidence: 0.74, humanDecision: "accepted", latencyMs: 1320 },
  { id: "r3", at: "2026-11-15T17:02:00Z", agent: "duplicate", model: "claude-haiku-5-5", promptVersion: "dup-v1", ref: "JK-SAMPLE-103", confidence: 0.61, humanDecision: "dismissed", latencyMs: 640 },
  { id: "r4", at: "2026-11-15T12:45:00Z", agent: "reply_draft", model: "claude-sonnet-5-5", promptVersion: "reply-v1", ref: "JK-SAMPLE-104", confidence: 0.7, humanDecision: "pending", latencyMs: 2410 },
];

export function countBy<T>(list: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of list) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return out;
}

/** Areas ranked by number of reports (real cases). A count, not a score; small counts are flagged so nobody over-reads them. */
export function hotspots(cases: CaseRecord[], minForSignal = 5): { area: string; count: number; weak: boolean }[] {
  const counts = countBy(cases.filter((c) => c.area.trim()), (c) => c.area.trim());
  return Object.entries(counts).map(([area, count]) => ({ area, count, weak: count < minForSignal })).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}

export function analytics(cases: CaseRecord[]) {
  return {
    total: cases.length,
    byStatus: countBy(cases, (c) => c.status),
    byCategory: countBy(cases, (c) => c.category) as Partial<Record<Category, number>>,
    hotspots: hotspots(cases),
  };
}
