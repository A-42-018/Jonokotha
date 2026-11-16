import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENCIES } from "./demo-data";
import { FROM_LEGACY } from "./transitions";
import type { Agency, CaseRecord, IntakeDraft, IssueStatus, Status } from "./types";

const tokens = (s: string) => new Set(s.toLowerCase().split(/[\s,।.]+/).filter((w) => w.length > 2));

export function similarity(a: string, b: string) {
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
  ai_similar: string[]; constituency_key: string; status_detail?: IssueStatus;
};
type EventRow = { case_ref: string; status: Status; created_at: string; note: string | null };

const toRecord = (r: Row, events: EventRow[]): CaseRecord => ({
  ref: r.ref, title: r.title, category: r.category, description: r.description, area: r.area ?? "",
  constituencyId: r.constituency_key, status: r.status, statusDetail: r.status_detail, createdAt: r.created_at,
  timeline: events.filter((e) => e.case_ref === r.ref).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((e) => ({ status: e.status, at: e.created_at, note: e.note ?? undefined })),
  ai: { summary: r.ai_summary ?? "", similarRefs: r.ai_similar, agencyId: r.ai_agency ?? "ag-office", confidence: Number(r.ai_confidence ?? 0.7) },
});

// Public reads use views that omit reporter_id and actor ids (migration 0003).
const COLS = "ref,title,category,description,area,status,created_at,ai_summary,ai_agency,ai_confidence,ai_similar,constituency_key,status_detail";

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

export type TransitionFailure = "not_found" | "forbidden" | "invalid_transition" | "missing_field" | "rule_not_met" | "error";
export type TransitionResult = { ok: true; status: IssueStatus } | { ok: false; code: TransitionFailure; field?: string };

/** The only way to change an issue's status: the database function transition_issue() validates the transition, the actor and the required fields. */
export async function transitionIssue(sb: SupabaseClient, issueId: string, to: IssueStatus, fields: Record<string, unknown> = {}, requestId?: string): Promise<TransitionResult> {
  const { data, error } = await sb.rpc("transition_issue", { p_issue: issueId, p_to: to, p_fields: fields, p_request_id: requestId ?? null });
  if (!error) return { ok: true, status: (data as { status: IssueStatus }).status };
  const map: Record<string, TransitionFailure> = { JK404: "not_found", "42501": "forbidden", JK001: "invalid_transition", JK002: "missing_field", JK003: "rule_not_met" };
  return { ok: false, code: map[error.code] ?? "error", field: error.details || undefined };
}

/**
 * Legacy two-button approval used by the current office UI: "acknowledge" or "refer".
 * "Refer" sends the issue to the agency the routing suggested and the staff member just approved.
 */
export async function advance(sb: SupabaseClient, ref: string, status: Status): Promise<TransitionResult> {
  const { data: issue } = await sb.from("issues").select("id,agency_id").eq("ref", ref).maybeSingle();
  if (!issue) return { ok: false, code: "not_found" };
  let fields: Record<string, unknown> = {};
  if (status === "referred") {
    const { data: a } = issue.agency_id ? await sb.from("agencies").select("id,name_bn,url,source").eq("id", issue.agency_id).maybeSingle() : { data: null };
    if (a) fields = { agency_id: a.id, agency_name: a.name_bn, contact_channel: a.url ?? a.source };
  }
  return transitionIssue(sb, issue.id as string, FROM_LEGACY[status], fields);
}
