import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "../supabase/service";
import { contentHash, embed, embeddingModel, EmbeddingError, issueEmbeddingText, toVector } from "./embeddings";
import { logAiRun } from "./log";
import { hashInput } from "./run";

/** Cosine similarity at or above which two reports in the same office and category are shown as possible duplicates. Tuned with the eval set (task 1.10). */
export const DUPLICATE_MIN_SCORE = Number(process.env.DUPLICATE_MIN_SCORE ?? 0.8);

/**
 * Stores the embedding of one issue (redacted public text). Best-effort and idempotent: unchanged text is skipped, and any
 * failure only means the issue has no embedding yet, never that a report is lost. Server-only (service role).
 */
export async function indexIssue(issueId: string): Promise<"indexed" | "unchanged" | "skipped"> {
  const sb = serviceClient();
  if (!sb) return "skipped";
  const { data: issue } = await sb.from("issues").select("id,title,description,area").eq("id", issueId).maybeSingle();
  if (!issue) return "skipped";
  const text = issueEmbeddingText(issue), hash = contentHash(text), model = embeddingModel();
  const { data: cur } = await sb.from("issue_embeddings").select("content_hash").eq("issue_id", issueId).eq("model", model).maybeSingle();
  if (cur?.content_hash === hash) return "unchanged";
  const started = Date.now();
  try {
    const [v] = await embed([text]);
    await sb.from("issue_embeddings").upsert({ issue_id: issueId, model, embedding: toVector(v), content_hash: hash }, { onConflict: "issue_id,model" }).throwOnError();
    return "indexed";
  } catch (e) {
    if (e instanceof EmbeddingError && e.kind === "not_configured") return "skipped";
    await logAiRun({ agent: "duplicate", status: e instanceof EmbeddingError && e.kind === "timeout" ? "timeout" : "error", model, promptId: "embed", promptVersion: "v1", inputHash: hashInput(text),
      output: null, latencyMs: Date.now() - started, usage: null, costUsd: null, issueId, actorId: null, requestId: null, errorClass: e instanceof EmbeddingError ? e.kind : "error" });
    return "skipped";
  }
}

export interface DuplicateCandidate { suggestionId: string | null; issueId: string; ref: string; score: number; reasons: Record<string, unknown> }

/**
 * Candidates for one issue, for office staff. The search runs as the signed-in user (find_similar_issues checks scope), then
 * each candidate becomes a pending `ai_suggestions` row that the office can Accept, Edit or Dismiss. Calling it again does not
 * duplicate suggestions. Returns { candidates: [], available: false } when embeddings are not available, so the office
 * simply sees no suggestion and uses its manual search.
 */
export async function suggestDuplicates(sb: SupabaseClient, issueId: string, ctx: { actorId?: string | null; requestId?: string | null } = {}): Promise<{ available: boolean; candidates: DuplicateCandidate[] }> {
  const svc = serviceClient();
  const started = Date.now(), model = embeddingModel();
  if (!svc) return { available: false, candidates: [] };
  await indexIssue(issueId);
  const { data, error } = await sb.rpc("find_similar_issues", { p_issue: issueId, p_limit: 5, p_min_score: DUPLICATE_MIN_SCORE });
  if (error) throw error;
  const rows = (data ?? []) as { issue_id: string; ref: string; score: number; reasons: Record<string, unknown> }[];

  const runId = await logAiRun({ agent: "duplicate", status: "ok", model, promptId: "duplicate-search", promptVersion: "v1", inputHash: hashInput(issueId),
    output: rows.map((r) => ({ ref: r.ref, score: Number(r.score) })), latencyMs: Date.now() - started, usage: null, costUsd: null, issueId, actorId: ctx.actorId ?? null, requestId: ctx.requestId ?? null, errorClass: null });

  const { data: existing } = await svc.from("ai_suggestions").select("id,payload,decision").eq("target_type", "issue").eq("target_id", issueId).eq("suggestion_type", "duplicate");
  const have = new Map((existing ?? []).map((s) => [(s.payload as { master_id?: string }).master_id, s]));
  const candidates: DuplicateCandidate[] = [];
  for (const r of rows) {
    let suggestionId = have.get(r.issue_id)?.id ?? null;
    if (!suggestionId) {
      const { data: ins } = await svc.from("ai_suggestions").insert({
        ai_run_id: runId, target_type: "issue", target_id: issueId, suggestion_type: "duplicate",
        payload: { master_id: r.issue_id, master_ref: r.ref, score: Number(r.score), reasons: r.reasons }, confidence: Number(r.score),
        citations: [{ type: "issue", ref: r.ref }],
      }).select("id").single();
      suggestionId = ins?.id ?? null;
    }
    candidates.push({ suggestionId, issueId: r.issue_id, ref: r.ref, score: Number(r.score), reasons: r.reasons });
  }
  return { available: true, candidates };
}

/** Called right after a report is stored: index it, but never hold the citizen's request for more than a few seconds. */
export async function indexIssueByRef(ref: string, maxMs = 3000): Promise<void> {
  const sb = serviceClient();
  if (!sb) return;
  const work = (async () => {
    const { data } = await sb.from("issues").select("id").eq("ref", ref).maybeSingle();
    if (data) await indexIssue(data.id);
  })().catch(() => undefined);
  await Promise.race([work, new Promise((r) => setTimeout(r, maxMs))]);
}
