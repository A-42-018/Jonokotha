import { createHash } from "node:crypto";
import { redactPii } from "../pii";

/**
 * Hosted BGE-M3 embeddings (multilingual, strong Bangla), 1024 dimensions. The provider is any service with an
 * OpenAI-compatible POST {base}/embeddings (DeepInfra, Together, Fireworks, a self-hosted TEI server...), chosen by env so
 * the vendor can change without code changes:
 *   EMBEDDINGS_BASE_URL  e.g. https://api.deepinfra.com/v1/openai
 *   EMBEDDINGS_API_KEY   server-only
 *   EMBEDDINGS_MODEL     default BAAI/bge-m3
 * Text is redacted here as well, so no caller can send personal data by mistake (§12.2).
 */
export const EMBEDDING_DIM = 1024;
export const embeddingModel = () => process.env.EMBEDDINGS_MODEL || "BAAI/bge-m3";
export const embeddingsConfigured = () => !!(process.env.EMBEDDINGS_BASE_URL && process.env.EMBEDDINGS_API_KEY);
export const contentHash = (text: string) => createHash("sha256").update(text).digest("hex");

export class EmbeddingError extends Error {
  constructor(public kind: "not_configured" | "timeout" | "http" | "bad_response", message: string) { super(message); }
}

/** The only text that is ever embedded for an issue: redacted public fields. */
export function issueEmbeddingText(i: { title: string; description: string; area?: string | null }) {
  return redactPii([i.title, i.description, i.area ?? ""].filter(Boolean).join("\n")).text.slice(0, 2000);
}

export async function embed(texts: string[], opts: { timeoutMs?: number } = {}): Promise<number[][]> {
  if (!embeddingsConfigured()) throw new EmbeddingError("not_configured", "Embeddings are not configured.");
  if (!texts.length) return [];
  const url = `${process.env.EMBEDDINGS_BASE_URL!.replace(/\/$/, "")}/embeddings`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.EMBEDDINGS_API_KEY}` },
      body: JSON.stringify({ model: embeddingModel(), input: texts.map((t) => redactPii(t).text), encoding_format: "float" }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
  } catch (e) {
    throw new EmbeddingError(/timeout|abort/i.test(String((e as Error)?.name)) ? "timeout" : "http", "The embedding service could not be reached.");
  }
  if (!res.ok) throw new EmbeddingError("http", `The embedding service answered ${res.status}.`);
  const json = (await res.json().catch(() => null)) as { data?: { index?: number; embedding?: number[] }[] } | null;
  const rows = json?.data;
  if (!Array.isArray(rows) || rows.length !== texts.length) throw new EmbeddingError("bad_response", "Unexpected embedding response.");
  const out = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((r) => r.embedding);
  for (const v of out) if (!Array.isArray(v) || v.length !== EMBEDDING_DIM || v.some((x) => typeof x !== "number" || !Number.isFinite(x)) || v.every((x) => x === 0)) {
    throw new EmbeddingError("bad_response", `Expected ${EMBEDDING_DIM} numbers per embedding.`);
  }
  return out as number[][];
}

/** pgvector text form. */
export const toVector = (v: number[]) => `[${v.join(",")}]`;
