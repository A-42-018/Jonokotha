// Digit sets and the numeral preference (F5.16, masterplan 19.1). Pure and client-safe.
import type { Lang } from "./i18n";

/** "auto" follows the page language: Bangla digits in bn, Latin digits in en. */
export type Numerals = "auto" | "bn" | "latin";
export const NUMERALS_KEY = "jonokotha:numerals:v1";
/** Stable reference: `useLocalValue` needs it. */
export const DEFAULT_NUMERALS: Numerals = "auto";

const BN = "০১২৩৪৫৬৭৮৯";
/** Reads a stored value safely: anything unknown falls back to "auto". */
export const cleanNumerals = (v: unknown): Numerals => (v === "bn" || v === "latin" ? v : "auto");

let active: Numerals = "auto";
/** Set from the Settings choice (device-local until B5.11 stores the preference on the account). */
export function setNumerals(n: Numerals) { active = cleanNumerals(n); }
export const getNumerals = (): Numerals => active;

/** Which digit set a page in `lang` shows, after the preference. */
export function digitSet(lang: Lang, pref: Numerals = active): "bn" | "latin" {
  return pref === "auto" ? (lang === "bn" ? "bn" : "latin") : pref;
}

/** Latin digits for any Bangla digits in `s` (use before parsing or sending phone numbers and codes). */
export const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
/** Bangla digits for any Latin digits in `s`. */
export const toBanglaDigits = (s: string) => s.replace(/[0-9]/g, (d) => BN[Number(d)]);
/** Digits of `s` in the set a page in `lang` shows. */
export const withDigits = (s: string, lang: Lang, pref: Numerals = active) => (digitSet(lang, pref) === "bn" ? toBanglaDigits(s) : toLatinDigits(s));

/** A phone number or code as typed: both digit sets accepted, spaces, dashes and brackets dropped, a leading + kept. */
export function cleanDigits(s: string): string {
  const t = toLatinDigits(s).replace(/[\s\-().]/g, "");
  return t.startsWith("+") ? `+${t.slice(1).replace(/\D/g, "")}` : t.replace(/\D/g, "");
}
