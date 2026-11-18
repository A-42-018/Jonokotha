import { toLatinDigits } from "../numerals";

/**
 * Numbers written out in Bangla words before a voice reads them. Bangla voices read digits badly (or skip them), and a text may write the same number as
 * ১,১৭০, ১১৭০ or 1,170. So every Bangla line goes through here first: ২০২৬ → দুই হাজার ছাব্বিশ, ১,২৩,৪৫৬ → এক লাখ তেইশ হাজার চারশো ছাপ্পান্ন, ৳৫০০ → পাঁচশো টাকা,
 * ৫% → পাঁচ শতাংশ, ১/৪ → চার ভাগের এক ভাগ, ১৫-২০ → পনেরো থেকে বিশ, ২:১ → দুই অনুপাত এক. Numbers that are NOT quantities (the emergency numbers 999, 109, 1098; phone
 * and ID numbers; anything with leading zeros or eight or more digits) are read one digit at a time. Ported from LandShield BD (bangla_speech_text.py), trimmed.
 * Pure and client-safe. English text is left alone.
 */
const UNDER_100 = ("শূন্য এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগারো বারো তেরো চৌদ্দ পনেরো ষোলো সতেরো আঠারো উনিশ " +
  "বিশ একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আঠাশ ঊনত্রিশ ত্রিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ পঁয়ত্রিশ ছত্রিশ সাঁইত্রিশ আটত্রিশ ঊনচল্লিশ চল্লিশ " +
  "একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ ছেচল্লিশ সাতচল্লিশ আটচল্লিশ ঊনপঞ্চাশ পঞ্চাশ একান্ন বাহান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন আটান্ন ঊনষাট ষাট " +
  "একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি ঊনসত্তর সত্তর একাত্তর বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর ঊনআশি আশি " +
  "একাশি বিরাশি তিরাশি চুরাশি পঁচাশি ছিয়াশি সাতাশি আটাশি ঊননব্বই নব্বই একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই").split(" ");
const UNITS: [number, string][] = [[1e7, "কোটি"], [1e5, "লাখ"], [1000, "হাজার"], [100, "শো"]];
/** Read one digit at a time, never as a quantity. */
const FIXED = new Set(["999", "109", "1098", "16430", "16122"]);

export function numberWords(n: number): string {
  if (n < 100) return UNDER_100[n];
  const parts: string[] = [];
  for (const [unit, name] of UNITS) {
    if (n >= unit) { const q = Math.floor(n / unit); n %= unit; parts.push(unit === 100 ? `${numberWords(q)}শো` : `${numberWords(q)} ${name}`); }
  }
  if (n) parts.push(UNDER_100[n]);
  return parts.join(" ");
}
export const spellDigits = (s: string): string => [...s].map((d) => UNDER_100[Number(d)]).join(" ");

const NUM = "[0-9০-৯]+(?:,[0-9০-৯]+)*(?:\\.[0-9০-৯]+)?";
const D = (s: string) => toLatinDigits(s);

function read(raw: string): string {
  const digits = D(raw);
  if (FIXED.has(digits)) return spellDigits(digits);
  if (/^\d{1,3}(?:,\d{2,3})+$/.test(digits)) { const n = Number(digits.replace(/,/g, "")); return n < 1e12 ? numberWords(n) : spellDigits(digits.replace(/,/g, "")); }
  if (digits.includes(",")) return digits.split(",").map(read).join(", ");
  const [whole, frac] = digits.split(".");
  const spoken = whole.length >= 8 || (whole.length >= 3 && whole[0] === "0") ? spellDigits(whole) : numberWords(Number(whole));
  return frac ? `${spoken} দশমিক ${spellDigits(frac)}` : spoken;
}

/** The text with every number written out in Bangla words. */
export function speakableBangla(text: string): string {
  let t = text;
  t = t.replace(/(?<![\w/.])([0-9০-৯]{1,2})\s*\/\s*([0-9০-৯]{1,2})(?![\w/.])/g, (m, a: string, b: string) => {
    const top = Number(D(a)), bottom = Number(D(b));
    if (![2, 3, 4, 5, 6, 8, 10, 12, 16, 24].includes(bottom) || !(top > 0 && top < bottom)) return m;
    return top === 1 && bottom === 2 ? "অর্ধেক" : `${numberWords(bottom)} ভাগের ${numberWords(top)} ভাগ`;
  });
  t = t.replace(/(?<![\w:.])([0-9০-৯]{1,2}):([0-9০-৯]{1,2})(?![\w:])/g, (_m, a: string, b: string) => {
    const x = Number(D(a)), y = Number(D(b));
    if (b.length === 2 && x <= 24 && y <= 59) return y === 0 ? `${numberWords(x)}টা` : `${numberWords(x)}টা ${numberWords(y)} মিনিট`;
    return `${numberWords(x)} অনুপাত ${numberWords(y)}`;
  });
  t = t.replace(new RegExp(`৳\\s*(${NUM})(\\s*টাকা)?`, "g"), (_m, n: string) => `${read(n)} টাকা`);
  t = t.replace(new RegExp(`(${NUM})\\s*%`, "g"), (_m, n: string) => `${read(n)} শতাংশ`);
  t = t.replace(new RegExp(`(?<![\\w.,-])(${NUM})\\s*[-–—]\\s*(${NUM})(?![\\w.,-])`, "g"), (m, a: string, b: string) => {
    for (const p of [D(a), D(b)]) if ((p.length > 1 && p[0] === "0") || p.split(".")[0].replace(/,/g, "").length >= 8) return m;
    return `${read(a)} থেকে ${read(b)}`;
  });
  // a number glued to a letter code (MUT-2026, LP10001) is part of the code: left to the voice
  t = t.replace(new RegExp(`(?<![A-Za-z][-/_#]?)(?<![\\w.,])(${NUM})(?![\\w.])`, "g"), (_m, n: string) => read(n));
  return t;
}
