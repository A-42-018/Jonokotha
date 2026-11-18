import { toBanglaDigits } from "../numerals";
import type { Bi, Lang } from "./types";

/**
 * "How do I use this page?": one short guide per public page, in both languages. Written from what each page does today, and nothing is promised that the page does not do.
 * A dynamic route (`/issue/AB12`, `/ideas/ID-1`) uses the guide of its longest fixed prefix. A test walks src/app and fails when a public page has no guide,
 * and the Bangla follows the same language rules as the dictionary (tests/unit/helper-content.test.ts).
 */
export interface Guide { title: Bi; what: Bi; steps: Bi[]; tip?: Bi }
const b = (bn: string, en: string): Bi => ({ bn, en });
const g = (title: Bi, what: Bi, steps: Bi[], tip?: Bi): Guide => ({ title, what, steps, tip });

export const GUIDES: Record<string, Guide> = {
  "/": g(b("প্রথম পাতা", "Home"), b("এখানে আপনার এলাকার সারাংশ, আইডিয়া আর দরকারি লিংক আছে।", "This page shows a summary of your area, ideas and useful links."),
    [b("উপরের বার থেকে যে পাতায় যেতে চান তা বেছে নিন।", "Use the bar at the top to pick a page."), b("সমস্যা জানাতে নিচের বোতামে চাপুন।", "To report a problem, press the button below.")]),
  "/report": g(b("সমস্যা জানানো", "Report a problem"), b("এখানে এলাকার সমস্যা ছবি, কথা বা লেখা দিয়ে জানানো যায়।", "Here you can report a problem in your area with photos, your voice or text."),
    [b("কী ধরনের সমস্যা তা বেছে নিন।", "Choose the type of problem."), b("কী হয়েছে তা লিখুন, বা মাইকে বলুন।", "Write what happened, or say it into the microphone."), b("জায়গাটি ঠিক করুন আর চাইলে ছবি দিন।", "Set the place and add photos if you like."), b("শেষে দেখে নিয়ে পাঠিয়ে দিন। পরে একটি সমস্যা নম্বর পাবেন।", "Check everything and send. You will then get a reference number.")],
    b("ফোন নম্বর বা ঠিকানা লিখবেন না। জরুরি বিপদে ৯৯৯-এ ফোন করুন।", "Do not write phone numbers or addresses. In an emergency call 999.")),
  "/me": g(b("আমার সমস্যাগুলো", "My reports"), b("আপনার পাঠানো সব সমস্যা আর তাদের অবস্থা এখানে দেখা যায়।", "All the problems you sent and their status are listed here."),
    [b("তালিকা থেকে একটি সমস্যা খুলুন।", "Open a report from the list."), b("সেখানে অবস্থার ধাপগুলো আর অফিসের উত্তর দেখুন।", "There you can see the status steps and the office's reply.")],
    b("সাইন ইন না থাকলে আগে সাইন ইন করতে হবে।", "You need to be signed in first.")),
  "/issue": g(b("একটি সমস্যার পাতা", "A report"), b("এখানে একটি সমস্যার বিবরণ, অবস্থা আর অফিসের প্রকাশ্য উত্তর আছে।", "This page shows one report with its details, status and the office's public reply."),
    [b("উপরে অবস্থার ধাপ দেখুন।", "See the status steps at the top."), b("নিচে অফিসের উত্তর থাকলে তা পড়ুন।", "Read the office's reply below, if there is one.")],
    b("সমস্যা নম্বর রেখে দিন, পরে আবার খুঁজে পাবেন।", "Keep the reference number to find it again.")),
  "/area": g(b("এলাকার পাতা", "Area"), b("আপনার এলাকার অবস্থা আর সাম্প্রতিক খবর এখানে।", "The state of your area and recent news are here."),
    [b("এলাকা বদলাতে উপরের এলাকা বোতামে চাপুন।", "To change the area, press the area button at the top.")]),
  "/projects": g(b("প্রকল্প", "Projects"), b("এলাকার সরকারি প্রকল্প আর তাদের ধাপ এখানে দেখা যায়।", "Government projects in your area and their milestones are listed here."),
    [b("একটি প্রকল্প খুলে তার ধাপগুলো দেখুন।", "Open a project to see its milestones.")]),
  "/ideas": g(b("আইডিয়া", "Ideas"), b("এলাকার উন্নয়নের আইডিয়া পড়া ও নিজের আইডিয়া দেওয়া যায়।", "You can read ideas for your area and share your own."),
    [b("কোনো আইডিয়া ভালো লাগলে “আমিও চাই” চাপুন।", "Press “I want this too” on an idea you like."), b("নিজের আইডিয়া দিতে নতুন আইডিয়ার বোতামে চাপুন।", "To share your own, press the new idea button.")],
    b("আইডিয়া দিতে সাইন ইন করতে হয়।", "You need to be signed in to post an idea.")),
  "/ideas/new": g(b("নতুন আইডিয়া", "New idea"), b("এখানে এলাকার জন্য আপনার আইডিয়া লেখা যায়।", "Write your idea for your area here."),
    [b("একটি ছোট শিরোনাম আর বিবরণ লিখুন।", "Write a short title and a description."), b("কোথায়, কার উপকার হবে আর প্রথম ধাপ কী, তা লিখলে আইডিয়া স্পষ্ট হয়।", "Say where, who benefits and the first step to make it clear."), b("দেখে নিয়ে পোস্ট করুন।", "Check it and post.")]),
  "/ask": g(b("এমপিকে প্রশ্ন", "Ask your MP"), b("এখানে এমপির অফিসকে প্রশ্ন বা বার্তা পাঠানো যায়।", "Here you can send a question or message to your MP's office."),
    [b("প্রশ্নটি লিখুন।", "Write your question."), b("ব্যক্তিগত বার্তা, না প্রকাশ্য প্রশ্ন, তা বেছে নিন।", "Choose a private message or a public question."), b("পাঠিয়ে দিন। প্রকাশ্য প্রশ্ন দেখে নেওয়ার পর সবার জন্য দেখা যায়।", "Send it. A public question is checked before everyone can see it.")],
    b("অফিস নির্দিষ্ট সময়ে উত্তর দিতে বাধ্য নয়।", "The office is not bound to reply within a set time.")),
  "/ask/inbox": g(b("আমার প্রশ্ন", "My questions"), b("আপনার পাঠানো প্রশ্ন আর অফিসের উত্তর এখানে।", "The questions you sent and the office's replies are here."), [b("একটি প্রশ্ন খুলে উত্তর দেখুন।", "Open a question to see the reply.")]),
  "/mp": g(b("এমপি খুঁজুন", "Find your MP"), b("এখানে আপনার এলাকার এমপিকে খুঁজে পাওয়া যায়।", "Find the MP for your area here."), [b("এলাকার নাম লিখে খুঁজুন বা তালিকা থেকে বেছে নিন।", "Search by area name or choose from the list."), b("এমপির পাতায় তাঁর অফিসের প্রকাশ্য কাজ দেখুন।", "On the MP's page see the office's public work.")]),
  "/mp/method": g(b("তথ্য কীভাবে নেওয়া", "How the data is made"), b("এই পাতায় এমপির তথ্য কোথা থেকে আসে আর কীভাবে দেখানো হয়, তা লেখা আছে।", "This page explains where the MP data comes from and how it is shown."), []),
  "/polls": g(b("পোল", "Polls"), b("এলাকার চলতি পোলগুলো এখানে দেখা যায়।", "Current polls for your area are here."), [b("একটি পোল খুলুন।", "Open a poll."), b("আপনার মত বেছে নিয়ে জমা দিন।", "Pick your answer and submit.")], b("মত দিতে সাইন ইন করতে হতে পারে।", "You may need to sign in to answer.")),
  "/notifications": g(b("নোটিফিকেশন", "Notifications"), b("আপনার সমস্যা বা প্রশ্নে নতুন কিছু হলে এখানে জানানো হয়।", "You are told here when something new happens on your reports or questions."), [b("একটি নোটিফিকেশন চাপলে সেই পাতা খোলে।", "Pressing one opens the related page.")]),
  "/settings": g(b("সেটিংস", "Settings"), b("এখানে ভাষা, সংখ্যার ধরন, সহজ ভাষা আর অন্য পছন্দ ঠিক করা যায়।", "Choose language, numerals, simple language and other preferences here."), [b("যে পছন্দ বদলাতে চান তা বেছে নিন।", "Pick the preference you want to change."), b("পরিবর্তন সঙ্গে সঙ্গে কাজ করে।", "Changes apply straight away.")]),
  "/help": g(b("সাহায্য", "Help"), b("জনকথা কীভাবে কাজ করে, নিরাপদে ব্যবহারের নিয়ম আর যোগাযোগের পথ এখানে।", "How Jonokotha works, safety tips and how to get in touch."), [b("জরুরি বিপদে আগে ৯৯৯-এ ফোন করুন।", "In an emergency call 999 first."), b("সমস্যা হলে যোগাযোগের পাতা দেখুন।", "If you are stuck, see the contact page.")]),
  "/help/contact": g(b("যোগাযোগ", "Contact"), b("সাহায্যের জন্য কীভাবে যোগাযোগ করবেন, তা এখানে লেখা আছে।", "How to get help is written here."), []),
  "/help/channels": g(b("বার্তায় সমস্যা জানানো", "Report by message"), b("এই পাতায় বার্তার মাধ্যমে সমস্যা জানানোর নিয়ম আছে।", "This page explains how to report by message."), []),
  "/about": g(b("জনকথা সম্পর্কে", "About Jonokotha"), b("জনকথা কী, কী করা যায় আর কী করা যায় না, এখানে লেখা আছে।", "What Jonokotha is, what it does and does not do."), []),
  "/privacy": g(b("গোপনীয়তা নীতি", "Privacy policy"), b("আপনার তথ্য কীভাবে রাখা হয়, তা এখানে লেখা আছে।", "How your information is kept is written here."), []),
  "/terms": g(b("শর্তাবলি", "Terms"), b("ব্যবহারের শর্ত এখানে লেখা আছে।", "The terms of use are written here."), []),
  "/accessibility": g(b("সবার ব্যবহারের সুবিধা", "Accessibility"), b("সবাই যেন সহজে ব্যবহার করতে পারে, সেজন্য কী করা হয়েছে আর কী বাকি, তা এখানে।", "What has been done so everyone can use the site, and what is left."), []),
  "/metrics": g(b("সংখ্যার মানে", "What the numbers mean"), b("এই পাতায় জনকথার সংখ্যাগুলোর মানে আর হিসাবের নিয়ম লেখা আছে।", "This page explains what the numbers mean and how they are counted."), []),
  "/challenge": g(b("লুকানো লেখা নিয়ে আপত্তি", "Challenge a hidden post"), b("কোনো লেখা লুকানো হয়েছে মনে হলে এখানে আপত্তি জানানো যায়।", "If a post was hidden and you disagree, say so here."), [b("লেখার কারণ জানান।", "Give your reason."), b("পাঠানোর পর একজন মানুষ বিষয়টি দেখেন।", "A person then looks at it.")]),
  "/login": g(b("সাইন ইন", "Sign in"), b("এখানে আপনার অ্যাকাউন্টে ঢোকা যায়।", "Sign in to your account here."), [b("আপনার ইমেইল দিন।", "Enter your email."), b("যে কোড বা লিংক আসবে তা দিয়ে ঢুকুন।", "Use the code or link you receive.")]),
  "/welcome": g(b("স্বাগতম", "Welcome"), b("জনকথা ব্যবহারের শুরুতে কয়েকটি ধাপ এখানে দেখানো হয়।", "A few first steps are shown here."), []),
  "/offline": g(b("ইন্টারনেট নেই", "Offline"), b("ইন্টারনেট না থাকলে এই পাতা দেখা যায়। যা লিখেছেন তা ফোনে রাখা থাকে।", "This page shows when you are offline. What you wrote is kept on your phone."), []),
  "/consultations": g(b("মতামতের ডাক", "Consultations"), b("এখানে এমপির অফিসের মতামত চাওয়ার বিষয়গুলো দেখা ও মত দেওয়া যায়।", "See the topics the office asks opinions on, and give yours."), [b("একটি বিষয় খুলে পড়ুন।", "Open a topic and read it."), b("মত দিন।", "Give your opinion.")]),
  "/commitments": g(b("প্রতিশ্রুতি", "Commitments"), b("অফিসের প্রকাশ্য প্রতিশ্রুতি আর তার অগ্রগতি এখানে।", "The office's public commitments and their progress."), []),
  "/priorities": g(b("অগ্রাধিকার", "Priorities"), b("এলাকার কোন কাজ আগে হওয়া উচিত, তা এখানে বেছে জানানো যায়।", "Say here which work should come first in your area."), []),
  "/budget": g(b("বাজেট ও ব্যয়", "Budget and spending"), b("সরকারি নথি থেকে নেওয়া বরাদ্দ ও ব্যয়ের অঙ্ক এখানে, নথি আর পৃষ্ঠার নম্বরসহ।", "Allocations and spending taken from official documents, with the document and page."), []),
  "/budgeting": g(b("সবার ভোটে বাজেট", "Participatory budgeting"), b("এখানে একটি নির্দিষ্ট তহবিল কোন কাজে যাবে, তা ভোট দিয়ে ঠিক করা যায়।", "Vote here on which work a given fund should pay for."), []),
  "/open-data": g(b("খোলা তথ্য", "Open data"), b("এখানে জনকথার সারাংশ তথ্য ডাউনলোড করা যায়, কারও ব্যক্তিগত তথ্য ছাড়া।", "Download summary data from Jonokotha, with no personal details."), []),
  "/mp-records": g(b("এমপির সংসদীয় রেকর্ড", "MP records"), b("সংসদের সরকারি নথি থেকে এমপির কাজ এখানে, কোনো স্কোর ছাড়া।", "The MP's activity from official parliament records, with no score."), []),
  "/rti": g(b("তথ্য অধিকারের সহায়ক", "RTI helper"), b("এখানে তথ্য চেয়ে আবেদনের খসড়া তৈরি করা যায়। আবেদন আপনাকেই নিজে জমা দিতে হয়।", "Draft a request for information here. You have to submit it yourself."), [b("কী তথ্য চান তা লিখুন।", "Write what information you want."), b("খসড়া কপি করে যে সংস্থার কাছে তথ্য চান, সেখানে নিজে জমা দিন।", "Copy the draft and submit it to the agency yourself.")]),
  "/volunteer": g(b("স্বেচ্ছাসেবক", "Volunteers"), b("যিনি নিজে অনলাইনে সমস্যা জানাতে পারেন না, তাঁর সম্মতি নিয়ে স্বেচ্ছাসেবক তাঁর হয়ে জানাতে পারেন।", "A volunteer can report on behalf of someone who cannot, with their consent."), []),
  "/transparency": g(b("স্বচ্ছতার পাতা", "Transparency"), b("বাজেট, খোলা তথ্য, এমপির রেকর্ড আর তথ্য অধিকারের পাতাগুলোর তালিকা।", "The list of budget, open data, MP records and RTI pages."), []),
};

const GENERIC: Guide = g(b("এই পাতা", "This page"), b("এই পাতায় কী আছে তা উপরের শিরোনাম আর নিচের লেখায় দেখা যায়।", "What is on this page is shown in the heading and the text below it."), [b("উপরের বার থেকে অন্য পাতায় যেতে পারেন।", "Use the bar at the top to go to another page.")], b("আটকে গেলে সাহায্যের পাতা দেখুন।", "If you are stuck, see the help page."));

/** The guide for a path: exact, else the longest fixed prefix (`/issue/AB12` uses `/issue`), else a generic one. */
export function guideFor(path: string): Guide {
  const p = (path.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  if (GUIDES[p]) return GUIDES[p];
  const prefix = Object.keys(GUIDES).filter((k) => k !== "/" && p.startsWith(`${k}/`)).sort((a, c) => c.length - a.length)[0];
  return prefix ? GUIDES[prefix] : GENERIC;
}

/** Is the text "how do I use this page?" (not about any particular other topic)? Short, with a page word and a how/use word. */
export function isPageQuestion(normalized: string): boolean {
  const ws = normalized.split(/\s+/).filter(Boolean);
  if (ws.length === 0 || ws.length > 14) return false;
  const page = /(পাতা|পাতাটি|পেজ|page|এখানে|এটা|এটি|this)/.test(normalized);
  const how = /(ব্যবহার|কীভাবে|কিভাবে|কি করব|কী করব|use|how|what can|কাজ করে|কী আছে|কি আছে)/.test(normalized);
  return page && how && !/(রিপোর্ট কীভাবে|কীভাবে রিপোর্ট)/.test(normalized);
}

export function renderGuide(guide: Guide, lang: Lang): string {
  const head = `${guide.title[lang]}: ${guide.what[lang]}`;
  const steps = guide.steps.length ? `\n\n${lang === "bn" ? "কীভাবে ব্যবহার করবেন:" : "How to use it:"}\n${guide.steps.map((s, i) => `${lang === "bn" ? toBanglaDigits(String(i + 1)) : i + 1}. ${s[lang]}`).join("\n")}` : "";
  const tip = guide.tip ? `\n\n${lang === "bn" ? "টিপ:" : "Tip:"} ${guide.tip[lang]}` : "";
  return head + steps + tip;
}
