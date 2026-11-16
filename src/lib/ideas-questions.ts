import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { afterCursor, decodeCursor, PageQuery, toPage } from "./pagination";
import { redactPii } from "./pii";

const REF = /^[A-Za-z0-9-]{3,40}$/;
const KEY = z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid");
const text = (min: number, max: number) => z.string().trim().min(min, `at least ${min} characters`).max(max, `at most ${max} characters`);
export const checkRef = (r: string) => { if (!REF.test(r)) throw new ApiError("not_found", "Not found."); return r; };
const clean = (s: string) => redactPii(s);

// Ideas ---------------------------------------------------------------------------------------------------------------
const IDEA_COLS = "ref,constituency_key,category,title,body,status,decision_note,decided_at,created_at,is_demo,support_count";
const toIdea = (r: Record<string, unknown>) => { const { is_demo, ...rest } = r; return { ...rest, is_sample: is_demo }; };
const IdeaFilters = z.object({ constituency: KEY.optional(), category: z.string().regex(/^[a-z_]{2,40}$/).optional(), status: z.enum(["published", "under_consideration", "planned", "declined"]).optional(),
  sort: z.enum(["new", "supported"]).default("new") });

export async function listIdeas(c: Ctx): Promise<Result> {
  const q = Object.fromEntries(c.url.searchParams);
  const { limit, cursor } = parse(PageQuery, q); const f = parse(IdeaFilters, q);
  let sel = c.sb.from("public_ideas").select(IDEA_COLS);
  if (f.constituency) sel = sel.eq("constituency_key", f.constituency);
  if (f.category) sel = sel.eq("category", f.category);
  if (f.status) sel = sel.eq("status", f.status);
  if (f.sort === "supported") {
    // Offset-free and stable enough for a short list: most supported first, then newest. Capped; no cursor.
    const { data, error } = await sel.order("support_count", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    if (error) throw fromDbError(error);
    return { data: (data ?? []).map(toIdea), page: { next_cursor: null, limit } };
  }
  sel = sel.order("created_at", { ascending: false }).order("ref", { ascending: false }).limit(limit + 1);
  if (cursor) sel = sel.or(afterCursor(decodeCursor(cursor)));
  const { data, error } = await sel;
  if (error) throw fromDbError(error);
  const { items, page } = toPage((data ?? []) as unknown as { created_at: string; ref: string }[], limit);
  return { data: items.map((r) => toIdea(r as unknown as Record<string, unknown>)), page };
}

export async function getIdea(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { data } = await c.sb.from("public_ideas").select(IDEA_COLS).eq("ref", ref).maybeSingle();
  if (data) return { data: toIdea(data) };
  // The author (and in-scope office, moderators) can also see their own idea while it waits for review.
  if (c.user) {
    const { data: own } = await c.sb.from("ideas").select("ref,category,title,body,status,decision_note,created_at,constituencies(key)").eq("ref", ref).maybeSingle();
    if (own) return { data: { ref: own.ref, constituency_key: (own.constituencies as unknown as { key: string } | null)?.key, category: own.category, title: own.title, body: own.body, status: own.status, decision_note: own.decision_note, created_at: own.created_at, support_count: 0 } };
  }
  throw new ApiError("not_found", "Idea not found.");
}

const CreateIdea = z.strictObject({ constituency: KEY, category: z.string().regex(/^[a-z_]{2,40}$/).optional(), title: text(5, 120), body: text(10, 2000) });
export async function createIdea(c: Ctx): Promise<Result> {
  const b = parse(CreateIdea, c.body);
  const t = clean(b.title), d = clean(b.body); // public text: personal data is removed before storing
  const data = await rpc<{ ref: string; status: string }>(c.sb, "create_idea", { p_constituency: b.constituency, p_category: b.category ?? null, p_title: t.text, p_body: d.text });
  return { status: 201, data: { ...data, pii_removed: [...new Set([...t.found, ...d.found])] } };
}

export async function setIdeaSupport(c: Ctx, on: boolean): Promise<Result> {
  return { data: await rpc(c.sb, "set_idea_support", { p_ref: checkRef(c.params.ref), p_on: on }) };
}

export async function similarIdeas(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { data: idea } = await c.sb.from("ideas").select("title,body,constituencies(key)").eq("ref", ref).maybeSingle();
  let source = idea ? { text: `${idea.title} ${idea.body}`, key: (idea.constituencies as unknown as { key: string }).key } : null;
  if (!source) {
    const { data: pub } = await c.sb.from("public_ideas").select("title,body,constituency_key").eq("ref", ref).maybeSingle();
    if (pub) source = { text: `${pub.title} ${pub.body}`, key: pub.constituency_key };
  }
  if (!source) throw new ApiError("not_found", "Idea not found.");
  return { data: await rpc(c.sb, "similar_ideas", { p_constituency: source.key, p_text: source.text, p_exclude: ref, p_limit: 5 }) };
}

/** Before posting: ideas already in the area that look alike (helps people support instead of repeat). */
export async function similarForDraft(c: Ctx): Promise<Result> {
  const q = parse(z.object({ constituency: KEY, text: text(5, 2000) }), Object.fromEntries(c.url.searchParams));
  return { data: await rpc(c.sb, "similar_ideas", { p_constituency: q.constituency, p_text: redactPii(q.text).text, p_exclude: null, p_limit: 5 }) };
}

const Decision = z.strictObject({ decision: z.enum(["under_consideration", "planned", "declined"]), note: z.string().trim().max(1000).optional() });
export async function decideIdea(c: Ctx): Promise<Result> {
  const b = parse(Decision, c.body);
  const note = b.note ? redactPii(b.note).text : null;
  return { data: await rpc(c.sb, "decide_idea", { p_ref: checkRef(c.params.ref), p_decision: b.decision, p_note: note }) };
}

// Questions -----------------------------------------------------------------------------------------------------------
const Ask = z.strictObject({ constituency: KEY, visibility: z.enum(["private", "public"]).default("private"), title: text(5, 150), body: text(10, 2000) });
export async function askQuestion(c: Ctx): Promise<Result> {
  const b = parse(Ask, c.body);
  const t = clean(b.title), d = clean(b.body);
  const data = await rpc<{ ref: string }>(c.sb, "ask_question", { p_constituency: b.constituency, p_visibility: b.visibility, p_title: t.text, p_body: d.text });
  return { status: 201, data: { ...data, pii_removed: [...new Set([...t.found, ...d.found])] } };
}

const Q_COLS = "ref,constituency_key,title,body,status,created_at,last_message_at,message_count,is_demo";
export async function listPublicQuestions(c: Ctx): Promise<Result> {
  const q = Object.fromEntries(c.url.searchParams);
  const { limit, cursor } = parse(PageQuery, q); const f = parse(z.object({ constituency: KEY.optional() }), q);
  let sel = c.sb.from("public_questions").select(Q_COLS).order("created_at", { ascending: false }).order("ref", { ascending: false }).limit(limit + 1);
  if (f.constituency) sel = sel.eq("constituency_key", f.constituency);
  if (cursor) sel = sel.or(afterCursor(decodeCursor(cursor)));
  const { data, error } = await sel;
  if (error) throw fromDbError(error);
  const { items, page } = toPage((data ?? []) as unknown as { created_at: string; ref: string; is_demo: boolean }[], limit);
  return { data: items.map(({ is_demo, ...r }) => ({ ...r, is_sample: is_demo })), page };
}

const OWN_COLS = "ref,asker_id,visibility,title,body,status,assigned_to,created_at,last_message_at,constituencies(key)";
type OwnRow = { ref: string; asker_id: string; visibility: string; title: string; body: string; status: string; assigned_to: string | null; created_at: string; last_message_at: string; constituencies: { key: string } | null };
const toOwn = (r: OwnRow, office: boolean) => ({ ref: r.ref, constituency_key: r.constituencies?.key, visibility: r.visibility, title: r.title, body: r.body, status: r.status, created_at: r.created_at, last_message_at: r.last_message_at, ...(office ? { assigned_to: r.assigned_to } : {}) });

async function ownList(sb: SupabaseClient, c: Ctx, scope: "mine" | "office"): Promise<Result> {
  const q = Object.fromEntries(c.url.searchParams);
  const { limit } = parse(PageQuery, q);
  const f = parse(z.object({ status: z.enum(["pending_review", "open", "answered", "closed", "hidden"]).optional() }), q);
  let sel = sb.from("questions").select(OWN_COLS).order("last_message_at", { ascending: false }).limit(limit);
  if (scope === "mine") sel = sel.eq("asker_id", c.user!.id);
  if (f.status) sel = sel.eq("status", f.status);
  const { data, error } = await sel;
  if (error) throw fromDbError(error);
  return { data: ((data ?? []) as unknown as OwnRow[]).map((r) => toOwn(r, scope === "office")), page: { next_cursor: null, limit } };
}
export const myQuestions = (c: Ctx) => ownList(c.sb, c, "mine");
export const officeQuestions = (c: Ctx) => ownList(c.sb, c, "office");

export async function getQuestion(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  if (c.user) {
    const { data: own } = await c.sb.from("questions").select(OWN_COLS + ",id").eq("ref", ref).maybeSingle();
    if (own) {
      const row = own as unknown as OwnRow & { id: string };
      const { data: msgs } = await c.sb.from("question_messages").select("author_kind,body,created_at").eq("question_id", row.id).order("created_at");
      return { data: { ...toOwn(row, row.asker_id !== c.user.id), messages: msgs ?? [] } };
    }
  }
  const { data: pub } = await c.sb.from("public_questions").select(Q_COLS).eq("ref", ref).maybeSingle();
  if (!pub) throw new ApiError("not_found", "Question not found.");
  const { data: msgs } = await c.sb.from("public_question_messages").select("author_kind,body,created_at").eq("question_ref", ref).order("created_at");
  const { is_demo, ...rest } = pub as Record<string, unknown>;
  return { data: { ...rest, is_sample: is_demo, messages: msgs ?? [] } };
}

const Msg = z.strictObject({ body: text(1, 2000) });
export async function postMessage(c: Ctx): Promise<Result> {
  const b = parse(Msg, c.body);
  const t = redactPii(b.body); // a public thread is public: personal data is removed
  const out = await rpc<Record<string, unknown>>(c.sb, "post_question_message", { p_ref: checkRef(c.params.ref), p_body: t.text });
  return { status: 201, data: { ...out, pii_removed: t.found } };
}
export const closeQuestion = async (c: Ctx): Promise<Result> => ({ data: await rpc(c.sb, "close_question", { p_ref: checkRef(c.params.ref) }) });
export async function assignQuestion(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ assignee: z.uuid().nullable() }), c.body);
  return { data: await rpc(c.sb, "assign_question", { p_ref: checkRef(c.params.ref), p_assignee: b.assignee }) };
}
