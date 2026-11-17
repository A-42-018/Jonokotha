import { describe, expect, it } from "vitest";
import { bnDayPart, fillNum, fmtDate, fmtDay, fmtNum } from "@/lib/format";
import { dict } from "@/lib/i18n";

/** Language QA (task 3.4, masterplan §19). Automated checks only: a native Bangla speaker still signs off the wording. */
function walk(o: unknown, path: string, out: [string, string][]) {
  if (typeof o === "string") out.push([path, o]);
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k, out);
}
const bn: [string, string][] = [];
const en: [string, string][] = [];
walk(dict.bn, "", bn);
walk(dict.en, "", en);
const text = (s: string) => s.replace(/\{[a-zA-Z0-9]+\}/g, "");

// Latin text allowed inside Bangla strings: language names, file formats and a data credit that must keep its proper name.
// Release 1.1 adds the product name WhatsApp and the file names CSV and PDF, which people know in Latin letters.
// The home track box shows an example reference number, and reference codes stay Latin (JK-...).
const LATIN_OK = new Set(["switchLang", "navLangSwitch", "stLangSwitch", "errPhotoType", "exMapCredit", "odExport", "chnTitle", "chnNavLink", "chnWaNumber", "chnOpenWa", "chnPlannedBody", "chpChannel_whatsapp", "chpLead", "xpCsv", "xpPrintNote", "xpCsvNote", "r2OdDownloadCsv", "r2OdDownloadJson", "r2BgErrUrl", "hmTrackExample"]);
// "AI-এর পরামর্শ" is the glossary form (§19.3) only where it already appears as বাংলা এআই; reference codes stay Latin.

describe("Bangla strings follow §19.1 and §19.2", () => {
  it("every English key exists in Bangla and vice versa", () => {
    expect(en.map(([k]) => k).sort()).toEqual(bn.map(([k]) => k).sort());
  });
  it("no mixed-language labels: Bangla strings contain no Latin letters, except named exceptions", () => {
    const bad = bn.filter(([k, s]) => /[A-Za-z]/.test(text(s)) && !LATIN_OK.has(k));
    expect(bad).toEqual([]);
  });
  it("no ASCII digits in Bangla text (Bangla numerals; counts go through fmtNum)", () => {
    expect(bn.filter(([, s]) => /[0-9]/.test(text(s)))).toEqual([]);
  });
  it("no সাধু (formal-literary) verb forms", () => {
    const sadhu = /(করিয়া|হইবে|হইয়া|করিবেন|করিতে|দিয়াছে|যাইবে|হইতে|কর্তৃক|তাহা|যাহা|হইল|করুন্)/;
    expect(bn.filter(([, s]) => sadhu.test(s))).toEqual([]);
  });
  it("office or heavily formal words from the §19.2 avoid-list are not used", () => {
    const formal = /(অভিযোগ|দাখিল|প্রদান করুন|নিবন্ধন|সংশ্লিষ্ট|কার্যালয়|প্রস্তাবনা|(?<!বি)জ্ঞাপন|প্রেরণ|উন্মুক্ত|বিজ্ঞপ্তি|অবস্থান নির্ধারণ|সংযুক্ত|পর্যবেক্ষণ|সম্পাদনা|গ্রহণ)/;
    expect(bn.filter(([, s]) => formal.test(s))).toEqual([]);
  });
  it("sentences stay short (about 12 words, never more than 20)", () => {
    const long = bn.filter(([, s]) => text(s).split(/[।?!;]/).some((x) => x.trim().split(/\s+/).length > 20));
    expect(long.map(([k]) => k)).toEqual([]);
  });
});

describe("glossary terms are used the same way everywhere (§19.3 to §19.5)", () => {
  const b = dict.bn;
  it("status labels match §19.4 for the statuses the app has", () => {
    expect(b.statuses).toEqual({ received: "পাঠানো হয়েছে", acknowledged: "এমপির অফিস পেয়েছে", referred: "দায়িত্বে থাকা অফিসে পাঠানো হয়েছে", resolved: "সমাধান হয়েছে" });
    expect(dict.en.statuses.acknowledged).toBe("Received by the office");
  });
  it("category labels match §19.5", () => {
    expect(b.cats).toMatchObject({ roads: "রাস্তাঘাট", flooding: "জলাবদ্ধতা ও বন্যা", drainage: "ড্রেন ও নালা", water: "পানির সমস্যা", electricity: "বিদ্যুৎ", waste: "ময়লা-আবর্জনা", health: "স্বাস্থ্যসেবা", education: "স্কুল ও পড়াশোনা", safety: "নিরাপত্তা", facilities: "সরকারি ভবন ও সুবিধা", environment: "পরিবেশ", other: "অন্য কিছু" });
  });
  it("core terms: reference number, my reports, follow, support, find your MP", () => {
    expect(b.refId).toBe("সমস্যা নম্বর");
    expect(b.meMyReports).toBe("আমার সমস্যাগুলো");
    expect(b.isFollow).toBe("খবর রাখুন");
    expect(b.idSupport).toBe("আমিও চাই");
  });
  it("buttons are short: 1 to 3 words for the main actions", () => {
    for (const k of ["signIn", "signOut", "stRetry", "isFollow", "idSupport", "qSendNow", "qDiscard"] as const) {
      expect(b[k].split(/\s+/).length, k).toBeLessThanOrEqual(3);
    }
  });
});

describe("numbers and dates (§19.1): Bangla digits, Asia/Dhaka", () => {
  it("fmtNum and fillNum use Bangla digits in bn and Latin digits in en", () => {
    expect(fmtNum(2026, "bn")).toBe("২০২৬");
    expect(fmtNum(2026, "en")).toBe("2026");
    expect(fillNum("{n}টি সমস্যা", { n: 12 }, "bn")).toBe("১২টি সমস্যা");
  });
  it("dates are shown in Dhaka time, not the device's or UTC", () => {
    // 20:30 UTC on 15 Nov is 02:30 on 16 Nov in Dhaka (UTC+6).
    expect(fmtDay("2026-11-15T20:30:00Z", "bn")).toBe("১৬ নভেম্বর ২০২৬");
    expect(fmtDay("2026-11-15T20:30:00Z", "en")).toBe("16 Nov 2026");
  });
  it("date and time read like everyday Bangla (day part, no AM/PM)", () => {
    expect(fmtDate("2026-11-15T20:30:00Z", "bn")).toBe("১৬ নভেম্বর ২০২৬, রাত ২:৩০");
    expect(fmtDate("2026-11-16T06:05:00Z", "bn")).toBe("১৬ নভেম্বর ২০২৬, দুপুর ১২:০৫");
    expect(fmtDate("2026-11-16T09:45:00Z", "bn")).toBe("১৬ নভেম্বর ২০২৬, দুপুর ৩:৪৫");
    expect(fmtDate("2026-11-15T20:30:00Z", "en")).toBe("16 Nov 2026, 02:30");
    expect(fmtDate("2026-11-15T20:30:00Z", "bn")).not.toMatch(/AM|PM/);
  });
  it("day parts cover the whole clock", () => {
    expect([0, 3, 4, 5, 6, 11, 12, 15, 16, 17, 18, 19, 20, 23].map(bnDayPart)).toEqual(["রাত", "রাত", "ভোর", "ভোর", "সকাল", "সকাল", "দুপুর", "দুপুর", "বিকেল", "বিকেল", "সন্ধ্যা", "সন্ধ্যা", "রাত", "রাত"]);
  });
});
