import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { CONSULTATION_V1 } from "./ai/prompts";
import { runAgent } from "./ai/run";
import { narrativeIsGrounded } from "./analytics";
import { buildConsensus, type VoteRow } from "./consensus";
import { toCsv, toPrintHtml } from "./csv";
import { checkRef } from "./ideas-questions";
import { prepareImage, scanForMalware } from "./media";
import { redactPii } from "./pii";
import { serviceClient } from "./supabase/service";

/** Phase 7 handlers (Release 1.1). Routes under src/app/api/v1/ are thin wrappers. Permission is decided by the database (RLS and SECURITY DEFINER functions); nothing here widens it. */
const KEY = z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, "invalid");
const text = (min: number, max: number) => z.string().trim().min(min, `at least ${min} characters`).max(max, `at most ${max} characters`);
const DAY = z.iso.date();
const WHEN = z.iso.datetime({ offset: true });
const uuidParam = (c: Ctx, name = "id") => { const r = z.uuid().safeParse(c.params[name]); if (!r.success) throw new ApiError("not_found", "Not found."); return r.data; };
const sample = <T extends { is_demo?: boolean }>(rows: T[]) => rows.map(({ is_demo, ...r }) => ({ ...r, is_sample: is_demo }));
const query = (c: Ctx) => Object.fromEntries(c.url.searchParams);
const withKey = <T extends { constituencies?: unknown }>(rows: T[]) => rows.map(({ constituencies, ...r }) => ({ ...r, constituency: (constituencies as { key: string } | null)?.key }));
const Limit = z.coerce.number().int().min(1).max(100).default(30);

// B7.1 Consultations ---------------------------------------------------------------------------------------------------------------------------
const CONS_COLS = "ref,constituency_key,question,description,status,closes_at,opened_at,closed_at,is_demo,statement_count,participant_count";
export async function listConsultations(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY.optional(), status: z.enum(["open", "closed", "reported"]).optional(), limit: Limit }), query(c));
  let s = c.sb.from("public_consultations").select(CONS_COLS).order("opened_at", { ascending: false }).limit(f.limit);
  if (f.constituency) s = s.eq("constituency_key", f.constituency);
  if (f.status) s = s.eq("status", f.status);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: sample(data ?? []), page: { next_cursor: null, limit: f.limit } };
}
export async function getConsultation(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { data: k } = await c.sb.from("public_consultations").select(CONS_COLS).eq("ref", ref).maybeSingle();
  if (!k) throw new ApiError("not_found", "Consultation not found.");
  const { data: st } = await c.sb.from("public_consultation_statements").select("id,body,kind").eq("consultation_ref", ref).order("id");
  const mine = c.user ? await rpc<{ statement_id: string; vote: string }[]>(c.sb, "my_consultation_votes", { p_ref: ref }) : [];
  const voted = new Map(mine.map((v) => [v.statement_id, v.vote]));
  const statements = (st ?? []).map((s) => ({ id: s.id, text: s.body, kind: s.kind, my_vote: voted.get(s.id) ?? null }));
  const { is_demo, ...rest } = k;
  return { data: { ...rest, is_sample: is_demo, statements, next_statement_id: statements.find((s) => !s.my_vote)?.id ?? null,
    note: "Votes per statement are shown only in the published report. Statements are about local needs and services." } };
}
export async function addConsultationStatement(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ text: text(5, 140) }), c.body);
  return { status: 201, data: await rpc(c.sb, "add_consultation_statement", { p_ref: checkRef(c.params.ref), p_text: redactPii(b.text).text }) };
}
export async function voteConsultationStatement(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ vote: z.enum(["agree", "disagree", "pass"]) }), c.body);
  const id = uuidParam(c, "id");
  const { data: s } = await c.sb.from("public_consultation_statements").select("id").eq("consultation_ref", checkRef(c.params.ref)).eq("id", id).maybeSingle();
  if (!s) throw new ApiError("not_found", "Statement not found.");
  return { data: await rpc(c.sb, "vote_consultation_statement", { p_id: id, p_vote: b.vote }) };
}
export async function publicConsultationReport(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("public_consultation_reports").select("*").eq("consultation_ref", checkRef(c.params.ref)).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ApiError("not_found", "No published report for this consultation.");
  const { is_demo, ...r } = data;
  return { data: { ...r, is_sample: is_demo } };
}
export async function listOfficeConsultations(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("consultations").select("ref,question,status,closes_at,opened_at,created_at,constituencies(key)").order("created_at", { ascending: false }).limit(50);
  if (error) throw fromDbError(error);
  return { data: withKey(data ?? []) };
}
export async function createConsultation(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, question: text(10, 200), description: text(1, 1000).optional(), seed_statements: z.array(text(5, 140)).max(10).default([]), closes_at: WHEN }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_consultation", { p_constituency: b.constituency, p_question: redactPii(b.question).text, p_description: b.description ? redactPii(b.description).text : null,
    p_seed: b.seed_statements.map((s) => redactPii(s).text), p_closes_at: b.closes_at }) };
}
export async function officeConsultation(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "consultation_office_view", { p_ref: checkRef(c.params.ref) }) }; }
export async function consultationStatus(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ action: z.enum(["open", "close"]) }), c.body);
  return { data: await rpc(c.sb, b.action === "open" ? "open_consultation" : "close_consultation", { p_ref: checkRef(c.params.ref) }) };
}
export async function consultationDecision(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ decision: z.enum(["approve", "reject"]), note: text(5, 500).optional() }), c.body);
  return { data: await rpc(c.sb, "decide_consultation", { p_ref: checkRef(c.params.ref), p_decision: b.decision, p_note: b.note ?? null }) };
}
export async function moderateConsultationStatement(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ action: z.enum(["approve", "reject"]), reason: text(5, 300).optional() }), c.body);
  return { data: await rpc(c.sb, "moderate_consultation_statement", { p_id: uuidParam(c, "id"), p_action: b.action, p_reason: b.reason ?? null }) };
}

/** Prose from aggregates. Every number in it must occur in the data (same check as analytics reports); otherwise it is dropped and the office writes it. */
async function consultationNarrative(c: Ctx, data: unknown): Promise<string | null> {
  const out = await runAgent({ agent: "insight", prompt: CONSULTATION_V1, schema: z.object({ narrative: z.string().trim().min(10).max(1500) }), input: JSON.stringify(data).slice(0, 7000), maxTokens: 600,
    actorId: c.user!.id, requestId: c.rid, tool: { name: "submit_summary", description: "Return the plain-Bangla summary." } });
  return out.ok && narrativeIsGrounded(out.data.narrative, data) ? out.data.narrative : null;
}
/** Generates (or refreshes) the aggregate report draft. The grouping runs here on an identity-free matrix; the database drops any group under 5 again. */
export async function consultationSummary(c: Ctx): Promise<Result> {
  parse(z.strictObject({ generate_narrative: z.boolean().default(true) }), c.body);
  const ref = checkRef(c.params.ref);
  const view = await rpc<{ statements: { id: string; text: string; status: string }[] }>(c.sb, "consultation_office_view", { p_ref: ref });
  // PostgREST caps one answer at 1000 rows, so the matrix is read in ordered pages.
  const matrix: VoteRow[] = [];
  for (let from = 0; from < 2_000_000; from += 1000) {
    const { data, error } = await c.sb.rpc("consultation_vote_matrix", { p_ref: ref }).range(from, from + 999);
    if (error) throw fromDbError(error);
    matrix.push(...((data ?? []) as VoteRow[]));
    if ((data ?? []).length < 1000) break;
  }
  const consensus = buildConsensus(matrix, view.statements.filter((s) => s.status === "approved").map((s) => ({ id: s.id, text: s.text })));
  const body = (c.body ?? {}) as { generate_narrative?: boolean };
  const narrative = !consensus.suppressed && body.generate_narrative !== false ? await consultationNarrative(c, { participants: consensus.participants, groups: consensus.groups, hidden_groups: consensus.hidden_groups, agreement: consensus.agreement }) : null;
  const saved = await rpc(c.sb, "save_consultation_report", { p_ref: ref, p_participants: consensus.participants, p_groups: consensus.groups, p_agreement: consensus.agreement, p_ai_summary: narrative });
  return { status: 201, data: { ...(saved as object), ai_summary: narrative, ai_summary_source: narrative ? "ai_draft" : "none", note: "A draft only: the office must review it before anything is published." } };
}
export async function consultationReport(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ summary_bn: text(10, 2000), you_said_we_did: text(1, 3000).optional(), actions: z.array(z.strictObject({ text: text(5, 300), link_ref: z.string().trim().max(40).optional() })).max(10).default([]), publish: z.boolean().default(false) }), c.body);
  return { data: await rpc(c.sb, "review_consultation_report", { p_ref: checkRef(c.params.ref), p_summary: redactPii(b.summary_bn).text, p_you_said: b.you_said_we_did ? redactPii(b.you_said_we_did).text : null, p_actions: b.actions, p_publish: b.publish }) };
}

// B7.5 Ideas: for / against, support threshold ------------------------------------------------------------------------------------------------------
export async function listIdeaArguments(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("public_idea_arguments").select("id,side,body,created_at,helpful_count").eq("idea_ref", checkRef(c.params.ref)).order("helpful_count", { ascending: false }).order("created_at").limit(100);
  if (error) throw fromDbError(error);
  const rows = data ?? [];
  return { data: { for: rows.filter((r) => r.side === "for"), against: rows.filter((r) => r.side === "against") } };
}
export async function addIdeaArgument(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ side: z.enum(["for", "against"]), body: text(5, 280) }), c.body);
  return { status: 201, data: await rpc(c.sb, "add_idea_argument", { p_idea: checkRef(c.params.ref), p_side: b.side, p_body: redactPii(b.body).text }) };
}
export async function setArgumentHelpful(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ on: z.boolean() }), c.body);
  const id = uuidParam(c, "id");
  const { data: a } = await c.sb.from("public_idea_arguments").select("id").eq("idea_ref", checkRef(c.params.ref)).eq("id", id).maybeSingle();
  if (!a) throw new ApiError("not_found", "Point not found.");
  return { data: await rpc(c.sb, "set_argument_helpful", { p_id: id, p_on: b.on }) };
}
export async function setIdeaPolicy(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ support_threshold: z.number().int().min(3).max(100000), response_days: z.number().int().min(3).max(90) }), c.body);
  const key = KEY.safeParse(c.params.key);
  if (!key.success) throw new ApiError("not_found", "Not found.");
  return { data: await rpc(c.sb, "set_idea_policy", { p_constituency: key.data, p_threshold: b.support_threshold, p_days: b.response_days }) };
}
export async function getIdeaPolicy(c: Ctx): Promise<Result> {
  const key = KEY.safeParse(c.params.key);
  if (!key.success) throw new ApiError("not_found", "Not found.");
  const { data: k } = await c.sb.from("constituencies").select("id").eq("key", key.data).maybeSingle();
  const { data } = k ? await c.sb.from("idea_policies").select("support_threshold,response_days,updated_at").eq("constituency_id", k.id).maybeSingle() : { data: null };
  return { data: data ?? { support_threshold: null, response_days: null } };
}

// B7.3 Project check-ins --------------------------------------------------------------------------------------------------------------------------------
export async function listCheckins(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const f = parse(z.object({ limit: Limit }), query(c));
  const { data, error } = await c.sb.from("public_project_checkins").select("id,note,visited_at,has_photo,office_response,responded_at,created_at,label").eq("project_ref", ref).order("visited_at", { ascending: false }).limit(f.limit);
  if (error) throw fromDbError(error);
  const rows = data ?? [];
  const withPhoto = rows.filter((r) => r.has_photo).map((r) => r.id);
  const urls = new Map<string, string>();
  const svc = serviceClient();
  if (svc && withPhoto.length) {
    const { data: paths } = await svc.from("project_checkins").select("id,photo_path").in("id", withPhoto).eq("moderation_status", "approved");
    const signed = await svc.storage.from("project-checkins").createSignedUrls((paths ?? []).map((p) => p.photo_path as string), 300);
    const byPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
    for (const p of paths ?? []) { const u = byPath.get(p.photo_path as string); if (u) urls.set(p.id as string, u); }
  }
  return { data: rows.map((r) => ({ ...r, photo_url: urls.get(r.id) ?? null })), page: { next_cursor: null, limit: f.limit } };
}
export async function createCheckin(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ note: text(5, 500), visited_at: DAY.optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_project_checkin", { p_project: checkRef(c.params.ref), p_note: redactPii(b.note).text, p_visited: b.visited_at ?? null }) };
}
export async function uploadCheckinPhoto(c: Ctx): Promise<Result> {
  const id = uuidParam(c, "id");
  const { data: k } = await c.sb.from("project_checkins").select("id,project_id,photo_path,moderation_status,author_id").eq("id", id).eq("author_id", c.user!.id).maybeSingle();   // RLS and the author check
  if (!k) throw new ApiError("not_found", "Check-in not found.");
  if (k.photo_path || k.moderation_status !== "pending_review") throw new ApiError("rule_not_met", "A photo can be added once, before the check-in is reviewed.", { _: "photo_not_allowed" });
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError("validation_failed", "Send the photo as the multipart field 'file'.", { file: "required" });
  if (file.size < 100 || file.size > 8 * 1024 * 1024) throw new ApiError("validation_failed", "A photo must be between 100 bytes and 8 MB.", { file: "size" });
  const svc = serviceClient();
  if (!svc) throw new ApiError("unavailable", "Photo storage is not configured on this server.");
  const img = await prepareImage(new Uint8Array(await file.arrayBuffer()));   // type by content, EXIF and GPS dropped by re-encoding
  await scanForMalware(img.bytes);
  const path = `${k.project_id}/${id}.jpg`;
  const up = await svc.storage.from("project-checkins").upload(path, img.bytes, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new ApiError("internal_error", "The photo could not be stored.");
  const { error } = await svc.from("project_checkins").update({ photo_path: path }).eq("id", id).is("photo_path", null);
  if (error) { await svc.storage.from("project-checkins").remove([path]); throw new ApiError("internal_error", "The photo could not be saved."); }
  return { status: 201, data: { id, has_photo: true, status: "pending_review", width: img.width, height: img.height } };
}
export async function officeCheckins(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { data, error } = await c.sb.from("project_checkins").select("id,note,visited_at,moderation_status,moderation_reason,office_response,created_at,photo_path,projects!inner(ref)").eq("projects.ref", ref).order("created_at", { ascending: false }).limit(100);
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ projects, photo_path, ...r }) => { void projects; return { ...r, has_photo: !!photo_path, label: "citizen_submitted" }; }) };
}
export async function moderateCheckin(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ action: z.enum(["approve", "hide"]), reason: text(5, 300).optional() }), c.body);
  return { data: await rpc(c.sb, "moderate_project_checkin", { p_id: uuidParam(c), p_action: b.action, p_reason: b.reason ?? null }) };
}
export async function respondCheckin(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ text: text(5, 500) }), c.body);
  return { data: await rpc(c.sb, "respond_to_checkin", { p_id: uuidParam(c), p_text: redactPii(b.text).text }) };
}

// B7.6 Surveys and satisfaction -------------------------------------------------------------------------------------------------------------------------
export async function listSurveys(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY.optional(), status: z.enum(["open", "closed"]).optional(), limit: Limit }), query(c));
  let s = c.sb.from("public_surveys").select("ref,constituency_key,title,description,status,closes_at,opened_at,closed_at,is_demo").order("opened_at", { ascending: false }).limit(f.limit);
  if (f.constituency) s = s.eq("constituency_key", f.constituency);
  if (f.status) s = s.eq("status", f.status);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: sample(data ?? []), page: { next_cursor: null, limit: f.limit } };
}
export async function getSurvey(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { data: s } = await c.sb.from("public_surveys").select("ref,constituency_key,title,description,status,closes_at,opened_at,closed_at,is_demo").eq("ref", ref).maybeSingle();
  if (!s) throw new ApiError("not_found", "Survey not found.");
  const { data: q } = await c.sb.from("public_survey_questions").select("id,position,kind,prompt,options").eq("survey_ref", ref).order("position");
  const { is_demo, ...rest } = s;
  return { data: { ...rest, is_sample: is_demo, questions: q ?? [] } };
}
export async function submitSurveyResponse(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ answers: z.record(z.uuid(), z.union([z.number().int().min(1).max(5), text(1, 80)])) }), c.body);
  return { status: 201, data: await rpc(c.sb, "submit_survey_response", { p_ref: checkRef(c.params.ref), p_answers: b.answers }) };
}
export async function surveyResults(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "survey_results", { p_ref: checkRef(c.params.ref) }) }; }
export async function createSurvey(c: Ctx): Promise<Result> {
  const Q = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("rating"), prompt: text(5, 200) }), z.strictObject({ kind: z.literal("choice"), prompt: text(5, 200), options: z.array(text(1, 80)).min(2).max(8) })]);
  const b = parse(z.strictObject({ constituency: KEY, title: text(5, 150), description: text(1, 600).optional(), questions: z.array(Q).min(1).max(8), closes_at: WHEN.optional() }), c.body);
  const questions = b.questions.map((q) => ({ ...q, prompt: redactPii(q.prompt).text }));
  return { status: 201, data: await rpc(c.sb, "create_survey", { p_constituency: b.constituency, p_title: redactPii(b.title).text, p_description: b.description ? redactPii(b.description).text : null, p_questions: questions, p_closes_at: b.closes_at ?? null }) };
}
export async function surveyAction(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ status: z.enum(["open", "closed", "cancelled"]) }), c.body);
  return { data: await rpc(c.sb, "set_survey_status", { p_ref: checkRef(c.params.ref), p_status: b.status }) };
}
export async function satisfaction(c: Ctx): Promise<Result> {
  const q = parse(z.object({ constituency: KEY, days: z.coerce.number().int().min(1).max(730).default(90) }), query(c));
  return { data: await rpc(c.sb, "satisfaction_summary", { p_constituency: q.constituency, p_days: q.days }) };
}

// B7.7 Commitments -------------------------------------------------------------------------------------------------------------------------------------------
const CM_COLS = "ref,constituency_key,title,description,status,due_date,published_at,updated_at,is_demo,announcement_ref,project_ref,idea_ref,label";
export async function listCommitments(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY.optional(), status: z.enum(["planned", "in_progress", "delivered", "delayed", "dropped"]).optional(), limit: Limit }), query(c));
  let s = c.sb.from("public_commitments").select(CM_COLS).order("updated_at", { ascending: false }).limit(f.limit);
  if (f.constituency) s = s.eq("constituency_key", f.constituency);
  if (f.status) s = s.eq("status", f.status);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: sample(data ?? []), page: { next_cursor: null, limit: f.limit } };
}
export async function getCommitment(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { data: m } = await c.sb.from("public_commitments").select(CM_COLS).eq("ref", ref).maybeSingle();
  if (!m) throw new ApiError("not_found", "Commitment not found.");
  const { data: ev } = await c.sb.from("public_commitment_events").select("from_status,to_status,note,evidence_url,evidence_text,created_at").eq("commitment_ref", ref).order("created_at");
  const { is_demo, ...rest } = m;
  return { data: { ...rest, is_sample: is_demo, history: ev ?? [] } };
}
export async function createCommitment(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, title: text(5, 150), description: text(1, 1500).optional(), due_date: DAY.optional(), announcement_ref: z.string().trim().max(40).optional(), project_ref: z.string().trim().max(40).optional(), idea_ref: z.string().trim().max(40).optional(), publish: z.boolean().default(false) }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_commitment", { p_constituency: b.constituency, p_title: redactPii(b.title).text, p_description: b.description ? redactPii(b.description).text : null, p_due: b.due_date ?? null,
    p_announcement: b.announcement_ref ?? null, p_project: b.project_ref ?? null, p_idea: b.idea_ref ?? null, p_publish: b.publish }) };
}
export async function commitmentDecision(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ decision: z.enum(["approve", "reject"]), note: text(5, 500).optional() }), c.body);
  return { data: await rpc(c.sb, "decide_commitment", { p_ref: checkRef(c.params.ref), p_decision: b.decision, p_note: b.note ?? null }) };
}
export async function commitmentStatus(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ status: z.enum(["in_progress", "delivered", "delayed", "dropped"]), note: text(5, 500).optional(), evidence_url: z.url({ protocol: /^https$/ }).max(500).optional(), evidence_text: text(10, 500).optional() }), c.body);
  return { data: await rpc(c.sb, "update_commitment_status", { p_ref: checkRef(c.params.ref), p_status: b.status, p_note: b.note ? redactPii(b.note).text : null, p_evidence_url: b.evidence_url ?? null, p_evidence_text: b.evidence_text ? redactPii(b.evidence_text).text : null }) };
}

// B7.8 Community priorities (non-binding) ---------------------------------------------------------------------------------------------------------------
export async function listPriorityRounds(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY.optional(), status: z.enum(["open", "closed"]).optional(), limit: Limit }), query(c));
  let s = c.sb.from("public_priority_rounds").select("ref,constituency_key,title,description,status,closes_at,opened_at,closed_at,is_demo,label").order("opened_at", { ascending: false }).limit(f.limit);
  if (f.constituency) s = s.eq("constituency_key", f.constituency);
  if (f.status) s = s.eq("status", f.status);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: sample(data ?? []), page: { next_cursor: null, limit: f.limit } };
}
export async function getPriorityRound(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { data: r } = await c.sb.from("public_priority_rounds").select("ref,constituency_key,title,description,status,closes_at,opened_at,closed_at,is_demo,label").eq("ref", ref).maybeSingle();
  if (!r) throw new ApiError("not_found", "Round not found.");
  const { data: items } = await c.sb.from("public_priority_items").select("id,position,label").eq("round_ref", ref).order("position");
  const { is_demo, ...rest } = r;
  return { data: { ...rest, is_sample: is_demo, items: items ?? [], note: "Non-binding: shows what participants say matters to them, not a decision." } };
}
export async function submitPriorityRanking(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ items: z.array(z.uuid()).min(1).max(5) }), c.body);
  return { data: await rpc(c.sb, "submit_priority_ranking", { p_ref: checkRef(c.params.ref), p_items: b.items }) };
}
export async function priorityResults(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "priority_results", { p_ref: checkRef(c.params.ref) }) }; }
export async function createPriorityRound(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, title: text(5, 150), description: text(1, 600).optional(), items: z.array(text(3, 100)).min(3).max(12), closes_at: WHEN.optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_priority_round", { p_constituency: b.constituency, p_title: redactPii(b.title).text, p_description: b.description ? redactPii(b.description).text : null, p_items: b.items.map((i) => redactPii(i).text), p_closes_at: b.closes_at ?? null }) };
}
export async function priorityAction(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ status: z.enum(["open", "closed", "cancelled"]) }), c.body);
  return { data: await rpc(c.sb, "set_priority_status", { p_ref: checkRef(c.params.ref), p_status: b.status }) };
}

// B7.4 Area alerts -------------------------------------------------------------------------------------------------------------------------------------------
export async function sendAreaAlert(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, title_bn: text(5, 120), title_en: text(1, 120).optional(), body: text(1, 300).optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "send_area_alert", { p_constituency: b.constituency, p_title_bn: redactPii(b.title_bn).text, p_title_en: b.title_en ? redactPii(b.title_en).text : null, p_body: b.body ? redactPii(b.body).text : null }) };
}
export async function listAreaAlerts(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY, limit: Limit }), query(c));
  const { data, error } = await c.sb.from("public_area_alerts").select("id,title_bn,title_en,body,created_at").eq("constituency_key", f.constituency).order("created_at", { ascending: false }).limit(f.limit);
  if (error) throw fromDbError(error);
  return { data: data ?? [], page: { next_cursor: null, limit: f.limit } };
}

// B7.9 Weekly briefs -----------------------------------------------------------------------------------------------------------------------------------------
export async function listBriefs(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("insight_briefs").select("id,week_start,status,payload,narrative_draft,narrative,generated_at,reviewed_at,shared_at,constituencies(key)").order("week_start", { ascending: false }).limit(30);
  if (error) throw fromDbError(error);
  return { data: withKey(data ?? []) };
}
export async function reviewBrief(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ decision: z.enum(["approve", "withdraw"]), narrative: text(10, 1500).optional() }), c.body);
  return { data: await rpc(c.sb, "review_insight_brief", { p_id: uuidParam(c), p_decision: b.decision, p_narrative: b.narrative ? redactPii(b.narrative).text : null }) };
}

// B7.10 Exports ----------------------------------------------------------------------------------------------------------------------------------------------
export async function officeExport(c: Ctx): Promise<Result> {
  const q = parse(z.object({ kind: z.enum(["cases", "ideas"]), constituency: KEY, days: z.coerce.number().int().min(1).max(730).default(90), format: z.enum(["csv", "html"]).default("csv") }), query(c));
  const out = await rpc<{ columns: string[]; rows: unknown[][]; generated_at: string; period_days: number; definition: string; row_count: number }>(c.sb, "export_rows", { p_kind: q.kind, p_constituency: q.constituency, p_days: q.days, p_format: q.format === "csv" ? "csv" : "pdf" });
  const name = `jonokotha-${q.constituency}-${q.kind}-${out.generated_at.slice(0, 10)}`;
  if (q.format === "html") return { raw: { body: toPrintHtml(`${q.kind} — ${q.constituency}`, `${out.definition} Generated ${out.generated_at}. Rows: ${out.row_count}.`, out.columns, out.rows), contentType: "text/html; charset=utf-8" }, headers: { "Content-Disposition": `inline; filename="${name}.html"` } };
  return { raw: { body: toCsv(out.columns, out.rows), contentType: "text/csv; charset=utf-8" }, headers: { "Content-Disposition": `attachment; filename="${name}.csv"` } };
}

// B7.11 Heatmaps and clusters --------------------------------------------------------------------------------------------------------------------------------
const Heat = z.object({ constituency: KEY, days: z.coerce.number().int().min(1).max(365).default(30), category: z.string().regex(/^[a-z_]{2,40}$/).optional(), cell_m: z.coerce.number().int().min(250).max(5000).optional() });
export async function publicHeatmap(c: Ctx): Promise<Result> {
  const q = parse(Heat, query(c));
  return { data: await rpc(c.sb, "public_heatmap", { p_constituency: q.constituency, p_days: q.days, p_category: q.category ?? null, p_cell_m: q.cell_m ?? 1000 }), headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } };
}
export async function officeClusters(c: Ctx): Promise<Result> {
  const q = parse(Heat, query(c));
  return { data: await rpc(c.sb, "office_clusters", { p_constituency: q.constituency, p_days: q.days, p_category: q.category ?? null, p_cell_m: q.cell_m ?? 250 }) };
}

// B7.13 KPIs --------------------------------------------------------------------------------------------------------------------------------------------------
export async function release11Kpis(c: Ctx): Promise<Result> {
  const q = parse(z.object({ constituency: KEY.optional(), days: z.coerce.number().int().min(1).max(730).default(90) }), query(c));
  return { data: await rpc(c.sb, "release11_kpis", { p_constituency: q.constituency ?? null, p_days: q.days }) };
}

// Office lists of drafts (RLS shows only the caller's areas) -------------------------------------------------------------------------------------------------
async function officeList(c: Ctx, table: string, select: string): Promise<Result> {
  const { data, error } = await c.sb.from(table).select(`${select},constituencies(key)`).order("created_at", { ascending: false }).limit(50);
  if (error) throw fromDbError(error);
  return { data: withKey((data ?? []) as unknown as { constituencies?: unknown }[]) };
}
export const listOfficeSurveys = (c: Ctx) => officeList(c, "surveys", "ref,title,status,closes_at,opened_at,created_at");
export const listOfficeCommitments = (c: Ctx) => officeList(c, "commitments", "ref,title,status,due_date,published_at,created_at");
export const listOfficePriorityRounds = (c: Ctx) => officeList(c, "priority_rounds", "ref,title,status,closes_at,opened_at,created_at");
