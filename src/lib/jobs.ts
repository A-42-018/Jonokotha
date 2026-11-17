import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverDue } from "./notify/deliver";
import { scanForMalware } from "./media";
import { runRelease11Maintenance, runWeeklyBriefs } from "./briefs";

/**
 * Background job runner (B5.8; masterplan §10.1, §20). One queue (background_jobs, migration 0034) for notifications, media processing,
 * AI tasks and ingestion. A worker claims due jobs, runs the handler for the job kind, and reports success or failure; failures retry with
 * exponential backoff and land in the dead-letter state after max_attempts (admin can requeue). Handlers must be idempotent.
 * Run it from a scheduled route (POST /api/internal/jobs/run, daily on Vercel Hobby, more often elsewhere) or opportunistically.
 */
export type JobKind = "notify_deliver" | "media_scan" | "ai_task" | "ingest" | "poll_maintenance" | "purge" | "release11_maintenance" | "weekly_briefs";
export interface Job { id: string; kind: JobKind; payload: Record<string, unknown>; attempts: number; max_attempts: number }
export type Handler = (sb: SupabaseClient, payload: Record<string, unknown>) => Promise<unknown>;

export const HANDLERS: Record<JobKind, Handler> = {
  notify_deliver: async () => deliverDue(25),
  poll_maintenance: async (sb) => {
    const closed = await sb.rpc("close_due_polls"); if (closed.error) throw closed.error;
    const rem = await sb.rpc("poll_closing_reminders"); if (rem.error) throw rem.error;
    return { closed: closed.data, reminders: rem.data };
  },
  purge: async (sb) => {
    const ret = await sb.rpc("run_retention"); if (ret.error) throw ret.error;
    const sec = await sb.rpc("purge_security_events"); if (sec.error) throw sec.error;
    const paths = ((ret.data as { storage_paths?: string[] } | null)?.storage_paths) ?? [];
    if (paths.length) await sb.storage.from("issue-media").remove(paths);
    return { security_events_purged: sec.data, photos_removed: paths.length };
  },
  release11_maintenance: async (sb) => runRelease11Maintenance(sb),
  weekly_briefs: async (sb) => runWeeklyBriefs(sb),
  // Photos stored while no scanner was configured are scanned when one appears. Fails closed: an infected file is marked and made private.
  media_scan: async (sb) => {
    if (!process.env.MALWARE_SCAN_URL) return { skipped: "no scanner configured" };
    const { data: rows } = await sb.from("issue_media").select("id,storage_path,media_type").eq("scan_status", "not_scanned").eq("upload_status", "ready").limit(20);
    let clean = 0, infected = 0;
    for (const m of rows ?? []) {
      const dl = await sb.storage.from(m.media_type === "video" ? "issue-video" : "issue-media").download(m.storage_path);
      if (dl.error || !dl.data) continue;
      try { await scanForMalware(new Uint8Array(await dl.data.arrayBuffer())); await sb.from("issue_media").update({ scan_status: "clean" }).eq("id", m.id); clean++; }
      catch { await sb.from("issue_media").update({ scan_status: "infected", visibility: "private", moderation_status: "rejected" }).eq("id", m.id); infected++; }
    }
    return { clean, infected };
  },
  // AI tasks and ingestion jobs are enqueued by their features with a payload; the handler is registered here so retries and dead letters apply.
  ai_task: async () => ({ skipped: "no handler registered for this task" }),
  ingest: async () => ({ skipped: "no ingestion source configured" }),
};

export interface RunSummary { claimed: number; done: number; failed: number; dead: number }

/** Claims and runs up to `limit` due jobs. A handler error is recorded and retried; this function itself does not throw per job. */
export async function runJobs(sb: SupabaseClient, limit = 10, worker = "http", handlers: Partial<Record<JobKind, Handler>> = HANDLERS): Promise<RunSummary> {
  await sb.rpc("ensure_periodic_jobs");
  const { data, error } = await sb.rpc("claim_jobs", { p_limit: limit, p_worker: worker });
  if (error) throw error;
  const out: RunSummary = { claimed: 0, done: 0, failed: 0, dead: 0 };
  for (const j of (data ?? []) as Job[]) {
    out.claimed++;
    const h = handlers[j.kind];
    let ok = true, err = "";
    try { if (!h) throw new Error("no handler for kind"); await h(sb, j.payload ?? {}); } catch (e) { ok = false; err = String((e as Error)?.message ?? e).slice(0, 300); }
    const { data: st } = await sb.rpc("finish_job", { p_id: j.id, p_ok: ok, p_error: ok ? null : err });
    if (st === "done") out.done++; else if (st === "dead") out.dead++; else out.failed++;
  }
  return out;
}
