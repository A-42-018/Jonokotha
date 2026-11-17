import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, fromDbError } from "./api";
import { parsePoint } from "./geo";
import { indexIssueByRef } from "./ai/duplicates";
import { summarize } from "./intake";
import { afterCursor, decodeCursor, toPage } from "./pagination";
import { redactPii } from "./pii";
import { createCase } from "./store";
import { CATEGORIES, ISSUE_STATUSES, CaseInput, type IssueStatus } from "./types";
import { z } from "zod";

/** Shared by POST /api/cases (legacy) and POST /api/v1/issues. Reports are public, so personal data is removed before storing. */
export async function submitIssue(sb: SupabaseClient, userId: string, input: z.infer<typeof CaseInput> & { lat?: number; lng?: number; locationSource?: string; locationAccuracyM?: number; duration?: string; affectedWho?: string }) {
  const clean = { ...input, duration: input.duration ? redactPii(input.duration).text : undefined, affectedWho: input.affectedWho ? redactPii(input.affectedWho).text : undefined, title: redactPii(input.title).text, description: redactPii(input.description).text, area: redactPii(input.area).text };
  const ref = await createCase(sb, userId, clean, await summarize(clean));
  await indexIssueByRef(ref); // embedding for the Duplicate Agent; best-effort, capped at a few seconds
  return ref;
}

/** The constituency a citizen reports into must exist and be active. (Area lookup by place arrives in Phase 2.) */
export async function assertConstituency(sb: SupabaseClient, key: string) {
  const { data } = await sb.from("constituencies").select("key").eq("key", key).eq("is_active", true).maybeSingle();
  if (!data) throw new ApiError("validation_failed", "Unknown constituency.", { constituency: "unknown" });
}

// Public shape (snake_case). Deliberately has no confidence number: nothing unmeasured is shown (masterplan §17.7).
interface PublicRow {
  ref: string; title: string; category: string; description: string; area: string | null; status: string; status_detail: IssueStatus;
  created_at: string; ai_summary: string | null; ai_similar: string[]; constituency_key: string; is_demo: boolean;
  public_lat: number | null; public_lng: number | null;
}
const PUBLIC_COLS = "ref,title,category,description,area,status,status_detail,created_at,ai_summary,ai_similar,constituency_key,is_demo,public_lat,public_lng";
const toPublic = (r: PublicRow) => ({
  ref: r.ref, service_request_id: r.ref, service_code: `JK-${r.category.toUpperCase().replace(/_/g, "-")}`, title: r.title, category: r.category, description: r.description, area: r.area ?? "", status: r.status_detail, legacy_status: r.status,
  created_at: r.created_at, summary: r.ai_summary || null, similar_refs: r.ai_similar, constituency: r.constituency_key, is_sample: r.is_demo,
  // Approximate on purpose (grid cell centre); the exact point is private to the reporter and the office.
  location: r.public_lat != null && r.public_lng != null ? { lat: r.public_lat, lng: r.public_lng, approximate: true } : null,
});

export const PublicFilters = z.object({
  category: z.enum(CATEGORIES).optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  constituency: z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid").optional(),
  area: z.string().trim().min(2).max(80).optional(),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
  near: z.string().max(40).optional(), radius_km: z.coerce.number().min(0.1).max(50).default(5),
});

/** Public "আমারও একই সমস্যা" counts (numbers only, never who). */
async function affectedCounts(sb: SupabaseClient, refs: string[]) {
  const m = new Map<string, number>();
  if (!refs.length) return m;
  const { data } = await sb.rpc("issue_affected_counts", { p_refs: refs });
  for (const r of (data ?? []) as { ref: string; affected_count: number }[]) m.set(r.ref, r.affected_count);
  return m;
}

export async function listPublic(sb: SupabaseClient, f: z.infer<typeof PublicFilters>, limit: number, cursor?: string) {
  let q = sb.from("public_cases").select(PUBLIC_COLS).order("created_at", { ascending: false }).order("ref", { ascending: false }).limit(limit + 1);
  if (f.category) q = q.eq("category", f.category);
  if (f.status) q = q.eq("status_detail", f.status);
  if (f.constituency) q = q.eq("constituency_key", f.constituency);
  if (f.area) q = q.ilike("area", `%${f.area.replace(/[%_,()]/g, " ")}%`);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00Z`);
  if (f.to) q = q.lt("created_at", new Date(Date.parse(`${f.to}T00:00:00Z`) + 86_400_000).toISOString());
  if (f.near) {
    const p = parsePoint(f.near);
    const { data: refs } = await sb.rpc("public_issue_refs_near", { p_lat: p.lat, p_lng: p.lng, p_km: f.radius_km });
    q = q.in("ref", ((refs ?? []) as { ref: string }[]).map((r) => r.ref).concat("-none-"));
  }
  if (cursor) q = q.or(afterCursor(decodeCursor(cursor)));
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  const { items, page } = toPage((data ?? []) as unknown as PublicRow[], limit);
  const counts = await affectedCounts(sb, items.map((r) => r.ref));
  return { data: items.map((r) => ({ ...toPublic(r), affected_count: counts.get(r.ref) ?? 0 })), page };
}

export async function getPublic(sb: SupabaseClient, ref: string) {
  const { data: row } = await sb.from("public_cases").select(PUBLIC_COLS).eq("ref", ref).maybeSingle();
  if (!row) throw new ApiError("not_found", "Issue not found.");
  const { data: ev } = await sb.from("public_case_events").select("status_detail,note,created_at").eq("case_ref", ref).order("created_at", { ascending: true });
  const counts = await affectedCounts(sb, [ref]);
  return { ...toPublic(row as unknown as PublicRow), affected_count: counts.get(ref) ?? 0, timeline: (ev ?? []).map((e) => ({ status: e.status_detail, at: e.created_at, message: e.note ?? null })) };
}

// Office reads use the base table: RLS limits rows to the caller's scope (and, for case officers, to assigned issues).
export const OfficeFilters = z.object({
  status: z.enum(ISSUE_STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  assigned: z.enum(["me", "none"]).optional(),
});
const OFFICE_COLS = "duration_text,affected_who,id,ref,title,category,description,area,status,priority,assigned_to,created_at,updated_at,constituency_key,is_demo";

export async function listOffice(sb: SupabaseClient, userId: string, f: z.infer<typeof OfficeFilters>, limit: number, cursor?: string) {
  let q = sb.from("issues").select(OFFICE_COLS).order("created_at", { ascending: false }).order("ref", { ascending: false }).limit(limit + 1);
  if (f.status) q = q.eq("status", f.status);
  if (f.category) q = q.eq("category", f.category);
  if (f.assigned === "me") q = q.eq("assigned_to", userId);
  if (f.assigned === "none") q = q.is("assigned_to", null);
  if (cursor) q = q.or(afterCursor(decodeCursor(cursor)));
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  const { items, page } = toPage((data ?? []) as unknown as (Record<string, unknown> & { created_at: string; ref: string })[], limit);
  return { data: items.map(({ id, ...r }) => ({ id, ...r, is_sample: r.is_demo, is_demo: undefined })), page };
}

export async function getOffice(sb: SupabaseClient, ref: string) {
  const { data: issue } = await sb.from("issues")
    .select(`${OFFICE_COLS},ai_summary,ai_similar,resolution_note,status_reason,appeal_route,master_issue_id,resolved_at,closed_at`).eq("ref", ref).maybeSingle();
  if (!issue) throw new ApiError("not_found", "Issue not found.");
  const id = (issue as unknown as { id: string }).id;
  const [events, assignments, referrals, feedback] = await Promise.all([
    sb.from("issue_events").select("event_type,from_status,to_status,public_message,internal_note,metadata,is_public,created_at").eq("issue_id", id).order("created_at", { ascending: true }),
    sb.from("issue_assignments").select("assigned_to,assigned_by,reason,assigned_at,unassigned_at").eq("issue_id", id).order("assigned_at", { ascending: true }),
    sb.from("issue_agency_referrals").select("id,agency_id,agency_name,agency_contact_or_channel,external_reference,forwarded_at,acknowledged_at,notes,visibility,registration_status,registration_reference,task_status,closed_at,closure_evidence,registered_at").eq("issue_id", id).order("forwarded_at", { ascending: true }),
    sb.from("issue_feedback").select("rating,comment,created_at").eq("issue_id", id),
  ]);
  return { ...issue, events: events.data ?? [], assignments: assignments.data ?? [], referrals: referrals.data ?? [], feedback: feedback.data ?? [] };
}
