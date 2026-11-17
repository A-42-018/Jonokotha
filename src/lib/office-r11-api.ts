import { api, ApiError } from "@/lib/api-client";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";

/** Office tools of Release 1.1: weekly briefs (B7.9), exports (B7.10), release KPIs (B7.13). Contract: docs/api-v1.md "Briefs, exports, heatmaps, KPIs, read-aloud" (branch claude/backend-phase7). */
const q = encodeURIComponent;

// Weekly briefs ------------------------------------------------------------------------------------------------------------------------------------
export interface BriefPayload {
  received?: number | null; received_suppressed?: boolean; previous_week_received?: number | null; resolved?: number | null;
  top_categories?: { category: string; count: number }[]; hotspot_cells?: number; satisfaction_ratings?: number | null; satisfaction_average?: number | null;
  ideas_awaiting_response?: number; ideas_overdue?: number; consultations_open?: number; commitments_delayed?: number; period_days?: number; is_sample?: boolean;
}
export interface Brief { id: string; week_start: string; status: "draft" | "approved" | "withdrawn"; payload: BriefPayload; narrative_draft: string | null; narrative: string | null; generated_at: string; reviewed_at: string | null; shared_at: string | null; constituency?: string }
export const fetchBriefs = (): Promise<OrPlanned<Brief[]>> => readOrPlanned<Brief[]>("/office/briefs").then((r) => (r.kind === "ok" && !Array.isArray(r.data) ? { ...r, data: [] } : r));
export const reviewBrief = (id: string, decision: "approve" | "withdraw", narrative?: string) => api<unknown>(`/office/briefs/${q(id)}/review`, { body: { decision, ...(narrative?.trim() ? { narrative: narrative.trim() } : {}) } });
/** The server accepts a reviewed text of 10 to 1500 characters. */
export const narrativeOk = (s: string) => s.trim().length === 0 || (s.trim().length >= 10 && s.trim().length <= 1500);

// Exports ------------------------------------------------------------------------------------------------------------------------------------------
export type ExportKind = "cases" | "ideas";
export type ExportFormat = "csv" | "html";
export interface ExportParams { kind: ExportKind; constituency: string; days: number; format: ExportFormat }
export const EXPORT_DAYS = [7, 30, 90, 365] as const;

export function exportFilename(h: string | null, fallback: string): string {
  const m = /filename="?([^";]+)"?/i.exec(h ?? "");
  return m && /^[\w.-]+$/.test(m[1]) ? m[1] : fallback;
}
/** Plain fetch, not `api()`: the answer is a file. A failed answer is still the usual JSON error, so the screen can say why. */
export async function fetchExport(p: ExportParams, doFetch: typeof fetch = fetch): Promise<{ blob: Blob; filename: string }> {
  let res: Response;
  try { res = await doFetch(`/api/v1/office/exports?${new URLSearchParams({ kind: p.kind, constituency: p.constituency, days: String(p.days), format: p.format })}`); } catch { throw new ApiError("network", 0); }
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { code?: string; field_errors?: Record<string, string> } | null;
    throw new ApiError(j?.code ?? "internal_error", res.status, j?.field_errors ?? {});
  }
  return { blob: await res.blob(), filename: exportFilename(res.headers.get("Content-Disposition"), `jonokotha-${p.kind}.${p.format === "csv" ? "csv" : "html"}`) };
}

// Release 1.1 KPIs ---------------------------------------------------------------------------------------------------------------------------------
export interface Kpi { value: number | null; n?: number | null; suppressed?: boolean; reached?: number; definition: string }
export interface Release11Kpis { constituency: string | null; period_days: number; generated_at: string; min_group_size: number; kpis: Record<string, Kpi> }
export const KPI_ORDER = ["consultation_participants", "consultation_report_rate", "idea_threshold_on_time", "project_checkins", "priority_participants", "survey_responses", "channel_intake_share", "satisfaction_average", "area_alerts_sent", "commitments_delivered"] as const;
/** Rates are fractions (0 to 1) on the server; these ones are shown as a percent, the rest as a plain number or average. */
export const RATE_KPIS: readonly string[] = ["consultation_report_rate", "idea_threshold_on_time", "channel_intake_share", "commitments_delivered"];
export const fetchKpis = (constituency: string, days = 90): Promise<OrPlanned<Release11Kpis>> => readOrPlanned(`/office/kpis/release-1-1?${new URLSearchParams({ constituency, days: String(days) })}`);
