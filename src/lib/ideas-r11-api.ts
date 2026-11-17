import { api } from "@/lib/api-client";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";

/** For / against points on ideas and the office's support-threshold policy (B7.5). Contract: docs/api-v1.md "Ideas: for/against points" (branch claude/backend-phase7). */
export interface IdeaPoint { id: string; side: "for" | "against"; body: string; created_at: string; helpful_count: number }
export interface IdeaPoints { for: IdeaPoint[]; against: IdeaPoint[] }
const q = encodeURIComponent;

export const fetchPoints = (ref: string): Promise<OrPlanned<IdeaPoints>> => readOrPlanned(`/ideas/${q(ref)}/arguments`);
export const addPoint = (ref: string, side: "for" | "against", body: string, key: string) => api<unknown>(`/ideas/${q(ref)}/arguments`, { body: { side, body: body.trim() }, idempotencyKey: key });
export const setHelpful = (ref: string, id: string, on: boolean) => api<unknown>(`/ideas/${q(ref)}/arguments/${q(id)}/helpful`, { method: "PUT", body: { on } });

export interface IdeaPolicy { support_threshold: number | null; response_days: number | null }
export const fetchPolicy = (key: string): Promise<OrPlanned<IdeaPolicy>> => readOrPlanned(`/office/constituencies/${q(key)}/idea-policy`);
export const savePolicy = (key: string, p: { support_threshold: number; response_days: number }) => api<unknown>(`/office/constituencies/${q(key)}/idea-policy`, { method: "PUT", body: p });

/** The server's limits (3..100000 supporters, 3..90 days). */
export const POLICY_LIMITS = { threshold: [3, 100000], days: [3, 90] } as const;
export function policyErrors(threshold: string, days: string): { threshold?: true; days?: true } {
  const th = Number(threshold), d = Number(days);
  return {
    ...(!Number.isInteger(th) || th < POLICY_LIMITS.threshold[0] || th > POLICY_LIMITS.threshold[1] ? { threshold: true as const } : {}),
    ...(!Number.isInteger(d) || d < POLICY_LIMITS.days[0] || d > POLICY_LIMITS.days[1] ? { days: true as const } : {}),
  };
}

/** Progress toward a threshold as whole percent, capped at 100. */
export const progress = (supports: number, target: number) => (target > 0 ? Math.min(100, Math.floor((supports / target) * 100)) : 0);

/** Which "reply" state to show: the server computes it on read; the client only reads it. */
export const needsAnswer = (s: string | null | undefined) => s === "awaiting_response" || s === "overdue";

// Public feature flags (GET /features) --------------------------------------------------------------------------------------------------------
export interface FlagRow { key: string; enabled: boolean; data_status?: string }
export async function fetchFlags(): Promise<Record<string, boolean>> {
  try {
    const { data } = await api<FlagRow[]>("/features");
    return Object.fromEntries((Array.isArray(data) ? data : []).map((f) => [f.key, f.enabled === true]));
  } catch { return {}; }
}
