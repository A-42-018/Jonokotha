import { z } from "zod";
import { ApiError, auditAdminRead, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { ingestKnowledge, KnowledgeRule } from "./ai/knowledge";
import { boundaryBBox } from "./geo";
import { sendEmail, emailConfigured } from "./notify/deliver";
import { redactPii } from "./pii";
import { PageQuery } from "./pagination";
import { decodeFeedCursor, encodeFeedCursor } from "./feed-cursor";
import { serviceClient } from "./supabase/service";

const KEY = z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid");
const UUID = z.uuid();
const requireAdmin = (c: Ctx) => { if (c.actor?.role !== "admin") throw new ApiError("forbidden", "Administrators only."); };
const idParam = (c: Ctx) => { const r = UUID.safeParse(c.params.id); if (!r.success) throw new ApiError("not_found", "Not found."); return r.data; };

// Invitations -----------------------------------------------------------------------------------------------------------------
const Invite = z.strictObject({ email: z.email().max(200), constituency: KEY, role: z.enum(["case_officer", "office_manager", "mp", "agency_liaison"]), representative_id: UUID.optional() });
export async function createInvitation(c: Ctx): Promise<Result> {
  const b = parse(Invite, c.body);
  const out = await rpc<{ id: string; token: string; expires_at: string }>(c.sb, "create_office_invitation", { p_email: b.email, p_constituency: b.constituency, p_role: b.role, p_representative: b.representative_id ?? null });
  let emailed = false;
  if (emailConfigured() && process.env.NEXT_PUBLIC_APP_URL) {
    emailed = (await sendEmail(b.email, "জনকথা: অফিসে যোগ দেওয়ার আমন্ত্রণ", `আপনাকে জনকথায় অফিসের সদস্য হতে আমন্ত্রণ জানানো হয়েছে।\n${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${out.token}\nএই লিংকটি একবার ব্যবহার করা যাবে এবং ৭ দিন পর্যন্ত চলবে। এই ইমেইল ঠিকানা দিয়ে সাইন ইন করে গ্রহণ করুন।`)).ok;
  }
  return { status: 201, data: { id: out.id, expires_at: out.expires_at, invite_token: out.token, emailed, note: "The token is shown once; share it only with the invited person." } };
}
export async function listInvitations(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("office_invitations").select("id,email,office_role,status,expires_at,created_at,accepted_at,constituencies(key)").order("created_at", { ascending: false }).limit(100);
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ constituencies, ...r }) => ({ ...r, constituency: (constituencies as unknown as { key: string } | null)?.key })) };
}
export async function revokeInvitation(c: Ctx): Promise<Result> { await rpc(c.sb, "revoke_office_invitation", { p_id: idParam(c) }); return { data: { revoked: true } }; }
export async function acceptInvitation(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ token: z.string().regex(/^[0-9a-f]{48}$/, "invalid") }), c.body);
  return { data: await rpc(c.sb, "accept_office_invitation", { p_token: b.token }) };
}

// Verification ---------------------------------------------------------------------------------------------------------------------
export async function verifyRepresentative(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ status: z.enum(["pending", "verified", "revoked"]), source_url: z.url({ protocol: /^https?$/ }).max(500).optional(), note: z.string().trim().max(300).optional() }), c.body);
  return { data: await rpc(c.sb, "verify_representative", { p_rep: idParam(c), p_status: b.status, p_source_url: b.source_url ?? null, p_note: b.note ?? null }) };
}
export async function setRepresentativeField(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ field: z.enum(["bio", "office_address", "office_phone", "office_email", "website", "education", "committees", "term_note"]), value: z.string().trim().min(1).max(2000),
    source_url: z.url({ protocol: /^https?$/ }).max(500), checked_at: z.iso.date() }), c.body);
  await rpc(c.sb, "set_representative_field", { p_rep: idParam(c), p_field: b.field, p_value: b.value, p_source: b.source_url, p_checked: b.checked_at });
  return { data: { saved: true } };
}
export async function setAccount(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ role: z.enum(["citizen", "staff", "moderator", "admin"]), status: z.enum(["active", "suspended"]).default("active"), reason: z.string().trim().min(5).max(300) }), c.body);
  return { data: await rpc(c.sb, "admin_set_account", { p_user: idParam(c), p_role: b.role, p_status: b.status, p_reason: b.reason }) };
}

// Moderation -----------------------------------------------------------------------------------------------------------------------
const Target = { type: z.enum(["issue", "idea", "question", "media"]), ref: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9-]+$/, "invalid") };
export async function reportContent(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ ...Target, reason: z.enum(["abuse", "personal_data", "spam", "false_information", "unsafe", "other"]), details: z.string().trim().max(500).optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "report_content", { p_type: b.type, p_ref: b.ref, p_reason: b.reason, p_details: b.details ? redactPii(b.details).text : null }) };
}
export async function moderationQueue(c: Ctx): Promise<Result> {
  const { limit } = parse(PageQuery, Object.fromEntries(c.url.searchParams));
  return { data: await rpc(c.sb, "moderation_queue", { p_limit: limit }), page: { next_cursor: null, limit } };
}
export async function moderateItem(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ ...Target, action: z.enum(["hide", "restore", "dismiss"]), reason: z.string().trim().min(5, "a reason is required").max(500) }), c.body);
  return { data: await rpc(c.sb, "moderate_item", { p_type: b.type, p_ref: b.ref, p_action: b.action, p_reason: b.reason }) };
}
export async function reviewPending(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ type: z.enum(["idea", "question"]), ref: Target.ref, action: z.enum(["publish", "reject"]), reason: z.string().trim().max(500).optional() }), c.body);
  if (b.action === "reject" && (b.reason ?? "").length < 5) throw new ApiError("validation_failed", "A reason is required to reject.", { reason: "required" });
  return { data: await rpc(c.sb, "review_pending", { p_type: b.type, p_ref: b.ref, p_action: b.action, p_reason: b.reason ?? null }) };
}

// AI runs, evaluations, audit, imports, knowledge ------------------------------------------------------------------------------------
const AGENTS = ["intake", "duplicate", "routing", "copilot", "translation", "insight", "idea", "transcription"] as const;
export async function listAiRuns(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const q = Object.fromEntries(c.url.searchParams);
  const { limit, cursor } = parse(PageQuery, q);
  const f = parse(z.object({ agent: z.enum(AGENTS).optional(), status: z.enum(["ok", "timeout", "refused", "invalid_output", "error", "fallback"]).optional(), include_output: z.enum(["true", "false"]).default("false") }), q);
  let sel = c.sb.from("ai_runs").select(`id,agent,model,prompt_id,prompt_version,status,decision,latency_ms,token_usage,cost_usd,error_class,request_id,created_at${f.include_output === "true" ? ",output" : ""}`)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (f.agent) sel = sel.eq("agent", f.agent); if (f.status) sel = sel.eq("status", f.status);
  if (cursor) { const k = decodeFeedCursor(cursor); sel = sel.or(`created_at.lt.${k.ts},and(created_at.eq.${k.ts},id.lt.${k.ref})`); }
  await auditAdminRead(c, "ai_runs", null, { agent: f.agent ?? null, include_output: f.include_output });
  const { data, error } = await sel;
  if (error) throw fromDbError(error);
  const rows = (data ?? []) as unknown as { id: string; created_at: string }[];
  const items = rows.slice(0, limit), last = items[items.length - 1];
  return { data: items, page: { next_cursor: rows.length > limit && last ? encodeFeedCursor(0, last.created_at, last.id) : null, limit } };
}

export async function listAiEvals(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const { data, error } = await c.sb.from("ai_eval_runs").select("id,dataset_name,dataset_size,model,prompt_versions,metrics,notes,created_at").order("created_at", { ascending: false }).limit(50);
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
export async function recordAiEval(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const b = parse(z.strictObject({ dataset_name: z.string().trim().min(2).max(80), dataset_size: z.number().int().min(1).max(1_000_000), model: z.string().max(80).optional(),
    prompt_versions: z.record(z.string().max(40), z.string().max(40)).default({}), metrics: z.record(z.string().max(60), z.union([z.number(), z.string().max(200), z.null()])), notes: z.string().trim().max(1000).optional() }), c.body);
  return { status: 201, data: { id: await rpc(c.sb, "record_ai_eval", { p_dataset: b.dataset_name, p_size: b.dataset_size, p_model: b.model ?? null, p_prompts: b.prompt_versions, p_metrics: b.metrics, p_notes: b.notes ?? null }) } };
}

export async function listAudit(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const q = Object.fromEntries(c.url.searchParams);
  const { limit, cursor } = parse(PageQuery, q);
  const f = parse(z.object({ resource_type: z.string().regex(/^[a-z_.]{1,40}$/).optional(), action: z.string().regex(/^[a-z_.]{1,60}$/).optional(), actor: UUID.optional(), resource_id: z.string().max(80).regex(/^[A-Za-z0-9._:-]+$/).optional(), from: z.iso.date().optional(), to: z.iso.date().optional() }), q);
  let sel = c.sb.from("audit_logs").select("id,actor_id,actor_role,actor_kind,action,resource_type,resource_id,before_data,after_data,request_id,metadata,created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (f.resource_type) sel = sel.eq("resource_type", f.resource_type); if (f.action) sel = sel.eq("action", f.action); if (f.actor) sel = sel.eq("actor_id", f.actor);
  if (f.resource_id) sel = sel.eq("resource_id", f.resource_id); if (f.from) sel = sel.gte("created_at", `${f.from}T00:00:00Z`);
  if (f.to) sel = sel.lt("created_at", new Date(Date.parse(`${f.to}T00:00:00Z`) + 86_400_000).toISOString());
  if (cursor) { const k = decodeFeedCursor(cursor); sel = sel.or(`created_at.lt.${k.ts},and(created_at.eq.${k.ts},id.lt.${k.ref})`); }
  await auditAdminRead(c, "audit_logs", null, { filters: Object.keys(f) });   // reading the audit trail is itself recorded
  const { data, error } = await sel;
  if (error) throw fromDbError(error);
  const rows = (data ?? []) as unknown as { id: string; created_at: string }[];
  const items = rows.slice(0, limit), last = items[items.length - 1];
  return { data: items, page: { next_cursor: rows.length > limit && last ? encodeFeedCursor(0, last.created_at, last.id) : null, limit } };
}

const Feature = z.object({ type: z.literal("Feature"), geometry: z.object({ type: z.enum(["Polygon", "MultiPolygon"]), coordinates: z.unknown() }), properties: z.object({
  key: KEY, name_bn: z.string().min(1).max(120), name_en: z.string().min(1).max(120), district: z.string().max(80).optional(), upazila_or_city: z.string().max(80).optional() }) });
export async function importConstituencies(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const b = parse(z.strictObject({ source: z.strictObject({ name: z.string().trim().min(3).max(200), url: z.url({ protocol: /^https?$/ }).max(500), license: z.string().trim().min(2).max(200), fetched_at: z.iso.date() }),
    geojson: z.object({ type: z.literal("FeatureCollection"), features: z.array(Feature).min(1).max(100) }) }), c.body);
  const items = b.geojson.features.map((f) => ({ ...f.properties, boundary: f.geometry, ...boundaryBBox(f.geometry) }));
  return { status: 201, data: await rpc(c.sb, "import_constituencies", { p_source: b.source, p_items: items }) };
}

export async function ingestKnowledgeAdmin(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const b = parse(z.strictObject({ rules: z.array(KnowledgeRule).max(50).default([]) }), c.body);
  const svc = serviceClient();
  if (!svc) throw new ApiError("unavailable", "The service role is not configured on this server.");
  await auditAdminRead(c, "knowledge_ingest", null, { rules: b.rules.length });
  return { data: await ingestKnowledge(svc, b.rules) };
}
