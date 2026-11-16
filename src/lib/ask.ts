/** Ask Your MP (§7.8): a private message or a public question (public only after moderation). */
export type AskKind = "private" | "public";
export interface AskMessage { id: string; kind: AskKind; topic: string; subject: string; message: string; at: string }

export const ASK_KEY = "jonokotha:ask:v1";
export const NO_ASKS: AskMessage[] = [];
export const TOPICS = ["roads", "water", "health", "education", "safety", "jobs", "other"] as const;
export type Topic = (typeof TOPICS)[number];

export const RATE_MAX = 3;
const DAY = 86_400_000;

/** Anti-spam: at most RATE_MAX messages per rolling 24 hours (also enforced by the server when it exists). */
export function remainingToday(list: AskMessage[], now: number, max = RATE_MAX): number {
  const recent = list.filter((m) => now - new Date(m.at).getTime() < DAY).length;
  return Math.max(0, max - recent);
}

export function validateAsk(v: { kind: string; topic: string; subject: string; message: string }) {
  const e: { kind?: true; topic?: true; subject?: true; message?: true } = {};
  if (v.kind !== "private" && v.kind !== "public") e.kind = true;
  if (!(TOPICS as readonly string[]).includes(v.topic)) e.topic = true;
  if (v.subject.trim().length < 5) e.subject = true;
  if (v.message.trim().length < 10) e.message = true;
  return e;
}

/** SAMPLE FAQ (নমুনা): in production only verified office answers appear here. */
export const SAMPLE_FAQ = [
  { id: "f1", qBn: "নমুনা: অফিসে সমস্যা জানানোর পর কত দিনে উত্তর পাওয়া যায়?", qEn: "Sample: how long until I get a reply after reporting to the office?", aBn: "সাধারণত কয়েক দিনের মধ্যে প্রথম সাড়া দেওয়ার চেষ্টা করা হয়। নির্দিষ্ট সময়ের প্রতিশ্রুতি নয়। (নমুনা উত্তর)", aEn: "The office usually tries to respond within a few days. This is not a fixed promise. (sample answer)" },
  { id: "f2", qBn: "নমুনা: জরুরি বিপদে কী করব?", qEn: "Sample: what do I do in an emergency?", aBn: "জরুরি বিপদে ৯৯৯-এ ফোন করুন। এই প্ল্যাটফর্ম জরুরি সেবা নয়। (নমুনা উত্তর)", aEn: "In an emergency call 999. This platform is not an emergency service. (sample answer)" },
];
