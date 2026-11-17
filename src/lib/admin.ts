import type { CaseRecord, Category } from "./types";

export const REASON_MIN = 10;
export const validReason = (r: string) => r.trim().length >= REASON_MIN;

export function countBy<T>(list: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of list) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return out;
}

/** Areas ranked by number of reports (real cases). A count, not a score; small counts are flagged so nobody over-reads them. */
export function hotspots(cases: CaseRecord[], minForSignal = 5): { area: string; count: number; weak: boolean }[] {
  const counts = countBy(cases.filter((c) => c.area.trim()), (c) => c.area.trim());
  return Object.entries(counts).map(([area, count]) => ({ area, count, weak: count < minForSignal })).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}

export function analytics(cases: CaseRecord[]) {
  return {
    total: cases.length,
    byStatus: countBy(cases, (c) => c.status),
    byCategory: countBy(cases, (c) => c.category) as Partial<Record<Category, number>>,
    hotspots: hotspots(cases),
  };
}
