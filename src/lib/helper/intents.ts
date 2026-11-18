import { fold, normalize, tokens } from "./normalize";
import type { Bi, Mood } from "./types";
import type { Slug } from "./navigate";

/**
 * What Dadu can answer without a model: a weighted keyword table, like LandShield's intent table, with jonokotha's own topics.
 * confidence = min(0.95, 0.5 + 0.15 × score); below 0.5 nothing matches. Every text here follows what the About, Help and Privacy pages already say,
 * so Dadu never claims more than the site does. Bangla is plain চলিত and checked by tests/unit/helper-content.test.ts.
 */
export interface Intent { id: string; kw: [string, number][]; reply: Bi; links?: Slug[]; chips?: Bi[]; mood?: Mood; /** Social intents win only when no topic matched. */ social?: boolean; /** The page a person asking "I want to …" is taken to (voice). */ go?: Slug }
const b = (bn: string, en: string): Bi => ({ bn, en });

export const INTENTS: Intent[] = [
  { id: "greet", social: true, mood: "greet", kw: [["হ্যালো", 2], ["সালাম", 2], ["নমস্কার", 2], ["আসসালামু", 2], ["শুভ সকাল", 2], ["hello", 2]],
    reply: b("স্বাগতম! আমি জমির দাদু। সমস্যা জানানো, এমপিকে প্রশ্ন বা আইডিয়া নিয়ে জিজ্ঞাসা করুন, ঠিক পাতায় পৌঁছে দেব।", "Welcome! I am Jomir Dadu. Ask me about reporting a problem, asking your MP or sharing an idea, and I will take you to the right page.") },
  { id: "thanks", social: true, mood: "happy", kw: [["ধন্যবাদ", 2], ["শুকরিয়া", 2], ["thanks", 2]], reply: b("আপনাকেও ধন্যবাদ। আর কিছু জানার থাকলে বলুন।", "You are welcome. Tell me if you want to know anything else.") },
  { id: "who", kw: [["তুমি কে", 2], ["আপনি কে", 2], ["দাদু কে", 2], ["তোমার নাম", 2], ["আপনার নাম", 2], ["who are you", 2]],
    reply: b("আমি জমির দাদু, জনকথার সহায়ক। কোন পাতায় কী আছে বলে দিই, আর বললে সেই পাতায় নিয়ে যাই। আমি সরকারি লোক নই, আর ভুলও করতে পারি।", "I am Jomir Dadu, the helper of Jonokotha. I tell you what is on each page and take you there if you ask. I am not an official, and I can make mistakes.") },
  { id: "report", go: "report", kw: [["রিপোর্ট", 2], ["সমস্যা জানাতে", 2], ["সমস্যা জানানো", 2], ["সমস্যা জানাব", 2], ["অভিযোগ", 2], ["ভাঙা", 1], ["নষ্ট", 1]], links: ["report"],
    reply: b("সমস্যা জানাতে রিপোর্টের পাতায় যান। কী ধরনের সমস্যা তা বেছে নিন, কী হয়েছে লিখুন বা মাইকে বলুন, জায়গা ঠিক করুন, চাইলে ছবি দিন। শেষে দেখে নিয়ে পাঠিয়ে দিন। জানানোর জন্য সাইন ইন করতে হয়।", "To report a problem go to the report page. Choose the type, write or say what happened, set the place and add photos if you like. Check it and send. You need to be signed in."),
    chips: [b("পাঠানোর পর কী হয়?", "What happens after I send?"), b("জরুরি বিপদে কী করব?", "What if it is an emergency?")] },
  { id: "after", kw: [["পাঠানোর পর", 2], ["অবস্থা", 1], ["কোথায় গেল", 2], ["উত্তর", 1], ["সমস্যা নম্বর", 2], ["আমার সমস্যা", 2], ["কতদিন", 1], ["ট্র্যাক", 2], ["status", 2]], links: ["me"], go: "me",
    reply: b("সমস্যা পাঠানোর পর একটি সমস্যা নম্বর পাবেন। আমার সমস্যাগুলো পাতায় প্রতিটির অবস্থা দেখা যায়: পাঠানো হয়েছে, এমপির অফিস পেয়েছে, দায়িত্বে থাকা অফিসে পাঠানো হয়েছে, সমাধান হয়েছে। অফিস নির্দিষ্ট সময়ে উত্তর দিতে বাধ্য নয়, আর কেউ সঙ্গে সঙ্গে দেখবে, তার নিশ্চয়তা নেই।", "After you send a report you get a reference number. On the my reports page you can see each status: sent, received by the office, passed to the responsible office, resolved. The office is not bound to reply within a set time, and nobody is guaranteed to see it right away.") },
  { id: "askmp", go: "ask", kw: [["এমপিকে প্রশ্ন", 3], ["এমপির কাছে", 2], ["প্রশ্ন করতে", 2], ["প্রশ্ন করা", 2], ["প্রশ্ন", 1], ["বার্তা", 1], ["ask mp", 3]], links: ["ask"],
    reply: b("এমপিকে প্রশ্ন করতে প্রশ্নের পাতায় যান। প্রশ্ন লিখুন, ব্যক্তিগত বার্তা না প্রকাশ্য প্রশ্ন, তা বেছে নিন, তারপর পাঠান। প্রকাশ্য প্রশ্ন দেখে নেওয়ার পর সবার জন্য দেখা যায়।", "To ask your MP, go to the ask page. Write your question, choose private message or public question, then send. A public question is checked before everyone can see it.") },
  { id: "findmp", go: "mp", kw: [["আমার এমপি", 3], ["এমপি কে", 3], ["এমপি খুঁজতে", 3], ["এমপি খোঁজা", 3], ["সংসদ সদস্য", 2], ["জনপ্রতিনিধি", 2], ["এমপি", 1], ["find mp", 3]], links: ["mp"],
    reply: b("নিজের এমপিকে খুঁজতে এমপি পাতায় এলাকার নাম লিখুন বা তালিকা থেকে বেছে নিন। এমপির পাতায় তাঁর অফিসের প্রকাশ্য কাজ দেখা যায়।", "To find your MP, use the MP page: type your area or pick from the list. The MP's page shows the office's public work.") },
  { id: "ideas", go: "ideas", kw: [["আইডিয়া", 2], ["প্রস্তাব", 2], ["পরামর্শ দিতে", 2]], links: ["ideas", "ideaNew"],
    reply: b("আইডিয়ার পাতায় এলাকার উন্নয়নের আইডিয়া পড়তে পারেন। ভালো লাগলে “আমিও চাই” চাপুন। নিজের আইডিয়া দিতে নতুন আইডিয়ার বোতামে চাপুন, তবে সাইন ইন করতে হয়।", "On the ideas page you can read ideas for your area. Press “I want this too” on ones you like. To post your own press the new idea button; you need to be signed in.") },
  { id: "polls", go: "polls", kw: [["পোল", 2], ["জনমত", 2], ["ভোট", 1]], links: ["polls"],
    reply: b("পোলের পাতায় এলাকার চলতি পোলগুলো আছে। একটি খুলে আপনার মত বেছে জমা দিন।", "The polls page lists current polls for your area. Open one, pick your answer and submit.") },
  { id: "rti", go: "rti", kw: [["তথ্য অধিকার", 3], ["আরটিআই", 3], ["তথ্য চাইতে", 2], ["তথ্য চেয়ে", 2]], links: ["rti"],
    reply: b("তথ্য অধিকারের সহায়কে তথ্য চেয়ে আবেদনের খসড়া তৈরি করা যায়। জনকথা আবেদন জমা দেয় না। খসড়া কপি করে যে সংস্থার কাছে তথ্য চান, সেখানে নিজে জমা দিতে হয়। এটি আইনি পরামর্শ নয়।", "The RTI helper drafts a request for information. Jonokotha does not file it. Copy the draft and submit it to the agency yourself. This is not legal advice.") },
  { id: "privacy", go: "privacy", kw: [["গোপনীয়তা", 2], ["প্রাইভেসি", 2], ["তথ্য নিরাপদ", 2], ["আমার তথ্য", 2], ["ডেটা", 1], ["ব্যক্তিগত তথ্য", 2], ["নাম প্রকাশ", 2]], links: ["privacy"],
    reply: b("আপনার ব্যক্তিগত তথ্য কীভাবে রাখা হয়, তা গোপনীয়তা নীতিতে লেখা আছে। রিপোর্টে নিজের বা অন্যের ফোন নম্বর ও ঠিকানা লিখবেন না। লিখলে সেগুলো এআইয়ের কাছে যাওয়ার আগে সরিয়ে ফেলা হয়।", "How your personal data is kept is written in the privacy policy. Do not write phone numbers or addresses in a report. If you do, they are removed before anything reaches the AI.") },
  { id: "ai", kw: [["এআই", 2], ["কৃত্রিম বুদ্ধিমত্তা", 2], ["যন্ত্র", 1], ["artificial", 2]], links: ["about"],
    reply: b("এআই শুধু লেখার খসড়া ও সারাংশ করে। খসড়া ভুল হতে পারে। কী পাঠানো বা প্রকাশ হবে, তা আপনি ও অফিসের কর্মীরা ঠিক করেন। এআইয়ের লেখা থাকলে তা আলাদা করে বলা থাকে।", "AI only drafts and summarises text. Drafts can be wrong. You and the office staff decide what is sent or published. AI text is always marked as such.") },
  { id: "language", go: "settings", kw: [["ভাষা", 2], ["ইংরেজি", 2], ["বাংলা", 1], ["language", 2], ["english", 2]], links: ["settings"],
    reply: b("ভাষা বদলাতে সেটিংস পাতায় যান। সেখানে সংখ্যা বাংলা না ইংরেজি, তাও বেছে নেওয়া যায়।", "To change the language go to settings. You can also choose Bangla or Latin digits there.") },
  { id: "access", go: "accessibility", kw: [["সহজ ভাষা", 3], ["বড় অক্ষর", 2], ["অ্যাক্সেসিবিলিটি", 3], ["দেখতে অসুবিধা", 2], ["ডার্ক", 2], ["অন্ধ", 1]], links: ["accessibility", "settings"],
    reply: b("সেটিংসে সহজ ভাষা, আগে কথা বলে লেখা আর সংখ্যার ধরন বেছে নেওয়া যায়। বোতাম ও লিংক ফোনে ছোঁয়ার মতো বড় রাখা হয়েছে। সবার ব্যবহারের সুবিধা পাতায় কী করা হয়েছে আর কী বাকি, তা লেখা আছে।", "In settings you can choose simple language, voice first, and the digit style. Buttons and links are made big enough to tap. The accessibility page says what is done and what is left.") },
  { id: "login", kw: [["সাইন ইন", 2], ["লগইন", 2], ["অ্যাকাউন্ট", 1], ["ঢুকতে", 1], ["লগআউট", 1]], links: ["help"], go: "settings",
    reply: b("রিপোর্ট করা, আইডিয়া দেওয়া বা প্রশ্ন পাঠানোর জন্য সাইন ইন করতে হয়। উপরের সাইন ইন বোতামে চাপুন, ইমেইল দিন, আর যে কোড বা লিংক আসবে তা দিয়ে ঢুকুন।", "You need to sign in to report, post an idea or send a question. Press the sign in button at the top, enter your email, and use the code or link you receive.") },
  { id: "help", go: "help", kw: [["সাহায্য", 2], ["হেল্প", 2], ["যোগাযোগ", 2], ["সমস্যা হচ্ছে", 2], ["আটকে", 2]], links: ["help", "contact"],
    reply: b("সাহায্যের পাতায় জনকথা কীভাবে কাজ করে আর নিরাপদে ব্যবহারের নিয়ম আছে। আটকে গেলে যোগাযোগের পাতা দেখুন।", "The help page explains how Jonokotha works and how to use it safely. If you are stuck, see the contact page.") },
  { id: "about", go: "about", kw: [["জনকথা কী", 3], ["জনকথা সম্পর্কে", 3], ["এটা কী", 2], ["এই অ্যাপ", 2], ["কী করা যায়", 3], ["what is jonokotha", 3]], links: ["about"],
    reply: b("জনকথা নাগরিক ও জনপ্রতিনিধির অফিসের মধ্যে যোগাযোগের একটি মাধ্যম। এখানে সমস্যা জানানো, আইডিয়া দেওয়া, প্রশ্ন করা আর কাজের অবস্থা দেখা যায়। এটি জরুরি সেবা বা সরকারি চ্যানেল নয়।", "Jonokotha is a way for citizens and their representative's office to talk to each other. You can report problems, give ideas, ask questions and follow the progress of work. It is not an emergency service or an official channel.") },
  { id: "projects", go: "projects", kw: [["প্রকল্প", 2], ["উন্নয়ন কাজ", 2], ["project", 2]], links: ["projects"],
    reply: b("প্রকল্পের পাতায় এলাকার সরকারি প্রকল্প আর তাদের ধাপ দেখা যায়। একটি প্রকল্প খুলে তার অগ্রগতি দেখুন।", "The projects page lists government projects in your area and their milestones. Open one to see its progress.") },
  { id: "emergency", kw: [["জরুরি", 2], ["বিপদ", 2], ["emergency", 2], ["৯৯৯", 2], ["999", 2]], links: ["help"],
    reply: b("জরুরি বিপদে আগে ৯৯৯-এ ফোন করুন। জনকথায় জানানো সমস্যা সঙ্গে সঙ্গে কেউ দেখবে না। এটি জরুরি সেবা নয়।", "In an emergency call 999 first. Nobody sees a report here right away. Jonokotha is not an emergency service."), mood: "sorry" },
  { id: "land", kw: [["জমি", 1], ["ভূমি", 2], ["নামজারি", 3], ["খতিয়ান", 3], ["দলিল", 3], ["পর্চা", 3], ["মৌজা", 3], ["তহসিল", 3], ["খাজনা", 3], ["ওয়ারিশ সনদ", 2], ["land", 1], ["জমির", 1]], links: ["report"],
    reply: b("জমির কাগজ, নামজারি বা খতিয়ানের কাজ উপজেলা ভূমি অফিসে (এসি ল্যান্ড) বা ইউনিয়ন ভূমি অফিসে হয়। জনকথায় কারও জমির রেকর্ড দেখা যায় না, আর আমি আইনি পরামর্শ দিই না। কোনো ভূমি অফিসে কাজ আটকে থাকলে বা সেবা নিয়ে সমস্যা হলে সেটি রিপোর্ট করে জানাতে পারেন।", "Land papers, mutation (namjari) and khatian work are done at the upazila land office (AC Land) or the union land office. Jonokotha cannot show anyone's land record, and I do not give legal advice. If work is stuck at a land office or you have a problem with the service, you can report it here."),
    chips: [b("সমস্যা জানাব কীভাবে?", "How do I report a problem?")] },
];

const T = (s: string) => tokens(normalize(s));
const INDEX = INTENTS.map((i) => ({ i, kws: i.kw.map(([k, w]) => ({ t: T(k).map(fold), w })) }));

function hit(ws: string[], t: string[]): boolean {
  if (t.length === 0) return false;
  for (let s = 0; s + t.length <= ws.length; s++) {
    let ok = true;
    for (let k = 0; k < t.length; k++) { const w = ws[s + k], a = t[k]; if (!(w === a || (/[ঀ-৿]/.test(a) && a.length >= 3 && w.startsWith(a)))) { ok = false; break; } }
    if (ok) return true;
  }
  return false;
}

/** Best intent for the text, with its confidence; null when nothing reaches 0.5. Social intents (greeting, thanks) are chosen only when no topic matched. */
export function matchIntent(text: string): { intent: Intent; confidence: number } | null {
  const ws = T(text).map(fold);
  const scored = INDEX.map(({ i, kws }) => ({ i, score: kws.reduce((s, k) => s + (hit(ws, k.t) ? k.w : 0), 0) })).filter((x) => x.score > 0);
  const topics = scored.filter((x) => !x.i.social);
  const pool = topics.length ? topics : scored;
  pool.sort((a, c) => c.score - a.score);
  const top = pool[0];
  if (!top) return null;
  const confidence = Math.min(0.95, 0.5 + 0.15 * top.score);
  return confidence >= 0.5 ? { intent: top.i, confidence } : null;
}
