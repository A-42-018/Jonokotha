import { inCountryBox } from "./country";
import type { Lang } from "./i18n";

/** SAMPLE places (নমুনা) for area search until a real gazetteer/geocoder is chosen (Nominatim terms need review). */
export interface Place { id: string; bn: string; en: string; lat: number; lng: number }
export const SAMPLE_PLACES: Place[] = [
  { id: "w1", bn: "ওয়ার্ড ১ (নমুনা)", en: "Ward 1 (sample)", lat: 23.7938, lng: 90.3702 },
  { id: "w2", bn: "ওয়ার্ড ২ (নমুনা)", en: "Ward 2 (sample)", lat: 23.8012, lng: 90.3611 },
  { id: "w3", bn: "ওয়ার্ড ৩ (নমুনা)", en: "Ward 3 (sample)", lat: 23.8069, lng: 90.3687 },
  { id: "w4", bn: "ওয়ার্ড ৪ (নমুনা)", en: "Ward 4 (sample)", lat: 23.8151, lng: 90.3722 },
  { id: "w5", bn: "ওয়ার্ড ৫ (নমুনা)", en: "Ward 5 (sample)", lat: 23.8227, lng: 90.3659 },
];

const BN = "০১২৩৪৫৬৭৮৯";
const norm = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d))).toLowerCase().trim();

export function searchPlaces(q: string, lang: Lang, list: Place[] = SAMPLE_PLACES): Place[] {
  const n = norm(q);
  if (!n) return [];
  return list.filter((p) => norm(p[lang]).includes(n) || norm(p.bn).includes(n) || norm(p.en).includes(n));
}

export interface Pin { lat: number; lng: number }
/** Coordinates inside the active country's bounding box only (rejects 0,0 and out-of-country taps). */
export const inCountry = (p: Pin) => inCountryBox(p.lat, p.lng);
/** @deprecated kept for older imports; same as `inCountry`. */
export const inBangladesh = inCountry;
