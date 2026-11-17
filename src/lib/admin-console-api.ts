import { ApiError, api } from "@/lib/api-client";
import { UUID_RE } from "@/lib/admin-api";

const enc = encodeURIComponent;
const HTTP_RE = /^https?:\/\/\S+$/i;
export const isHttpUrl = (s: string) => HTTP_RE.test(s.trim());
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = (s: string) => ISO_DATE.test(s.trim()) && !Number.isNaN(Date.parse(s.trim()));

// ---- Boundaries: POST /admin/constituencies/import (docs/api-v1.md; up to 100 features, 5 MB) ----
export const MAX_FEATURES = 100;
export const MAX_BYTES = 5 * 1024 * 1024;
export interface BoundarySource { name: string; url: string; license: string; fetched_at: string }
export type BoundaryProblem = "name" | "url" | "license" | "date" | "json" | "type" | "empty" | "many" | "big" | "props";
const KEY_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;

/** Checks the form before it is sent. Returns the first problem per field; the server stays the judge of geometry. */
export function checkBoundary(src: BoundarySource, text: string): { problems: BoundaryProblem[]; geojson?: unknown; count: number } {
  const problems: BoundaryProblem[] = [];
  if (src.name.trim().length < 3) problems.push("name");
  if (!isHttpUrl(src.url)) problems.push("url");
  if (src.license.trim().length < 2) problems.push("license");
  if (!isIsoDate(src.fetched_at)) problems.push("date");
  let geojson: unknown;
  let count = 0;
  if (new Blob([text]).size > MAX_BYTES) problems.push("big");
  else {
    try { geojson = JSON.parse(text); } catch { problems.push("json"); }
  }
  if (geojson !== undefined) {
    const g = geojson as { type?: unknown; features?: unknown };
    if (g?.type !== "FeatureCollection" || !Array.isArray(g.features)) problems.push("type");
    else {
      count = g.features.length;
      if (count === 0) problems.push("empty");
      else if (count > MAX_FEATURES) problems.push("many");
      else if (g.features.some((f: { properties?: Record<string, unknown> }) => !f?.properties || !KEY_RE.test(String(f.properties.key ?? "")) || !f.properties.name_bn || !f.properties.name_en)) problems.push("props");
    }
  }
  return { problems, geojson, count };
}
export const importBoundaries = (source: BoundarySource, geojson: unknown) =>
  api<unknown>("/admin/constituencies/import", { body: { source: { ...source, name: source.name.trim(), url: source.url.trim(), license: source.license.trim() }, geojson } });

// ---- Representatives: PUT /admin/representatives/{id}/fields (value, source link and check date together) ----
export const REP_FIELDS = ["bio", "office_address", "office_phone", "office_email", "website", "education", "committees", "term_note"] as const;
export type RepField = (typeof REP_FIELDS)[number];
export const setRepField = (id: string, f: { field: RepField; value: string; source_url: string; checked_at: string }) =>
  api<unknown>(`/admin/representatives/${enc(id)}/fields`, { method: "PUT", body: { ...f, value: f.value.trim(), source_url: f.source_url.trim(), checked_at: f.checked_at.trim() } });
export { UUID_RE };

// ---- Users: POST /admin/accounts/{id} (role, status, reason of 5+ characters; not yourself) ----
export const ROLES = ["citizen", "staff", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const REASON_MIN = 5;
export const setAccount = (id: string, role: Role, status: "active" | "suspended", reason: string) =>
  api<unknown>(`/admin/accounts/${enc(id)}`, { body: { role, status, reason: reason.trim() } });

// ---- Staff invitation by an admin: POST /office/invitations (token shown once) ----
export const INVITE_ROLES = ["case_officer", "office_manager", "mp", "agency_liaison"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const invite = (email: string, constituency: string, role: InviteRole) =>
  api<{ id: string; expires_at: string; invite_token: string; emailed: boolean }>("/office/invitations", { body: { email: email.trim(), constituency: constituency.trim(), role } }).then((r) => r.data);

// ---- Knowledge: POST /admin/knowledge/ingest {rules?}: rebuild the index (idempotent) ----
export const ingestKnowledge = () => api<Record<string, unknown>>("/admin/knowledge/ingest", { body: { rules: [] } }).then((r) => r.data);

// ---- AI evaluation results: GET /admin/ai/evals ----
export interface AiEval { id: string; dataset_name: string; dataset_size: number; model: string | null; prompt_versions: Record<string, string>; metrics: Record<string, number | string | null>; notes: string | null; created_at: string }
export const fetchEvals = () => api<AiEval[]>("/admin/ai/evals").then((r) => r.data);

// ---- Health: GET /api/health is the only documented probe, public, `{ok}`; 503 when the database is unreachable ----
export type Health = "ok" | "down" | "offline";
export async function fetchHealth(): Promise<Health> {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    return r.ok ? "ok" : "down";
  } catch {
    return "offline";
  }
}
export const isMissing = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 501);
