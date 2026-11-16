// Number and date formatting. Separate from i18n.ts so client components can use it without bundling the dictionaries.
import type { Lang } from "./i18n";

/** Formats a number with Bangla digits in bn (e.g. 12 -> ১২). */
export function fmtNum(n: number, lang: Lang) {
  return n.toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { useGrouping: false });
}

/** Fills `{name}` placeholders; numeric values are formatted for the language. */
export function fillNum(template: string, values: Record<string, string | number>, lang: Lang) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = values[k];
    return typeof v === "number" ? fmtNum(v, lang) : String(v ?? "");
  });
}

export function fmtDate(iso: string, lang: Lang) {
  return new Date(iso).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
}

/** Date without time (Asia/Dhaka), Bangla digits in bn. */
export function fmtDay(iso: string, lang: Lang) {
  return new Date(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium" });
}
