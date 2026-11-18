/**
 * Input clean-up for the land helper (voice commands and the AI helper): digits, case, and Bangla typed in Latin letters ("Banglish").
 * Pure and client-safe. The Banglish table is ported from LandShield BD (backend/app/services/assistant/normalize.py).
 * The output is for MATCHING only, never shown as a translation.
 */
import { normalizeDigits } from "../digits";

export const BANGLISH: Record<string, string> = {
  report: "রিপোর্ট", ripor: "রিপোর্ট", riport: "রিপোর্ট", problem: "সমস্যা", somossa: "সমস্যা", shomosha: "সমস্যা", samasya: "সমস্যা", complaint: "সমস্যা", ovijog: "সমস্যা", obhijog: "সমস্যা",
  idea: "আইডিয়া", aidia: "আইডিয়া", ideas: "আইডিয়া",
  mp: "এমপি", empi: "এমপি", sangsad: "সংসদ", songsod: "সংসদ",
  poll: "পোল", polls: "পোল", vote: "ভোট", vot: "ভোট",
  rti: "আরটিআই", tothyo: "তথ্য", tathya: "তথ্য", odhikar: "অধিকার",
  help: "সাহায্য", sahajjo: "সাহায্য", shahajjo: "সাহায্য", guide: "গাইড",
  login: "লগইন", signin: "লগইন", logout: "লগআউট",
  privacy: "গোপনীয়তা", gopon: "গোপন", terms: "শর্ত", about: "সম্পর্কে", settings: "সেটিংস", setting: "সেটিংস", home: "হোম", back: "ফিরে",
  notification: "নোটিফিকেশন", notifications: "নোটিফিকেশন", project: "প্রকল্প", projects: "প্রকল্প", prokolpo: "প্রকল্প",
  area: "এলাকা", elaka: "এলাকা", budget: "বাজেট", bajet: "বাজেট",
  contact: "যোগাযোগ", jogajog: "যোগাযোগ", language: "ভাষা", bhasha: "ভাষা", bangla: "বাংলা", english: "ইংরেজি",
  land: "জমি", jomi: "জমি", jami: "জমি", zomi: "জমি", bhumi: "ভূমি", vumi: "ভূমি", namjari: "নামজারি", mutation: "নামজারি", khatian: "খতিয়ান", khotian: "খতিয়ান", dolil: "দলিল", deed: "দলিল", porcha: "পর্চা", mouza: "মৌজা", tahsil: "তহসিল", office: "অফিস", ofis: "অফিস",
  kinbo: "কিনব", kinte: "কিনতে", kena: "কেনা", buy: "কিনতে",
  dhonnobad: "ধন্যবাদ", dhanyabad: "ধন্যবাদ", thanks: "ধন্যবাদ", thank: "ধন্যবাদ", shukriya: "ধন্যবাদ",
  hello: "হ্যালো", hi: "হ্যালো", salam: "সালাম", assalamualaikum: "সালাম", nomoshkar: "নমস্কার",
};
/** Keys of the table that are plain English words (they map to Bangla for matching, but typing them does not make a message Banglish). */
const ENGLISH_KEYS = new Set("report problem complaint idea ideas mp poll polls vote rti help guide login signin logout privacy terms about settings setting home back notification notifications project projects area budget contact language english land mutation deed office buy thanks thank hello hi".split(" "));

const GLUE = new Set("ami amar apnar ki kivabe kibhabe kothay kotha koto ache achhe nai chai korbo korte koren kori dekhbo dekhte janbo jante bolen bolun kemne keno hobe lagbe dorkar ta ti er r o ar kore".split(" "));
const BENGALI = /[ঀ-৿]/;
const LATIN_WORD = /[a-z]+/g;

/** Trim, NFC, drop zero-width marks, Bangla digits to ASCII, lowercase Latin, one space. */
export function clean(text: string): string {
  return normalizeDigits((text ?? "").normalize("NFC").replace(/[​-‍﻿]/g, "")).replace(/\s+/g, " ").trim().toLowerCase();
}

/** `clean` plus the Banglish and English-keyword table, so "namjari kharcha" reads like "নামজারি খরচ". */
export function normalize(text: string): string {
  return clean(text).replace(LATIN_WORD, (w) => BANGLISH[w] ?? w).normalize("NFC");
}

/** Matching form: long vowels fold to short, so কী/কি and ভূমি/ভুমি match either way. */
export const fold = (s: string): string => s.normalize("NFC").replace(/ী/g, "ি").replace(/ূ/g, "ু");

/** Words of normalised text: Latin or digit runs, and Bengali runs. */
export const tokens = (s: string): string[] => fold(s).match(/[a-z0-9]+|[ঀ-৿]+/g) ?? [];

/** The language to answer in: Bangla script means bn; Latin means en unless it is Banglish (then the page language). */
export function replyLang(text: string, page: "bn" | "en"): "bn" | "en" {
  const raw = clean(text);
  if (BENGALI.test(raw)) return "bn";
  const words = raw.match(LATIN_WORD) ?? [];
  if (words.length === 0 || words.some((w) => GLUE.has(w))) return page;
  return words.every((w) => w in BANGLISH && !ENGLISH_KEYS.has(w)) ? page : "en";
}
