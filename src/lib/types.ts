import { z } from "zod";
import { CATEGORIES, type Category } from "./categories";

export { CATEGORIES };
export type { Category };

export const IntakeDraft = z.object({
  title: z.string().min(3).max(120),
  category: z.enum(CATEGORIES),
  description: z.string().min(3).max(2000),
  area: z.string().max(120).default(""),
});
export type IntakeDraft = z.infer<typeof IntakeDraft>;

export const CaseInput = IntakeDraft.extend({ constituencyId: z.string().default("demo-1") });

/** Legacy 4-state label set the current UI knows. Still the type of CaseRecord.status. */
export type Status = "received" | "acknowledged" | "referred" | "resolved";

/** The real 13-state model (masterplan §9). CaseRecord.statusDetail carries it; the UI can adopt it when ready. */
export const ISSUE_STATUSES = [
  "submitted", "under_review", "needs_information", "acknowledged", "assigned", "referred_to_authority", "in_progress",
  "resolved", "closed", "rejected", "duplicate", "out_of_jurisdiction", "reopened",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface CaseRecord extends IntakeDraft {
  ref: string;
  constituencyId: string;
  status: Status;
  /** Added in Phase 1 (additive): the precise state. `status` is a mapped, coarser label for older UI code. */
  statusDetail?: IssueStatus;
  createdAt: string;
  timeline: { status: Status; at: string; note?: string }[];
  ai: { summary: string; similarRefs: string[]; agencyId: string; confidence: number };
}

export interface Agency { id: string; nameBn: string; nameEn: string; categories: Category[]; source: string; url?: string; checkedAt?: string }

/** Imminent-harm result (Phase 3, backend M.8). Returned by POST /ai/intake (`source: "emergency"`), POST /issues and POST /questions.
 *  The UI shows `guidance` prominently, in the user's language, and never replaces it with model text. Wording is a draft pending review. */
export type EmergencyKind = "self_harm" | "violence" | "child_in_danger";
export interface Emergency { kind: EmergencyKind; guidance: { bn: string; en: string }; numbers: string[] }
