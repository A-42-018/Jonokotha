import { ISSUE_STATUSES, type IssueStatus, type Status } from "./types";
import type { OfficeAction } from "./auth";

/**
 * The issue state machine (masterplan §9). The database function transition_issue() is the authority;
 * this table is its mirror for validation, UI hints and tests (tests/db/transitions.test.ts compares them).
 *
 * actor: office = staff with the listed permission (src/lib/auth.ts matrix); owner = the reporting citizen;
 *        system = trusted server job (service role). The system may perform any listed transition.
 * required: fields the caller must supply (see RequiredField).
 */
export type TransitionActor = "office" | "owner" | "system";
export type RequiredField = "message" | "reason" | "resolution_note" | "appeal_route" | "assignee" | "master_issue" | "destination" | "forwarding_details" | "responsible_party";
export interface Transition { from: IssueStatus; to: IssueStatus; actor: TransitionActor; action?: OfficeAction; required: RequiredField[] }

const S: Record<string, IssueStatus> = Object.fromEntries(ISSUE_STATUSES.map((s) => [s, s]));
const many = (from: IssueStatus[], to: IssueStatus, actor: TransitionActor, action: OfficeAction | undefined, required: RequiredField[] = []): Transition[] =>
  from.map((f) => ({ from: f, to, actor, ...(action ? { action } : {}), required }));

/** States from which an office can reject, mark duplicate or out of jurisdiction. */
const INTAKE: IssueStatus[] = [S.submitted, S.under_review, S.acknowledged, S.assigned, S.needs_information, S.reopened];

export const TRANSITIONS: Transition[] = [
  ...many([S.submitted, S.needs_information, S.reopened], "under_review", "office", "update"),
  ...many([S.needs_information], "under_review", "owner", undefined, ["message"]),
  ...many([S.submitted, S.under_review, S.needs_information, S.reopened], "acknowledged", "office", "acknowledge"),
  ...many([S.submitted, S.under_review, S.acknowledged, S.needs_information, S.referred_to_authority, S.reopened], "assigned", "office", "assign", ["assignee"]),
  ...many([S.submitted, S.under_review, S.acknowledged, S.assigned, S.referred_to_authority, S.in_progress, S.reopened], "needs_information", "office", "request_information", ["message"]),
  ...many([S.submitted, S.under_review, S.acknowledged, S.assigned, S.in_progress, S.needs_information, S.out_of_jurisdiction, S.reopened], "referred_to_authority", "office", "forward", ["destination", "forwarding_details"]),
  ...many([S.under_review, S.acknowledged, S.assigned, S.referred_to_authority, S.reopened], "in_progress", "office", "update", ["responsible_party"]),
  ...many([S.under_review, S.acknowledged, S.assigned, S.referred_to_authority, S.in_progress, S.reopened], "resolved", "office", "resolve", ["resolution_note"]),
  ...many([S.resolved], "closed", "office", "close"),
  ...many([S.resolved], "closed", "system", undefined),
  ...many([S.needs_information], "closed", "office", "close", ["reason"]),
  ...many([S.needs_information], "closed", "system", undefined, ["reason"]),
  ...many(INTAKE, "rejected", "office", "decide", ["reason", "appeal_route"]),
  ...many(INTAKE, "duplicate", "office", "decide", ["master_issue"]),
  ...many(INTAKE, "out_of_jurisdiction", "office", "decide", ["reason"]),
  ...many([S.resolved, S.closed, S.rejected, S.duplicate, S.out_of_jurisdiction], "reopened", "office", "decide", ["reason"]),
  ...many([S.resolved, S.closed, S.rejected], "reopened", "owner", undefined, ["reason"]),
];

export const transitionsFrom = (from: IssueStatus) => TRANSITIONS.filter((t) => t.from === from);
export const findTransitions = (from: IssueStatus, to: IssueStatus) => TRANSITIONS.filter((t) => t.from === from && t.to === to);
export const isAllowedTransition = (from: IssueStatus, to: IssueStatus) => findTransitions(from, to).length > 0;

/** Required fields for from -> to when performed by `actor` (system uses the first matching row, as the database does). */
export function requiredFields(from: IssueStatus, to: IssueStatus, actor: TransitionActor): RequiredField[] | null {
  const rows = findTransitions(from, to);
  const row = actor === "system" ? rows[0] : rows.find((r) => r.actor === actor);
  return row ? row.required : null;
}

/** Terminal-ish states: no further progress without a reopen. */
export const TERMINAL_STATUSES: IssueStatus[] = ["closed", "rejected", "duplicate", "out_of_jurisdiction"];

/** 13-state -> legacy 4-state label for UI that predates the new model. Mirrors issue_to_legacy_status() in migration 0005. */
export const TO_LEGACY: Record<IssueStatus, Status> = {
  submitted: "received", under_review: "received", needs_information: "received", reopened: "received",
  acknowledged: "acknowledged", assigned: "acknowledged", in_progress: "acknowledged",
  rejected: "acknowledged", duplicate: "acknowledged", out_of_jurisdiction: "acknowledged",
  referred_to_authority: "referred", resolved: "resolved", closed: "resolved",
};
export const FROM_LEGACY: Record<Status, IssueStatus> = { received: "submitted", acknowledged: "acknowledged", referred: "referred_to_authority", resolved: "resolved" };
