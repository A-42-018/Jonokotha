import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { WEEKLY_BRIEF_V1 } from "./ai/prompts";
import { runAgent } from "./ai/run";
import { narrativeIsGrounded } from "./analytics";

/**
 * Weekly insight briefs (B7.9). The job creates one DRAFT per area with an active office per week (counts only, 5-person rule, in the database).
 * When a model key exists the Insight Agent drafts the prose from those counts; the prose is kept only when every number in it occurs in the data.
 * The draft is visible to the reviewing roles only; a person approves (and may edit) before the rest of the office sees it. The AI shares nothing.
 */
export async function runWeeklyBriefs(sb: SupabaseClient): Promise<{ created: number; drafted: number }> {
  const { data, error } = await sb.rpc("generate_weekly_briefs");
  if (error) throw error;
  const rows = (data ?? []) as { id: string; constituency_key: string; payload: Record<string, unknown> }[];
  let drafted = 0;
  for (const r of rows) {
    const out = await runAgent({ agent: "insight", prompt: WEEKLY_BRIEF_V1, schema: z.object({ narrative: z.string().trim().min(10).max(1200) }), input: JSON.stringify(r.payload).slice(0, 6000), maxTokens: 500,
      tool: { name: "submit_narrative", description: "Return the short weekly note." } });
    if (out.ok && narrativeIsGrounded(out.data.narrative, r.payload)) {
      const { error: e } = await sb.rpc("set_brief_draft", { p_id: r.id, p_text: out.data.narrative });
      if (!e) drafted++;
    }
  }
  return { created: rows.length, drafted };
}

/** Hourly: close what is due, remind the office about idea responses, alert on channel costs, trim old messages, delete files of erased accounts. */
export async function runRelease11Maintenance(sb: SupabaseClient): Promise<Record<string, unknown>> {
  const call = async (fn: string) => { const { data, error } = await sb.rpc(fn); if (error) throw error; return data; };
  const out: Record<string, unknown> = {};
  out.consultations_closed = await call("close_due_consultations");
  out.surveys_closed = await call("close_due_surveys");
  out.priority_rounds_closed = await call("close_due_priority_rounds");
  out.idea_reminders = await call("idea_response_reminders");
  out.channel_cost_alerts = await call("channel_cost_alerts");
  out.channel_messages_purged = await call("purge_channel_messages");
  const { data: files } = await sb.rpc("take_file_deletions", { p_limit: 100 });
  const list = (files ?? []) as { id: string; bucket: string; path: string }[];
  const done: string[] = [];
  for (const f of list) { const r = await sb.storage.from(f.bucket).remove([f.path]); if (!r.error) done.push(f.id); }
  if (done.length) await sb.rpc("finish_file_deletions", { p_ids: done });
  out.files_deleted = done.length;
  return out;
}
