import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiError, DataStatus } from "./api";

/**
 * Capability labels and feature flags (B5.3, B5.13; masterplan §2.9, §31 #20).
 * Every /api/v1 response carries `data_status`: live | sample | demo | planned. A record that says so itself (is_sample / is_demo) wins;
 * a route behind a flag takes the flag's label when it is not live.
 */
export function inferDataStatus(data: unknown): DataStatus {
  const rows = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
  let sample = false;
  for (const r of rows.slice(0, 50)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (o.is_demo === true) return "demo";
    if (o.is_sample === true) sample = true;
  }
  return sample ? "sample" : "live";
}

type Flag = { enabled: boolean; data_status: DataStatus };
let cache: { at: number; flags: Map<string, Flag> } | null = null;
export const clearFlagCache = () => { cache = null; };

/** Flag state from the database (cached 15 s per server instance). Unknown flags and read errors count as "no flag": the route stays on. */
export async function flagState(sb: SupabaseClient, key: string): Promise<Flag | null> {
  if (!cache || Date.now() - cache.at > 15_000) {
    const { data, error } = await sb.rpc("public_feature_flags");
    if (error || !Array.isArray(data)) return null;
    cache = { at: Date.now(), flags: new Map((data as { key: string; enabled: boolean; data_status: DataStatus }[]).map((f) => [f.key, { enabled: f.enabled, data_status: f.data_status }])) };
  }
  return cache.flags.get(key) ?? null;
}

/** For server code that must refuse when a feature is off (jobs, agents). */
export async function featureOn(sb: SupabaseClient, key: string): Promise<boolean> {
  const f = await flagState(sb, key);
  return f ? f.enabled : true;
}

const SECURITY_KIND: Partial<Record<ApiError["code"], string>> = { rate_limited: "rate_limit", unauthenticated: "auth_failure", forbidden: "permission_denied" };

/** Writes a security event for the admin alerts feed. Never throws; the IP is stored only as a salted one-way hash. */
export async function recordSecurityEvent(sb: SupabaseClient | null, e: ApiError, route: string, ip: string) {
  const kind = e.fieldErrors?._ === "cross_site" ? "csrf_blocked" : SECURITY_KIND[e.code];
  if (!sb || !kind) return;
  const salt = process.env.SECURITY_HASH_SALT ?? "jonokotha";
  const hash = createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
  try { await sb.rpc("record_security_event", { p_kind: kind, p_route: route, p_ip_hash: hash, p_detail: e.fieldErrors?._ ?? e.code }); } catch { /* monitoring must never break a request */ }
}
