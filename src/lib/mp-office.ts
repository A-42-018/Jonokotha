import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { checkRef } from "./ideas-questions";
import { redactPii } from "./pii";
import { overview } from "./analytics";

// Phase 5 / B5.1: what an MP (and the office manager) can do beyond the case workflow: approvals, delegation, area overview.
// Authorization lives in the database (office_can 'approve' / 'delegate'); these handlers validate input and shape output.
const KEY = z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid");
const UUID = z.uuid();
const id = (c: Ctx) => { const r = UUID.safeParse(c.params.id); if (!r.success) throw new ApiError("not_found", "Not found."); return r.data; };
const text = (min: number, max: number) => z.string().trim().min(min, `at least ${min} characters`).max(max, `at most ${max} characters`);

export async function listApprovals(c: Ctx): Promise<Result> {
  const q = parse(z.object({ status: z.enum(["pending", "approved", "rejected"]).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }), Object.fromEntries(c.url.searchParams));
  let s = c.sb.from("approval_requests").select("id,target_type,target_ref,payload,status,requested_at,decided_at,decision_note,constituencies(key)").order("requested_at", { ascending: false }).limit(q.limit);
  if (q.status) s = s.eq("status", q.status);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ constituencies, ...r }) => ({ ...r, constituency: (constituencies as unknown as { key: string } | null)?.key })), page: { next_cursor: null, limit: q.limit } };
}

export async function decideApproval(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() }), c.body);
  return { data: await rpc(c.sb, "decide_approval", { p_id: id(c), p_decision: b.decision, p_note: b.note ?? null }) };
}

export async function setApprovalSetting(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ required: z.boolean() }), c.body);
  const key = KEY.safeParse(c.params.key);
  if (!key.success) throw new ApiError("not_found", "Area not found.");
  return { data: await rpc(c.sb, "set_mp_approval_required", { p_constituency: key.data, p_required: b.required }) };
}

export async function publicReply(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ note: text(1, 1000) }), c.body);
  const out = await rpc<{ ref: string; approval_required: boolean }>(c.sb, "post_public_reply", { p_ref: checkRef(c.params.ref), p_note: redactPii(b.note).text });
  return { status: out.approval_required ? 202 : 201, data: out };
}

// Delegation ------------------------------------------------------------------------------------------------------------------------
const Task = z.strictObject({ constituency: KEY, assignee: UUID, title: text(3, 150), detail: z.string().trim().max(1000).optional(), due_date: z.iso.date().optional(), issue_ref: z.string().max(40).optional() });
export async function delegateTask(c: Ctx): Promise<Result> {
  const b = parse(Task, c.body);
  return { status: 201, data: await rpc(c.sb, "delegate_task", { p_constituency: b.constituency, p_assignee: b.assignee, p_title: redactPii(b.title).text, p_detail: b.detail ? redactPii(b.detail).text : null, p_due: b.due_date ?? null, p_issue_ref: b.issue_ref ?? null }) };
}
export async function listTasks(c: Ctx): Promise<Result> {
  const q = parse(z.object({ status: z.enum(["open", "done", "cancelled"]).optional(), mine: z.enum(["1", "0"]).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }), Object.fromEntries(c.url.searchParams));
  let s = c.sb.from("office_tasks").select("id,title,detail,status,due_date,assigned_to,created_at,completed_at,constituencies(key)").order("created_at", { ascending: false }).limit(q.limit);
  if (q.status) s = s.eq("status", q.status);
  if (q.mine === "1" && c.user) s = s.eq("assigned_to", c.user.id);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ constituencies, ...r }) => ({ ...r, constituency: (constituencies as unknown as { key: string } | null)?.key })), page: { next_cursor: null, limit: q.limit } };
}
export async function setTaskStatus(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ status: z.enum(["open", "done", "cancelled"]) }), c.body);
  return { data: await rpc(c.sb, "set_task_status", { p_id: id(c), p_status: b.status }) };
}

// MP overview: constituency analytics (suppressed small groups) plus what waits for the MP. ------------------------------------------------------
export async function mpOverview(c: Ctx): Promise<Result> {
  const analytics = await overview(c);
  const [pending, tasks] = await Promise.all([
    c.sb.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    c.sb.from("office_tasks").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  return { data: { analytics: analytics.data, pending_approvals: pending.count ?? 0, open_tasks: tasks.count ?? 0 } };
}
