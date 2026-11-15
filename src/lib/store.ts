import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENCIES } from "./demo-data";
import type { CaseRecord, IntakeDraft, Status } from "./types";

const tokens = (s: string) => new Set(s.toLowerCase().split(/[\s,।.]+/).filter((w) => w.length > 2));

function similarity(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n / Math.max(1, Math.min(A.size, B.size));
}

export function pickAgency(category: string) {
  return AGENCIES.find((a) => a.categories[0] === category) ?? AGENCIES.find((a) => a.categories.includes(category as never)) ?? AGENCIES[AGENCIES.length - 1];
}

type Row = {
  ref: string; title: string; category: IntakeDraft["category"]; description: string; area: string | null;
  status: Status; created_at: string; ai_summary: string | null; ai_agency: string | null; ai_confidence: number | null;
  ai_similar: string[]; constituency_key: string; case_events?: { status: Status; created_at: string; note: string | null }[];
};

const toRecord = (r: Row): CaseRecord => ({
  ref: r.ref, title: r.title, category: r.category, description: r.description, area: r.area ?? "",
  constituencyId: r.constituency_key, status: r.status, createdAt: r.created_at,
  timeline: (r.case_events ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((e) => ({ status: e.status, at: e.created_at, note: e.note ?? undefined })),
  ai: { summary: r.ai_summary ?? "", similarRefs: r.ai_similar, agencyId: r.ai_agency ?? "ag-office", confidence: Number(r.ai_confidence ?? 0.7) },
});

const COLS = "ref,title,category,description,area,status,created_at,ai_summary,ai_agency,ai_confidence,ai_similar,constituency_key,case_events(status,created_at,note)";

export async function createCase(sb: SupabaseClient, userId: string, input: IntakeDraft & { constituencyId: string }, summary: string) {
  const { data: peers } = await sb.from("cases").select("ref,title,description").eq("category", input.category).order("created_at", { ascending: false }).limit(50);
  const text = `${input.title} ${input.description}`;
  const similar = (peers ?? []).filter((c) => similarity(text, `${c.title} ${c.description}`) > 0.35).slice(0, 3).map((c) => c.ref);
  const { data, error } = await sb.from("cases").insert({
    reporter_id: userId, title: input.title, category: input.category, description: input.description, area: input.area,
    constituency_key: input.constituencyId, ai_summary: summary, ai_agency: pickAgency(input.category).id,
    ai_confidence: similar.length ? 0.85 : 0.7, ai_similar: similar,
  }).select("ref").single();
  if (error) throw error;
  return data.ref as string;
}

export async function listCases(sb: SupabaseClient) {
  const { data } = await sb.from("cases").select(COLS).order("created_at", { ascending: false }).limit(100);
  return ((data ?? []) as unknown as Row[]).map(toRecord);
}

export async function getCase(sb: SupabaseClient, ref: string) {
  const { data } = await sb.from("cases").select(COLS).eq("ref", ref).maybeSingle();
  return data ? toRecord(data as unknown as Row) : undefined;
}

/** Returns false if the row was not updated (not staff, or no such case). RLS enforces staff-only. */
export async function advance(sb: SupabaseClient, ref: string, status: Status) {
  const { data } = await sb.from("cases").update({ status }).eq("ref", ref).select("ref");
  return (data?.length ?? 0) > 0;
}
