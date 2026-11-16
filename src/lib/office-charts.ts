import type { CaseRecord } from "./types";

export interface Count { key: string; value: number }

function tally(keys: string[]): Count[] {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
}

/** Categories by count, descending; beyond the six largest the rest fold into one "other" row so the donut stays readable. */
export function categoryCounts(cases: CaseRecord[]): Count[] {
  const all = tally(cases.map((c) => c.category));
  if (all.length <= 7) return all;
  const top = all.slice(0, 6);
  const rest = all.slice(6).reduce((a, c) => a + c.value, 0);
  const other = top.find((c) => c.key === "other");
  if (other) { other.value += rest; return top; }
  return [...top, { key: "other", value: rest }];
}

/** Status counts in workflow order (only statuses that occur). */
export const STATUS_ORDER_FOR_CHART = ["received", "acknowledged", "referred", "resolved"] as const;
export function statusCounts(cases: CaseRecord[]): Count[] {
  const t = tally(cases.map((c) => c.status));
  const rank = (k: string) => { const i = (STATUS_ORDER_FOR_CHART as readonly string[]).indexOf(k); return i < 0 ? 99 : i; };
  return t.sort((a, b) => rank(a.key) - rank(b.key));
}

/** Most reported area names (trimmed; blanks skipped), top `n`. */
export function areaCounts(cases: CaseRecord[], n: number): Count[] {
  return tally(cases.map((c) => c.area.trim()).filter(Boolean)).slice(0, n);
}
