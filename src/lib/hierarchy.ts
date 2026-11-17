import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { Lat, Lng } from "./geo";
import { checkRef } from "./ideas-questions";

// Phase 5 / B5.7: administrative hierarchy, uncertain-boundary lookup and reviewed location changes.
const KEY = z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid");
const LEVEL = z.enum(["division", "district", "upazila", "city", "union", "ward"]);

export async function listAdminUnits(c: Ctx): Promise<Result> {
  const q = parse(z.object({ level: LEVEL.optional(), parent: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/).optional(), country: z.string().regex(/^[A-Z]{2}$/).default("BD"), limit: z.coerce.number().int().min(1).max(200).default(100) }), Object.fromEntries(c.url.searchParams));
  let s = c.sb.from("admin_units").select("code,level,name_bn,name_en,verified_at,parent:parent_id(code,level)").eq("country_code", q.country).eq("is_active", true).order("code").limit(q.limit);
  if (q.level) s = s.eq("level", q.level);
  if (q.parent) {
    const { data: p } = await c.sb.from("admin_units").select("id").eq("country_code", q.country).eq("code", q.parent).limit(1);
    if (!p?.length) return { data: [], page: { next_cursor: null, limit: q.limit } };
    s = s.eq("parent_id", p[0].id);
  }
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ parent, ...r }) => ({ ...r, parent: parent ?? null })), page: { next_cursor: null, limit: q.limit } };
}

const Unit = z.strictObject({ level: LEVEL, code: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/), name_bn: z.string().trim().min(1).max(120), name_en: z.string().trim().min(1).max(120), parent_code: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/).optional() });
export async function importAdminUnits(c: Ctx): Promise<Result> {
  if (c.actor?.role !== "admin") throw new ApiError("forbidden", "Administrators only.");
  const b = parse(z.strictObject({ source: z.strictObject({ name: z.string().trim().min(3).max(200), url: z.url({ protocol: /^https?$/ }).max(500), license: z.string().trim().min(2).max(200), fetched_at: z.iso.date(), country: z.string().regex(/^[A-Z]{2}$/).default("BD") }), units: z.array(Unit).min(1).max(500) }), c.body);
  return { status: 201, data: await rpc(c.sb, "import_admin_units", { p_source: b.source, p_items: b.units }) };
}
export async function linkUnits(c: Ctx): Promise<Result> {
  if (c.actor?.role !== "admin") throw new ApiError("forbidden", "Administrators only.");
  const b = parse(z.strictObject({ unit_codes: z.array(z.string().regex(/^[A-Za-z0-9._-]{1,40}$/)).min(1).max(50), country: z.string().regex(/^[A-Z]{2}$/).default("BD") }), c.body);
  const key = KEY.safeParse(c.params.key);
  if (!key.success) throw new ApiError("not_found", "Area not found.");
  return { data: await rpc(c.sb, "link_constituency_units", { p_key: key.data, p_unit_codes: b.unit_codes, p_country: b.country }) };
}

/** All areas that could contain the point. `certain` only for an exact match on a verified boundary; `uncertain` tells the UI to ask the person to choose. */
export async function lookupCandidates(c: Ctx): Promise<Result> {
  const q = parse(z.object({ lat: z.coerce.number().pipe(Lat), lng: z.coerce.number().pipe(Lng) }), { lat: c.url.searchParams.get("lat"), lng: c.url.searchParams.get("lng") });
  const rows = await rpc<{ key: string; name_bn: string; name_en: string; district: string | null; is_demo: boolean; method: string; certain: boolean }[]>(c.sb, "constituency_candidates", { p_lat: q.lat, p_lng: q.lng });
  return { data: { candidates: rows.map(({ is_demo, ...r }) => ({ ...r, is_sample: is_demo })), uncertain: rows.length !== 1 || !rows[0].certain, manual_choice_allowed: true } };
}

export async function requestLocationChange(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ lat: Lat, lng: Lng }), c.body);
  const out = await rpc<{ applied: boolean }>(c.sb, "request_location_change", { p_ref: checkRef(c.params.ref), p_lat: b.lat, p_lng: b.lng });
  return { status: out.applied ? 200 : 202, data: out };
}
export async function listLocationChanges(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("location_change_requests").select("id,status,candidate_keys,created_at,decided_at,issues(ref,constituency_key)").order("created_at", { ascending: false }).limit(50);
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ issues, ...r }) => ({ ...r, issue_ref: (issues as unknown as { ref: string } | null)?.ref, current_constituency: (issues as unknown as { constituency_key: string } | null)?.constituency_key })) };
}
export async function decideLocationChange(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ decision: z.enum(["approve", "reject"]), target: KEY.optional(), note: z.string().trim().max(300).optional() }), c.body);
  if (!z.uuid().safeParse(c.params.id).success) throw new ApiError("not_found", "Not found.");
  return { data: await rpc(c.sb, "decide_location_change", { p_id: c.params.id, p_decision: b.decision, p_target: b.target ?? null, p_note: b.note ?? null }) };
}
