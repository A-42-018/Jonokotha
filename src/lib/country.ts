/**
 * Country adapter (masterplan 2.8.4, F5.12). Everything that differs from one country to the next lives here as data:
 * name, time zone, locale tags, currency, bounding box, administrative level names and cost bands. Shared components read
 * `country()` and never name a country themselves. Bangladesh is the first adapter.
 *
 * Not on the server yet (B5.12): the documented `GET /config/country` that will replace this built-in table. Until then
 * `NEXT_PUBLIC_COUNTRY` (an ISO code present in ADAPTERS) picks the adapter, and the default is "BD".
 */
import type { Lang } from "./i18n";
import { digitSet } from "./numerals";

type Pair = { bn: string; en: string };

export interface CountryConfig {
  code: string;
  name: Pair;
  /** IANA time zone used to show dates and to count calendar days. */
  timezone: string;
  /** Locale tags for number and date formatting, per UI language. */
  locale: Record<Lang, string>;
  /** Locale tag handed to browser speech recognition, per UI language. */
  speechLocale: Record<Lang, string>;
  currency: { code: string; symbol: string };
  /** How the integer part of an amount is grouped: "indian" is 12,34,567 (lakh and crore), "western" is 1,234,567. */
  grouping: "indian" | "western";
  /** Outer box of the country; a cheap check before the server judges real boundaries. */
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  /** Names of the administrative levels, top first. The server's area hierarchy labels win when present. */
  hierarchy: Pair[];
  /** Idea cost bands as shown in the form (small, medium, large). */
  costBands: Record<"s" | "m" | "l", Pair>;
}

const BANGLADESH: CountryConfig = {
  code: "BD",
  name: { bn: "বাংলাদেশ", en: "Bangladesh" },
  timezone: "Asia/Dhaka",
  locale: { bn: "bn-BD", en: "en-GB" },
  speechLocale: { bn: "bn-BD", en: "en-US" },
  currency: { code: "BDT", symbol: "৳" },
  grouping: "indian",
  bbox: { minLat: 20.5, maxLat: 26.8, minLng: 88.0, maxLng: 92.8 },
  hierarchy: [
    { bn: "জেলা", en: "District" },
    { bn: "উপজেলা বা সিটি", en: "Upazila or city" },
    { bn: "ওয়ার্ড বা ইউনিয়ন", en: "Ward or union" },
  ],
  costBands: {
    s: { bn: "কম (১ লাখ টাকার নিচে)", en: "Low (under 1 lakh taka)" },
    m: { bn: "মাঝারি (১–১০ লাখ টাকা)", en: "Medium (1–10 lakh taka)" },
    l: { bn: "বেশি (১০ লাখ টাকার বেশি)", en: "High (over 10 lakh taka)" },
  },
};

export const ADAPTERS: Record<string, CountryConfig> = { BD: BANGLADESH };

let active: CountryConfig = ADAPTERS[(process.env.NEXT_PUBLIC_COUNTRY ?? "BD").toUpperCase()] ?? BANGLADESH;

/** The adapter in use. */
export const country = (): CountryConfig => active;

/** Test and future server-config hook. Returns false (and changes nothing) for a code with no adapter. */
export function useCountry(code: string): boolean {
  const next = ADAPTERS[code.toUpperCase()];
  if (!next) return false;
  active = next;
  return true;
}

/** Coordinates inside the active country's outer box. Rejects swapped, zero and foreign points. */
export function inCountryBox(lat: number, lng: number): boolean {
  const b = active.bbox;
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

export const countryName = (lang: Lang) => active.name[lang];

/** Name of administrative level `index` (0 = top), or undefined past the configured depth. */
export const levelName = (index: number, lang: Lang): string | undefined => active.hierarchy[index]?.[lang];

/** Groups the digits of a whole number: lakh and crore style (12,34,567) or thousands (1,234,567), per the country. */
export function groupDigits(whole: string, grouping: "indian" | "western" = active.grouping): string {
  if (whole.length <= 3) return whole;
  if (grouping === "western") return whole.replace(/\B(?=(\d{3})+$)/g, ",");
  return `${whole.slice(0, -3).replace(/\B(?=(\d{2})+$)/g, ",")},${whole.slice(-3)}`;
}

/** An amount with the currency symbol, grouped the local way (৳১২,৩৪,৫৬৭ in bn, ৳12,34,567 with Latin digits). */
export function fmtMoney(amount: number, lang: Lang): string {
  const rounded = Math.round(Math.abs(amount));
  const text = `${amount < 0 ? "-" : ""}${active.currency.symbol}${groupDigits(String(rounded))}`;
  return digitSet(lang) === "bn" ? text.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : text;
}

/** Label of an idea cost band ("s", "m" or "l"); empty for anything else. */
export function costLabel(band: string, lang: Lang): string {
  return active.costBands[band as "s" | "m" | "l"]?.[lang] ?? "";
}
