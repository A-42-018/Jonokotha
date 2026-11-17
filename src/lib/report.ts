import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import type { Dict } from "@/lib/i18n";
import { REPORT_DESC_MAX } from "@/lib/report-extras";

export const DRAFT_KEY = "jonokotha:report-draft:v2";
export const LEGACY_DRAFT_KEY = "jonokotha:report-draft:v1";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Phone (BD mobile, with or without +880) or a long digit run (NID, passport, bank-like numbers). */
export function hasPersonalNumber(raw: string) {
  const s = raw.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  if (/(?:\+?880|0)\s*1[3-9](?:[\s-]?\d){8}/.test(s)) return true;
  return /\d(?:[\s-]?\d){9,}/.test(s);
}

export const FIELDS = ["category", "title", "description", "area"] as const;
export type ReportField = (typeof FIELDS)[number];

/** Zod schema with messages in the current language. Limits match the API's `CaseInput`. */
export function reportSchema(t: Dict) {
  return z.object({
    category: z.enum(CATEGORIES, { error: t.errCategory }),
    title: z.string().trim().min(3, t.errTitleMin).max(120, t.errTitleMax),
    description: z.string().trim().min(10, t.errDescMin).max(REPORT_DESC_MAX, t.errDescMax),
    area: z.string().trim().min(2, t.errAreaMin).max(120, t.errAreaMax),
  });
}
export type ReportValues = z.input<ReturnType<typeof reportSchema>>;
export type ReportData = z.output<ReturnType<typeof reportSchema>>;

/** Fields validated at each wizard step (category, describe, location, evidence, review). */
export const STEP_FIELDS: ReportField[][] = [["category"], ["title", "description"], ["area"], [], []];

export const MAX_PHOTOS = 3;
export const MAX_CAPTION = 140;
