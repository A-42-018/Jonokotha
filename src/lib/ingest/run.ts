import type { SupabaseClient } from "@supabase/supabase-js";
import { politeFetch, type FetchDeps } from "./fetcher";
import { helplineEvidence, parseByKind } from "./parse";

export interface DueSource { id: string; key: string; url: string; kind: string; license: string; min_interval_ms: number; max_bytes: number; is_demo: boolean }
export interface RunSummary { key: string; status: string; staged?: number; rejected?: number; error?: string }

/**
 * Runs one source: fetch politely, record the run (lineage: source, licence, fetch date, checksum) and stage records for review.
 * `sb` must be the service-role client; every database step is a function that refuses anyone else.
 * `helplineNumbers`: for kind "helpline", the numbers whose presence on the page is recorded as evidence.
 */
export async function runSource(sb: SupabaseClient, s: DueSource, deps: FetchDeps = {}, helplineNumbers: string[] = []): Promise<RunSummary> {
  const { data: run, error } = await sb.rpc("ingest_begin_run", { p_source: s.id });
  if (error || !run) return { key: s.key, status: "error", error: "could not open run" };
  const finish = async (status: string, extra: Record<string, unknown> = {}) => {
    await sb.rpc("ingest_finish_run", { p_run: run, p_status: status, p_http: null, p_bytes: null, p_checksum: null, p_robots: null, p_error: null, ...extra });
  };
  const { data: src } = await sb.from("ingestion_sources").select("enabled, license_ok").eq("id", s.id).single();
  if (!src?.enabled || !src?.license_ok) return { key: s.key, status: "blocked_licence" };   // begin_run already closed it

  const r = await politeFetch(s.url, { minIntervalMs: s.min_interval_ms, maxBytes: s.max_bytes }, deps);
  const common = { p_http: r.httpStatus ?? null, p_bytes: r.bytes ?? null, p_robots: r.robotsAllowed, p_error: r.error ?? null };
  if (r.outcome !== "ok") { await finish(r.outcome, common); return { key: s.key, status: r.outcome, error: r.error }; }

  let records: { key: string; payload: Record<string, unknown> }[] = [];
  try {
    if (s.kind === "helpline") records = helplineNumbers.map((n) => ({ key: `helpline-${n}`, payload: { number: n, ...helplineEvidence(r.body!, n), checksum: r.checksum, source_url: s.url } }));
    else records = parseByKind(s.kind, r.body!, s.url, r.contentType);
  } catch (e) { await finish("error", { ...common, p_checksum: r.checksum, p_error: `parse: ${(e as Error).message}`.slice(0, 280) }); return { key: s.key, status: "error", error: "parse failed" }; }

  const { data: fin } = await sb.rpc("ingest_finish_run", { p_run: run, p_status: "ok", p_checksum: r.checksum, ...common });
  const status = (fin as { status?: string } | null)?.status ?? "ok";
  let staged = 0, rejected = 0;
  if (records.length && status === "ok") {
    const { data: st } = await sb.rpc("ingest_stage_records", { p_run: run, p_records: records });
    staged = (st as { staged?: number } | null)?.staged ?? 0; rejected = (st as { rejected_personal_data?: number } | null)?.rejected_personal_data ?? 0;
  }
  return { key: s.key, status, staged, rejected };
}

/** The scheduled job: every enabled, licence-checked source whose refresh is due. Sequential on purpose (politeness). */
export async function runDueSources(sb: SupabaseClient, deps: FetchDeps = {}): Promise<RunSummary[]> {
  const { data, error } = await sb.rpc("ingest_due_sources");
  if (error) return [{ key: "*", status: "error", error: "could not list sources" }];
  const out: RunSummary[] = [];
  for (const s of (data ?? []) as DueSource[]) out.push(await runSource(sb, s, deps, s.kind === "helpline" ? await trackedHelplineNumbers(sb) : []));
  return out;
}

async function trackedHelplineNumbers(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb.from("helplines").select("number").neq("verification_status", "rejected");
  return [...new Set((data ?? []).map((h) => h.number as string))];
}
