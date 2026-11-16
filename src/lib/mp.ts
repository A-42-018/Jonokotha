import type { Lang } from "./i18n";
import { searchPlaces, SAMPLE_PLACES, type Place } from "./places";

/**
 * SAMPLE representatives (নমুনা). Invented people and numbers for demo and review only.
 * Real profiles need verification by the platform team (source + date); until then every card says "Sample".
 */
export interface Announcement { id: string; date: string; titleBn: string; titleEn: string }
export interface Rep {
  id: string;
  constituencyId: string;
  nameBn: string; nameEn: string;
  roleBn: string; roleEn: string;
  constituencyBn: string; constituencyEn: string;
  termFrom: string; termTo: string;
  verifiedAt: string;
  source: string;
  office: { addressBn: string; addressEn: string; phone: string; email: string; hoursBn: string; hoursEn: string };
  announcements: Announcement[];
  /** Responsiveness for a stated period. Sample numbers only. Never used to rank or compare MPs. */
  stats: { from: string; to: string; received: number; answered: number; pending: number; medianFirstResponseDays: number };
  sample: true;
}

export const SAMPLE_REPS: Rep[] = [
  {
    id: "rep-demo-1", constituencyId: "demo-1",
    nameBn: "নমুনা জনপ্রতিনিধি ১", nameEn: "Sample Representative 1",
    roleBn: "সংসদ সদস্য", roleEn: "Member of Parliament",
    constituencyBn: "নমুনা নির্বাচনী এলাকা", constituencyEn: "Sample Constituency",
    termFrom: "2026-01-01", termTo: "2030-12-31", verifiedAt: "2026-11-16", source: "example.invalid (নমুনা)",
    office: { addressBn: "নমুনা ঠিকানা, নমুনা সড়ক (আসল নয়)", addressEn: "Sample address, Sample Road (not real)", phone: "০০০০-নমুনা", email: "office@example.invalid", hoursBn: "রবি–বৃহস্পতি, সকাল ১০টা–বিকাল ৪টা (নমুনা)", hoursEn: "Sun–Thu, 10am–4pm (sample)" },
    announcements: [
      { id: "a1", date: "2026-11-10", titleBn: "নমুনা: ওয়ার্ড ৩-এ ড্রেন পরিষ্কার অভিযান শুরু হবে", titleEn: "Sample: drain cleaning drive to start in Ward 3" },
      { id: "a2", date: "2026-11-02", titleBn: "নমুনা: প্রতি মঙ্গলবার জনসাধারণের সঙ্গে বসা", titleEn: "Sample: open meeting with residents every Tuesday" },
    ],
    stats: { from: "2026-10-01", to: "2026-10-31", received: 120, answered: 84, pending: 36, medianFirstResponseDays: 3 },
    sample: true,
  },
  {
    id: "rep-demo-2", constituencyId: "demo-2",
    nameBn: "নমুনা জনপ্রতিনিধি ২", nameEn: "Sample Representative 2",
    roleBn: "সংসদ সদস্য", roleEn: "Member of Parliament",
    constituencyBn: "নমুনা নির্বাচনী এলাকা ২", constituencyEn: "Sample Constituency 2",
    termFrom: "2026-01-01", termTo: "2030-12-31", verifiedAt: "2026-11-16", source: "example.invalid (নমুনা)",
    office: { addressBn: "নমুনা ঠিকানা ২ (আসল নয়)", addressEn: "Sample address 2 (not real)", phone: "০০০০-নমুনা", email: "office2@example.invalid", hoursBn: "অফিস সময় নিশ্চিত নয়", hoursEn: "Office hours not confirmed" },
    announcements: [],
    stats: { from: "2026-10-01", to: "2026-10-31", received: 40, answered: 22, pending: 18, medianFirstResponseDays: 5 },
    sample: true,
  },
];

/** Which constituency(ies) a sample ward may fall in. Ward 5 sits on a boundary: two candidates, citizen confirms (§7.13). */
const WARD_CONSTITUENCY: Record<string, string[]> = { w1: ["demo-1"], w2: ["demo-1"], w3: ["demo-1"], w4: ["demo-1"], w5: ["demo-1", "demo-2"] };

export const repById = (id: string) => SAMPLE_REPS.find((r) => r.id === id);

export interface FinderResult { place: Place; reps: Rep[] }

/** Area search to candidate representatives. More than one rep means the boundary is uncertain. */
export function findRepsByArea(q: string, lang: Lang): FinderResult[] {
  return searchPlaces(q, lang, SAMPLE_PLACES).map((place) => ({
    place,
    reps: (WARD_CONSTITUENCY[place.id] ?? []).map((cid) => SAMPLE_REPS.find((r) => r.constituencyId === cid)).filter((r): r is Rep => !!r),
  }));
}

/** Share of received messages that were answered (0–100, whole number). Describes one office; never ranks. */
export function answeredShare(s: Rep["stats"]): number {
  return s.received === 0 ? 0 : Math.round((s.answered / s.received) * 100);
}
