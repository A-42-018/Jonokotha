import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";

// Phase 5 / B5.8: job administration and privacy-conscious product events.
export async function listJobs(c: Ctx): Promise<Result> {
  if (c.actor?.role !== "admin") throw new ApiError("forbidden", "Administrators only.");
  const q = parse(z.object({ status: z.enum(["queued", "running", "done", "failed", "dead"]).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }), Object.fromEntries(c.url.searchParams));
  let s = c.sb.from("background_jobs").select("id,kind,status,attempts,max_attempts,run_at,last_error,created_at,finished_at").order("created_at", { ascending: false }).limit(q.limit);
  if (q.status) s = s.eq("status", q.status);
  const { data, error } = await s;
  if (error) throw fromDbError(error);
  return { data: data ?? [], page: { next_cursor: null, limit: q.limit } };
}
export async function requeueJob(c: Ctx): Promise<Result> {
  if (!z.uuid().safeParse(c.params.id).success) throw new ApiError("not_found", "Not found.");
  return { data: await rpc(c.sb, "requeue_job", { p_id: c.params.id }) };
}

export const EVENT_NAMES = ["report_started", "report_submitted", "idea_posted", "poll_voted", "question_asked", "search_used", "offline_report_queued", "install_prompt_shown", "voice_used", "language_switched"] as const;
/** Counts an event. Accepts only a name and a language: no user id, no address, no device, no URL is read or stored. Works signed out. */
export async function trackEvent(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ name: z.enum(EVENT_NAMES), lang: z.enum(["bn", "en"]).default("bn") }), c.body);
  await c.sb.rpc("track_product_event", { p_name: b.name, p_lang: b.lang });
  return { status: 202, data: { counted: true } };
}
export async function eventCounts(c: Ctx): Promise<Result> {
  if (c.actor?.role !== "admin") throw new ApiError("forbidden", "Administrators only.");
  const q = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }), Object.fromEntries(c.url.searchParams));
  const { data, error } = await c.sb.from("product_events").select("day,name,lang,count").gte("day", new Date(Date.now() - q.days * 86_400_000).toISOString().slice(0, 10)).order("day", { ascending: false }).limit(2000);
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
