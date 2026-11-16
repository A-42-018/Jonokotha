import { z } from "zod";
import { ApiError, auditAdminRead, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { clearFlagCache } from "./capabilities";
import { serviceClient } from "./supabase/service";

// Phase 5 / B5.3: administration APIs. Authorization is in the database (is_admin(), which includes MFA); these handlers validate
// input and shape output. Secrets are never returned: integrations report only whether a key is present.
const KEY = z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid");
const SLUG = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, "lowercase letters, digits and _");
const UUID = z.uuid();
const requireAdmin = (c: Ctx) => { if (c.actor?.role !== "admin") throw new ApiError("forbidden", "Administrators only."); };
const uid = (c: Ctx) => { const r = UUID.safeParse(c.params.id); if (!r.success) throw new ApiError("not_found", "Not found."); return r.data; };

// Feature flags -----------------------------------------------------------------------------------------------------------------
export async function publicFlags(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.rpc("public_feature_flags");
  if (error) throw fromDbError(error);
  return { data: data ?? [], headers: { "Cache-Control": "public, max-age=15" } };
}
export async function listFlags(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const { data, error } = await c.sb.from("feature_flags").select("key,enabled,data_status,description,updated_at").order("key");
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
const Status = z.enum(["live", "sample", "demo", "planned"]);
export async function saveFlag(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ key: SLUG, enabled: z.boolean(), data_status: Status.optional(), description: z.string().trim().max(300).optional(), create: z.boolean().default(false) }), c.body);
  const out = b.create
    ? await rpc(c.sb, "create_feature_flag", { p_key: b.key, p_enabled: b.enabled, p_status: b.data_status ?? "planned", p_description: b.description ?? null })
    : await rpc(c.sb, "set_feature_flag", { p_key: b.key, p_enabled: b.enabled, p_status: b.data_status ?? null, p_description: b.description ?? null });
  clearFlagCache();
  return { status: b.create ? 201 : 200, data: out };
}

// Categories ---------------------------------------------------------------------------------------------------------------------
export async function listCategories(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("issue_categories").select("slug,name_bn,name_en,default_priority,is_active,service_code,parent:parent_id(slug)").order("slug");
  if (error) throw fromDbError(error);
  const all = (data ?? []).map(({ parent, ...r }) => ({ ...r, parent: (parent as unknown as { slug: string } | null)?.slug ?? null }));
  return { data: c.actor?.role === "admin" ? all : all.filter((r) => r.is_active) };
}
export async function saveCategory(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ slug: SLUG, name_bn: z.string().trim().min(1).max(80), name_en: z.string().trim().min(1).max(80), parent: SLUG.optional(),
    default_priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"), is_active: z.boolean().default(true) }), c.body);
  const out = await rpc<{ created: boolean }>(c.sb, "admin_upsert_category", { p_slug: b.slug, p_name_bn: b.name_bn, p_name_en: b.name_en, p_parent: b.parent ?? null, p_priority: b.default_priority, p_active: b.is_active });
  return { status: out.created ? 201 : 200, data: out };
}

// SLA targets --------------------------------------------------------------------------------------------------------------------
export async function listSla(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("sla_policies").select("id,ack_target_hours,update_target_hours,note,is_active,constituencies(key),issue_categories(slug)").eq("is_active", true);
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ constituencies, issue_categories, ...r }) => ({ ...r, constituency: (constituencies as unknown as { key: string } | null)?.key ?? null, category: (issue_categories as unknown as { slug: string } | null)?.slug ?? null })) };
}
export async function saveSla(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY.optional(), category: SLUG.optional(), ack_target_hours: z.number().int().min(1).max(720), update_target_hours: z.number().int().min(1).max(2160), note: z.string().trim().max(300).optional() }), c.body);
  return { data: await rpc(c.sb, "set_sla_policy", { p_constituency: b.constituency ?? null, p_category: b.category ?? null, p_ack_hours: b.ack_target_hours, p_update_hours: b.update_target_hours, p_note: b.note ?? null }) };
}

// Directory: constituencies and agencies ------------------------------------------------------------------------------------------
export async function updateConstituency(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ name_bn: z.string().trim().max(120).optional(), name_en: z.string().trim().max(120).optional(), district: z.string().trim().max(80).optional(), upazila_or_city: z.string().trim().max(80).optional(), is_active: z.boolean().optional() }), c.body);
  const key = KEY.safeParse(c.params.key);
  if (!key.success) throw new ApiError("not_found", "Area not found.");
  return { data: await rpc(c.sb, "admin_update_constituency", { p_key: key.data, p_name_bn: b.name_bn ?? null, p_name_en: b.name_en ?? null, p_district: b.district ?? null, p_upazila: b.upazila_or_city ?? null, p_active: b.is_active ?? null }) };
}
export async function saveAgency(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ key: KEY, name_bn: z.string().trim().min(1).max(200), name_en: z.string().trim().min(1).max(200), categories: z.array(SLUG).max(20).default([]), source: z.string().trim().min(2).max(200),
    url: z.url({ protocol: /^https?$/ }).max(500).optional(), checked_at: z.iso.date(), jurisdiction_level: z.enum(["national", "division", "district", "upazila", "city", "union"]).optional(), contact_channel: z.string().trim().max(300).optional() }), c.body);
  const out = await rpc<{ created: boolean }>(c.sb, "admin_upsert_agency", { p_key: b.key, p_name_bn: b.name_bn, p_name_en: b.name_en, p_categories: b.categories, p_source: b.source, p_url: b.url ?? null, p_checked: b.checked_at, p_level: b.jurisdiction_level ?? null, p_channel: b.contact_channel ?? null });
  return { status: out.created ? 201 : 200, data: out };
}

// Users and platform invitations ------------------------------------------------------------------------------------------------------
export async function listAccounts(c: Ctx): Promise<Result> {
  const q = parse(z.object({ role: z.enum(["citizen", "staff", "moderator", "admin"]).optional(), status: z.enum(["active", "suspended", "deleted"]).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }), Object.fromEntries(c.url.searchParams));
  return { data: await rpc(c.sb, "admin_list_accounts", { p_role: q.role ?? null, p_status: q.status ?? null, p_limit: q.limit }), page: { next_cursor: null, limit: q.limit } };
}
export async function createPlatformInvitation(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ email: z.email().max(200), role: z.enum(["moderator", "admin"]) }), c.body);
  const out = await rpc<{ id: string; token: string; expires_at: string }>(c.sb, "create_platform_invitation", { p_email: b.email, p_role: b.role });
  return { status: 201, data: { id: out.id, expires_at: out.expires_at, invite_token: out.token, note: "The token is shown once; share it only with the invited person." } };
}
export async function revokePlatformInvitation(c: Ctx): Promise<Result> { await rpc(c.sb, "revoke_platform_invitation", { p_id: uid(c) }); return { data: { revoked: true } }; }
export async function acceptPlatformInvitation(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ token: z.string().min(20).max(80) }), c.body);
  return { data: await rpc(c.sb, "accept_platform_invitation", { p_token: b.token }) };
}

// Integrations: enabled flags plus "is a key present". The keys themselves are never read into a response. -------------------------------
const KEYS: Record<string, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"], resend: ["EMAIL_API_KEY"], web_push: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"], maplibre: [], stt: ["TRANSCRIBE_API_KEY", "STT_API_KEY"],
  embeddings: ["EMBEDDINGS_API_KEY", "EMBEDDING_API_KEY"], sentry: ["SENTRY_DSN"], clamav: ["MALWARE_SCAN_URL"], sms: ["SMS_API_KEY"], plausible: ["ANALYTICS_SITE_ID"],
};
/** null = no key needed; otherwise whether any of the provider's environment variables is set (aliases count). */
export const keyPresent = (provider: string, env: NodeJS.ProcessEnv = process.env): boolean | null => {
  const names = KEYS[provider] ?? [];
  return names.length === 0 ? null : names.some((k) => !!env[k]);
};
export async function listIntegrations(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const { data, error } = await c.sb.from("integration_settings").select("provider,kind,enabled,note,updated_at").order("provider");
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map((r) => ({ ...r, key_present: keyPresent(r.provider) })) };
}
export async function saveIntegration(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ provider: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/), enabled: z.boolean(), note: z.string().trim().max(300).optional() }), c.body);
  return { data: await rpc(c.sb, "set_integration_setting", { p_provider: b.provider, p_enabled: b.enabled, p_note: b.note ?? null }) };
}

// Security alerts ----------------------------------------------------------------------------------------------------------------------
export async function securityEvents(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const q = parse(z.object({ kind: z.enum(["auth_failure", "rate_limit", "permission_denied", "csrf_blocked", "upload_rejected"]).optional(), hours: z.coerce.number().int().min(1).max(720).default(24), limit: z.coerce.number().int().min(1).max(100).default(50) }), Object.fromEntries(c.url.searchParams));
  await auditAdminRead(c, "security_events", null, { kind: q.kind ?? null });
  let s = c.sb.from("security_events").select("id,kind,route,detail,created_at").gte("created_at", new Date(Date.now() - q.hours * 3_600_000).toISOString()).order("created_at", { ascending: false }).limit(q.limit);
  if (q.kind) s = s.eq("kind", q.kind);
  const [rows, counts] = await Promise.all([s, c.sb.from("security_events").select("kind").gte("created_at", new Date(Date.now() - q.hours * 3_600_000).toISOString()).limit(5000)]);
  if (rows.error) throw fromDbError(rows.error);
  const summary: Record<string, number> = {};
  for (const r of counts.data ?? []) summary[r.kind as string] = (summary[r.kind as string] ?? 0) + 1;
  return { data: { summary, events: rows.data ?? [] }, page: { next_cursor: null, limit: q.limit } };
}

// System health: DB, storage, queues, AI provider, notification delivery ---------------------------------------------------------------
export async function systemHealth(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  const t0 = Date.now();
  const db = await c.sb.from("agencies").select("id", { head: true }).limit(1);
  checks.database = { ok: !db.error, detail: `${Date.now() - t0} ms` };
  const svc = serviceClient();
  if (svc) {
    const st = await svc.storage.listBuckets();
    checks.storage = { ok: !st.error, detail: st.error ? "unreachable" : `${st.data?.length ?? 0} buckets` };
    const h = await svc.rpc("ops_health");
    const o = (h.data ?? {}) as Record<string, number>;
    checks.queues = { ok: !h.error && (o.deliveries_pending ?? 0) <= 50, detail: h.error ? "unknown" : `${o.deliveries_pending ?? 0} overdue deliveries` };
    checks.notification_delivery = { ok: !h.error && (o.deliveries_dead ?? 0) === 0, detail: h.error ? "unknown" : `${o.deliveries_dead ?? 0} dead in 24h` };
    const j = await svc.from("background_jobs").select("id", { count: "exact", head: true }).eq("status", "dead");
    checks.jobs = { ok: !j.error && (j.count ?? 0) === 0, detail: j.error ? "unknown" : `${j.count ?? 0} dead-lettered` };
    checks.ai_provider = { ok: !!process.env.ANTHROPIC_API_KEY, detail: process.env.ANTHROPIC_API_KEY ? "key present" : "no key: offline fallbacks in use" };
  } else {
    for (const k of ["storage", "queues", "notification_delivery", "jobs"]) checks[k] = { ok: false, detail: "service role not configured on this server" };
    checks.ai_provider = { ok: !!process.env.ANTHROPIC_API_KEY, detail: process.env.ANTHROPIC_API_KEY ? "key present" : "no key: offline fallbacks in use" };
  }
  await auditAdminRead(c, "system_health", null);
  return { data: { ok: Object.values(checks).every((x) => x.ok), checked_at: new Date().toISOString(), checks } };
}

// Knowledge sources --------------------------------------------------------------------------------------------------------------------
export async function listKnowledgeSources(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("knowledge_sources").select("id,name,url,license_or_terms,collection_method,fetched_at,status,is_demo").order("created_at", { ascending: false }).limit(100);
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
export async function manageKnowledgeSource(c: Ctx): Promise<Result> {
  const b = parse(z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("add"), name: z.string().trim().min(3).max(200), url: z.url({ protocol: /^https?$/ }).max(500), license: z.string().trim().min(2).max(200), method: z.enum(["api", "scrape", "manual", "file"]).default("manual") }),
    z.strictObject({ action: z.enum(["refresh", "retire"]), id: UUID }),
  ]), c.body);
  const args = b.action === "add" ? { p_action: "add", p_name: b.name, p_url: b.url, p_license: b.license, p_method: b.method } : { p_action: b.action, p_id: b.id };
  return { status: b.action === "add" ? 201 : 200, data: await rpc(c.sb, "admin_manage_knowledge_source", args) };
}

// Demo data: refused in production by the environment variable AND by the database setting ---------------------------------------------------
export const isProductionEnv = (env: NodeJS.ProcessEnv = process.env) => env.APP_ENV === "production" || env.VERCEL_ENV === "production";
export async function demoData(c: Ctx): Promise<Result> {
  requireAdmin(c);
  const b = parse(z.strictObject({ action: z.enum(["load", "reset"]) }), c.body);
  if (isProductionEnv()) throw new ApiError("forbidden", "Demo data tools are disabled in production.", { _: "production" });
  return { data: await rpc(c.sb, b.action === "load" ? "load_demo_data" : "reset_demo_data") };
}
