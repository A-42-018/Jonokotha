import type { ExploreIssue } from "./explore";
import { approxCoord } from "./explore";
import type { Idea } from "./ideas";
import type { Category, Status } from "./types";

/**
 * SAMPLE DATA (নমুনা). Invented for demo and review; never real reports, people or statistics.
 * Every screen that shows these must label them "নমুনা" / "Sample".
 * Replaced by API data in Phase 2 integration; the backend owns the real endpoints.
 */
const T = (d: number) => new Date(Date.UTC(2026, 10, 16 - d, 6)).toISOString();

const row = (n: number, title: string, category: Category, status: Status, area: string, ago: number, upd: number, lat: number, lng: number, supports: number): ExploreIssue => ({
  ref: `JK-SAMPLE-${100 + n}`, title, category, status, area, createdAt: T(ago), updatedAt: T(upd),
  lat: approxCoord(lat), lng: approxCoord(lng), supports, areaId: "demo-1", sample: true,
});

export const SAMPLE_ISSUES: ExploreIssue[] = [
  row(1, "রাস্তায় বড় গর্ত, রিকশা উল্টে যাচ্ছে", "roads", "received", "ওয়ার্ড ৩ (নমুনা)", 1, 1, 23.8069, 90.3687, 14),
  row(2, "বাজারের পাশে ড্রেন বন্ধ", "drainage", "acknowledged", "ওয়ার্ড ৩ (নমুনা)", 3, 1, 23.8103, 90.3654, 9),
  row(3, "রাতে রাস্তার বাতি জ্বলে না", "electricity", "referred", "ওয়ার্ড ৪ (নমুনা)", 6, 2, 23.8151, 90.3722, 21),
  row(4, "টিউবওয়েল নষ্ট, পানি পাওয়া যাচ্ছে না", "water", "received", "ওয়ার্ড ২ (নমুনা)", 2, 2, 23.8012, 90.3611, 6),
  row(5, "ময়লা কয়েক দিন ধরে তোলা হচ্ছে না", "waste", "acknowledged", "ওয়ার্ড ৪ (নমুনা)", 9, 4, 23.8188, 90.3761, 17),
  row(6, "বৃষ্টিতে স্কুলের সামনে পানি জমে", "flooding", "referred", "ওয়ার্ড ১ (নমুনা)", 14, 5, 23.7971, 90.3702, 12),
  row(7, "স্বাস্থ্যকেন্দ্রে সন্ধ্যায় কেউ থাকে না", "health", "received", "ওয়ার্ড ২ (নমুনা)", 5, 5, 23.8044, 90.3568, 8),
  row(8, "স্কুলের দেয়াল ভেঙে পড়ছে", "education", "resolved", "ওয়ার্ড ১ (নমুনা)", 40, 8, 23.7938, 90.3745, 11),
  row(9, "মোড়ে রাতে ছিনতাইয়ের ভয়", "safety", "acknowledged", "ওয়ার্ড ৫ (নমুনা)", 12, 6, 23.8227, 90.3659, 19),
  row(10, "খালে পলিথিন আর আবর্জনা", "environment", "received", "ওয়ার্ড ৫ (নমুনা)", 20, 20, 23.8256, 90.3701, 5),
  row(11, "খেলার মাঠের গেট ভাঙা", "facilities", "resolved", "ওয়ার্ড ১ (নমুনা)", 60, 30, 23.7905, 90.3639, 3),
  row(12, "সড়কের পাশের ম্যানহোলের ঢাকনা নেই", "roads", "referred", "ওয়ার্ড ৩ (নমুনা)", 4, 3, 23.8097, 90.3711, 26),
];

const I = (n: number, title: string, summary: string, category: Category, area: string, supports: number, status: Idea["status"], ago: number, reason?: string): Idea => ({
  id: `idea-sample-${n}`, title, summary, category, area, supports, status, createdAt: T(ago), reason, sample: true,
});

export const SAMPLE_IDEAS: Idea[] = [
  I(1, "বাজারের পাশে ছোট পাবলিক টয়লেট", "বাজারে আসা নারী ও বয়স্কদের জন্য একটি পরিষ্কার টয়লেট দরকার।", "facilities", "ওয়ার্ড ৩ (নমুনা)", 48, "under_consideration", 10),
  I(2, "স্কুলের পাশে গতিরোধক ও জেব্রা ক্রসিং", "স্কুলের সময় গাড়ির গতি কমাতে রাস্তায় গতিরোধক ও পারাপারের দাগ দেওয়া হোক।", "safety", "ওয়ার্ড ১ (নমুনা)", 73, "office_review", 6),
  I(3, "খালের ধারে বসার জায়গা ও গাছ", "খালের পাড় পরিষ্কার করে গাছ লাগিয়ে বসার ব্যবস্থা করা যায়।", "environment", "ওয়ার্ড ৫ (নমুনা)", 31, "submitted", 2),
  I(4, "সন্ধ্যায় স্বাস্থ্যকেন্দ্র খোলা রাখা", "কর্মজীবী মানুষের জন্য সপ্তাহে দুই দিন সন্ধ্যায় স্বাস্থ্যকেন্দ্র খোলা থাকুক।", "health", "ওয়ার্ড ২ (নমুনা)", 56, "planned", 25),
  I(5, "রাস্তায় সৌরবাতি বসানো", "যেসব রাস্তায় বিদ্যুতের লাইন নেই, সেখানে সৌরবাতি লাগানো হোক।", "electricity", "ওয়ার্ড ৪ (নমুনা)", 40, "needs_info", 4),
  I(6, "নদীর পাড়ে বহুতল পার্কিং", "বড় খরচ ও জায়গার সীমাবদ্ধতায় এই আইডিয়া এখন করা সম্ভব নয়।", "roads", "ওয়ার্ড ৫ (নমুনা)", 12, "not_planned", 45, "জায়গা ও বাজেটের সীমাবদ্ধতা; পরে সম্ভাব্যতা যাচাই করা যেতে পারে।"),
  I(7, "ময়লা আলাদা করার ডাস্টবিন", "পাড়ায় তিন রঙের ডাস্টবিন রেখে ময়লা আলাদা করা শুরু হোক।", "waste", "ওয়ার্ড ৩ (নমুনা)", 27, "in_progress", 30),
  I(8, "মাঠে কমিউনিটি বইয়ের তাক", "খেলার মাঠের এক কোণে ছোট খোলা লাইব্রেরি।", "education", "ওয়ার্ড ১ (নমুনা)", 19, "implemented", 70),
];

/** SAMPLE in-app notifications (নমুনা). Real ones need the notifications API (not built). */
export interface Notice { id: string; kind: "status" | "reply" | "area" | "idea"; bn: string; en: string; at: string; href: string }
export const SAMPLE_NOTICES: Notice[] = [
  { id: "n1", kind: "status", bn: "আপনার অনুসরণ করা অভিযোগের অবস্থা বদলেছে: “অফিস দেখেছে”।", en: "A report you follow changed status: “Seen by office”.", at: T(0), href: "/area" },
  { id: "n2", kind: "reply", bn: "এমপি অফিস আপনার প্রশ্নের উত্তর দিয়েছে।", en: "The MP office replied to your question.", at: T(1), href: "/ask/inbox" },
  { id: "n3", kind: "area", bn: "আপনার অনুসরণ করা এলাকায় নতুন একটি সমস্যা জানানো হয়েছে।", en: "A new problem was reported in an area you follow.", at: T(2), href: "/area" },
  { id: "n4", kind: "idea", bn: "আপনার সমর্থন করা আইডিয়া “বিবেচনায়” গেছে।", en: "An idea you supported is now “under consideration”.", at: T(5), href: "/ideas" },
];
