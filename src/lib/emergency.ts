/**
 * Imminent-harm detection (masterplan §17.8, backend plan M.8). Rules only, on purpose: a person in danger gets fixed,
 * reviewed text with the national emergency numbers, never a model-written reply, and detection works with no network.
 * It favours false alarms over misses; a false alarm shows a calm notice and does not block the report.
 *
 * The wording below is a draft for the team to approve (docs/aibc/runbooks/imminent-harm.md). Numbers: 999 national
 * emergency, 109 violence against women and children helpline, 1098 child helpline.
 */
import type { Emergency, EmergencyKind } from "./types";
export type { Emergency, EmergencyKind };

const RULES: { kind: EmergencyKind; re: RegExp }[] = [
  { kind: "self_harm", re: /(আত্মহত্যা|আত্মহনন|নিজেকে শেষ|বাঁচতে চাই না|বাঁচতে ইচ্ছা করে না|মরে যেতে চাই|মরে যাব|বিষ খাব|গলায় দড়ি|suicid|kill myself|end my life|want to die|don'?t want to live|hang myself|take my own life|ami morte chai|atmohotta|attohotta)/i },
  { kind: "child_in_danger", re: /(শিশু(কে)? (নির্যাতন|ধর্ষণ|পাচার)|বাচ্চা(কে)? (মারছে|নির্যাতন)|শিশু বিবাহ|বাল্যবিবাহ(র)? (হচ্ছে|দিচ্ছে)|child (abuse|marriage|trafficking)|abusing (a |the )?child|kidnapp?ed? (a |the )?child)/i },
  { kind: "violence", re: /(খুন করবে|মেরে ফেলবে|মেরে ফেলার হুমকি|প্রাণনাশের হুমকি|ধর্ষণ(ের)? (হুমকি|চেষ্টা)|এখনই মারছে|হামলা হচ্ছে|অপহরণ|জিম্মি|kill (me|her|him|them)|going to kill|threaten(ing|ed)? to kill|death threat|being (attacked|beaten|raped)|rape threat|hostage|kidnap|he has a (gun|knife)|shooting|stabbing)/i },
];

const GUIDANCE = {
  self_harm: {
    bn: "আপনি একা নন। এখনই বিপদ মনে হলে ৯৯৯-এ ফোন করুন, অথবা বিশ্বাসের কাউকে এখনই আপনার কাছে ডাকুন। এই অ্যাপ জরুরি সেবা বা পরামর্শদাতা নয়।",
    en: "You are not alone. If you feel in danger right now, call 999, or ask someone you trust to be with you now. This app is not an emergency or counselling service.",
  },
  violence: {
    bn: "প্রাণের ঝুঁকি বা এখনই হামলার আশঙ্কা থাকলে আগে ৯৯৯-এ ফোন করুন। নারী ও শিশু নির্যাতনের জন্য ১০৯। এই অ্যাপ জরুরি সেবা নয়; কেউ এই লেখা সঙ্গে সঙ্গে দেখবে, তার নিশ্চয়তা নেই।",
    en: "If anyone's life is at risk or an attack is happening, call 999 first. For violence against women and children, call 109. This app is not an emergency service and nobody is guaranteed to read this right away.",
  },
  child_in_danger: {
    bn: "কোনো শিশু বিপদে থাকলে এখনই ৯৯৯ বা শিশু হেল্পলাইন ১০৯৮-এ ফোন করুন। এই অ্যাপ জরুরি সেবা নয়।",
    en: "If a child is in danger, call 999 or the child helpline 1098 now. This app is not an emergency service.",
  },
} as const;

export function detectEmergency(text: string): Emergency | null {
  const t = text.normalize("NFC");
  for (const r of RULES) if (r.re.test(t)) {
    return { kind: r.kind, guidance: GUIDANCE[r.kind], numbers: r.kind === "child_in_danger" ? ["999", "1098"] : r.kind === "violence" ? ["999", "109"] : ["999"] };
  }
  return null;
}

/** Puts the item in the moderators' queue (reason "unsafe", flagged automatically). Best effort: a failure never blocks the citizen's submission. */
export async function flagEmergency(sb: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> }, type: "issue" | "question", ref: string): Promise<void> {
  try { await sb.rpc("flag_emergency", { p_type: type, p_ref: ref }); } catch { /* best effort */ }
}
