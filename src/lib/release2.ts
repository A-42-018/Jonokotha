import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { MP_RECORD_V1 } from "./ai/prompts";
import { runAgent } from "./ai/run";
import { narrativeIsGrounded } from "./analytics";
import { CATEGORIES } from "./categories";
import { toCsv } from "./csv";
import { detectEmergency, flagEmergency } from "./emergency";
import { checkRef } from "./ideas-questions";
import { redactPii } from "./pii";
import { parsePublicKey, receiptMessage, signatureHash, verifyReceipt } from "./release2/receipt";
import { evaluativeWords } from "./release2/mp-neutral";
import { buildRtiDraft, DEFAULT_RTI_RULES, rtiTimeline, type RtiRules } from "./release2/rti";
import { serviceClient } from "./supabase/service";

/** Phase 8 handlers (Release 2). Routes under src/app/api/v1/ are thin wrappers. Permission is decided by the database (RLS and SECURITY DEFINER functions); nothing here widens it. */
const KEY = z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, "invalid");
const text = (min: number, max: number) => z.string().trim().min(min, `at least ${min} characters`).max(max, `at most ${max} characters`);
const WHEN = z.iso.datetime({ offset: true });
const FISCAL = z.string().regex(/^20[0-9]{2}-[0-9]{2}$/, "like 2026-27");
const UUID = z.uuid();
const Limit = z.coerce.number().int().min(1).max(200).default(50);
const query = (c: Ctx) => Object.fromEntries(c.url.searchParams);
const uuidParam = (c: Ctx, name = "id") => { const r = UUID.safeParse(c.params[name]); if (!r.success) throw new ApiError("not_found", "Not found."); return r.data; };
const sample = <T extends { is_demo?: boolean }>(rows: T[]) => rows.map(({ is_demo, ...r }) => ({ ...r, is_sample: is_demo }));
const clean = (s: string) => redactPii(s).text;

// B8.1 Budget transparency ---------------------------------------------------------------------------------------------------------------------
/** Every budget response says the same thing: amounts are quoted from the named verified document; the platform does not add up, estimate or compare them. */
export async function listBudgetSources(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY.optional(), fiscal_year: FISCAL.optional(), limit: Limit }), query(c));
  let s = c.sb.from("public_budget_sources").select("*").order("verified_at", { ascending: false }).limit(f.limit);
  if (f.constituency) s = s.eq("constituency_key", f.constituency);
  if (f.fiscal_year) s = s.eq("fiscal_year", f.fiscal_year);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: sample(data ?? []) };
}
export async function listBudgetEntries(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY.optional(), fiscal_year: FISCAL.optional(), kind: z.enum(["allocated", "released", "spent"]).optional(), project: z.string().trim().max(40).optional(), source: z.string().trim().max(40).optional(), limit: Limit }), query(c));
  let s = c.sb.from("public_budget_entries").select("*").order("fiscal_year", { ascending: false }).order("verified_at", { ascending: false }).limit(f.limit);
  if (f.constituency) s = s.eq("constituency_key", f.constituency);
  if (f.fiscal_year) s = s.eq("fiscal_year", f.fiscal_year);
  if (f.kind) s = s.eq("kind", f.kind);
  if (f.project) s = s.eq("project_ref", f.project);
  if (f.source) s = s.eq("source_ref", f.source);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: sample(data ?? []), page: { next_cursor: null, limit: f.limit }, headers: { "x-data-note": "quoted-from-verified-sources" } };
}
export async function officeBudgetSources(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY.optional() }), query(c));
  return { data: await rpc(c.sb, "budget_office_sources", { p_constituency: f.constituency ?? null }) };
}
export async function createBudgetSource(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, title: text(5, 200), publisher: text(3, 150), doc_kind: z.enum(["annual_budget", "adp", "tender_notice", "work_order", "expenditure_report", "audit_report", "other"]),
    source_url: z.url({ protocol: /^https$/ }).max(500), published_on: z.iso.date().optional(), fiscal_year: FISCAL, doc_sha256: z.string().regex(/^[0-9a-fA-F]{64}$/).optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_budget_source", { p_constituency: b.constituency, p_title: b.title, p_publisher: b.publisher, p_kind: b.doc_kind, p_url: b.source_url, p_published: b.published_on ?? null, p_fiscal: b.fiscal_year, p_sha256: b.doc_sha256 ?? null }) };
}
export async function createBudgetEntry(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ kind: z.enum(["allocated", "released", "spent"]), label: text(3, 150), amount: z.number().min(0).max(1e15), source_page: text(1, 60), project_ref: z.string().trim().max(40).optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_budget_entry", { p_source: checkRef(c.params.ref), p_kind: b.kind, p_label: clean(b.label), p_amount: b.amount, p_page: b.source_page, p_project: b.project_ref ?? null }) };
}
export async function withdrawBudgetSource(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ reason: text(5, 500) }), c.body);
  return { data: await rpc(c.sb, "withdraw_budget_source", { p_ref: checkRef(c.params.ref), p_reason: b.reason }) };
}
export async function retractBudgetEntry(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ reason: text(5, 300) }), c.body);
  return { data: await rpc(c.sb, "retract_budget_entry", { p_id: uuidParam(c), p_reason: b.reason }) };
}
export async function verifyBudgetSource(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ decision: z.enum(["verify", "reject"]), note: text(5, 500).optional() }), c.body);
  return { data: await rpc(c.sb, "verify_budget_source", { p_ref: checkRef(c.params.ref), p_decision: b.decision, p_note: b.note ?? null }) };
}
export async function adminBudgetSources(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "budget_office_sources", { p_constituency: null }) }; }

// B8.2 Agency integrations: signed receipts ------------------------------------------------------------------------------------------------------
export async function listAgencyIntegrations(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "list_agency_integrations") }; }
export async function setIntegrationKey(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ public_key_pem: z.string().trim().min(60).max(800) }), c.body);
  let fp: string;
  try { fp = parsePublicKey(b.public_key_pem).fingerprint; } catch { throw new ApiError("validation_failed", "Not a valid Ed25519 public key.", { public_key_pem: "invalid" }); }
  return { data: await rpc(c.sb, "set_agency_integration_key", { p_integration: uuidParam(c), p_public_key: b.public_key_pem, p_fingerprint: fp }) };
}
/** Public but signed. Every failure looks the same from outside (403) so the route cannot be used to probe which integrations or referrals exist. */
export async function agencyReceipt(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ integration_id: UUID, referral_id: UUID, agency_reference: text(1, 120), issued_at: WHEN, signature: z.string().regex(/^[A-Za-z0-9+/=]{80,120}$/) }), c.body);
  const svc = serviceClient();
  if (!svc) throw new ApiError("unavailable", "Receipts are not available right now.");
  const denied = new ApiError("forbidden", "The receipt could not be verified.");
  const { data: k } = await svc.rpc("agency_integration_key", { p_integration: b.integration_id });
  const key = k as { public_key_pem: string | null; key_fingerprint: string | null; status: string } | null;
  if (!key?.public_key_pem || !key.key_fingerprint || key.status !== "confirmed") throw denied;
  if (!verifyReceipt(key.public_key_pem, receiptMessage(b), b.signature)) throw denied;
  const { data, error } = await svc.rpc("record_agency_receipt", { p_integration: b.integration_id, p_referral: b.referral_id, p_reference: b.agency_reference, p_issued_at: b.issued_at, p_signature_sha256: signatureHash(b.signature), p_fingerprint: key.key_fingerprint });
  if (error) { if (error.code === "JK404" || error.code === "JK003") throw denied; throw fromDbError(error); }
  return { data };
}

// B8.3 Volunteers, kiosks, assisted reports -----------------------------------------------------------------------------------------------------
/** Draft texts, version-stamped. Wording must be reviewed by counsel and native speakers before the flag is switched on (docs/aibc/release2/open-items.md). */
export const VOLUNTEER_RULES = {
  reviewed: false, conduct_version: "v1-draft", consent_version: "v1-draft",
  conduct: {
    bn: ["আমি শুধু ব্যক্তির সম্মতি নিয়ে এবং তাঁর কথা অনুযায়ী রিপোর্ট লিখব।", "আমি নিজের মত বা দলীয় বার্তা যোগ করব না।", "আমি ব্যক্তির নাম, ফোন বা ঠিকানা রিপোর্টে লিখব না এবং নিজের কাছে রাখব না।", "আমি কোনো উপহার বা অর্থ নেব না, কোনো ফলের প্রতিশ্রুতি দেব না।", "জরুরি বিপদ হলে আমি আগে ৯৯৯-এ ফোন করতে বলব।"],
    en: ["I will file only with the person's consent and in line with what they tell me.", "I will not add my own opinion or any party message.", "I will not write the person's name, phone or address in the report and will not keep them.", "I will not take gifts or money and will not promise any result.", "In an emergency I will first tell them to call 999."],
  },
  consent: {
    bn: "আমি বুঝেছি এবং সম্মত: (১) আমার হয়ে এই রিপোর্ট জমা দেওয়া হবে, (২) ব্যক্তিগত তথ্য বাদ দিয়ে রিপোর্টটি সবার জন্য প্রকাশ হতে পারে, (৩) আমার কোনো অ্যাকাউন্ট খোলা হচ্ছে না; ফলাফল জানতে স্বেচ্ছাসেবকের কাছে রিপোর্ট নম্বর দিয়ে খোঁজ নিতে হবে।",
    en: "I understand and agree: (1) this report is filed for me, (2) with personal details removed it may be published for everyone, (3) no account is created for me; to learn the outcome I must ask the volunteer, giving the report number.",
  },
} as const;
export async function volunteerRules(): Promise<Result> { return { data: VOLUNTEER_RULES }; }
export async function applyVolunteer(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, accept_conduct: z.literal(true), conduct_version: text(1, 20) }), c.body);
  return { status: 201, data: await rpc(c.sb, "apply_volunteer", { p_constituency: b.constituency, p_conduct_version: b.conduct_version }) };
}
export async function myVolunteer(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("volunteers").select("id,status,conduct_version,created_at,decided_at,constituencies(key)").eq("user_id", c.user!.id).order("created_at", { ascending: false });
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ constituencies, ...v }) => ({ ...v, constituency: (constituencies as unknown as { key: string } | null)?.key })) };
}
export async function withdrawVolunteer(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "withdraw_volunteer", { p_id: uuidParam(c) }) }; }
export async function officeVolunteers(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY }), query(c));
  return { data: await rpc(c.sb, "office_volunteers", { p_constituency: f.constituency }) };
}
export async function volunteerDecision(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ decision: z.enum(["approve", "reject", "suspend", "reinstate"]), note: text(5, 500).optional() }), c.body);
  return { data: await rpc(c.sb, "decide_volunteer", { p_id: uuidParam(c), p_decision: b.decision, p_note: b.note ?? null }) };
}
export async function createKiosk(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, label: text(3, 80), place_text: text(1, 200).optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_kiosk", { p_constituency: b.constituency, p_label: clean(b.label), p_place: b.place_text ? clean(b.place_text) : null }) };
}
export async function retireKiosk(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "retire_kiosk", { p_id: uuidParam(c) }) }; }
export async function publicKiosks(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY.optional() }), query(c));
  let s = c.sb.from("public_kiosks").select("id,constituency_key,label,place_text").order("label").limit(100);
  if (f.constituency) s = s.eq("constituency_key", f.constituency);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
const AssistedBody = z.strictObject({
  constituency: KEY, kiosk_id: UUID.optional(),
  consent: z.strictObject({ method: z.enum(["read_aloud_agreed", "signed_paper", "kiosk_screen"]), version: text(1, 20), agreed_to_file: z.literal(true), agreed_to_publish: z.literal(true), understands_no_account: z.literal(true), language: z.enum(["bn", "en"]).default("bn") }),
  title: text(3, 120), category: z.enum(CATEGORIES), description: text(3, 2000), area: z.string().trim().max(120).default(""),
  lat: z.number().min(20.5).max(26.7).optional(), lng: z.number().min(88).max(92.8).optional(),
}).refine((b) => (b.lat === undefined) === (b.lng === undefined), { message: "lat and lng go together", path: ["lat"] });
export async function submitAssistedReport(c: Ctx): Promise<Result> {
  const b = parse(AssistedBody, c.body);
  const out = await rpc<{ ref: string; status: string; label: string }>(c.sb, "submit_assisted_report", { p_constituency: b.constituency, p_kiosk: b.kiosk_id ?? null, p_consent: b.consent,
    p_title: clean(b.title), p_category: b.category, p_description: clean(b.description), p_area: clean(b.area), p_lat: b.lat ?? null, p_lng: b.lng ?? null });
  const emergency = detectEmergency(`${b.title}\n${b.description}`);
  if (emergency) await flagEmergency(c.sb, "issue", out.ref);
  return { status: 201, data: { ...out, note: "Give the person this reference. They have no account; they can ask you for updates.", ...(emergency ? { emergency } : {}) } };
}
export async function myAssistedReports(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "my_assisted_reports") }; }

// B8.4 Open data -------------------------------------------------------------------------------------------------------------------------------------
export async function openDataCatalogue(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("public_open_datasets").select("*").order("slug");
  if (error) throw fromDbError(error);
  const licence = await rpc<{ code: string; name: string; url: string; reviewed: boolean }>(c.sb, "open_data_licence");
  return { data: { datasets: data ?? [], licence, attribution: "Please credit \"Jonokotha\" and link to the dataset page.", min_group_size: 5, formats: ["json", "csv"] }, headers: { "cache-control": "public, max-age=300" } };
}
const OpenQuery = z.object({ format: z.enum(["json", "csv"]).default("json"), constituency: KEY.optional(), from: z.iso.date().optional(), to: z.iso.date().optional() });
export async function openDataset(c: Ctx): Promise<Result> {
  const slug = z.string().regex(/^[a-z][a-z0-9-]{2,40}$/).safeParse(c.params.slug);
  if (!slug.success) throw new ApiError("not_found", "Dataset not found.");
  const f = parse(OpenQuery, query(c));
  const { data: meta } = await c.sb.from("public_open_datasets").select("*").eq("slug", slug.data).maybeSingle();
  if (!meta) throw new ApiError("not_found", "Dataset not found.");
  let rows: Record<string, unknown>[] = []; let hidden: number | null = null;
  if (slug.data === "issues-monthly" || slug.data === "resolution-monthly") {
    const out = await rpc<{ rows: Record<string, unknown>[]; hidden_cells: number }>(c.sb, slug.data === "issues-monthly" ? "open_data_issues_monthly" : "open_data_resolution_monthly", { p_constituency: f.constituency ?? null, p_from: f.from ?? null, p_to: f.to ?? null });
    rows = out.rows; hidden = out.hidden_cells;
  } else if (slug.data === "projects") {
    let s = c.sb.from("public_projects").select("ref,constituency_key,title,status,budget_text,start_date,expected_end_date,source_url,source_checked_at").order("ref").limit(5000);
    if (f.constituency) s = s.eq("constituency_key", f.constituency);
    const { data, error } = await s; if (error) throw fromDbError(error); rows = data ?? [];
  } else if (slug.data === "budget-entries") {
    let s = c.sb.from("public_budget_entries").select("source_ref,constituency_key,fiscal_year,kind,label,amount,currency,source_page,source_url").order("source_ref").limit(5000);
    if (f.constituency) s = s.eq("constituency_key", f.constituency);
    const { data, error } = await s; if (error) throw fromDbError(error); rows = data ?? [];
  } else throw new ApiError("not_found", "Dataset not found.");
  const licence = await rpc<{ code: string; url: string; reviewed: boolean }>(c.sb, "open_data_licence");
  const cols = (meta.columns as { name: string }[]).map((x) => x.name);
  const headers = { "cache-control": "public, max-age=300", "x-licence": licence.code, "x-hidden-cells": String(hidden ?? 0) };
  if (f.format === "csv") return { raw: { body: toCsv(cols, rows.map((r) => cols.map((k) => r[k]))), contentType: "text/csv; charset=utf-8" }, headers: { ...headers, "content-disposition": `attachment; filename="${slug.data}.csv"` } };
  return { data: { dataset: slug.data, licence, generated_at: new Date().toISOString(), privacy_note: meta.privacy_note, hidden_cells: hidden, row_count: rows.length, rows }, headers };
}

// B8.5 Regional administration ------------------------------------------------------------------------------------------------------------------------
export async function regionOverview(c: Ctx): Promise<Result> {
  const f = parse(z.object({ unit: z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/).optional() }), query(c));
  return { data: await rpc(c.sb, "regional_overview", { p_unit_code: f.unit ?? null }) };
}
export async function myRegions(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "my_regional_units") }; }
export async function listRegionalAdmins(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "list_regional_admins") }; }
export async function grantRegionalAdmin(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ user_id: UUID, unit_code: z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/), level: z.enum(["division", "district", "upazila", "city", "union", "ward"]), note: text(1, 300).optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "grant_regional_admin", { p_user: b.user_id, p_unit_code: b.unit_code, p_level: b.level, p_note: b.note ?? null }) };
}
export async function revokeRegionalAdmin(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "revoke_regional_admin", { p_id: uuidParam(c) }) }; }

// B8.6 Participatory budgeting -----------------------------------------------------------------------------------------------------------------------
export async function listPbCycles(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY.optional(), status: z.enum(["open", "closed"]).optional(), limit: Limit }), query(c));
  let s = c.sb.from("public_pb_cycles").select("*").order("opened_at", { ascending: false }).limit(f.limit);
  if (f.constituency) s = s.eq("constituency_key", f.constituency);
  if (f.status) s = s.eq("status", f.status);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: sample(data ?? []) };
}
export async function getPbCycle(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { data: cy } = await c.sb.from("public_pb_cycles").select("*").eq("ref", ref).maybeSingle();
  if (!cy) throw new ApiError("not_found", "Not found.");
  const { data: opts } = await c.sb.from("public_pb_options").select("id,position,title,description,cost,approvals,funded").eq("cycle_ref", ref).order("position");
  const mine = c.user ? await rpc<{ option_ids: string[]; submitted_at: string } | null>(c.sb, "my_pb_ballot", { p_ref: ref }) : null;
  const { is_demo, ...rest } = cy;
  return { data: { ...rest, is_sample: is_demo, options: opts ?? [], my_ballot: mine,
    note: "The office's pledge above is its own public statement. Votes are counted per option; results show only after closing and with at least 5 voters." } };
}
export async function submitPbBallot(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ option_ids: z.array(UUID).min(1).max(10) }), c.body);
  return { data: await rpc(c.sb, "submit_pb_ballot", { p_ref: checkRef(c.params.ref), p_options: b.option_ids }) };
}
export async function listOfficePb(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "pb_office_list") }; }
export async function createPb(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, budget_source_ref: text(3, 40), title: text(5, 150), description: text(1, 800).optional(), budget_amount: z.number().positive().max(1e15), pledge: text(20, 1000),
    max_choices: z.number().int().min(1).max(10).default(5), closes_at: WHEN, options: z.array(z.strictObject({ title: text(3, 120), description: text(1, 400).optional(), cost: z.number().positive().max(1e15) })).min(2).max(30) }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_pb_cycle", { p_constituency: b.constituency, p_source: checkRef(b.budget_source_ref), p_title: clean(b.title), p_description: b.description ? clean(b.description) : null, p_budget: b.budget_amount,
    p_pledge: clean(b.pledge), p_max_choices: b.max_choices, p_closes_at: b.closes_at, p_options: b.options.map((o) => ({ title: clean(o.title), description: o.description ? clean(o.description) : null, cost: o.cost })) }) };
}
export async function officePb(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "pb_office_view", { p_ref: checkRef(c.params.ref) }) }; }
export async function pbAction(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  switch (c.params.action) {
    case "request-open": parse(z.strictObject({}), c.body); return { data: await rpc(c.sb, "request_pb_open", { p_ref: ref }) };
    case "decision": { const b = parse(z.strictObject({ decision: z.enum(["approve", "reject"]), note: text(5, 500).optional() }), c.body); return { data: await rpc(c.sb, "decide_pb_cycle", { p_ref: ref, p_decision: b.decision, p_note: b.note ?? null }) }; }
    case "close": parse(z.strictObject({}), c.body); return { data: await rpc(c.sb, "close_pb_cycle", { p_ref: ref }) };
    case "outcome": { const b = parse(z.strictObject({ followed: z.boolean(), reason: text(10, 1000).optional() }), c.body); return { data: await rpc(c.sb, "record_pb_outcome", { p_ref: ref, p_followed: b.followed, p_reason: b.reason ? clean(b.reason) : null }) }; }
    case "cancel": { const b = parse(z.strictObject({ reason: text(5, 500) }), c.body); return { data: await rpc(c.sb, "cancel_pb_cycle", { p_ref: ref, p_reason: b.reason }) }; }
    default: throw new ApiError("not_found", "Not found.");
  }
}

// B8.7 RTI helper ------------------------------------------------------------------------------------------------------------------------------------
async function rtiRules(c: Ctx): Promise<RtiRules> {
  const v = await rpc<Partial<RtiRules>>(c.sb, "rti_rules");
  return { ...DEFAULT_RTI_RULES, ...(v ?? {}) } as RtiRules;
}
export async function rtiGuide(c: Ctx): Promise<Result> {
  const r = await rtiRules(c);
  return { data: { reviewed: r.reviewed, we_never_file: true,
    steps_en: ["Describe the information you want, as exactly as you can.", "Copy the draft and fill in your own details (we do not ask for or keep them).", "Submit it yourself to the Designated Officer of the agency, in the form and way the agency or the Information Commission says.", "Come back and record the date you filed. We will show the earliest date an answer is due.", "If there is no answer or you disagree, the law has an appeal route; ask the Information Commission or a lawyer."],
    steps_bn: ["আপনি কোন তথ্য চান তা যতটা সম্ভব স্পষ্ট করে লিখুন।", "খসড়াটি কপি করে নিজের তথ্য নিজে বসান (আমরা তা চাই না, রাখিও না)।", "সংশ্লিষ্ট সংস্থার দায়িত্বপ্রাপ্ত কর্মকর্তার কাছে সংস্থা বা তথ্য কমিশন যেভাবে বলে সেভাবে নিজে জমা দিন।", "জমা দেওয়ার তারিখ এখানে লিখে রাখুন; আমরা উত্তরের সবচেয়ে আগের তারিখ দেখাব।", "উত্তর না এলে বা অসন্তুষ্ট হলে আইনে আপিলের পথ আছে; তথ্য কমিশন বা আইনজীবীর পরামর্শ নিন।"],
    respond_working_days: r.respond_working_days, respond_working_days_multiple_units: r.respond_working_days_multiple_units, appeal_days_after_decision: r.appeal_days_after_decision,
    official_channels: r.official_channels, note: "Working days here skip Friday and Saturday only; public holidays are not known, so a date shown is the earliest possible. This is guidance, not legal advice." } };
}
const RtiCreate = z.strictObject({ agency_id: UUID.optional(), agency_name: text(2, 150).optional(), subject: text(5, 150), info_requested: text(20, 2000), period: text(1, 100).optional(),
  format: z.enum(["electronic", "paper_copy", "inspection"]).default("electronic"), language: z.enum(["bn", "en"]).default("bn") })
  .refine((b) => b.agency_id || b.agency_name, { message: "agency_id or agency_name", path: ["agency_name"] });
export async function createRtiDraft(c: Ctx): Promise<Result> {
  const b = parse(RtiCreate, c.body);
  let name = b.agency_name ? clean(b.agency_name) : "";
  if (b.agency_id) {
    const { data: a } = await c.sb.from("agencies").select(b.language === "bn" ? "name_bn" : "name_en").eq("id", b.agency_id).maybeSingle();
    if (!a) throw new ApiError("validation_failed", "Unknown agency.", { agency_id: "unknown" });
    name = String((a as unknown as Record<string, string>)[b.language === "bn" ? "name_bn" : "name_en"]);
  }
  const subj = redactPii(b.subject), info = redactPii(b.info_requested), per = b.period ? redactPii(b.period) : null;
  const draft = buildRtiDraft({ agency_name: name, subject: subj.text, info_requested: info.text, period: per?.text ?? null, format: b.format, language: b.language });
  const saved = await rpc<{ id: string; status: string }>(c.sb, "save_rti_draft", { p_agency: b.agency_id ?? null, p_agency_name: name, p_subject: subj.text, p_info: info.text, p_period: per?.text ?? null, p_format: b.format, p_draft: draft });
  const removed = [...subj.found, ...info.found, ...(per?.found ?? [])];
  return { status: 201, data: { ...saved, draft_text: draft, personal_data_removed: removed.length > 0,
    next: "Copy this text, fill in the bracketed lines yourself and submit it to the agency's Designated Officer. Jonokotha has not sent or filed anything." } };
}
const RTI_COLS = "id,agency_id,agency_name,subject,info_requested,period_text,preferred_format,draft_text,status,filed_on,filed_channel,agency_reference,answered_on,created_at,updated_at";
export async function listRtiDrafts(c: Ctx): Promise<Result> {
  const rules = await rtiRules(c);
  const { data, error } = await c.sb.from("rti_drafts").select(RTI_COLS).eq("user_id", c.user!.id).order("created_at", { ascending: false }).limit(50);
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map((d) => ({ ...d, timeline: rtiTimeline(d, rules) })) };
}
export async function getRtiDraft(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("rti_drafts").select(RTI_COLS).eq("user_id", c.user!.id).eq("id", uuidParam(c)).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ApiError("not_found", "Not found.");
  return { data: { ...data, timeline: rtiTimeline(data, await rtiRules(c)) } };
}
export async function patchRtiDraft(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ action: z.enum(["mark_filed", "mark_answered", "mark_appealed", "close"]), on: z.iso.date().optional(), channel: z.enum(["in_person", "post", "email", "official_portal"]).optional(), agency_reference: text(1, 80).optional() }), c.body);
  return { data: { ...(await rpc<object>(c.sb, "update_rti_status", { p_id: uuidParam(c), p_action: b.action, p_on: b.on ?? null, p_channel: b.channel ?? null, p_reference: b.agency_reference ?? null })), self_reported: true } };
}
export async function deleteRtiDraft(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "delete_rti_draft", { p_id: uuidParam(c) }) }; }

// B8.8 MP records ------------------------------------------------------------------------------------------------------------------------------------
const NEUTRAL = "Individual records from official sources, newest first. Jonokotha publishes no score, count, rank or comparison of MPs.";
const MP_COLS = "ref,representative_id,representative_name,kind,title,occurred_on,session_label,source_name,source_url,source_checked_at,summary_bn,published_at,is_demo";
export async function listMpRecords(c: Ctx): Promise<Result> {
  // strict: a `sort`, `rank` or `order` parameter is refused, not ignored.
  const f = parse(z.strictObject({ representative_id: UUID.optional(), kind: z.enum(["question_asked", "bill_introduced", "committee_membership", "debate_contribution", "other"]).optional(), limit: Limit }), query(c));
  let s = c.sb.from("public_mp_records").select(MP_COLS).order("occurred_on", { ascending: false }).order("ref", { ascending: false }).limit(f.limit);
  if (f.representative_id) s = s.eq("representative_id", f.representative_id);
  if (f.kind) s = s.eq("kind", f.kind);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: { records: sample(data ?? []), note: NEUTRAL } };
}
export async function getMpRecord(c: Ctx): Promise<Result> {
  const { data } = await c.sb.from("public_mp_records").select(MP_COLS).eq("ref", checkRef(c.params.ref)).maybeSingle();
  if (!data) throw new ApiError("not_found", "Not found.");
  const { is_demo, ...r } = data;
  return { data: { ...r, is_sample: is_demo, note: NEUTRAL } };
}
export async function adminMpRecords(c: Ctx): Promise<Result> {
  const f = parse(z.object({ status: z.enum(["draft", "published", "withdrawn"]).optional() }), query(c));
  return { data: await rpc(c.sb, "list_mp_records_admin", { p_status: f.status ?? null }) };
}
export async function createMpRecord(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ representative_id: UUID, kind: z.enum(["question_asked", "bill_introduced", "committee_membership", "debate_contribution", "other"]), title: text(5, 200), occurred_on: z.iso.date(), session_label: text(1, 80).optional(),
    source_name: text(3, 150), source_url: z.url({ protocol: /^https$/ }).max(500), source_checked_at: z.iso.date(), excerpt: text(1, 1500).optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_mp_record", { p_representative: b.representative_id, p_kind: b.kind, p_title: b.title, p_occurred: b.occurred_on, p_session: b.session_label ?? null, p_source_name: b.source_name, p_source_url: b.source_url, p_checked: b.source_checked_at, p_excerpt: b.excerpt ?? null }) };
}
/** Plain-Bangla draft from the official excerpt only. Kept only if every number is in the excerpt or title and no evaluative word is used; a second person reviews it before publishing. */
export async function mpRecordSummary(c: Ctx): Promise<Result> {
  parse(z.strictObject({}), c.body);
  const ref = checkRef(c.params.ref);
  const rec = await rpc<{ title: string; kind: string; occurred_on: string; excerpt: string | null; status: string }>(c.sb, "mp_record_excerpt", { p_ref: ref });
  if (!rec.excerpt) throw new ApiError("rule_not_met", "Add the official excerpt first; the summary is written from it only.", { _: "no_excerpt" });
  const data = { title: rec.title, kind: rec.kind, occurred_on: rec.occurred_on, excerpt: rec.excerpt };
  const out = await runAgent({ agent: "insight", prompt: MP_RECORD_V1, schema: z.object({ summary_bn: z.string().trim().min(10).max(600) }), input: JSON.stringify(data).slice(0, 4000), maxTokens: 500,
    actorId: c.user!.id, requestId: c.rid, tool: { name: "submit_summary", description: "Return the plain-Bangla summary of the record." } });
  const ok = out.ok && narrativeIsGrounded(out.data.summary_bn, data) && evaluativeWords(out.data.summary_bn).length === 0;
  const draft = ok && out.ok ? out.data.summary_bn : null;
  if (draft) await rpc(c.sb, "save_mp_record_draft", { p_ref: ref, p_draft: draft });
  return { status: 201, data: { ref, summary_draft: draft, ai_summary_source: draft ? "ai_draft" : "none", note: "A draft only: a second person must read it against the source and publish." } };
}
export async function publishMpRecord(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ summary_bn: text(10, 800), from_draft: z.boolean().default(false) }), c.body);
  const bad = evaluativeWords(b.summary_bn);
  if (bad.length) throw new ApiError("validation_failed", "The summary must describe the record, not judge it.", { summary_bn: "evaluative_wording" });
  return { data: await rpc(c.sb, "publish_mp_record", { p_ref: checkRef(c.params.ref), p_summary: b.summary_bn, p_from_draft: b.from_draft }) };
}
export async function withdrawMpRecord(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ reason: text(5, 500) }), c.body);
  return { data: await rpc(c.sb, "withdraw_mp_record", { p_ref: checkRef(c.params.ref), p_reason: b.reason }) };
}

// B8.10 Second-country gates --------------------------------------------------------------------------------------------------------------------------
const CODE = z.string().regex(/^[A-Z]{2}$/);
export async function countryReadiness(c: Ctx): Promise<Result> {
  const code = CODE.safeParse(c.params.code);
  if (!code.success) throw new ApiError("not_found", "Not found.");
  return { data: await rpc(c.sb, "country_readiness", { p_code: code.data }) };
}
export async function setCountryGate(c: Ctx): Promise<Result> {
  const code = CODE.safeParse(c.params.code), gate = z.enum(["legal_review", "electoral_review", "data_protection_review", "language_review", "hosting_residency"]).safeParse(c.params.gate);
  if (!code.success || !gate.success) throw new ApiError("not_found", "Not found.");
  const b = parse(z.strictObject({ status: z.enum(["open", "cleared"]), evidence_ref: text(5, 300).optional(), reviewer: text(3, 150).optional(), note: text(1, 500).optional() }), c.body);
  return { data: await rpc(c.sb, "set_country_gate", { p_code: code.data, p_gate: gate.data, p_status: b.status, p_evidence: b.evidence_ref ?? null, p_reviewer: b.reviewer ?? null, p_note: b.note ?? null }) };
}
