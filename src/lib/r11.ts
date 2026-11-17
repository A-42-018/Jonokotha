import { api, ApiError, type Page } from "@/lib/api-client";

/**
 * Release 1.1 client helpers (backend Phase 7, `docs/api-v1.md` on branch claude/backend-phase7).
 * A route behind an off feature flag answers 404 `feature_disabled`; a server that has not got the routes at all answers 404 or 501.
 * For a list or a page that is "not switched on", not "something broke".
 */
export type OrPlanned<T> = { kind: "planned" } | { kind: "ok"; data: T; page?: Page };

export const isOff = (e: unknown): boolean => e instanceof ApiError && (e.status === 404 || e.status === 501 || e.code === "feature_disabled");
export const isNetwork = (e: unknown): boolean => e instanceof ApiError && e.isNetwork;

export async function readOrPlanned<T>(path: string): Promise<OrPlanned<T>> {
  try {
    const r = await api<T>(path);
    return { kind: "ok", data: r.data, page: r.page };
  } catch (e) {
    if (isOff(e)) return { kind: "planned" };
    throw e;
  }
}

/** Plain-language reason for a failed write, chosen from the status and the server's `field_errors._` code. */
export type WriteProblem = "auth" | "limit" | "closed" | "duplicate" | "own" | "moderated" | "off" | "again" | "fail";
export function writeProblem(e: unknown): WriteProblem {
  if (!(e instanceof ApiError)) return "fail";
  const d = e.fieldErrors._ ?? "";
  if (e.status === 401) return "auth";
  if (e.status === 429 || /limit/.test(d)) return "limit";
  if (/closed|not_open|round_closed|survey_closed|consultation_closed/.test(d)) return "closed";
  if (/duplicate/.test(d)) return "duplicate";
  if (/own_point/.test(d)) return "own";
  if (/moderated|pending/.test(d)) return "moderated";
  if (/already_answered/.test(d) || e.status === 409) return "again";
  if (isOff(e)) return "off";
  return "fail";
}

/** `{n}` or `null` under the 5-person rule: null means "hidden because the group is small", never zero. */
export const isHidden = (n: number | null | undefined): boolean => n === null || n === undefined;

/** Whole-number percent for display; the server already rounds to one decimal. */
export const pct = (n: number | null | undefined): number | null => (typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null);
