import { z } from "zod";
import { ApiError, fromDbError, parse, type Ctx, type Result } from "./api";

const REF = /^[A-Za-z0-9-]{3,40}$/;
export const FollowInput = z.strictObject({
  type: z.enum(["issue", "area", "category", "project", "representative"], "issue, area, category, project or representative"),
  target: z.string().trim().min(1, "required").max(60, "too long").regex(/^[A-Za-z0-9_-]+$/, "invalid"),
});

/** "আমারও একই সমস্যা": add (on=true) or withdraw (on=false). Only the public count ever leaves the database. */
export async function setAffected(c: Ctx, on: boolean): Promise<Result> {
  if (!REF.test(c.params.ref)) throw new ApiError("not_found", "Issue not found.");
  const { data, error } = await c.sb.rpc("set_issue_affected", { p_ref: c.params.ref, p_on: on });
  if (error) {
    if (error.code === "JK003") throw new ApiError("rule_not_met", "You reported this issue, so it already counts.", { _: "own_issue" });
    throw fromDbError(error);
  }
  return { data };
}

export async function listFollows(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("follows")
    .select("id,target_type,category,created_at,issues(ref,title),constituencies(key,name_bn,name_en),projects(ref,title),representatives(id,full_name)")
    .eq("user_id", c.user!.id).order("created_at", { ascending: false }).limit(200);
  if (error) throw fromDbError(error);
  type Row = { id: string; target_type: string; category: string | null; created_at: string; issues: { ref: string; title: string } | null; constituencies: { key: string; name_bn: string; name_en: string } | null; projects: { ref: string; title: string } | null; representatives: { id: string; full_name: string } | null };
  return { data: (data as unknown as Row[]).map((r) => ({
    id: r.id, type: r.target_type, created_at: r.created_at,
    target: r.target_type === "issue" ? r.issues?.ref : r.target_type === "area" ? r.constituencies?.key : r.target_type === "project" ? r.projects?.ref : r.target_type === "representative" ? r.representatives?.id : r.category,
    label: r.target_type === "issue" ? r.issues?.title : r.target_type === "area" ? { bn: r.constituencies?.name_bn, en: r.constituencies?.name_en } : r.target_type === "project" ? r.projects?.title : r.target_type === "representative" ? r.representatives?.full_name : null,
  })) };
}

export async function addFollow(c: Ctx): Promise<Result> {
  const body = parse(FollowInput, c.body);
  const { data, error } = await c.sb.rpc("add_follow", { p_type: body.type, p_target: body.target });
  if (error) throw error.code === "JK003" ? new ApiError("rule_not_met", "You follow the maximum number of items.", { _: "follow_limit" }) : fromDbError(error);
  return { status: 201, data };
}
