// Number and date formatting. Separate from i18n.ts so client components can use it without bundling the dictionaries.
import { country } from "./country";
import type { Lang } from "./i18n";
import { digitSet, withDigits } from "./numerals";

/** Formats a number with the digits the page shows: Bangla in bn (12 -> ১২) and Latin in en, unless Settings chose one set. */
export function fmtNum(n: number, lang: Lang) {
  return n.toLocaleString(country().locale[lang], { useGrouping: false, numberingSystem: digitSet(lang) === "bn" ? "beng" : "latn" } as Intl.NumberFormatOptions);
}

/** Fills `{name}` placeholders; numeric values are formatted for the language. */
export function fillNum(template: string, values: Record<string, string | number>, lang: Lang) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = values[k];
    return typeof v === "number" ? fmtNum(v, lang) : String(v ?? "");
  });
}

/** Everyday Bangla day parts (ভোর, সকাল, দুপুর, বিকেল, সন্ধ্যা, রাত) for a 24-hour clock hour. */
export function bnDayPart(h: number) {
  if (h < 4) return "রাত";
  if (h < 6) return "ভোর";
  if (h < 12) return "সকাল";
  if (h < 16) return "দুপুর";
  if (h < 18) return "বিকেল";
  if (h < 20) return "সন্ধ্যা";
  return "রাত";
}

function dhakaParts(iso: string, lang: Lang) {
  const loc = country().locale[lang];
  const date = new Date(iso);
  const day = date.toLocaleDateString(loc, { timeZone: country().timezone, day: "numeric", month: lang === "bn" ? "long" : "short", year: "numeric" });
  const [h, m] = date.toLocaleTimeString("en-GB", { timeZone: country().timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).split(":").map(Number);
  return { day, h, m };
}

/** Date and time in the country time zone (Asia/Dhaka for Bangladesh). bn: "১৬ নভেম্বর ২০২৬, রাত ২:৩০" (Bangla digits and day part); en: "16 Nov 2026, 02:30". */
export function fmtDate(iso: string, lang: Lang) {
  const { day, h, m } = dhakaParts(iso, lang);
  const two = (n: number) => String(n).padStart(2, "0");
  if (lang === "en") return withDigits(`${day}, ${two(h)}:${two(m)}`, lang);
  return withDigits(`${day.replace(/,/g, "")}, ${bnDayPart(h)} ${h % 12 || 12}:${two(m)}`, lang);
}

/** Date without time (Asia/Dhaka), Bangla digits in bn: "১৬ নভেম্বর ২০২৬". */
export function fmtDay(iso: string, lang: Lang) {
  return withDigits(dhakaParts(iso, lang).day.replace(/,/g, ""), lang);
}

/**
 * Relative time for lists: today, yesterday, "N days ago" (up to 30 days), then the plain date. `now` is passed in (never read
 * here) so server and browser render the same text. Calendar days are counted in the country time zone (Asia/Dhaka for Bangladesh).
 */
export function fmtAgo(iso: string, now: number, lang: Lang) {
  const key = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: country().timezone });
  const days = Math.round((Date.parse(key(now)) - Date.parse(key(Date.parse(iso)))) / 86_400_000);
  if (days <= 0) return lang === "bn" ? "আজ" : "Today";
  if (days === 1) return lang === "bn" ? "গতকাল" : "Yesterday";
  if (days <= 30) return lang === "bn" ? `${fmtNum(days, "bn")} দিন আগে` : `${days} days ago`;
  return fmtDay(iso, lang);
}
