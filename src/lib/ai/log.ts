import { serviceClient } from "../supabase/service";

export type AiAgent = "intake" | "duplicate" | "routing" | "copilot" | "translation" | "insight" | "idea";
export type AiStatus = "ok" | "timeout" | "refused" | "invalid_output" | "error" | "fallback";

export interface AiRunRecord {
  agent: AiAgent; status: AiStatus; model: string; promptId: string; promptVersion: string; inputHash: string;
  output: unknown; latencyMs: number; usage: { input: number; output: number } | null; costUsd: number | null;
  issueId: string | null; actorId: string | null; requestId: string | null; errorClass: string | null;
}

/**
 * Writes one ai_runs row through log_ai_run(), which only the service role may call. Without the service-role key
 * (for example on a deployment that has not been given it yet) the run is written as one JSON log line instead.
 * Logging must never break the user's request, so this never throws.
 */
export async function logAiRun(r: AiRunRecord): Promise<string | null> {
  const sb = serviceClient();
  if (sb) {
    try {
      const { data, error } = await sb.rpc("log_ai_run", {
        p_agent: r.agent, p_status: r.status, p_model: r.model, p_prompt_id: r.promptId, p_prompt_version: r.promptVersion, p_input_hash: r.inputHash,
        p_output: r.output, p_latency_ms: r.latencyMs, p_token_usage: r.usage, p_cost_usd: r.costUsd,
        p_issue_id: r.issueId, p_actor_id: r.actorId, p_request_id: r.requestId, p_error_class: r.errorClass,
      });
      if (!error) return data as string;
    } catch { /* fall through to the log line */ }
  }
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", kind: "ai_run", agent: r.agent, status: r.status, model: r.model, prompt: `${r.promptId}@${r.promptVersion}`, ms: r.latencyMs, tokens: r.usage, request_id: r.requestId }));
  return null;
}
