import type { Category, CaseRecord, IssueStatus, Status } from "../types";
import { ago, bi, tx, type Bi, type Lang } from "./util";

/** Example reports (cases). Refs start with JKD- so they can never be confused with a real JK-YYYY-NNNN case. */
export interface DemoCase {
  ref: string; category: Category; title: Bi; description: Bi; area: Bi; detail: IssueStatus; days: number; affected: number;
  lat: number; lng: number; photos: { file: string; caption: Bi }[];
  /** Legacy-status steps with the number of days after the report each happened. */
  steps: { status: Status; after: number }[];
}

const B = { lat: 23.8069, lng: 90.3687 };
const photo = (file: string, bn: string, en: string) => ({ file: `/demo/${file}.svg`, caption: bi(bn, en) });

export const DEMO_CASES: DemoCase[] = [
  { ref: "JKD-2026-0101", category: "roads", detail: "resolved", days: 21, affected: 48, lat: B.lat + 0.004, lng: B.lng + 0.002, area: bi("মিরপুর ১০", "Mirpur 10"),
    title: bi("মিরপুর ১০ নম্বর রোডে বড় গর্ত", "Large pothole on Road 10, Mirpur 10"),
    description: bi("মূল রাস্তার মাঝখানে বড় গর্ত। রিকশা আর মোটরসাইকেল দুর্ঘটনায় পড়ছে। বৃষ্টির পর গর্ত পানিতে ঢেকে যায়, তাই বোঝাই যায় না।", "A large pothole in the middle of the main road. Rickshaws and motorcycles keep having accidents. After rain it fills with water and cannot be seen."),
    photos: [photo("pothole-before", "মেরামতের আগে", "Before the repair"), photo("pothole-after", "মেরামতের পরে", "After the repair")],
    steps: [{ status: "received", after: 0 }, { status: "acknowledged", after: 2 }, { status: "referred", after: 4 }, { status: "resolved", after: 15 }] },
  { ref: "JKD-2026-0102", category: "drainage", detail: "referred_to_authority", days: 12, affected: 31, lat: B.lat - 0.003, lng: B.lng + 0.006, area: bi("কাজীপাড়া", "Kazipara"),
    title: bi("বৃষ্টির পর ড্রেনের পানি উপচে পড়ছে", "Drain overflows onto the road after rain"),
    description: bi("ড্রেন পরিষ্কার না হওয়ায় সামান্য বৃষ্টিতেই পানি রাস্তায় উঠে যায়। ড্রেনে প্লাস্টিক আর ময়লা জমে আছে।", "The drain is not cleaned, so even light rain pushes water onto the road. Plastic and rubbish are packed into it."),
    photos: [photo("drain-before", "ড্রেনের অবস্থা", "The drain today")],
    steps: [{ status: "received", after: 0 }, { status: "acknowledged", after: 1 }, { status: "referred", after: 3 }] },
  { ref: "JKD-2026-0103", category: "electricity", detail: "in_progress", days: 9, affected: 27, lat: B.lat + 0.006, lng: B.lng - 0.004, area: bi("শেওড়াপাড়া", "Shewrapara"),
    title: bi("রাতে গলির রাস্তার বাতি জ্বলে না", "Street lights in the lane are dark at night"),
    description: bi("গলির তিনটি বাতি এক মাস ধরে নষ্ট। রাতে চলাচল ঝুঁকিপূর্ণ, বিশেষ করে নারী ও শিশুদের জন্য।", "Three lights in the lane have been out for a month. Walking at night is risky, especially for women and children."),
    photos: [photo("light-before", "রাতের গলি", "The lane at night")],
    steps: [{ status: "received", after: 0 }, { status: "acknowledged", after: 2 }] },
  { ref: "JKD-2026-0104", category: "waste", detail: "resolved", days: 30, affected: 55, lat: B.lat - 0.007, lng: B.lng - 0.002, area: bi("পল্লবী", "Pallabi"),
    title: bi("বাজারের পাশে ময়লার ভাগাড় সরানো হয়নি", "Rubbish heap beside the market not collected"),
    description: bi("বাজারের পাশে ময়লা জমে দুর্গন্ধ ছড়াচ্ছে। মাছি আর মশার উপদ্রব বেড়েছে।", "Rubbish has piled up next to the market and smells. Flies and mosquitoes are getting worse."),
    photos: [photo("waste-before", "ময়লার স্তূপ", "The rubbish heap"), photo("waste-after", "পরিষ্কারের পর, নতুন ডাস্টবিন", "After clearing, with new bins")],
    steps: [{ status: "received", after: 0 }, { status: "acknowledged", after: 1 }, { status: "referred", after: 3 }, { status: "resolved", after: 20 }] },
  { ref: "JKD-2026-0105", category: "water", detail: "under_review", days: 3, affected: 14, lat: B.lat + 0.009, lng: B.lng + 0.007, area: bi("মিরপুর ১২", "Mirpur 12"),
    title: bi("ট্যাপের পানি ঘোলা ও দুর্গন্ধযুক্ত", "Tap water is cloudy and smells"),
    description: bi("তিন দিন ধরে ট্যাপে ঘোলা পানি আসছে। ফুটিয়ে খেলেও গন্ধ যায় না।", "For three days the tap has run cloudy water. The smell stays even after boiling."),
    photos: [], steps: [{ status: "received", after: 0 }] },
  { ref: "JKD-2026-0106", category: "safety", detail: "submitted", days: 2, affected: 22, lat: B.lat + 0.001, lng: B.lng + 0.01, area: bi("মিরপুর ১১", "Mirpur 11"),
    title: bi("স্কুলের সামনে স্পিডব্রেকার দরকার", "Speed breaker needed outside the school"),
    description: bi("স্কুল ছুটির সময় দ্রুতগতির গাড়ি যায়। গত মাসে একটি শিশু অল্পের জন্য বেঁচেছে।", "Cars speed past at school closing time. A child narrowly escaped last month."),
    photos: [], steps: [{ status: "received", after: 0 }] },
  { ref: "JKD-2026-0107", category: "health", detail: "acknowledged", days: 8, affected: 19, lat: B.lat - 0.002, lng: B.lng - 0.008, area: bi("রূপনগর", "Rupnagar"),
    title: bi("কমিউনিটি ক্লিনিকে ওষুধ ফুরিয়ে গেছে", "Community clinic has run out of medicine"),
    description: bi("ক্লিনিকে জ্বর ও ডায়রিয়ার ওষুধ নেই। রোগীদের বাইরে থেকে কিনতে হচ্ছে।", "No fever or diarrhoea medicine at the clinic. Patients must buy outside."),
    photos: [], steps: [{ status: "received", after: 0 }, { status: "acknowledged", after: 3 }] },
  { ref: "JKD-2026-0108", category: "education", detail: "acknowledged", days: 15, affected: 36, lat: B.lat + 0.011, lng: B.lng - 0.001, area: bi("মিরপুর ১৪", "Mirpur 14"),
    title: bi("প্রাথমিক বিদ্যালয়ের ছাদ চুইয়ে পানি পড়ে", "Primary school roof leaks in the rain"),
    description: bi("বর্ষায় তিনটি শ্রেণিকক্ষে পানি পড়ে, ক্লাস বন্ধ রাখতে হয়।", "Three classrooms leak in the monsoon and classes have to stop."),
    photos: [], steps: [{ status: "received", after: 0 }, { status: "acknowledged", after: 4 }] },
  { ref: "JKD-2026-0109", category: "flooding", detail: "referred_to_authority", days: 18, affected: 63, lat: B.lat - 0.009, lng: B.lng + 0.004, area: bi("ভাষানটেক", "Bhashantek"),
    title: bi("ভারী বৃষ্টিতে সড়কে হাঁটুপানি জমে", "Knee-deep waterlogging on the road after heavy rain"),
    description: bi("বৃষ্টির পর ২–৩ দিন পানি নামে না। দোকান আর স্কুল বন্ধ থাকে।", "Water stays for two to three days after rain. Shops and schools close."),
    photos: [], steps: [{ status: "received", after: 0 }, { status: "acknowledged", after: 2 }, { status: "referred", after: 6 }] },
  { ref: "JKD-2026-0110", category: "environment", detail: "submitted", days: 1, affected: 9, lat: B.lat + 0.003, lng: B.lng + 0.014, area: bi("দারুস সালাম", "Darus Salam"),
    title: bi("খোলা জায়গায় ময়লা পোড়ানোর ধোঁয়া", "Smoke from burning rubbish in the open"),
    description: bi("প্রতি সন্ধ্যায় খালি জমিতে ময়লা পোড়ানো হয়। শ্বাসকষ্টে ভুগছে বয়স্করা।", "Rubbish is burned on the empty plot every evening. Older people struggle to breathe."),
    photos: [], steps: [{ status: "received", after: 0 }] },
  { ref: "JKD-2026-0111", category: "facilities", detail: "in_progress", days: 24, affected: 41, lat: B.lat - 0.005, lng: B.lng - 0.011, area: bi("কালশী", "Kalshi"),
    title: bi("ফুটওভার ব্রিজের রেলিং ভাঙা", "Broken railing on the footbridge"),
    description: bi("ব্রিজের এক পাশের রেলিং নেই। শিশু ও বয়স্কদের পার হওয়া ঝুঁকিপূর্ণ।", "One side of the footbridge has no railing. Crossing is risky for children and older people."),
    photos: [], steps: [{ status: "received", after: 0 }, { status: "acknowledged", after: 5 }] },
  { ref: "JKD-2026-0112", category: "roads", detail: "submitted", days: 0, affected: 4, lat: B.lat + 0.005, lng: B.lng + 0.012, area: bi("মিরপুর ২", "Mirpur 2"),
    title: bi("ফুটপাত দখল করে দোকান বসানো হয়েছে", "Shops occupy the footpath"),
    description: bi("ফুটপাত দখলের কারণে মানুষ রাস্তায় নেমে হাঁটতে বাধ্য হচ্ছে।", "Because the footpath is blocked, people have to walk on the road."),
    photos: [], steps: [{ status: "received", after: 0 }] },
];

const NEW_CASE = (ref: string): DemoCase => ({ ref, category: "other", detail: "submitted", days: 0, affected: 1, lat: B.lat, lng: B.lng, area: bi("আপনার এলাকা", "Your area"),
  title: bi("আপনার নমুনা অভিযোগ", "Your sample report"), description: bi("এটি ডেমোতে পাঠানো নমুনা অভিযোগ; কোথাও জমা হয়নি।", "This is a sample report sent during the demo. It was not saved anywhere."), photos: [], steps: [{ status: "received", after: 0 }] });
export const findCase = (ref: string) => DEMO_CASES.find((c) => c.ref === ref);

const NOTE: Record<Status, Bi> = {
  received: bi("অভিযোগ গৃহীত হয়েছে।", "Report received."),
  acknowledged: bi("অফিস অভিযোগটি দেখেছে।", "The office has seen the report."),
  referred: bi("সংশ্লিষ্ট সংস্থায় পাঠানো হয়েছে।", "Passed to the responsible agency."),
  resolved: bi("কাজ শেষ হয়েছে।", "The work is finished."),
};

/** The public case page record for an example ref (what `getCase` returns for a real one). */
export function demoCaseRecord(ref: string, lang: Lang): CaseRecord | undefined {
  // A report "sent" during the demo gets a ref in the 9xxx range; show it as a freshly received example.
  const c = findCase(ref) ?? (/^JKD-2026-9\d{3}$/.test(ref) ? NEW_CASE(ref) : undefined);
  if (!c) return undefined;
  const last = c.steps[c.steps.length - 1].status;
  return {
    ref: c.ref, title: tx(c.title, lang), category: c.category, description: tx(c.description, lang), area: tx(c.area, lang), constituencyId: "demo-1",
    status: last, statusDetail: c.detail, createdAt: ago(c.days),
    timeline: c.steps.map((s) => ({ status: s.status, at: ago(c.days - s.after), note: tx(NOTE[s.status], lang) })),
    ai: { summary: "", similarRefs: [], agencyId: "ag-office", confidence: 0.8 },
  };
}
