import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { runSource, type DueSource } from "./ingest/run";
import { redactPii } from "./pii";
import { serviceClient } from "./supabase/service";

/** Phase 6 handlers (pilot readiness and operations). Routes under src/app/api/v1/ are thin wrappers. Permission is decided by the database; `admin()` only gives a clear 403 before a list read. */
const KEY = z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "invalid");
const HTTPS = z.url({ protocol: /^https$/ }).max(500);
const DATE = z.iso.date();
const admin = (c: Ctx) => { if (c.actor?.role !== "admin") throw new ApiError("forbidden", "Administrators only."); };
const keyParam = (c: Ctx, name = "key") => { const r = KEY.safeParse(c.params[name]); if (!r.success) throw new ApiError("not_found", "Not found."); return r.data; };
const uuidParam = (c: Ctx) => { const r = z.uuid().safeParse(c.params.id); if (!r.success) throw new ApiError("not_found", "Not found."); return r.data; };
const noBody = (c: Ctx) => parse(z.strictObject({}), c.body);

async function list(c: Ctx, table: string, select: string, order: string, limit = 200, eq: Record<string, string> = {}): Promise<Result> {
  const q = c.sb.from(table).select(select).match(eq);
  const { data, error } = await q.order(order, { ascending: false }).limit(limit);
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}

// B6.2 ingestion ---------------------------------------------------------------------------------------------------------------------------
export async function listIngestionSources(c: Ctx): Promise<Result> {
  admin(c);
  return list(c, "ingestion_sources", "key,name,kind,url,license,license_checked_at,license_ok,attribution,refresh_hours,min_interval_ms,max_bytes,is_demo,enabled,last_run_at", "created_at");
}
const Source = z.strictObject({ key: KEY.min(3), name: z.string().trim().min(3).max(120), kind: z.enum(["boundaries", "representatives", "osm", "service_directory", "helpline", "grs_link", "other"]),
  url: HTTPS, license: z.string().trim().min(2).max(200), attribution: z.string().trim().max(300).optional(), refresh_hours: z.number().int().min(1).max(8760).optional(),
  min_interval_ms: z.number().int().min(1000).max(60000).optional(), max_bytes: z.number().int().min(1024).max(52428800).optional(), is_demo: z.boolean().optional() });
export async function registerIngestionSource(c: Ctx): Promise<Result> {
  const b = parse(Source, c.body);
  const id = await rpc<string>(c.sb, "register_ingestion_source", { p_key: b.key, p_name: b.name, p_kind: b.kind, p_url: b.url, p_license: b.license, p_attribution: b.attribution ?? null,
    p_refresh_hours: b.refresh_hours ?? 168, p_min_interval_ms: b.min_interval_ms ?? 5000, p_max_bytes: b.max_bytes ?? 5242880, p_is_demo: b.is_demo ?? false });
  return { status: 201, data: { id, enabled: false, note: "Disabled until a person checks the licence (POST .../licence)." } };
}
export async function reviewIngestionLicence(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ license_ok: z.boolean(), checked_on: DATE.optional(), enable: z.boolean().default(false) }), c.body);
  return { data: await rpc(c.sb, "review_ingestion_licence", { p_key: keyParam(c), p_license_ok: b.license_ok, p_checked_on: b.checked_on ?? new Date().toISOString().slice(0, 10), p_enable: b.enable }) };
}
export async function toggleIngestionSource(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ enabled: z.boolean() }), c.body);
  return { data: await rpc(c.sb, "set_ingestion_enabled", { p_key: keyParam(c), p_enabled: b.enabled }) };
}
export async function listIngestionRuns(c: Ctx): Promise<Result> {
  admin(c);
  const q = parse(z.object({ source: KEY.optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }), Object.fromEntries(c.url.searchParams));
  let sourceId: string | null = null;
  if (q.source) { const { data } = await c.sb.from("ingestion_sources").select("id").eq("key", q.source).maybeSingle(); if (!data) throw new ApiError("not_found", "Not found."); sourceId = data.id; }
  return list(c, "ingestion_runs", "id,source_id,started_at,finished_at,status,http_status,bytes,checksum,robots_allowed,records_staged,error,is_demo", "started_at", q.limit, sourceId ? { source_id: sourceId } : {});
}
export async function listStagedRecords(c: Ctx): Promise<Result> {
  admin(c);
  const q = parse(z.object({ status: z.enum(["staged", "applied", "rejected", "superseded"]).default("staged"), limit: z.coerce.number().int().min(1).max(200).default(50) }), Object.fromEntries(c.url.searchParams));
  const { data: src } = await c.sb.from("ingestion_sources").select("id").eq("key", keyParam(c)).maybeSingle();
  if (!src) throw new ApiError("not_found", "Not found.");
  return list(c, "ingestion_records", "id,record_key,payload,status,pii_flags,created_at", "created_at", q.limit, { source_id: src.id, status: q.status });
}
/** Run one source now (administrator). Uses the service role for the run itself; the admin check happens first. */
export async function runIngestionNow(c: Ctx): Promise<Result> {
  admin(c); noBody(c);
  const key = keyParam(c);
  const { data: s } = await c.sb.from("ingestion_sources").select("id,key,url,kind,license,min_interval_ms,max_bytes,is_demo,enabled,license_ok").eq("key", key).maybeSingle();
  if (!s) throw new ApiError("not_found", "Not found.");
  if (!s.enabled || !s.license_ok) throw new ApiError("rule_not_met", "The source is disabled or its licence has not been checked.", { _: "licence_not_checked" });
  const svc = serviceClient();
  if (!svc) throw new ApiError("unavailable", "Service role is not configured on this server.");
  let numbers: string[] = [];
  if (s.kind === "helpline") { const { data } = await svc.from("helplines").select("number").neq("verification_status", "rejected"); numbers = [...new Set((data ?? []).map((h) => h.number as string))]; }
  const out = await runSource(svc, s as DueSource, {}, numbers);
  return { data: out };
}

// Helplines --------------------------------------------------------------------------------------------------------------------------------------
export async function publicHelplines(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("public_helplines").select("*").order("number");
  if (error) throw fromDbError(error);
  return { data: data ?? [], headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } };
}
export async function publicDataSources(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("public_data_sources").select("*").order("name");
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
export async function listHelplines(c: Ctx): Promise<Result> {
  admin(c);
  return list(c, "helplines", "key,number,name_bn,name_en,purpose_bn,purpose_en,source_url,verification_status,proposed_at,verified_at,verification_method,evidence_checksum,review_due_at,is_demo", "proposed_at");
}
const Helpline = z.strictObject({ key: KEY, number: z.string().regex(/^[0-9]{3,6}$/, "3 to 6 digits"), name_bn: z.string().trim().min(2).max(120), name_en: z.string().trim().min(2).max(120),
  purpose_bn: z.string().trim().max(300).optional(), purpose_en: z.string().trim().max(300).optional(), source_url: HTTPS.optional(), is_demo: z.boolean().optional() });
export async function proposeHelpline(c: Ctx): Promise<Result> {
  const b = parse(Helpline, c.body);
  return { status: 201, data: await rpc(c.sb, "propose_helpline", { p_key: b.key, p_number: b.number, p_name_bn: b.name_bn, p_name_en: b.name_en, p_purpose_bn: b.purpose_bn ?? null,
    p_purpose_en: b.purpose_en ?? null, p_source_url: b.source_url ?? null, p_record: null, p_is_demo: b.is_demo ?? false }) };
}
export async function verifyHelpline(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ decision: z.enum(["verified", "rejected"]), method: z.string().trim().min(10).max(400), evidence_checksum: z.string().regex(/^[0-9a-f]{64}$/).optional(), valid_days: z.number().int().min(7).max(365).default(90) }), c.body);
  return { data: await rpc(c.sb, "verify_helpline", { p_key: keyParam(c), p_decision: b.decision, p_method: b.method, p_evidence_checksum: b.evidence_checksum ?? null, p_valid_days: b.valid_days }) };
}

// B6.3 governance --------------------------------------------------------------------------------------------------------------------------------
export async function publicRetentionPolicies(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("public_retention_policies").select("*").order("data_class");
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
export async function listLegalHolds(c: Ctx): Promise<Result> { admin(c); return list(c, "legal_holds", "id,subject_type,subject_id,reason,authority_ref,placed_at,released_at,release_reason", "placed_at"); }
export async function placeLegalHold(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ subject_type: z.enum(["user", "issue"]), subject_id: z.string().trim().min(1).max(80), reason: z.string().trim().min(10).max(500), authority_ref: z.string().trim().min(3).max(120) }), c.body);
  return { status: 201, data: await rpc(c.sb, "place_legal_hold", { p_type: b.subject_type, p_id: b.subject_id, p_reason: b.reason, p_authority: b.authority_ref }) };
}
export async function releaseLegalHold(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ reason: z.string().trim().min(5).max(300) }), c.body);
  return { data: await rpc(c.sb, "release_legal_hold", { p_id: uuidParam(c), p_reason: b.reason }) };
}

// B6.4 service notices ---------------------------------------------------------------------------------------------------------------------------
export async function publicServiceNotices(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("public_service_notices").select("*").order("starts_at", { ascending: false }).limit(10);
  if (error) throw fromDbError(error);
  return { data: data ?? [], headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } };
}
export async function postServiceNotice(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ severity: z.enum(["info", "maintenance", "degraded", "outage"]), title_bn: z.string().trim().min(3).max(140), title_en: z.string().trim().min(3).max(140),
    body_bn: z.string().trim().max(1000).optional(), body_en: z.string().trim().max(1000).optional(), starts_at: z.iso.datetime().optional(), ends_at: z.iso.datetime().optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "post_service_notice", { p_severity: b.severity, p_title_bn: b.title_bn, p_title_en: b.title_en, p_body_bn: b.body_bn ?? null, p_body_en: b.body_en ?? null, p_starts_at: b.starts_at ?? null, p_ends_at: b.ends_at ?? null }) };
}
export async function resolveServiceNotice(c: Ctx): Promise<Result> { noBody(c); return { data: await rpc(c.sb, "resolve_service_notice", { p_id: uuidParam(c) }) }; }

// B6.7 penetration test --------------------------------------------------------------------------------------------------------------------------
export async function listPentest(c: Ctx): Promise<Result> {
  admin(c);
  const findings = (await list(c, "pentest_findings", "ref,round,title,severity,category,affected,status,reported_by,reported_on,fix_ref,fixed_on,retest_on,retest_by,accepted_by", "created_at", 300)).data;
  return { data: { summary: await rpc(c.sb, "pentest_summary"), findings } };
}
export async function recordPentestFinding(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ title: z.string().trim().min(5).max(200), severity: z.enum(["critical", "high", "medium", "low", "info"]), reported_by: z.string().trim().min(2).max(120),
    category: z.string().trim().max(80).optional(), affected: z.string().trim().max(300).optional(), description: z.string().trim().max(4000).optional(), round: z.number().int().min(1).max(20).default(1), reported_on: DATE.optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "record_pentest_finding", { p_title: b.title, p_severity: b.severity, p_reported_by: b.reported_by, p_category: b.category ?? null, p_affected: b.affected ?? null,
    p_description: b.description ?? null, p_round: b.round, p_reported_on: b.reported_on ?? null }) };
}
export async function updatePentestFinding(c: Ctx): Promise<Result> {
  const ref = z.string().regex(/^PT-[0-9]{3,}$/).safeParse(c.params.ref);
  if (!ref.success) throw new ApiError("not_found", "Not found.");
  const b = parse(z.strictObject({ status: z.enum(["open", "fix_in_progress", "fixed_pending_retest", "retest_passed", "retest_failed", "accepted_risk", "not_reproducible"]), fix_ref: z.string().trim().max(200).optional(),
    retest_by: z.string().trim().max(120).optional(), retest_note: z.string().trim().max(1000).optional(), acceptance_reason: z.string().trim().max(1000).optional() }), c.body);
  return { data: await rpc(c.sb, "update_pentest_finding", { p_ref: ref.data, p_status: b.status, p_fix_ref: b.fix_ref ?? null, p_retest_by: b.retest_by ?? null, p_retest_note: b.retest_note ?? null, p_acceptance_reason: b.acceptance_reason ?? null }) };
}

// B6.1 pilot -------------------------------------------------------------------------------------------------------------------------------------
const LINES = ["hosting_app", "hosting_database", "ai_inference", "speech", "email_sms", "support", "moderation", "security_testing", "other"] as const;
export async function listPilot(c: Ctx): Promise<Result> {
  admin(c);
  const month = parse(z.object({ month: DATE.optional() }), Object.fromEntries(c.url.searchParams)).month ?? null;
  const [sites, budget, report] = await Promise.all([
    c.sb.from("pilot_sites").select("status,categories,support_contact,escalation_contact,office_verified_at,starts_on,ends_on,notes,constituencies(key)").order("updated_at", { ascending: false }),
    c.sb.from("pilot_budget_lines").select("line,monthly_budget_usd,basis").order("line"),
    rpc(c.sb, "pilot_cost_report", { p_month: month }),
  ]);
  if (sites.error) throw fromDbError(sites.error);
  if (budget.error) throw fromDbError(budget.error);
  return { data: { sites: (sites.data ?? []).map(({ constituencies, ...s }) => ({ ...s, constituency: (constituencies as unknown as { key: string } | null)?.key })), budget: budget.data ?? [], cost_report: report } };
}
export async function savePilotSite(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, status: z.enum(["planning", "onboarding", "live", "paused", "ended"]), categories: z.array(KEY).max(12), support_contact: z.string().trim().max(200).optional(),
    escalation_contact: z.string().trim().max(200).optional(), office_verified_at: DATE.optional(), starts_on: DATE.optional(), notes: z.string().trim().max(1000).optional() }), c.body);
  return { data: await rpc(c.sb, "upsert_pilot_site", { p_constituency: b.constituency, p_status: b.status, p_categories: b.categories, p_support: b.support_contact ?? null, p_escalation: b.escalation_contact ?? null,
    p_office_verified_at: b.office_verified_at ?? null, p_starts_on: b.starts_on ?? null, p_notes: b.notes ?? null }) };
}
export async function setPilotBudget(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ line: z.enum(LINES), monthly_budget_usd: z.number().min(0).max(1_000_000), basis: z.string().trim().min(5).max(300) }), c.body);
  return { data: await rpc(c.sb, "set_pilot_budget_line", { p_line: b.line, p_monthly_usd: b.monthly_budget_usd, p_basis: b.basis }) };
}
export async function recordPilotCost(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ month: DATE, line: z.enum(LINES), amount_usd: z.number().min(0).max(1_000_000), note: z.string().trim().max(300).optional(), source_ref: z.string().trim().max(120).optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "record_pilot_cost", { p_month: b.month, p_line: b.line, p_amount_usd: b.amount_usd, p_note: b.note ?? null, p_source_ref: b.source_ref ?? null }) };
}

// B6.5 AI on real use ----------------------------------------------------------------------------------------------------------------------------
/** A citizen offers one of their own reports as an evaluation example. Needs the `ai_eval_example` consent. The stored text is the (already redacted) report text, redacted again. */
export async function submitEvalExample(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ issue_ref: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9-]+$/, "invalid"), language: z.enum(["bn", "en", "mixed"]).default("bn") }), c.body);
  const { data: issue } = await c.sb.from("issues").select("title, description, reporter_id").eq("ref", b.issue_ref).maybeSingle();
  if (!issue || issue.reporter_id !== c.user?.id) throw new ApiError("not_found", "Issue not found.");
  const text = redactPii(`${issue.title}. ${issue.description}`).text.slice(0, 2000);
  return { status: 201, data: await rpc(c.sb, "submit_eval_example", { p_ref: b.issue_ref, p_text: text, p_language: b.language }) };
}
export async function myEvalExamples(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("eval_candidates").select("id,issue_id,status,language,created_at,reviewed_at").eq("user_id", c.user!.id).order("created_at", { ascending: false });
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
export async function withdrawEvalExample(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "withdraw_eval_example", { p_id: uuidParam(c) }) }; }
export async function pendingEvalExamples(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "pending_eval_examples", { p_limit: 50 }) }; }
export async function reviewEvalExample(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ decision: z.enum(["approve", "reject"]), category: KEY.optional(), expected_agency_key: KEY.optional(), language: z.enum(["bn", "en", "mixed"]).optional(),
    note: z.string().trim().max(300).optional(), pii_checked: z.boolean().default(false), text_override: z.string().trim().min(10).max(2000).optional() }), c.body);
  return { data: await rpc(c.sb, "review_eval_example", { p_id: uuidParam(c), p_decision: b.decision, p_category: b.category ?? null, p_expected_agency_key: b.expected_agency_key ?? null, p_language: b.language ?? null,
    p_note: b.note ?? null, p_pii_checked: b.pii_checked, p_text_override: b.text_override ? redactPii(b.text_override).text : null }) };
}
export async function exportEvalSet(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "eval_set_export"), headers: { "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="eval-real.eval-real.json"' } }; }
export async function routingAccuracy(c: Ctx): Promise<Result> {
  const q = parse(z.object({ days: z.coerce.number().int().min(1).max(730).default(90), include_demo: z.enum(["true", "false"]).default("false") }), Object.fromEntries(c.url.searchParams));
  return { data: await rpc(c.sb, "routing_accuracy", { p_days: q.days, p_include_demo: q.include_demo === "true" }) };
}
export async function listThresholds(c: Ctx): Promise<Result> { admin(c); return list(c, "ai_thresholds", "key,value,basis,set_at", "key"); }
export async function setThreshold(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ key: z.enum(["duplicate_min_score", "routing_min_confidence", "stt_min_confidence"]), value: z.number().min(0).max(1),
    basis: z.object({ n: z.number().int().min(30), metric: z.string().min(3).max(200), method: z.string().min(3).max(300), measured_on: DATE }).catchall(z.union([z.string().max(200), z.number(), z.boolean()])) }), c.body);
  return { data: await rpc(c.sb, "set_ai_threshold", { p_key: b.key, p_value: b.value, p_basis: b.basis }) };
}
export async function recordSpeechTest(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ provider: z.string().trim().min(2).max(60), language: z.enum(["bn", "en"]).default("bn"), district: z.string().trim().min(2).max(60), age_band: z.enum(["18-29", "30-44", "45-59", "60+"]),
    environment: z.enum(["quiet_room", "street", "market", "vehicle", "office", "other"]), samples: z.number().int().min(1).max(10000), word_error_rate: z.number().min(0).max(5), participants_consented: z.literal(true, { error: "consent of participants is required" }),
    notes: z.string().trim().max(500).optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "record_stt_test", { p_provider: b.provider, p_district: b.district, p_age_band: b.age_band, p_environment: b.environment, p_samples: b.samples, p_wer: b.word_error_rate, p_consented: true, p_language: b.language, p_notes: b.notes ?? null }) };
}
export async function speechSummary(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "stt_summary") }; }

// B6.6 KPI baselines -----------------------------------------------------------------------------------------------------------------------------
export async function snapshotKpiBaseline(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, days: z.number().int().min(7).max(365).default(30) }), c.body);
  return { status: 201, data: await rpc(c.sb, "snapshot_kpi_baseline", { p_constituency: b.constituency, p_days: b.days }) };
}
export async function recordManualKpi(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, metric: z.enum(["accessibility_task_completion_pct", "copilot_time_study_with_minutes", "copilot_time_study_without_minutes", "citizen_satisfaction_pct", "report_completion_rate_pct"]),
    value: z.number().min(0).max(100000), n: z.number().int().min(1).max(1000000), method: z.string().trim().min(10).max(600), definition: z.string().trim().min(10).max(600), period_start: DATE, period_end: DATE }), c.body);
  return { status: 201, data: await rpc(c.sb, "record_manual_kpi", { p_constituency: b.constituency, p_metric: b.metric, p_value: b.value, p_n: b.n, p_method: b.method, p_definition: b.definition, p_start: b.period_start, p_end: b.period_end }) };
}
export async function publishKpiBaselines(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, period_end: DATE }), c.body);
  return { data: await rpc(c.sb, "publish_kpi_baselines", { p_constituency: b.constituency, p_period_end: b.period_end }) };
}
export async function withdrawKpiBaselines(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, period_end: DATE, reason: z.string().trim().min(5).max(300) }), c.body);
  return { data: await rpc(c.sb, "withdraw_kpi_baselines", { p_constituency: b.constituency, p_period_end: b.period_end, p_reason: b.reason }) };
}
export async function listDraftKpiBaselines(c: Ctx): Promise<Result> {
  const q = parse(z.object({ constituency: KEY }), Object.fromEntries(c.url.searchParams));
  const { data: con } = await c.sb.from("constituencies").select("id").eq("key", q.constituency).maybeSingle();
  if (!con) throw new ApiError("not_found", "Not found.");
  return list(c, "kpi_baselines", "metric_key,value,n,suppressed,period_start,period_end,definition,method,source,status,published_at", "created_at", 200, { constituency_id: con.id });
}
export async function publicKpiBaselines(c: Ctx): Promise<Result> {
  const q = parse(z.object({ constituency: KEY.optional() }), Object.fromEntries(c.url.searchParams));
  let s = c.sb.from("public_kpi_baselines").select("*");
  if (q.constituency) s = s.eq("constituency", q.constituency);
  const { data, error } = await s.order("period_end", { ascending: false }).limit(200);
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
