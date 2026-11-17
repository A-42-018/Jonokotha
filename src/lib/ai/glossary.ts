/**
 * Bangla glossary shared by every agent (B5.10; masterplan §17.5). Terms that must be written one way so the product sounds like itself and
 * so reviewers can check adherence (tests/unit/glossary.test.ts and the eval dataset's glossary check). Plain everyday Bangla (চলিত).
 */
export const GLOSSARY: { en: string; bn: string; note?: string }[] = [
  { en: "constituency", bn: "নির্বাচনী এলাকা" }, { en: "Member of Parliament / MP", bn: "সংসদ সদস্য (এমপি)" }, { en: "MP office", bn: "এমপি অফিস" },
  { en: "issue / report (a citizen's problem)", bn: "সমস্যা", note: "not অভিযোগ, which sounds like a legal complaint" }, { en: "reference number", bn: "নম্বর" },
  { en: "idea", bn: "আইডিয়া" }, { en: "question", bn: "প্রশ্ন" }, { en: "poll", bn: "জনমত যাচাই" }, { en: "project", bn: "প্রকল্প" }, { en: "announcement", bn: "ঘোষণা" },
  { en: "agency", bn: "সংস্থা" }, { en: "forwarded to an agency", bn: "সংশ্লিষ্ট সংস্থায় পাঠানো হয়েছে" }, { en: "officially registered", bn: "সংস্থা আনুষ্ঠানিকভাবে নথিভুক্ত করেছে", note: "only when confirmed; never imply it" },
  { en: "resolved (reported resolved)", bn: "সমাধান হয়েছে বলে জানানো হয়েছে" }, { en: "appeal", bn: "আপিল" }, { en: "notification", bn: "বিজ্ঞপ্তি" }, { en: "sample / demo data", bn: "নমুনা তথ্য" },
];

/** The glossary as prompt text. Stable (never changes between requests), so it sits first in the system prompt and can be cached. */
export function glossaryText(): string {
  return "BANGLA GLOSSARY (use exactly these Bangla terms): " + GLOSSARY.map((g) => `${g.en} = ${g.bn}${g.note ? ` (${g.note})` : ""}`).join("; ") + ".";
}

/** Does Bangla output avoid the discouraged variants? Used by tests and the eval gate. */
export function glossaryViolations(bn: string): string[] {
  const out: string[] = [];
  if (/অভিযোগ/.test(bn)) out.push("অভিযোগ (use সমস্যা)");
  if (/\bMP\b/.test(bn)) out.push("MP in Latin letters (use এমপি or সংসদ সদস্য)");
  return out;
}
