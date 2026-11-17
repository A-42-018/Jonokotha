/**
 * RTI helper (B8.7). Pure functions: a draft text with PLACEHOLDERS for the applicant's own details, and a deadline estimate.
 * Nothing here sends, files or stores personal details. Deadlines come from configuration (app_settings.rti_rules, reviewed: false until counsel confirms).
 */
export interface RtiRules {
  reviewed: boolean; respond_working_days: number; respond_working_days_multiple_units: number; appeal_days_after_decision: number; weekend_days: number[];
  official_channels: { name_en: string; name_bn: string; url: string; verified: boolean }[]; note?: string;
}
export const DEFAULT_RTI_RULES: RtiRules = { reviewed: false, respond_working_days: 20, respond_working_days_multiple_units: 30, appeal_days_after_decision: 30, weekend_days: [5, 6], official_channels: [], note: "Not confirmed." };

export type RtiFormat = "electronic" | "paper_copy" | "inspection";
const FORMAT_BN: Record<RtiFormat, string> = { electronic: "ইলেকট্রনিক কপি (ইমেইল বা সিডি)", paper_copy: "কাগজের কপি", inspection: "নথি পরিদর্শন করে" };
const FORMAT_EN: Record<RtiFormat, string> = { electronic: "an electronic copy (email or disc)", paper_copy: "a paper copy", inspection: "inspection of the records" };

export interface RtiInput { agency_name: string; subject: string; info_requested: string; period?: string | null; format: RtiFormat; language: "bn" | "en" }

/** The text the citizen copies. The bracketed lines are for them to fill in; we never ask for or keep those details. */
export function buildRtiDraft(i: RtiInput): string {
  if (i.language === "en") {
    return [
      "To,", "The Designated Officer", i.agency_name, "",
      `Subject: Request for information under the Right to Information Act, 2009 - ${i.subject}`, "",
      "Dear Sir or Madam,", "",
      "Under the Right to Information Act, 2009, I request the following information:", "", i.info_requested, "",
      ...(i.period ? [`Period concerned: ${i.period}`, ""] : []),
      `I would like to receive the information as ${FORMAT_EN[i.format]}.`, "",
      "Applicant's name: [write your name]", "Address: [write your address]", "Contact (phone or email): [write how the office can reach you]", "Other details the official form asks for: [fill in from the form]", "Date: [date of application]", "Signature: [your signature]",
    ].join("\n");
  }
  return [
    "বরাবর,", "দায়িত্বপ্রাপ্ত কর্মকর্তা", i.agency_name, "",
    `বিষয়: তথ্য অধিকার আইন, ২০০৯ এর অধীনে তথ্যের জন্য আবেদন - ${i.subject}`, "",
    "জনাব/জনাবা,", "",
    "তথ্য অধিকার আইন, ২০০৯ এর অধীনে আমি নিচের তথ্য চাইছি:", "", i.info_requested, "",
    ...(i.period ? [`সংশ্লিষ্ট সময়কাল: ${i.period}`, ""] : []),
    `তথ্যটি আমি ${FORMAT_BN[i.format]} পেতে চাই।`, "",
    "আবেদনকারীর নাম: [আপনার নাম লিখুন]", "ঠিকানা: [আপনার ঠিকানা লিখুন]", "যোগাযোগ (ফোন বা ইমেইল): [অফিস যেভাবে আপনার সঙ্গে যোগাযোগ করবে]", "সরকারি ফরমে চাওয়া অন্যান্য তথ্য: [ফরম দেখে পূরণ করুন]", "তারিখ: [আবেদনের তারিখ]", "স্বাক্ষর: [আপনার স্বাক্ষর]",
  ].join("\n");
}

/** Adds working days to a date (UTC calendar days). The start day is day 0. Public holidays are NOT known, so the result is the EARLIEST possible date. */
export function addWorkingDays(from: string, days: number, weekend: number[] = [5, 6]): string {
  const d = new Date(`${from}T00:00:00Z`);
  let left = days;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); if (!weekend.includes(d.getUTCDay())) left--; }
  return d.toISOString().slice(0, 10);
}
export type RtiState = "not_filed" | "awaiting_answer" | "due_soon" | "past_earliest_deadline" | "answered" | "appealed" | "closed";
export function rtiTimeline(r: { status: string; filed_on: string | null; answered_on: string | null }, rules: RtiRules, today = new Date().toISOString().slice(0, 10)) {
  if (!r.filed_on) return { state: (r.status === "closed" ? "closed" : "not_filed") as RtiState, earliest_due_on: null, appeal_window_days: rules.appeal_days_after_decision, self_reported: true };
  const due = addWorkingDays(r.filed_on, rules.respond_working_days, rules.weekend_days);
  const soon = addWorkingDays(today, 3, rules.weekend_days);
  const state: RtiState = r.status === "closed" ? "closed" : r.status === "appealed" ? "appealed" : r.status === "answered" ? "answered" : today > due ? "past_earliest_deadline" : due <= soon ? "due_soon" : "awaiting_answer";
  return { state, earliest_due_on: due, appeal_window_days: rules.appeal_days_after_decision, self_reported: true };
}
