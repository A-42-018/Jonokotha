import { z } from "zod";
import { ApiError, fromDbError, parse, type Ctx, type Result } from "./api";
import { TRANSITIONS } from "./transitions";
import { transitionIssue } from "./store";
import type { IssueStatus } from "./types";

const text = (min: number, max: number) => z.string().trim().min(min, `at least ${min} characters`).max(max, `at most ${max} characters`);
const optional = (max: number) => z.string().trim().max(max, `at most ${max} characters`).optional();
const shared = { message: optional(1000), internal_note: optional(1000) };

/** Request body per office action. Unknown keys are rejected so typos do not silently do nothing. */
const SCHEMAS = {
  acknowledge: z.strictObject({ ...shared }),
  assign: z.strictObject({ assignee: z.uuid("must be a user id"), reason: optional(500) }),
  "request-information": z.strictObject({ message: text(3, 1000), internal_note: optional(1000) }),
  forward: z.strictObject({
    agency_id: z.uuid().optional(), agency_name: optional(200), contact_channel: optional(300), external_reference: optional(100), ...shared,
  }).superRefine((v, ctx) => {
    if (!v.agency_id && !v.agency_name) ctx.addIssue({ code: "custom", path: ["agency_id"], message: "agency_id or agency_name is required" });
    if (!v.contact_channel && !v.external_reference) ctx.addIssue({ code: "custom", path: ["contact_channel"], message: "contact_channel or external_reference is required" });
  }),
  update: z.strictObject({
    note: text(1, 1000).optional(), public: z.boolean().optional(),
    status: z.enum(["under_review", "in_progress"]).optional(),
    assignee: z.uuid().optional(), agency_id: z.uuid().optional(), agency_name: optional(200), contact_channel: optional(300), external_reference: optional(100),
    ...shared,
  }).superRefine((v, ctx) => {
    if (!!v.note === !!v.status) ctx.addIssue({ code: "custom", path: ["note"], message: "send either a note or a status" });
  }),
  resolve: z.strictObject({ resolution_note: text(5, 2000), evidence_url: z.url().max(500).optional(), ...shared }),
  close: z.strictObject({ reason: optional(500), message: optional(1000) }),
  reject: z.strictObject({ reason: text(5, 1000), appeal_route: text(5, 500), ...shared }),
  "mark-duplicate": z.strictObject({ master_ref: z.string().trim().regex(/^[A-Za-z0-9-]{3,40}$/, "must be an issue reference"), reason: optional(500), ...shared }),
  "out-of-jurisdiction": z.strictObject({ reason: text(5, 1000), ...shared }),
  reopen: z.strictObject({ reason: text(5, 1000), ...shared }),
} as const;
export type OfficeEndpoint = keyof typeof SCHEMAS;
export const isOfficeAction = (s: string): s is OfficeEndpoint => s in SCHEMAS;

/** Target status for actions that map 1:1 onto a transition. */
const TARGET: Partial<Record<OfficeEndpoint, IssueStatus>> = {
  acknowledge: "acknowledged", "request-information": "needs_information", forward: "referred_to_authority", resolve: "resolved",
  close: "closed", reject: "rejected", "mark-duplicate": "duplicate", "out-of-jurisdiction": "out_of_jurisdiction", reopen: "reopened",
};

type IssueRef = { id: string; status: IssueStatus };

function transitionError(r: Extract<Awaited<ReturnType<typeof transitionIssue>>, { ok: false }>) {
  switch (r.code) {
    case "not_found": return new ApiError("not_found", "Issue not found.");
    case "forbidden": return new ApiError("forbidden", "You are not allowed to do this.");
    case "invalid_transition": return new ApiError("invalid_transition", "This change is not allowed from the issue's current status.");
    case "missing_field": return new ApiError("validation_failed", "A required field is missing or invalid.", { [r.field ?? "_"]: "required_or_invalid" });
    case "rule_not_met": return new ApiError("rule_not_met", r.field === "review_period_active" ? "The citizen review period is still running." : "A rule is not met.", r.field ? { _: r.field } : {});
    default: return new ApiError("internal_error", "Something went wrong.");
  }
}

export async function performOfficeAction(c: Ctx, action: OfficeEndpoint, issue: IssueRef): Promise<Result> {
  const body = parse(SCHEMAS[action] as z.ZodType<Record<string, unknown>>, c.body);
  const run = async (to: IssueStatus, fields: Record<string, unknown>) => {
    const r = await transitionIssue(c.sb, issue.id, to, fields, c.rid);
    if (!r.ok) throw transitionError(r);
    return { data: { ref: c.params.ref, status: r.status } };
  };

  if (action === "assign") {
    // Where the table has an "assigned" transition for this status, assigning also moves the issue to "assigned";
    // otherwise only the assignee changes.
    if (TRANSITIONS.some((t) => t.from === issue.status && t.to === "assigned" && t.actor === "office")) return run("assigned", body);
    const { data, error } = await c.sb.rpc("assign_issue", { p_issue: issue.id, p_assignee: body.assignee, p_reason: body.reason ?? null, p_request_id: c.rid });
    if (error) throw fromDbError(error);
    return { data: { ref: c.params.ref, ...(data as object) } };
  }
  if (action === "update") {
    if (body.note) {
      const { data, error } = await c.sb.rpc("add_issue_note", { p_issue: issue.id, p_note: body.note, p_public: body.public === true, p_request_id: c.rid });
      if (error) throw fromDbError(error);
      return { status: 201, data: { ref: c.params.ref, ...(data as object) } };
    }
    return run(body.status as IssueStatus, body);
  }
  if (action === "mark-duplicate") {
    const { data: master } = await c.sb.from("issues").select("id").eq("ref", body.master_ref as string).maybeSingle();
    if (!master) throw new ApiError("validation_failed", "Master issue not found in your office.", { master_ref: "not_found" });
    return run("duplicate", { ...body, master_issue: master.id });
  }
  return run(TARGET[action]!, body);
}
