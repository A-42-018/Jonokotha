/**
 * B8.8 neutrality guard for summaries of parliamentary records. A heuristic, not proof: it blocks the obvious evaluative words (Bangla and English) so
 * a summary describes WHAT the record says and never judges the MP. A human reviewer is still required before anything is published.
 */
const BN = ["ভালো", "ভাল", "খারাপ", "দুর্দান্ত", "চমৎকার", "ব্যর্থ", "সফল", "অসাধারণ", "নিষ্ক্রিয়", "সক্রিয়", "অযোগ্য", "দক্ষ", "অদক্ষ", "নিন্দনীয়", "প্রশংসনীয়", "হতাশাজনক", "দায়িত্বজ্ঞানহীন", "সেরা", "নিকৃষ্ট", "ধারাবাহিকভাবে", "অনুপস্থিত"];
const EN = ["best", "worst", "good", "bad", "poor", "excellent", "failed", "failure", "successful", "active", "inactive", "lazy", "effective", "ineffective", "outstanding", "disappointing", "irresponsible", "score", "rank", "ranking", "rating"];
export function evaluativeWords(text: string): string[] {
  const found: string[] = [];
  for (const w of BN) if (text.includes(w)) found.push(w);
  const words: string[] = text.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const w of EN) if (words.includes(w)) found.push(w);
  return found;
}
