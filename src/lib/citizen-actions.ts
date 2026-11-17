import { z } from "zod";
import { ApiError, fromDbError, parse, type Ctx, type Result } from "./api";
import { transitionIssue } from "./store";

const text = (min: number, max: number) => z.string().trim().min(min, `at least ${min} characters`).max(max, `at most ${max} characters`);

const SCHEMAS = {
  "additional-information": z.strictObject({ message: text(3, 1000) }),
  reopen: z.strictObject({ reason: text(5, 1000) }),
  feedback: z.strictObject({ rating: z.number().int().min(1, "1 to 5").max(5, "1 to 5"), comment: z.string().trim().max(1000).optional() }),
} as const;
export type CitizenEndpoint = keyof typeof SCHEMAS;
export const isCitizenAction = (s: string): s is CitizenEndpoint => s in SCHEMAS;

/** Actions the reporting citizen can take on their own issue. Ownership is enforced by the database, not by the request. */
export async function performCitizenAction(c: Ctx, action: CitizenEndpoint, issue: { id: string; status: string }): Promise<Result> {
  if (action === "feedback") {
    const body = parse(SCHEMAS.feedback, c.body);
    if (!["resolved", "closed"].includes(issue.status)) throw new ApiError("rule_not_met", "Feedback is possible after the issue is resolved.");
    const { error } = await c.sb.from("issue_feedback").insert({ issue_id: issue.id, user_id: c.user!.id, rating: body.rating, comment: body.comment || null });
    if (error?.code === "23505") throw new ApiError("conflict", "You have already sent feedback for this issue.");
    if (error) throw error.code === "42501" ? new ApiError("forbidden", "You are not allowed to do this.") : fromDbError(error);
    return { status: 201, data: { ref: c.params.ref, rating: body.rating } };
  }
  const body = action === "reopen" ? parse(SCHEMAS.reopen, c.body) : parse(SCHEMAS["additional-information"], c.body);
  const to = action === "reopen" ? "reopened" : "under_review";
  const r = await transitionIssue(c.sb, issue.id, to, body, c.rid);
  if (r.ok) return { data: { ref: c.params.ref, status: r.status } };
  if (r.code === "not_found") throw new ApiError("not_found", "Issue not found.");
  if (r.code === "forbidden") throw new ApiError("forbidden", "You are not allowed to do this.");
  if (r.code === "invalid_transition") throw new ApiError("invalid_transition", action === "reopen" ? "This issue cannot be reopened from its current status." : "The office has not asked for more information on this issue.");
  if (r.code === "rule_not_met") throw new ApiError("rule_not_met", "The reopen window has passed. Contact the office or submit an appeal.", r.field ? { _: r.field } : {});
  if (r.code === "missing_field") throw new ApiError("validation_failed", "A required field is missing or invalid.", { [r.field ?? "_"]: "required_or_invalid" });
  throw new ApiError("internal_error", "Something went wrong.");
}
