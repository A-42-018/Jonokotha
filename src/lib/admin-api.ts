import { api } from "@/lib/api-client";

const enc = encodeURIComponent;

// Moderation queue: reported public content and ideas / public questions waiting for a first review. Excerpts only.
export interface QueueItem { kind: "report" | "review"; target_type: "issue" | "idea" | "question" | "media"; target_ref: string; excerpt: string | null; reasons: string[]; report_count: number; oldest: string }
export const fetchModerationQueue = () => api<QueueItem[]>("/admin/moderation?limit=50").then((r) => r.data);

export type ModAction = "hide" | "dismiss" | "publish" | "reject";
/** Reported items: hide or dismiss the report. Waiting ideas and questions: publish or reject. A reason is always sent. */
export function moderate(item: QueueItem, action: ModAction, reason: string) {
  const body = { type: item.target_type, ref: item.target_ref, action, reason: reason.trim() };
  return api<unknown>(item.kind === "report" ? "/admin/moderation/items" : "/admin/moderation/review", { body });
}
export const actionsFor = (k: QueueItem["kind"]): ModAction[] => (k === "report" ? ["dismiss", "hide"] : ["publish", "reject"]);

export type RepStatus = "pending" | "verified" | "revoked";
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const verifyRepresentative = (id: string, status: RepStatus, sourceUrl: string, note: string) =>
  api<unknown>(`/admin/representatives/${enc(id)}/verify`, { body: { status, ...(sourceUrl.trim() ? { source_url: sourceUrl.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) } });

export interface AiRun { id: string; agent: string; model: string | null; prompt_id: string | null; prompt_version: string | null; status: string; decision: string | null; latency_ms: number | null; cost_usd: number | null; created_at: string }
export async function fetchAiRuns(cursor?: string) {
  const q = new URLSearchParams({ limit: "25" });
  if (cursor) q.set("cursor", cursor);
  const { data, page } = await api<AiRun[]>(`/admin/ai/runs?${q}`);
  return { items: data, next: page?.next_cursor ?? null };
}

export interface AuditRow { id: string; actor_role: string | null; actor_kind: string | null; action: string; resource_type: string; resource_id: string | null; created_at: string }
export async function fetchAudit(cursor?: string) {
  const q = new URLSearchParams({ limit: "25" });
  if (cursor) q.set("cursor", cursor);
  const { data, page } = await api<AuditRow[]>(`/admin/audit?${q}`);
  return { items: data, next: page?.next_cursor ?? null };
}

export interface Kpis { period_days: number; generated_at: string; min_group_size: number; metrics: Record<string, { value?: number | null; sent_pct?: number | null; suppressed?: boolean; definition: string; [k: string]: unknown }> }
export const fetchKpis = (days = 30) => api<Kpis>(`/admin/kpis?days=${days}`).then((r) => r.data);
/** The headline number of a metric: its `value`, or the delivery share. null when hidden (group too small). */
export const kpiValue = (m: Kpis["metrics"][string]) => (m.suppressed ? null : (m.value ?? m.sent_pct ?? null));
