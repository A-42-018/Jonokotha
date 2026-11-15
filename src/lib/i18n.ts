import { cookies } from "next/headers";

export type Lang = "bn" | "en";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  return c === "en" ? "en" : "bn";
}

export const dict = {
  bn: {
    appName: "জনকথা",
    tagline: "আপনার এলাকার সমস্যা, সরাসরি জনপ্রতিনিধির কাছে",
    demoBadge: "নমুনা (ডেমো) তথ্য",
    reportCta: "সমস্যা জানান",
    officeCta: "অফিস ড্যাশবোর্ড",
    switchLang: "English",
    reportTitle: "সমস্যাটি লিখুন বা বলুন",
    reportHint: "নিজের ভাষায় লিখুন। আমরা শিরোনাম ও ধরন ঠিক করে দেব, আপনি বদলাতে পারবেন।",
    speak: "বলুন",
    listening: "শুনছি…",
    draft: "খসড়া তৈরি করুন",
    drafting: "খসড়া হচ্ছে…",
    fTitle: "শিরোনাম",
    fCategory: "ধরন",
    fDescription: "বিবরণ",
    fArea: "এলাকা",
    aiNote: "এটি এআই-এর খসড়া। জমা দেওয়ার আগে দেখে নিন।",
    submit: "জমা দিন",
    submitting: "জমা হচ্ছে…",
    sentTitle: "আপনার অভিযোগ পাঠানো হয়েছে",
    refId: "রেফারেন্স নম্বর",
    status: "অবস্থা",
    timeline: "অগ্রগতি",
    statuses: { received: "গ্রহণ করা হয়েছে", acknowledged: "অফিস দেখেছে", referred: "সংশ্লিষ্ট সংস্থায় পাঠানো হয়েছে", resolved: "সমাধান হয়েছে" },
    queue: "আসা অভিযোগ",
    emptyQueue: "কোনো নতুন অভিযোগ নেই",
    aiSummary: "এআই সারসংক্ষেপ",
    similar: "একই ধরনের অভিযোগ",
    noSimilar: "মিলছে এমন কোনো অভিযোগ নেই",
    noAiSummary: "এআই সারসংক্ষেপ চালু নেই (এআই কী যোগ হয়নি)",
    routing: "প্রস্তাবিত সংস্থা",
    source: "সূত্র",
    confidence: "নিশ্চয়তা",
    approveAck: "স্বীকৃতি অনুমোদন করুন",
    approveRefer: "সংস্থায় রেফার অনুমোদন করুন",
    humanOnly: "কর্মী অনুমোদন না করা পর্যন্ত কিছু পাঠানো হয় না।",
    back: "ফিরুন",
    cats: { roads: "রাস্তা", drainage: "ড্রেন", water: "পানি", electricity: "বিদ্যুৎ", waste: "ময়লা", flooding: "জলাবদ্ধতা", health: "স্বাস্থ্য", education: "শিক্ষা", safety: "নিরাপত্তা", environment: "পরিবেশ", facilities: "সুবিধা", other: "অন্যান্য" },
  },
  en: {
    appName: "Jonokotha",
    tagline: "Your neighbourhood's problems, straight to your representative",
    demoBadge: "Sample (demo) data",
    reportCta: "Report a problem",
    officeCta: "Office dashboard",
    switchLang: "বাংলা",
    reportTitle: "Type or speak the problem",
    reportHint: "Write in your own words. We will draft a title and category; you can edit them.",
    speak: "Speak",
    listening: "Listening…",
    draft: "Create draft",
    drafting: "Drafting…",
    fTitle: "Title",
    fCategory: "Category",
    fDescription: "Description",
    fArea: "Area",
    aiNote: "This is an AI draft. Please review before submitting.",
    submit: "Submit",
    submitting: "Submitting…",
    sentTitle: "Your report has been sent",
    refId: "Reference ID",
    status: "Status",
    timeline: "Progress",
    statuses: { received: "Received", acknowledged: "Seen by office", referred: "Referred to agency", resolved: "Resolved" },
    queue: "Incoming reports",
    emptyQueue: "No new reports",
    aiSummary: "AI summary",
    similar: "Similar reports",
    noSimilar: "No matching reports",
    noAiSummary: "AI summary is off (no AI key configured)",
    routing: "Suggested agency",
    source: "Source",
    confidence: "Confidence",
    approveAck: "Approve acknowledgement",
    approveRefer: "Approve referral",
    humanOnly: "Nothing is sent until staff approve it.",
    back: "Back",
    cats: { roads: "Roads", drainage: "Drainage", water: "Water", electricity: "Electricity", waste: "Waste", flooding: "Flooding", health: "Health", education: "Education", safety: "Safety", environment: "Environment", facilities: "Facilities", other: "Other" },
  },
} as const;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type Dict = Widen<(typeof dict)["en"]>;

export function fmtDate(iso: string, lang: Lang) {
  return new Date(iso).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
}
