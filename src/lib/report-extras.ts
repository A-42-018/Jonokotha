import type { Dict } from "./i18n";

/**
 * Two extra report fields (masterplan 7.4): how long it has been going on, and who is affected.
 * The API (B5.6) has no fields for them yet and rejects unknown keys, so they are added to the end of the description
 * as one labelled line. That is real: the office reads it. When B5.6 ships, send them as fields and drop `withExtras`.
 */
export const DURATIONS = ["today", "days", "weeks", "months", "long"] as const;
export const AFFECTED = ["me", "family", "neighbours", "many", "children", "vulnerable", "unsure"] as const;
export type Duration = (typeof DURATIONS)[number];
export type Affected = (typeof AFFECTED)[number];

export const isDuration = (v: unknown): v is Duration => typeof v === "string" && (DURATIONS as readonly string[]).includes(v);
export const isAffected = (v: unknown): v is Affected => typeof v === "string" && (AFFECTED as readonly string[]).includes(v);

/** The report limit is 2000; the footer needs room, so the person's own text may use this much. */
export const REPORT_DESC_MAX = 1900;

export function durationLabel(t: Dict, v: Duration): string { return t[`rxD_${v}`]; }
export function affectedLabel(t: Dict, v: Affected): string { return t[`rxW_${v}`]; }

/** Description plus the chosen extras as one line at the end. Nothing is added when neither was chosen. */
export function withExtras(description: string, extras: { duration?: string; who?: string }, t: Dict): string {
  const parts: string[] = [];
  if (isDuration(extras.duration)) parts.push(`${t.rxFooterDuration} ${durationLabel(t, extras.duration)}`);
  if (isAffected(extras.who)) parts.push(`${t.rxFooterWho} ${affectedLabel(t, extras.who)}`);
  return parts.length ? `${description}\n\n[${parts.join(". ")}.]` : description;
}
