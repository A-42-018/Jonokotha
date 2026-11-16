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

export type Status = "received" | "acknowledged" | "referred" | "resolved";

export interface CaseRecord extends IntakeDraft {
  ref: string;
  constituencyId: string;
  status: Status;
  createdAt: string;
  timeline: { status: Status; at: string; note?: string }[];
  ai: { summary: string; similarRefs: string[]; agencyId: string; confidence: number };
}

export interface Agency { id: string; nameBn: string; nameEn: string; categories: Category[]; source: string; url?: string; checkedAt?: string }
