import { z } from "zod";
import { runAgent } from "./ai/run";
import { INTAKE_V1, SUMMARY_V1 } from "./ai/prompts";
import { CATEGORIES, IntakeDraft, type Category } from "./types";
import { redactPii, type PiiKind } from "./pii";

const KEYWORDS: Record<Category, string[]> = {
  roads: ["রাস্তা","গর্ত","road","pothole"], drainage: ["ড্রেন","নালা","drain"], water: ["পানি","টিউবওয়েল","water"],
  electricity: ["বিদ্যুৎ","লাইট","বাতি","electric","power"], waste: ["ময়লা","আবর্জনা","waste","garbage"],
  flooding: ["জলাবদ্ধ","বন্যা","flood"], health: ["হাসপাতাল","ক্লিনিক","স্বাস্থ্য","hospital"],
  education: ["স্কুল","শিক্ষা","school"], safety: ["চুরি","ছিনতাই","নিরাপত্তা","theft"],
  environment: ["দূষণ","গাছ","pollution"], facilities: ["পার্ক","মাঠ","public toilet"], other: [],
};

export function heuristicDraft(text: string): IntakeDraft {
  const t = text.trim();
  const lower = t.toLowerCase();
  let category: Category = "other";
  let best = Infinity;
  for (const c of CATEGORIES) {
    for (const k of KEYWORDS[c]) {
      const i = lower.indexOf(k.toLowerCase());
      if (i >= 0 && i < best) { best = i; category = c; }
    }
  }
  const first = t.split(/[।.\n]/)[0].slice(0, 80) || t.slice(0, 80);
  return { title: first, category, description: t, area: "" };
}

export interface AiContext { actorId?: string | null; requestId?: string | null }

export async function draftFromText(input: string, ctx: AiContext = {}): Promise<{ draft: IntakeDraft; source: "ai" | "fallback"; pii: PiiKind[] }> {
  // Personal data never reaches the model: redact first, and tell the UI what was removed.
  const { text, found: pii } = redactPii(input);
  const out = await runAgent({
    agent: "intake", prompt: INTAKE_V1, schema: IntakeDraft, input: text.slice(0, 3000), maxTokens: 600, ...ctx,
    tool: { name: "submit_draft", description: "Return the drafted civic report: title, category, description and the place the citizen named (or empty)." },
  });
  // Timeout, refusal, malformed output or no key: the manual (keyword) path, never an error for the citizen.
  return out.ok ? { draft: out.data, source: "ai", pii } : { draft: heuristicDraft(text), source: "fallback", pii };
}

const Summary = z.object({ summary: z.string().trim().min(1).max(300) });

export async function summarize(d: IntakeDraft, ctx: AiContext = {}): Promise<string> {
  const out = await runAgent({
    agent: "intake", prompt: SUMMARY_V1, schema: Summary, input: redactPii(`${d.title}\n${d.description}\n${d.area}`).text, maxTokens: 200, ...ctx,
    tool: { name: "submit_summary", description: "Return a one-sentence summary of the report." },
  });
  return out.ok ? out.data.summary : "";
}
