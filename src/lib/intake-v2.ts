import { z } from "zod";
import { runAgent } from "./ai/run";
import { INTAKE_V2, TRANSLATE_V1 } from "./ai/prompts";
import { heuristicDraft, type AiContext } from "./intake";
import { detectEmergency, type Emergency } from "./emergency";
import { redactPii, type PiiKind } from "./pii";
import { CATEGORIES } from "./types";

export type Language = "bn" | "en";
export type Urgency = "routine" | "soon" | "urgent";

const BANGLISH = /\b(ami|amar|amader|apni|rasta|rastar|nai|nei|kharap|pani|bidyut|current|moila|nala|nordoma|bondho|hoy|hoyni|hocche|kore|dorkar|shomossha|somossha|ekhane|ekhon|onek|gorto|bhanga|jol|jomeche)\b/i;
const URGENT = /(আগুন|অগ্নি|বিদ্যুতের তার|ছেঁড়া তার|বিদ্যুৎস্পৃষ্ট|ডুবে|ধসে|ভবন ধস|গ্যাস লিক|গ্যাসের গন্ধ|মারামারি|ছুরি|অস্ত্র|\bfire\b|live wire|electrocut|drown|collapse|gas leak|stabbing|weapon)/i;

export function chooseLanguage(text: string, requested: Language | "auto"): Language {
  if (requested !== "auto") return requested;
  if (/[ঀ-৿]/.test(text)) return "bn";
  return BANGLISH.test(text) ? "bn" : "en";
}

/** Guidance is fixed text, never model-written: for danger to life the citizen is pointed to emergency services, not to a report form. */
export function urgencyGuidance(u: Urgency, lang: Language): string {
  const t = {
    urgent: { bn: "প্রাণের ঝুঁকি বা এখনই বিপদ হলে আগে ৯৯৯-এ ফোন করুন। এই রিপোর্ট জরুরি সেবার বিকল্প নয়।", en: "If anyone is in danger right now, call 999 first. A report here is not an emergency service." },
    soon: { bn: "এটা দৈনন্দিন জীবনে সমস্যা করছে। রিপোর্ট জমা দিন; অফিস কত দ্রুত দেখবে তার নিশ্চয়তা নেই।", en: "This affects daily life. Submit the report; the office cannot promise how fast it will look." },
    routine: { bn: "রিপোর্ট জমা দিলে অফিস দেখবে। আমরা সময়ের নিশ্চয়তা দিই না।", en: "Submit the report and the office will review it. We cannot promise a response time." },
  } as const;
  return t[u][lang];
}

const Out = z.object({
  title: z.string().min(3).max(120),
  category: z.enum(CATEGORIES),
  description: z.string().min(3).max(2000),
  area_hint: z.string().max(120).default(""),
  urgency: z.enum(["routine", "soon", "urgent"]),
});

export interface IntakeV2 {
  title: string; category: string; description: string; area_hint: string;
  urgency: Urgency; urgency_guidance: string; language: Language; pii_warnings: PiiKind[]; source: "ai" | "fallback" | "emergency";
  /** Set when the text suggests danger to life. The citizen sees fixed guidance and no model is called. */
  emergency?: Emergency;
}

/** Drafts a report from free text. It never submits anything; the citizen reviews and submits. */
export async function draftIntakeV2(raw: string, requested: Language | "auto", ctx: AiContext = {}): Promise<IntakeV2> {
  const { text, found } = redactPii(raw);
  const language = chooseLanguage(raw, requested);
  // Imminent harm: rules decide, no model is called, and the answer is fixed text with emergency numbers (never an AI reply).
  const emergency = detectEmergency(raw);
  if (emergency) {
    const h = heuristicDraft(text);
    return { title: h.title.length >= 3 ? h.title : "সমস্যা", category: h.category, description: h.description, area_hint: "", urgency: "urgent", urgency_guidance: emergency.guidance[language], language, pii_warnings: found, source: "emergency", emergency };
  }
  const out = await runAgent({
    agent: "intake", prompt: INTAKE_V2, schema: Out, input: `OUTPUT_LANGUAGE: ${language}\n---\n${text.slice(0, 3000)}`, maxTokens: 700, ...ctx,
    tool: { name: "submit_draft", description: "Return the drafted civic report." },
  });
  let d: z.infer<typeof Out>, source: "ai" | "fallback";
  if (out.ok) { d = out.data; source = "ai"; }
  else { const h = heuristicDraft(text); d = { title: h.title.length >= 3 ? h.title : "সমস্যা", category: h.category, description: h.description, area_hint: "", urgency: "routine" }; source = "fallback"; }
  // Safety floor: danger words always raise urgency, whatever the model said.
  const urgency: Urgency = URGENT.test(text) ? "urgent" : d.urgency;
  return { title: d.title, category: d.category, description: d.description, area_hint: d.area_hint, urgency, urgency_guidance: urgencyGuidance(urgency, language), language, pii_warnings: found, source };
}

const Translation = z.object({ translation: z.string().min(1).max(4000) });
const HAS_BANGLA = /[ঀ-৿]/;
export interface Translated { available: boolean; translation?: string; target: Language; source: Language; original: string; machine_translated: true; label: string; reason?: string }
/** On-demand translation (B5.10). Always labelled as machine translation, the original text is always returned alongside, and a failure says why (timeout, refused, invalid output, no key) so the UI can show the original. */
export async function translateText(raw: string, to: Language, ctx: AiContext = {}): Promise<Translated> {
  const { text } = redactPii(raw);
  const source: Language = HAS_BANGLA.test(text) ? "bn" : "en";
  const base = { target: to, source, original: text, machine_translated: true as const, label: to === "bn" ? "যান্ত্রিক অনুবাদ" : "Machine translation" };
  if (source === to) return { ...base, available: true, translation: text };   // already in the target language: nothing to do, no model call
  const out = await runAgent({
    agent: "translation", prompt: TRANSLATE_V1, schema: Translation, input: `TARGET_LANGUAGE: ${to}\n---\n${text.slice(0, 2000)}`, maxTokens: 1200, ...ctx,
    tool: { name: "submit_translation", description: "Return the translated text only." },
  });
  return out.ok ? { ...base, available: true, translation: out.data.translation } : { ...base, available: false, reason: out.reason };
}
