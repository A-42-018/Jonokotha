import type { CaseRecord, Category, Status } from "./types";
import { matchesQuery } from "./translit";

/** SAMPLE staff (নমুনা) for assignment until the staff directory API exists. */
export const SAMPLE_STAFF = [
  { id: "st-1", name: "নমুনা কর্মী ক" },
  { id: "st-2", name: "নমুনা কর্মী খ" },
  { id: "st-3", name: "নমুনা কর্মী গ" },
];

export interface Overview { total: number; newReports: number; waiting: number; forwarded: number; resolvedThisMonth: number; resolved: number }

/** Counts derived only from fields the API really has (status and dates). Priority, assignee, targets and ratings need backend fields. */
export function overviewStats(cases: CaseRecord[], now: number): Overview {
  const d = new Date(now);
  const sameMonth = (iso: string) => { const x = new Date(iso); return x.getUTCFullYear() === d.getUTCFullYear() && x.getUTCMonth() === d.getUTCMonth(); };
  const resolvedAt = (c: CaseRecord) => c.timeline.filter((e) => e.status === "resolved").at(-1)?.at;
  return {
    total: cases.length,
    newReports: cases.filter((c) => c.status === "received").length,
    waiting: cases.filter((c) => c.status === "received" || c.status === "acknowledged").length,
    forwarded: cases.filter((c) => c.status === "referred").length,
    resolved: cases.filter((c) => c.status === "resolved").length,
    resolvedThisMonth: cases.filter((c) => c.status === "resolved" && sameMonth(resolvedAt(c) ?? c.createdAt)).length,
  };
}

export interface CaseFilter { q: string; status: Status | "all"; category: Category | "all"; assigned: "all" | "mine-none" | string }
export const NO_CASE_FILTER: CaseFilter = { q: "", status: "all", category: "all", assigned: "all" };

export function filterCases(cases: CaseRecord[], f: CaseFilter, assign: Record<string, string>): CaseRecord[] {
  const q = f.q.trim().toLowerCase();
  return cases.filter((c) => {
    if (f.status !== "all" && c.status !== f.status) return false;
    if (f.category !== "all" && c.category !== f.category) return false;
    if (f.assigned === "mine-none" && assign[c.ref]) return false;
    if (f.assigned !== "all" && f.assigned !== "mine-none" && assign[c.ref] !== f.assigned) return false;
    return !q || matchesQuery(`${c.ref} ${c.title} ${c.area}`, q);
  });
}

/** Missing-information checklist from plain rules on the report (not AI): what staff may need to ask the citizen. */
export type Missing = "area" | "detail" | "when" | "contact_hint";
export function missingInfo(c: Pick<CaseRecord, "area" | "description">): Missing[] {
  const out: Missing[] = [];
  if (c.area.trim().length < 3) out.push("area");
  if (c.description.trim().length < 40) out.push("detail");
  if (!/(দিন|সপ্তাহ|মাস|আজ|গতকাল|রাত|সকাল|day|week|month|today|yesterday|night|morning|since|ago|\d)/i.test(c.description)) out.push("when");
  return out;
}

/** CSV cell: quotes, doubles quotes, and neutralises spreadsheet formulas (=, +, -, @, tab, CR) so exports are safe to open. */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export of the visible case rows: public report fields and staff assignment only. Never notes, AI text or reporter data. */
export function casesToCsv(rows: CaseRecord[], assign: Record<string, string>, header: string[]): string {
  const lines = [header, ...rows.map((c) => [c.ref, c.title, c.category, c.area, c.status, c.createdAt, assign[c.ref] ?? ""])];
  return lines.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Plain template reply draft (placeholder for the AI reply-draft endpoint, which does not exist yet). Staff edit before sending. */
export function templateReply(c: Pick<CaseRecord, "title" | "status">, lang: "bn" | "en"): string {
  if (lang === "bn") {
    return `আপনার জানানো “${c.title}” বিষয়টির জন্য ধন্যবাদ। আমরা বিষয়টি দেখছি। ${c.status === "referred" ? "সংশ্লিষ্ট সংস্থাকে জানানো হয়েছে।" : "প্রয়োজনে আপনার কাছে আরও তথ্য চাইব।"} অগ্রগতি এই পাতায় জানানো হবে।`;
  }
  return `Thank you for reporting “${c.title}”. We are looking into it. ${c.status === "referred" ? "The responsible agency has been informed." : "We may ask you for more information."} Progress will be posted on this page.`;
}

export type CopilotItem = "summary" | "missing" | "similar" | "routing" | "reply";
export type Decision = "accepted" | "edited" | "dismissed";
export interface CopilotLog { ref: string; item: CopilotItem; decision: Decision; at: string }
