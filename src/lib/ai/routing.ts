import { z } from "zod";
import { ApiError, fromDbError, type Ctx } from "../api";
import { can } from "../auth";
import { embed, embeddingsConfigured, EmbeddingError, issueEmbeddingText, toVector } from "./embeddings";
import { ROUTING_V1 } from "./prompts";
import { runAgent } from "./run";
import { redactPii } from "../pii";
import { serviceClient } from "../supabase/service";

interface Chunk { chunk_id: string; source_id: string; source_name: string; source_url: string | null; fetched_at: string | null; locale: string; content: string; agency_id: string | null; agency_key: string | null; score: number; method: "semantic" | "lexical" }

/** Minimum retrieval score for any suggestion. Lexical: an agency serving the category scores at least 0.6. Semantic: cosine; tune on the eval set. */
export const minScore = (m: "semantic" | "lexical") => (m === "semantic" ? Number(process.env.ROUTING_MIN_SCORE_SEMANTIC ?? 0.5) : Number(process.env.ROUTING_MIN_SCORE_LEXICAL ?? 0.6));

const Pick = z.object({ agency_key: z.string().max(60).nullable(), reason: z.string().trim().max(300), confidence: z.number().min(0).max(1), source_ids: z.array(z.string().regex(/^S\d{1,2}$/)).max(6) });

/**
 * Graph evidence (migration 0091): for each candidate agency, how many earlier issues of the same category in the same constituency were routed to it,
 * found by walking graph_edges. Shown to staff next to the suggestion and never used as a citation. Any failure (for example the migration is not applied yet) gives {}.
 */
async function graphSupport(c: Ctx, issueId: string, agencyIds: string[]): Promise<Record<string, number>> {
  try {
    const { data, error } = await c.sb.rpc("agency_graph_evidence", { p_issue: issueId, p_agencies: agencyIds });
    if (error) return {};
    return Object.fromEntries(((data ?? []) as { agency_id: string; similar_routed: number }[]).map((r) => [r.agency_id, r.similar_routed]));
  } catch { return {}; }
}

/**
 * Routing Agent (RAG, masterplan §17.4). Retrieves agency and service-rule chunks for one issue, then proposes an agency WITH
 * citations (source name, URL, date checked). No chunk above the threshold, or no valid citation, means "no confident
 * suggestion": nothing is stored and the office routes by hand. The suggestion is only a pending `ai_suggestions` row; forwarding
 * is a separate staff action.
 */
export async function suggestRouting(c: Ctx, ref: string) {
  const { data: i } = await c.sb.from("issues").select("id,title,description,area,category,constituency_id,assigned_to").eq("ref", ref).maybeSingle();
  if (!i) throw new ApiError("not_found", "Issue not found.");
  const where = { constituencyId: i.constituency_id, assignedTo: i.assigned_to };
  if (!can(c.actor, "forward", where) && !can(c.actor, "update", where)) throw new ApiError("forbidden", "You are not allowed to route this issue.");
  const svc = serviceClient();
  if (!svc) throw new ApiError("unavailable", "AI suggestions are not configured on this server.");

  let vec: string | null = null;
  if (embeddingsConfigured()) { try { vec = toVector((await embed([issueEmbeddingText(i)]))[0]); } catch (e) { if (!(e instanceof EmbeddingError)) throw e; } }
  const { data, error } = await c.sb.rpc("retrieve_knowledge", { p_issue: i.id, p_embedding: vec, p_limit: 6 });
  if (error) throw fromDbError(error);
  const all = (data ?? []) as Chunk[];
  const method = all[0]?.method ?? (vec ? "semantic" : "lexical");
  const strong = all.filter((r) => r.agency_id && r.agency_key && r.score >= minScore(method));
  if (!strong.length) return { available: true, suggestion: null, reason: "no_confident_match", method };

  // Optional model choice among the retrieved sources; anything outside them is discarded.
  const labelled = strong.map((r, n) => ({ ...r, label: `S${n + 1}` }));
  let chosen = labelled[0], reason = "", note: "retrieval" | "model" = "retrieval", runId: string | null = null, conf: number | null = null;
  const out = await runAgent({ agent: "routing", prompt: ROUTING_V1, schema: Pick, maxTokens: 400, issueId: i.id, actorId: c.user!.id, requestId: c.rid,
    input: `REPORT: ${redactPii(`${i.title}\n${i.description}\n${i.area ?? ""}`).text.slice(0, 1500)}\n\nSOURCES:\n${labelled.map((r) => `${r.label} (agency ${r.agency_key}; ${r.source_name}): ${r.content}`).join("\n")}`,
    tool: { name: "submit_routing", description: "Return the chosen agency key, reason, confidence and supporting source ids." } });
  if (out.ok) {
    const ids = new Set(out.data.source_ids), pick = labelled.find((r) => ids.has(r.label) && r.agency_key === out.data.agency_key);
    if (pick && out.data.agency_key) { chosen = pick; reason = out.data.reason; note = "model"; runId = out.runId; conf = out.data.confidence; }
  }
  const cites = labelled.filter((r) => r.agency_key === chosen.agency_key).map((r) => ({ chunk_id: r.chunk_id, source_id: r.source_id, source_name: r.source_name, source_url: r.source_url, fetched_at: r.fetched_at, locale: r.locale }));
  if (!cites.length) return { available: true, suggestion: null, reason: "no_valid_citation", method };
  const { data: ag } = await svc.from("agencies").select("id,key,name_bn,name_en,url").eq("id", chosen.agency_id!).single();
  const graph = await graphSupport(c, i.id, [...new Set(labelled.map((r) => r.agency_id!))]);
  const payload = { graph_support: graph[chosen.agency_id!] ?? 0, agency_id: ag!.id, agency_key: ag!.key, agency_name_bn: ag!.name_bn, agency_name_en: ag!.name_en, reason: reason || null, method, retrieval_score: Number(chosen.score.toFixed(3)), chosen_by: note,
    confidence_note: note === "model" ? "model self-report, not calibrated" : "no confidence figure: retrieval score only" };
  const { data: ins, error: e2 } = await svc.from("ai_suggestions").insert({ ai_run_id: runId, target_type: "issue", target_id: i.id, suggestion_type: "routing", payload, citations: cites, confidence: conf }).select("id").single();
  if (e2) throw new ApiError("internal_error", "The suggestion could not be saved.");
  return { available: true, suggestion: { id: ins.id, ...payload, citations: cites, confidence: conf }, method };
}
