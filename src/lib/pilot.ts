import { redactPii } from "./pii";

/** Support and tester-feedback message (F6.2). The API has no endpoint for it yet, so the text is prepared on the device and handed over by email or copy, like the content challenge. */
export type SupportKind = "question" | "problem" | "tester";
export interface SupportInput { kind: SupportKind; where: string; clarity: string; what: string }

export function validateSupport(v: SupportInput): { what?: "spWhatShort" | "spWhatLong"; clarity?: "spClarityMissing" } {
  const e: { what?: "spWhatShort" | "spWhatLong"; clarity?: "spClarityMissing" } = {};
  const n = v.what.trim().length;
  if (n < 10) e.what = "spWhatShort";
  else if (n > 1500) e.what = "spWhatLong";
  if (v.kind === "tester" && !/^[1-5]$/.test(v.clarity)) e.clarity = "spClarityMissing";
  return e;
}

/** True when the text looks like it holds a phone number, email or ID number, so the person can remove it before sending. */
export const looksPersonal = (text: string) => redactPii(text).found.length > 0;

export function supportText(v: SupportInput, labels: { kind: string; where: string; clarity: string; what: string; kindName: string }, fmt: (n: string) => string = (x) => x) {
  const lines = [`${labels.kind}: ${labels.kindName}`];
  if (v.where.trim()) lines.push(`${labels.where}: ${v.where.trim()}`);
  if (v.kind === "tester" && v.clarity) lines.push(`${labels.clarity}: ${fmt(v.clarity)}`);
  lines.push(`${labels.what}:`, v.what.trim(), "");
  return lines.join("\n");
}

export const OFFICE_TOUR_KEY = "jonokotha:office-tour-done";
export const OFFICE_TOUR_STEPS = 5;
