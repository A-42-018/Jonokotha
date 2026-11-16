import type { ExploreIssue } from "./explore";
import { approxCoord } from "./explore";
import type { Category, Status } from "./types";

/**
 * SAMPLE DATA (নমুনা). Invented for demo and review; never real reports, people or statistics.
 * Every screen that shows these must label them "নমুনা" / "Sample".
 * Replaced by API data in Phase 2 integration; the backend owns the real endpoints.
 */
const T = (d: number) => new Date(Date.UTC(2026, 10, 16 - d, 6)).toISOString();

const row = (n: number, title: string, category: Category, status: Status, area: string, ago: number, upd: number, lat: number, lng: number, supports: number): ExploreIssue => ({
  ref: `JK-SAMPLE-${100 + n}`, title, category, status, area, createdAt: T(ago), updatedAt: T(upd),
  lat: approxCoord(lat), lng: approxCoord(lng), supports, sample: true,
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
