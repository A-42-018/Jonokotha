// Banglish search (F5.16, masterplan 19.1): "rasta bhanga" finds "রাস্তা ভাঙা". Client-side over what is already loaded; the
// server-side transliteration index that covers every record is B5.11. Matching is deliberately loose (it ignores vowels),
// so it can over-match a little; it only ever adds matches to the plain text match, never removes one.
import { toLatinDigits } from "./numerals";

const CONSONANTS: Record<string, string> = {
  "ক": "k", "খ": "k", "গ": "g", "ঘ": "g", "ঙ": "ng", "চ": "c", "ছ": "c", "জ": "j", "ঝ": "j", "ঞ": "n", "ট": "t", "ঠ": "t", "ড": "d", "ঢ": "d",
  "ণ": "n", "ত": "t", "থ": "t", "দ": "d", "ধ": "d", "ন": "n", "প": "p", "ফ": "f", "ব": "b", "ভ": "b", "ম": "m", "য": "j", "র": "r", "ল": "l",
  "শ": "s", "ষ": "s", "স": "s", "হ": "h", "ড়": "r", "ঢ়": "r", "য়": "", "ৎ": "t", "ং": "ng", "ঃ": "", "ঁ": "",
};

/** Consonant skeleton of a Latin word: lower case, vowels and "h" dropped, similar letters folded, doubles collapsed. */
function latinSkeleton(s: string): string {
  return s.toLowerCase()
    .replace(/ph/g, "f").replace(/(?:ch|sh|th|dh|kh|gh|bh|jh)/g, (m) => m[0]).replace(/z/g, "j").replace(/q/g, "k").replace(/v/g, "b").replace(/x/g, "ks").replace(/[wy]/g, "")
    .replace(/[aeiouh]/g, "").replace(/(.)\1+/g, "$1");
}

/** Skeleton of any text: Bangla letters read as their usual Latin consonants, everything else as typed, non-letters dropped. */
export function skeleton(text: string): string {
  let out = "";
  for (const ch of toLatinDigits(text.normalize("NFC"))) {
    if (CONSONANTS[ch] !== undefined) out += CONSONANTS[ch];
    else if (/[a-zA-Z0-9]/.test(ch)) out += ch;
    else if (/[\s]/.test(ch)) out += " ";
  }
  return out.split(/\s+/).filter(Boolean).map((w) => (/\d/.test(w) ? w : latinSkeleton(w))).join(" ");
}

const hasLatinLetters = (s: string) => /[a-zA-Z]/.test(s);

/** True when `text` contains `query`: as plain text (either digit set), or, for a Latin-letter query, by sound. */
export function matchesQuery(text: string, query: string): boolean {
  const q = toLatinDigits(query.trim().toLowerCase());
  if (!q) return true;
  if (toLatinDigits(text.toLowerCase()).includes(q)) return true;
  if (!hasLatinLetters(q)) return false;
  const sq = skeleton(q);
  if (sq.replace(/\s/g, "").length < 2) return false;
  return skeleton(text).includes(sq);
}
