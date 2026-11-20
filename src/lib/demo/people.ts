import { ago, AREA_KEY, bi, tx, type Bi, type Lang } from "./util";

// Example questions to the MP, the example representative, areas and notifications for the simulated demo. No real person is named.

interface DemoQuestion { ref: string; title: Bi; body: Bi; status: "open" | "answered"; days: number; reply?: Bi; replyDays?: number; mine?: boolean }
export const DEMO_QUESTIONS: DemoQuestion[] = [
  { ref: "JKD-QN-1001", status: "answered", days: 12, replyDays: 9, title: bi("মিরপুর ১০ রাস্তার কাজ কবে শেষ হবে?", "When will the Mirpur 10 road work finish?"),
    body: bi("সড়ক পুনর্নির্মাণ চলছে, কিন্তু কবে শেষ হবে জানা নেই। দোকানদারদের ক্ষতি হচ্ছে।", "The road is being rebuilt but we do not know when it ends. Shopkeepers are losing business."),
    reply: bi("কাজের সময়সূচি প্রকল্প পাতায় দেওয়া আছে: কার্পেটিং ৩০ দিনের মধ্যে, পুরো কাজ ৬০ দিনে শেষ হওয়ার কথা। দেরি হলে প্রকল্প পাতায় জানানো হবে।", "The schedule is on the project page: carpeting within 30 days, everything in 60. Any delay will be posted there.") },
  { ref: "JKD-QN-1002", status: "answered", days: 8, replyDays: 5, title: bi("বয়স্ক ভাতার আবেদন কোথায় করব?", "Where do I apply for the elderly allowance?"),
    body: bi("আমার বাবার বয়স ৬৮। কোন অফিসে কী কাগজ নিয়ে যেতে হবে?", "My father is 68. Which office should we go to, with which papers?"),
    reply: bi("এটি ইউনিয়ন/ওয়ার্ড অফিসের সেবা। জাতীয় পরিচয়পত্র ও দুই কপি ছবি নিয়ে যান। অফিস আপনাকে ঠিকানা পাঠাবে।", "This is a ward office service. Take the national ID and two photos. The office will send you the address.") },
  { ref: "JKD-QN-1003", status: "open", days: 2, title: bi("স্কুলের সামনের স্পিডব্রেকারের অগ্রগতি কী?", "What is the progress on the speed breaker outside the school?"),
    body: bi("কয়েক সপ্তাহ আগে অভিযোগ জানিয়েছিলাম; এখনও কিছু হয়নি।", "I reported it a few weeks ago and nothing has happened yet.") },
  { ref: "JKD-QN-1004", status: "answered", days: 20, replyDays: 17, title: bi("নতুন ডাস্টবিন কোথায় বসবে?", "Where will the new bins go?"),
    body: bi("পল্লবী বাজারের ডাস্টবিন নিয়ে আলোচনা হয়েছিল।", "Bins at Pallabi market were discussed."),
    reply: bi("বাজারের প্রবেশমুখে ও মাছের সারির পাশে দুটি বসানো হয়েছে; আরও আটটি আগামী মাসে।", "Two are placed at the market entrance and by the fish stalls; eight more next month.") },
];
export const findQuestion = (ref: string) => DEMO_QUESTIONS.find((q) => q.ref === ref);

export const publicQuestion = (q: DemoQuestion, lang: Lang) => ({ ref: q.ref, constituency_key: AREA_KEY, title: tx(q.title, lang), body: tx(q.body, lang), status: q.status, created_at: ago(q.days), last_message_at: ago(q.replyDays ?? q.days), message_count: q.reply ? 2 : 1, is_sample: true });
export const questionThread = (q: DemoQuestion, lang: Lang) => ({ ...publicQuestion(q, lang), visibility: "public" as const, messages: [{ author_kind: "citizen" as const, body: tx(q.body, lang), created_at: ago(q.days) }, ...(q.reply ? [{ author_kind: "office" as const, body: tx(q.reply, lang), created_at: ago(q.replyDays ?? 1) }] : [])] });

export const DEMO_FAQ_NOTE = bi("এই প্রশ্নগুলো নমুনা; বাস্তব উত্তর নয়।", "These questions are examples, not real answers.");

// Representative ------------------------------------------------------------------------------------------------------------------------
const area = (lang: Lang) => ({ key: AREA_KEY, name_bn: "নমুনা নির্বাচনী এলাকা", name_en: "Sample Constituency", district: lang === "bn" ? "ঢাকা" : "Dhaka", is_demo: true });
export const DEMO_REP_ID = "demo-rep-1";
const rep = (lang: Lang) => ({
  id: DEMO_REP_ID, full_name: "Sample Representative", full_name_bn: "নমুনা প্রতিনিধি", party_name: "—", party_name_bn: "—", photo_path: null,
  role_note: tx(bi("নমুনা তথ্য — বাস্তব ব্যক্তি নন।", "Sample record: not a real person."), lang), office_title: tx(bi("সংসদ সদস্য (নমুনা)", "Member of Parliament (sample)"), lang),
  official_contact: "office@example.org", source_url: "https://example.org/jonokotha-sample", verified_at: ago(10), is_sample: true,
});
export const demoLookup = (lang: Lang) => ({ needs_manual_choice: false, matches: [{ constituency: area(lang), representatives: [rep(lang)] }] });
export const demoRepDetail = (lang: Lang) => ({
  ...rep(lang), constituencies: [{ ...area(lang), valid_from: ago(300).slice(0, 10), valid_to: null }],
  fields: [{ field: tx(bi("অফিসের ঠিকানা", "Office address"), lang), value: tx(bi("নমুনা সড়ক, মিরপুর, ঢাকা", "Sample Road, Mirpur, Dhaka"), lang), source_url: "https://example.org/jonokotha-sample", checked_at: ago(10) }],
  announcements: [{ ref: "JKD-AN-0601", title: tx(bi("শনিবার বিনামূল্যে স্বাস্থ্য পরীক্ষা", "Free health check on Saturday"), lang), body: tx(bi("সকাল ৯টা থেকে দুপুর ১টা পর্যন্ত।", "9 am to 1 pm."), lang), published_at: ago(1) }],
});
export const demoResponsiveness = () => ({ constituency: AREA_KEY, is_sample: true, from: ago(30), to: ago(0), received: 42, answered: 36, pending: 6, median_hours_to_first_response: 31, method_url: "/mp/method", note: "Sample figures." });

export const demoAreas = (parent: string | undefined, lang: Lang) => parent
  ? { level: "upazila", label_bn: "থানা/উপজেলা", label_en: "Thana/Upazila", areas: [{ id: "demo-mirpur", name_bn: "মিরপুর", name_en: "Mirpur" }] }
  : { level: "district", label_bn: "জেলা", label_en: "District", areas: [{ id: "demo-dhaka", name_bn: "ঢাকা", name_en: lang === "bn" ? "Dhaka" : "Dhaka" }] };

// Notifications -------------------------------------------------------------------------------------------------------------------------
const N = (id: string, type: string, title: Bi, body: Bi, ref: string | null, days: number, read: boolean) => ({ id, type, title: title.bn, body: body.bn, ref, read_at: read ? ago(days - 1) : null, created_at: ago(days), en: { title: title.en, body: body.en } });
export const DEMO_NOTICES = [
  N("nt-1", "issue_status", bi("আপনার অনুসরণ করা অভিযোগের অবস্থা বদলেছে", "A report you follow changed status"), bi("স্থিতি: সমাধান হয়েছে।", "Status: resolved."), "JKD-2026-0101", 1, false),
  N("nt-2", "question_reply", bi("আপনার প্রশ্নের উত্তর এসেছে", "Your question has an answer"), bi("অফিস উত্তর দিয়েছে।", "The office replied."), "JKD-QN-1001", 2, false),
  N("nt-3", "idea_decision", bi("আপনার সমর্থিত প্রস্তাবে সিদ্ধান্ত", "A decision on an idea you supported"), bi("প্রস্তাবটি পরিকল্পনায় নেওয়া হয়েছে।", "The idea is now planned."), "JKD-ID-0201", 3, true),
  N("nt-4", "announcement", bi("নতুন ঘোষণা", "New announcement"), bi("শনিবার বিনামূল্যে স্বাস্থ্য পরীক্ষা।", "Free health check on Saturday."), null, 4, true),
  N("nt-5", "project_update", bi("প্রকল্পের হালনাগাদ", "Project update"), bi("পুরনো পিচ তোলার কাজ শেষ।", "Stripping of the old surface is done."), "JKD-PJ-0401", 6, true),
];
