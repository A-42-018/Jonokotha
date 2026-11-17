import { api, ApiError } from "@/lib/api-client";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";

/**
 * Citizen polls, to the shipped B5.5 contract (docs/api-v1.md "Ideas, polls, projects, snapshot"):
 *   GET /polls?constituency=&status=       -> rows without options
 *   GET /polls/{ref}                       -> row + options + `results` (my_option_id, results_shown, total_votes, options with votes only when shown)
 *   POST /polls/{ref}/vote {option_id}     -> 201; 409-style `already_voted`, `poll_closed`
 * One vote per verified account. Results show only after closing (or when the office chose "always") and only with 5 or more votes.
 */
export interface PollRow { ref: string; constituency_key: string; question: string; status: "open" | "closed"; results_visibility: "after_close" | "always"; closes_at: string | null; opened_at: string | null; closed_at: string | null; is_sample?: boolean }
export interface PollOption { id: string; label: string; position: number }
export interface PollResults { ref: string; status: string; total_votes: number; my_option_id: string | null; results_shown: boolean; options: { id: string; label: string; votes: number }[] | null }
export interface PollDetail extends PollRow { options: PollOption[]; results: PollResults }

const q = encodeURIComponent;
export const fetchPolls = (constituency: string): Promise<OrPlanned<PollRow[]>> =>
  readOrPlanned<PollRow[]>(`/polls?${new URLSearchParams({ constituency, limit: "20" })}`).then((r) => (r.kind === "ok" && !Array.isArray(r.data) ? { ...r, data: [] } : r));
export const fetchPoll = (ref: string) => api<PollDetail>(`/polls/${q(ref)}`).then((r) => r.data);
export const votePoll = (ref: string, optionId: string, key: string) => api<{ voted: boolean }>(`/polls/${q(ref)}/vote`, { body: { option_id: optionId }, idempotencyKey: key });

/** Share of the votes for one option, whole percent; 0 when nobody has voted. */
export const percent = (votes: number, total: number) => (total > 0 ? Math.round((votes / total) * 100) : 0);

/** Why results are not shown: the poll is still running, or fewer than 5 people have voted. */
export type WhyHidden = "until_close" | "few_votes";
export const whyHidden = (r: Pick<PollResults, "status" | "total_votes">, visibility: PollRow["results_visibility"]): WhyHidden =>
  (r.status === "closed" || visibility === "always") && r.total_votes < 5 ? "few_votes" : "until_close";

export type VoteProblem = "auth" | "again" | "closed" | "fail";
export function voteProblem(e: unknown): VoteProblem {
  if (!(e instanceof ApiError)) return "fail";
  const d = e.fieldErrors._ ?? "";
  if (e.status === 401) return "auth";
  if (d === "already_voted" || e.status === 409) return "again";
  if (d === "poll_closed" || e.status === 410) return "closed";
  return "fail";
}

// Office (B5.5) -------------------------------------------------------------------------------------------------------------------------------------
export interface OfficePoll { ref: string; question: string; status: "draft" | "open" | "closed" | "cancelled"; results_visibility: "after_close" | "always"; closes_at: string | null; created_at: string; constituency?: string }
export const fetchOfficePolls = (): Promise<OrPlanned<OfficePoll[]>> => readOrPlanned("/office/polls");
export const createPoll = (b: { constituency: string; question: string; options: string[]; closes_at?: string; results_visibility: "after_close" | "always" }, key: string) =>
  api<{ ref: string; status: string }>("/office/polls", { body: b, idempotencyKey: key }).then((r) => r.data);
export const pollAction = (ref: string, a: "publish" | "close" | "cancel") => api<unknown>(`/office/polls/${q(ref)}/${a}`, { body: {} });
export const officePollResults = (ref: string) => api<PollResults>(`/office/polls/${q(ref)}/results`).then((r) => r.data);
