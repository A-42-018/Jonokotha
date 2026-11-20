import { z } from "zod";
import { redactPii } from "../pii";
import { CHUNK_CONTEXT_V1 } from "./prompts";
import { runAgent } from "./run";

const Ctx = z.object({ context: z.string().trim().min(10).max(300) });

/** Model-written context lines are opt-in (KNOWLEDGE_CONTEXT_LLM=1): they cost one short call per chunk and only run during ingestion. */
export const contextLlmEnabled = () => process.env.KNOWLEDGE_CONTEXT_LLM === "1" && !!process.env.ANTHROPIC_API_KEY;

/**
 * Anthropic-style contextual retrieval: one short model-written line that situates a passage inside its document.
 * Returns null on any failure so the caller keeps the deterministic header. A line that contains a digit string the
 * document does not contain (an invented phone number or figure) is rejected.
 */
export async function modelContext(doc: { title: string; text: string }, passage: string): Promise<string | null> {
  const out = await runAgent({
    agent: "ingest", prompt: CHUNK_CONTEXT_V1, schema: Ctx, maxTokens: 150, timeoutMs: 15_000,
    input: `DOCUMENT: ${redactPii(`${doc.title}\n${doc.text}`).text.slice(0, 3000)}\n\nPASSAGE: ${redactPii(passage).text.slice(0, 1200)}`,
    tool: { name: "submit_context", description: "Return the one-line context for the passage." },
  });
  if (!out.ok) return null;
  const known = new Set((`${doc.title} ${doc.text}`.match(/\d+/g) ?? []));
  for (const n of out.data.context.match(/\d+/g) ?? []) if (!known.has(n)) return null;
  return out.data.context;
}
