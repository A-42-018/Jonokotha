import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENCIES } from "./demo-data";
import type { Agency, CaseRecord, IntakeDraft, Status } from "./types";

const tokens = (s: string) => new Set(s.toLowerCase().split(/[\s,।.]+/).filter((w) => w.length > 2));

function similarity(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n / Math.max(1, Math.min(A.size, B.size));
}

/** Agencies come from the database; the in-code list is only a fallback if the table is empty or unreachable. */
export async function getAgencies(sb: SupabaseClient): Promise<Agency[]> {
  const { data } = await sb.from("agencies").select("key,name_bn,name_en,categories,source,url,checked_at");
  if (!data?.length) return AGENCIES;
  return data.map((a) => ({ id: a.key, nameBn: a.name_bn, nameEn: a.name_en, categories: a.categories, source: a.source, url: a.url ?? undefined, checkedAt: a.checked_at ?? undefined }));
}

export function pickAgency(agencies: Agency[], category: string) {
  return agencies.find((a) => a.categories[0] === category) ?? agencies.find((a) => a.categories.includes(category as never)) ?? agencies.find((a) => a.categories.includes("other")) ?? agencies[agencies.length - 1];
}

type Row = {
  ref: string; title: string; category: IntakeDraft["category"]; description: string; area: string | null;
  status: Status; created_at: string; ai_summary: string | null; ai_agency: string | null; ai_confidence: number | null;
  ai_similar: string[]; constituency_key: string;
};
type EventRow = { case_ref: string; status: Status; created_at: string; note: string | null };

const toRecord = (r: Row, events: EventRow[]): CaseRecord => ({
  ref: r.ref, title: r.title, category: r.category, description: r.description, area: r.area ?? "",
  constituencyId: r.constituency_key, status: r.status, createdAt: r.created_at,
  timeline: events.filter((e) => e.case_ref === r.ref).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((e) => ({ status: e.status, at: e.created_at, note: e.note ?? undefined })),
  ai: { summary: r.ai_summary ?? "", similarRefs: r.ai_similar, agencyId: r.ai_agency ?? "ag-office", confidence: Number(r.ai_confidence ?? 0.7) },
});

// Public reads use views that omit reporter_id and actor ids (migration 0003).
const COLS = "ref,title,category,description,area,status,created_at,ai_summary,ai_agency,ai_confidence,ai_similar,constituency_key";

async function eventsFor(sb: SupabaseClient, refs: string[]) {
  if (!refs.length) return [] as EventRow[];
  const { data } = await sb.from("public_case_events").select("case_ref,status,created_at,note").in("case_ref", refs);
  return (data ?? []) as EventRow[];
}

export async function createCase(sb: SupabaseClient, userId: string, input: IntakeDraft & { constituencyId: string }, summary: string) {
  const { data: peers } = await sb.from("public_cases").select("ref,title,description").eq("category", input.category).order("created_at", { ascending: false }).limit(50);
  const text = `${input.title} ${input.description}`;
  const similar = (peers ?? []).filter((c) => similarity(text, `${c.title} ${c.description}`) > 0.35).slice(0, 3).map((c) => c.ref);
  const { data, error } = await sb.from("issues").insert({
    reporter_id: userId, title: input.title, category: input.category, description: input.description, area: input.area,
    constituency_key: input.constituencyId, ai_summary: summary, ai_agency: pickAgency(await getAgencies(sb), input.category).id,
    ai_confidence: similar.length ? 0.85 : 0.7, ai_similar: similar,
  }).select("ref").single();
  if (error) throw error;
  return data.ref as string;
}

export async function listCases(sb: SupabaseClient) {
  const { data } = await sb.from("public_cases").select(COLS).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as Row[];
  const events = await eventsFor(sb, rows.map((r) => r.ref));
  return rows.map((r) => toRecord(r, events));
}

export async function getCase(sb: SupabaseClient, ref: string) {
  const { data } = await sb.from("public_cases").select(COLS).eq("ref", ref).maybeSingle();
  return data ? toRecord(data as unknown as Row, await eventsFor(sb, [ref])) : undefined;
}

/** Legacy 4-state UI status -> 13-state model (masterplan §9). Mirrors legacy_to_issue_status() in migration 0005. */
export const LEGACY_TO_ISSUE_STATUS: Record<Status, string> = {
  received: "submitted", acknowledged: "acknowledged", referred: "referred_to_authority", resolved: "resolved",
};

/** Returns false if the row was not updated (not staff, or no such case). RLS enforces staff-only. */
export async function advance(sb: SupabaseClient, ref: string, status: Status) {
  const { data } = await sb.from("issues").update({ status: LEGACY_TO_ISSUE_STATUS[status] }).eq("ref", ref).select("ref");
  return (data?.length ?? 0) > 0;
}
