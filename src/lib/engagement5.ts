import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { checkRef } from "./ideas-questions";
import { redactPii } from "./pii";
import { decodeCursor, encodeCursor, PageQuery } from "./pagination";

// Phase 5 / B5.5: idea comments, polls, constituency snapshot, project feedback and details.
const KEY = z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid");
const text = (min: number, max: number) => z.string().trim().min(min, `at least ${min} characters`).max(max, `at most ${max} characters`);
const day = z.iso.date();

// Idea comments ------------------------------------------------------------------------------------------------------------------------
export async function listIdeaComments(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { limit, cursor } = parse(PageQuery, Object.fromEntries(c.url.searchParams));
  let s = c.sb.from("public_idea_comments").select("id,body,created_at").eq("idea_ref", ref).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(limit + 1);
  if (cursor) { const k = decodeCursor(cursor); s = s.or(`created_at.gt.${k.createdAt},and(created_at.eq.${k.createdAt},id.gt.${k.ref})`); }
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  const rows = data ?? [], items = rows.slice(0, limit), last = items[items.length - 1];
  return { data: items, page: { next_cursor: rows.length > limit && last ? encodeCursor(last.created_at, last.id) : null, limit } };
}
export async function createIdeaComment(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ body: text(2, 500) }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_idea_comment", { p_idea: checkRef(c.params.ref), p_body: redactPii(b.body).text }) };
}

// Polls ----------------------------------------------------------------------------------------------------------------------------------
export async function listPolls(c: Ctx): Promise<Result> {
  const f = parse(z.object({ constituency: KEY.optional(), status: z.enum(["open", "closed"]).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }), Object.fromEntries(c.url.searchParams));
  let s = c.sb.from("public_polls").select("ref,constituency_key,question,status,results_visibility,closes_at,opened_at,closed_at,is_demo").order("opened_at", { ascending: false }).limit(f.limit);
  if (f.constituency) s = s.eq("constituency_key", f.constituency);
  if (f.status) s = s.eq("status", f.status);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ is_demo, ...r }) => ({ ...r, is_sample: is_demo })), page: { next_cursor: null, limit: f.limit } };
}
export async function getPoll(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { data: p } = await c.sb.from("public_polls").select("ref,constituency_key,question,status,results_visibility,closes_at,opened_at,closed_at,is_demo").eq("ref", ref).maybeSingle();
  if (!p) throw new ApiError("not_found", "Poll not found.");
  const [opts, results] = await Promise.all([
    c.sb.from("public_poll_options").select("id,label,position").eq("poll_ref", ref).order("position"),
    rpc(c.sb, "poll_results", { p_ref: ref }),
  ]);
  const { is_demo, ...rest } = p;
  return { data: { ...rest, is_sample: is_demo, options: opts.data ?? [], results } };
}
export async function votePoll(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ option_id: z.uuid() }), c.body);
  return { status: 201, data: await rpc(c.sb, "cast_poll_vote", { p_ref: checkRef(c.params.ref), p_option: b.option_id }) };
}
export async function createPoll(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ constituency: KEY, question: text(5, 200), options: z.array(text(1, 100)).min(2).max(10), closes_at: z.iso.datetime({ offset: true }).optional(), results_visibility: z.enum(["after_close", "always"]).default("after_close") }), c.body);
  return { status: 201, data: await rpc(c.sb, "create_poll", { p_constituency: b.constituency, p_question: redactPii(b.question).text, p_options: b.options.map((o) => redactPii(o).text), p_closes_at: b.closes_at ?? null, p_results: b.results_visibility }) };
}
export async function setPollStatus(c: Ctx, status: "open" | "closed" | "cancelled"): Promise<Result> {
  return { data: await rpc(c.sb, "set_poll_status", { p_ref: checkRef(c.params.ref), p_status: status }) };
}
export async function officePollResults(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "poll_results", { p_ref: checkRef(c.params.ref) }) }; }
export async function listOfficePolls(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("polls").select("ref,question,status,results_visibility,closes_at,created_at,constituencies(key)").order("created_at", { ascending: false }).limit(50);
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ constituencies, ...r }) => ({ ...r, constituency: (constituencies as unknown as { key: string } | null)?.key })) };
}

// Snapshot --------------------------------------------------------------------------------------------------------------------------------
export async function snapshot(c: Ctx): Promise<Result> {
  const key = KEY.safeParse(c.params.key);
  if (!key.success) throw new ApiError("not_found", "Area not found.");
  const q = parse(z.object({ from: day.optional(), to: day.optional() }), Object.fromEntries(c.url.searchParams));
  return { data: await rpc(c.sb, "constituency_snapshot", { p_key: key.data, p_from: q.from ?? null, p_to: q.to ?? null }) };
}

// Projects ---------------------------------------------------------------------------------------------------------------------------------
export async function projectFeedback(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "submit_project_feedback", { p_ref: checkRef(c.params.ref), p_rating: b.rating, p_comment: b.comment ? redactPii(b.comment).text : null }) };
}
export async function projectFeedbackSummary(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("public_project_feedback").select("feedback_count,average_rating").eq("project_ref", checkRef(c.params.ref)).maybeSingle();
  if (error) throw fromDbError(error);
  return { data: { feedback_count: data?.feedback_count ?? 0, average_rating: data?.average_rating ?? null, note: "The average appears once at least 5 people have sent feedback." } };
}
export async function projectDetails(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ budget_source: z.string().trim().max(300).optional(), budget_verified_at: day.optional(), procurement_ref: z.string().trim().max(120).optional(), contractor_name: z.string().trim().max(200).optional() }), c.body);
  return { data: await rpc(c.sb, "set_project_details", { p_ref: checkRef(c.params.ref), p_budget_source: b.budget_source ?? null, p_budget_verified: b.budget_verified_at ?? null, p_procurement_ref: b.procurement_ref ?? null, p_contractor: b.contractor_name ?? null }) };
}
