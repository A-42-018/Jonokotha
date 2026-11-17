import { api, ApiError } from "@/lib/api-client";

/**
 * Citizen polls, built to the B5.5 contract (not on the server yet; see docs/frontend.md "F5.11 progress").
 * GET /polls?limit= and POST /polls/{id}/vote {option_id}. One vote per person is the server's rule (a second vote is 409);
 * the client also shows a voted poll without a vote button. Counts (`votes`) arrive only when the office setting allows results.
 */
export interface PollOption { id: string; label: string; label_en: string | null; votes: number | null }
export interface Poll { id: string; question: string; question_en: string | null; status: "open" | "closed"; closes_at: string | null; options: PollOption[]; my_vote: string | null; results_visible: boolean; is_sample?: boolean }

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Anything unexpected is dropped, never guessed: a poll without a question or with fewer than two options is not shown. */
export function normalizePoll(raw: unknown): Poll | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return null;
  const id = str(r.id), question = str(r.question);
  const opts = (Array.isArray(r.options) ? r.options : []).flatMap((o): PollOption[] => {
    const x = o as Record<string, unknown>;
    const oid = str(x?.id), label = str(x?.label);
    return oid && label ? [{ id: oid, label, label_en: str(x.label_en), votes: num(x.votes) }] : [];
  });
  if (!id || !question || opts.length < 2) return null;
  const visible = r.results_visible === true && opts.every((o) => o.votes !== null);
  return { id, question, question_en: str(r.question_en), status: r.status === "closed" ? "closed" : "open", closes_at: str(r.closes_at), options: opts, my_vote: str(r.my_vote), results_visible: visible, ...(r.is_sample === true ? { is_sample: true } : {}) };
}

export type PollsResult = { kind: "planned" } | { kind: "ok"; polls: Poll[] };
/** A 404 or 501 means the server has no polls yet: that is "not switched on", not an error. */
export async function fetchPolls(): Promise<PollsResult> {
  try {
    const { data } = await api<unknown[]>("/polls?limit=20");
    return { kind: "ok", polls: (Array.isArray(data) ? data : []).map(normalizePoll).filter((p): p is Poll => p !== null) };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 501)) return { kind: "planned" };
    throw e;
  }
}

export const votePoll = (id: string, optionId: string, key: string) =>
  api<unknown>(`/polls/${encodeURIComponent(id)}/vote`, { body: { option_id: optionId }, idempotencyKey: key });

/** Share of the votes for one option, whole percent; 0 when nobody has voted. */
export const percent = (votes: number, total: number) => (total > 0 ? Math.round((votes / total) * 100) : 0);
