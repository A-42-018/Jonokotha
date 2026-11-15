import { AGENCIES } from "./demo-data";
import type { CaseRecord, IntakeDraft, Status } from "./types";

// Sprint 0: in-memory store. Swap for Supabase (see supabase/migrations) in Sprint 1.
const g = globalThis as unknown as { __cases?: CaseRecord[] };
const cases = (g.__cases ??= []);

const tokens = (s: string) => new Set(s.toLowerCase().split(/[\s,।.]+/).filter((w) => w.length > 2));

function similarity(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n / Math.max(1, Math.min(A.size, B.size));
}

export function createCase(input: IntakeDraft & { constituencyId: string }, summary?: string): CaseRecord {
  const now = new Date().toISOString();
  const ref = `JK-${new Date().getFullYear()}-${String(cases.length + 1001)}`;
  const text = `${input.title} ${input.description}`;
  const similarRefs = cases
    .filter((c) => c.category === input.category && similarity(text, `${c.title} ${c.description}`) > 0.35)
    .slice(0, 3).map((c) => c.ref);
  const agency = AGENCIES.find((a) => a.categories[0] === input.category) ?? AGENCIES.find((a) => a.categories.includes(input.category)) ?? AGENCIES[AGENCIES.length - 1];
  const rec: CaseRecord = {
    ...input, ref, status: "received", createdAt: now,
    timeline: [{ status: "received", at: now }],
    ai: { summary: summary ?? "", similarRefs, agencyId: agency.id, confidence: similarRefs.length ? 0.85 : 0.7 },
  };
  cases.unshift(rec);
  return rec;
}

export const listCases = () => cases;
export const getCase = (ref: string) => cases.find((c) => c.ref === ref);

export function advance(ref: string, status: Status, note?: string) {
  const c = getCase(ref);
  if (!c) return undefined;
  c.status = status;
  c.timeline.push({ status, at: new Date().toISOString(), note });
  return c;
}
