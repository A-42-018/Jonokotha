import { FLAGS } from "../flags-more";
import { R2 } from "../flags-r2";
import { fold, normalize, tokens } from "./normalize";
import type { Bi, Lang } from "./types";

/**
 * Voice navigation (the idea is LandShield's "VN" work): turn "রিপোর্ট করতে চাই" or "take me to polls" into one page of jonokotha.
 * The destination ALWAYS comes from the table below, never from the person's words, and a page behind a flag is offered only when its flag is on,
 * so Dadu never sends anyone to a 404. Staff, admin and developer pages are not in the table. Pure and testable.
 */
export type Slug = "home" | "report" | "me" | "area" | "projects" | "ideas" | "ideaNew" | "ask" | "mp" | "polls" | "notifications" | "settings" | "help" | "contact" | "about" | "privacy" | "terms" | "accessibility"
  | "consultations" | "commitments" | "priorities" | "budget" | "budgeting" | "openData" | "mpRecords" | "rti" | "volunteer" | "transparency";

export interface Flags { consultations: boolean; commitments: boolean; priorities: boolean; budget: boolean; budgeting: boolean; openData: boolean; mpRecords: boolean; rti: boolean; assisted: boolean }
export const liveFlags = (): Flags => ({ consultations: FLAGS.consultations, commitments: FLAGS.commitments, priorities: FLAGS.priorities, budget: R2.budget, budgeting: R2.budgeting, openData: R2.openData, mpRecords: R2.mpRecords, rti: R2.rti, assisted: R2.assisted });

interface Page { slug: Slug; href: string; label: Bi; /** Phrases (Bangla, after normalisation; English words that stay Latin). Longer phrases win. */ aliases: string[]; signedIn?: boolean; flag?: keyof Flags }

export const PAGES: Page[] = [
  { slug: "home", href: "/", label: { bn: "প্রথম পাতা", en: "the home page" }, aliases: ["হোম", "প্রথম পাতা", "মূল পাতা", "শুরুর পাতা", "main page"] },
  { slug: "report", href: "/report", label: { bn: "সমস্যা জানানোর পাতা", en: "the report page" }, aliases: ["রিপোর্ট", "সমস্যা জানাতে", "সমস্যা জানানো", "সমস্যা জানানোর", "নতুন রিপোর্ট", "নতুন সমস্যা", "রিপোর্ট করা"], signedIn: true },
  { slug: "me", href: "/me", label: { bn: "আমার সমস্যাগুলো", en: "my reports" }, aliases: ["আমার রিপোর্ট", "আমার সমস্যা", "আমার সমস্যাগুলো", "আমার অ্যাকাউন্ট", "আমার পাতা", "my reports", "my account"], signedIn: true },
  { slug: "area", href: "/area", label: { bn: "এলাকার পাতা", en: "the area page" }, aliases: ["এলাকা", "আমার এলাকা", "এলাকার পাতা", "area page"] },
  { slug: "projects", href: "/projects", label: { bn: "প্রকল্পের তালিকা", en: "the projects" }, aliases: ["প্রকল্প", "প্রকল্পের তালিকা", "উন্নয়ন প্রকল্প"] },
  { slug: "ideas", href: "/ideas", label: { bn: "আইডিয়ার পাতা", en: "the ideas page" }, aliases: ["আইডিয়া", "আইডিয়ার পাতা", "সব আইডিয়া"] },
  { slug: "ideaNew", href: "/ideas/new", label: { bn: "নতুন আইডিয়া দেওয়ার পাতা", en: "the new idea page" }, aliases: ["নতুন আইডিয়া", "আইডিয়া দিতে", "আইডিয়া দেওয়া", "আইডিয়া দেওয়ার", "নতুন আইডিয়া দিতে"], signedIn: true },
  { slug: "ask", href: "/ask", label: { bn: "এমপিকে প্রশ্ন করার পাতা", en: "the ask your MP page" }, aliases: ["এমপিকে প্রশ্ন", "এমপির কাছে প্রশ্ন", "প্রশ্ন করতে", "প্রশ্ন করা", "প্রশ্নের পাতা", "ask page"] },
  { slug: "mp", href: "/mp", label: { bn: "এমপি খোঁজার পাতা", en: "find your MP" }, aliases: ["এমপি খুঁজতে", "এমপি খোঁজা", "আমার এমপি", "এমপি", "সংসদ সদস্য", "find mp"] },
  { slug: "polls", href: "/polls", label: { bn: "পোলের পাতা", en: "the polls" }, aliases: ["পোল", "পোলের পাতা", "জনমত"] },
  { slug: "notifications", href: "/notifications", label: { bn: "নোটিফিকেশন", en: "notifications" }, aliases: ["নোটিফিকেশন", "নোটিফিকেশনের পাতা"], signedIn: true },
  { slug: "settings", href: "/settings", label: { bn: "সেটিংস", en: "settings" }, aliases: ["সেটিংস", "ভাষা বদল", "ভাষা বদলাতে", "ডার্ক মোড"] },
  { slug: "help", href: "/help", label: { bn: "সাহায্যের পাতা", en: "the help page" }, aliases: ["সাহায্য", "সাহায্যের পাতা", "হেল্প"] },
  { slug: "contact", href: "/help/contact", label: { bn: "যোগাযোগের পাতা", en: "the contact page" }, aliases: ["যোগাযোগ", "যোগাযোগের পাতা", "যোগাযোগ করতে"] },
  { slug: "about", href: "/about", label: { bn: "জনকথা সম্পর্কে", en: "about Jonokotha" }, aliases: ["জনকথা সম্পর্কে", "সম্পর্কে", "আমাদের সম্পর্কে"] },
  { slug: "privacy", href: "/privacy", label: { bn: "গোপনীয়তা নীতি", en: "the privacy policy" }, aliases: ["গোপনীয়তা", "গোপনীয়তা নীতি", "প্রাইভেসি"] },
  { slug: "terms", href: "/terms", label: { bn: "শর্তাবলি", en: "the terms" }, aliases: ["শর্ত", "শর্তাবলি", "নিয়ম ও শর্ত"] },
  { slug: "accessibility", href: "/accessibility", label: { bn: "সবার ব্যবহারের সুবিধা", en: "accessibility" }, aliases: ["অ্যাক্সেসিবিলিটি", "সবার ব্যবহারের সুবিধা", "সুবিধা বিবৃতি"] },
  { slug: "consultations", href: "/consultations", label: { bn: "মতামতের ডাক", en: "consultations" }, aliases: ["মতামতের ডাক", "মতামত", "কনসালটেশন"], flag: "consultations" },
  { slug: "commitments", href: "/commitments", label: { bn: "প্রতিশ্রুতির তালিকা", en: "commitments" }, aliases: ["প্রতিশ্রুতি", "প্রতিশ্রুতির তালিকা"], flag: "commitments" },
  { slug: "priorities", href: "/priorities", label: { bn: "অগ্রাধিকার", en: "priorities" }, aliases: ["অগ্রাধিকার", "অগ্রাধিকারের তালিকা"], flag: "priorities" },
  { slug: "budget", href: "/budget", label: { bn: "বাজেট ও ব্যয়", en: "budget and spending" }, aliases: ["বাজেট", "বাজেট ও ব্যয়", "ব্যয়"], flag: "budget" },
  { slug: "budgeting", href: "/budgeting", label: { bn: "সবার ভোটে বাজেট", en: "participatory budgeting" }, aliases: ["সবার ভোটে বাজেট", "বাজেটে ভোট"], flag: "budgeting" },
  { slug: "openData", href: "/open-data", label: { bn: "খোলা তথ্য", en: "open data" }, aliases: ["খোলা তথ্য", "ওপেন ডেটা", "ডেটা"], flag: "openData" },
  { slug: "mpRecords", href: "/mp-records", label: { bn: "এমপির সংসদীয় রেকর্ড", en: "MP records" }, aliases: ["সংসদীয় রেকর্ড", "এমপির রেকর্ড", "এমপি রেকর্ড"], flag: "mpRecords" },
  { slug: "rti", href: "/rti", label: { bn: "তথ্য অধিকারের সহায়ক", en: "the RTI helper" }, aliases: ["তথ্য অধিকার", "আরটিআই", "তথ্য চাইতে"], flag: "rti" },
  { slug: "volunteer", href: "/volunteer", label: { bn: "স্বেচ্ছাসেবক", en: "volunteers" }, aliases: ["স্বেচ্ছাসেবক", "ভলান্টিয়ার"], flag: "assisted" },
  { slug: "transparency", href: "/transparency", label: { bn: "স্বচ্ছতার পাতা", en: "transparency" }, aliases: ["স্বচ্ছতা", "স্বচ্ছতার পাতা"] },
];

const CUES = ["নিয়ে", "যাও", "যান", "চলো", "খোলো", "খুলো", "খুলুন", "দেখাও", "দেখান", "যেতে", "যাব", "যাই", "গিয়ে", "go", "open", "take", "show", "navigate", "visit"];
const DESIRE = ["চাই", "চাইছি", "করতে", "দিতে", "জানাতে", "করব", "want", "need", "wanna", "chai", "korte", "dite", "janate"];
const QUESTIONS = ["কীভাবে", "কিভাবে", "কি", "কী", "কেন", "কত", "কোথায়", "কোন", "কখন", "কেমন", "কারা", "কে", "কাকে", "how", "what", "why", "when", "where", "which", "who", "ki", "kivabe", "keno", "koto"].map(fold);

const words = (text: string): string[] => tokens(normalize(text));
const aliasOf = (a: string) => tokens(normalize(a));

/** Does the phrase `alias` (tokens) occur in `ws`? Bangla endings are glued to words ("পোলে", "রিপোর্টে"), so the last token may be a prefix. */
function contains(ws: string[], alias: string[]): boolean {
  if (alias.length === 0) return false;
  for (let i = 0; i + alias.length <= ws.length; i++) {
    let ok = true;
    for (let k = 0; k < alias.length; k++) {
      const w = ws[i + k], a = alias[k];
      if (!(w === a || (/[ঀ-৿]/.test(a) && a.length >= 3 && w.startsWith(a)))) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

export interface Target { page: Page; href: string; label: string; say: string; signedInRequired: boolean }
export const askedQuestion = (text: string): boolean => words(text).some((w) => QUESTIONS.includes(w));
export const hasCue = (text: string): boolean => words(text).some((w) => CUES.includes(w) || w === "চলুন");
export const hasDesire = (text: string): boolean => words(text).some((w) => DESIRE.includes(w));

/** Pages whose flag is off are not offered. */
export const offered = (flags: Flags): Page[] => PAGES.filter((p) => !p.flag || flags[p.flag]);
export const pageBySlug = (slug: Slug, flags: Flags): Page | undefined => offered(flags).find((p) => p.slug === slug);

/** The best page for the words, or null. */
export function findPage(text: string, flags: Flags): Page | null {
  const ws = words(text);
  let best: { p: Page; n: number } | null = null;
  for (const p of offered(flags)) {
    for (const a of p.aliases) {
      const t = aliasOf(a);
      if (contains(ws, t) && (!best || t.length > best.n)) best = { p, n: t.length };
    }
  }
  return best?.p ?? null;
}

/** Builds the navigate answer. A signed-out person asking for a page that needs sign-in is sent to /login and then on. */
export function toTarget(p: Page, lang: Lang, signedIn: boolean, loginUrl: (path: string) => string): Target {
  const needs = !!p.signedIn && !signedIn;
  const href = needs ? loginUrl(p.href) : p.href;
  const label = p.label[lang];
  return { page: p, href, label, signedInRequired: needs, say: needs ? (lang === "bn" ? `${label} খুলতে আগে সাইন ইন করতে হবে। সাইন ইন পাতায় নিয়ে যাচ্ছি…` : `You need to sign in for ${label}. Taking you to sign in…`) : lang === "bn" ? `${label} খুলছি…` : `Opening ${label}…` };
}

/**
 * Spoken-navigation rule (voice only): a go-cue plus a page name ("নিয়ে যাও … পোল"), or a page name with a wish ("রিপোর্ট করতে চাই").
 * A question word anywhere ("রিপোর্ট কীভাবে করব?") blocks it, so people get an answer instead of a page change.
 */
export function navigateTo(text: string, flags: Flags): Page | null {
  if (askedQuestion(text)) return null;
  const p = findPage(text, flags);
  if (!p) return null;
  return hasCue(text) || hasDesire(text) ? p : null;
}
