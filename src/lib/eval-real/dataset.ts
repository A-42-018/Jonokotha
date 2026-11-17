import { z } from "zod";

/** The shape returned by GET /api/v1/admin/ai/eval-set (database function eval_set_export). */
export const RealExport = z.object({
  generated_at: z.string(),
  examples: z.array(z.object({
    id: z.string().regex(/^real-[0-9a-f]{10}$/), text: z.string().min(10).max(2000), category: z.string(),
    language: z.enum(["bn", "en", "mixed"]), expected_agency: z.string().nullable(), source: z.literal("consented_real"),
  })),
});

export interface EvalCase { id: string; lang: "bn" | "en" | "banglish"; text: string; category: string; agency: string; area: string; real: true }

/**
 * Turns the consented export into cases for tests/ai/eval.run.ts (set EVAL_REAL_EXPORT=path to the downloaded JSON).
 * The file is personal-adjacent data: keep it out of git (it is ignored) and out of shared folders. Cases with no expected agency
 * count for category accuracy only (agency "").
 */
export function realExamplesToCases(raw: unknown): EvalCase[] {
  const parsed = RealExport.parse(raw);
  return parsed.examples.map((e) => ({ id: e.id, lang: e.language === "mixed" ? "banglish" : e.language, text: e.text, category: e.category, agency: e.expected_agency ?? "", area: "", real: true }));
}
