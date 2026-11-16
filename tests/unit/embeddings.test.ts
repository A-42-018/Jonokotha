import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIM, EmbeddingError, embed, embeddingsConfigured, issueEmbeddingText, toVector } from "@/lib/ai/embeddings";

const vec = (n = EMBEDDING_DIM) => Array.from({ length: n }, (_, i) => i / n);
const ok = (rows: unknown[]) => new Response(JSON.stringify({ data: rows }), { status: 200 });

beforeEach(() => { process.env.EMBEDDINGS_BASE_URL = "https://emb.example.test/v1/"; process.env.EMBEDDINGS_API_KEY = "k"; });
afterEach(() => { vi.restoreAllMocks(); delete process.env.EMBEDDINGS_BASE_URL; delete process.env.EMBEDDINGS_API_KEY; delete process.env.EMBEDDINGS_MODEL; });

describe("embeddings client (hosted BGE-M3, OpenAI-compatible)", () => {
  it("is not configured without env, and says so with a typed error", async () => {
    delete process.env.EMBEDDINGS_API_KEY;
    expect(embeddingsConfigured()).toBe(false);
    await expect(embed(["x"])).rejects.toMatchObject({ kind: "not_configured" });
  });
  it("posts the redacted text to {base}/embeddings with the BGE-M3 model and returns vectors in input order", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok([{ index: 1, embedding: vec() }, { index: 0, embedding: vec().map((x) => x + 1) }]));
    const out = await embed(["call 01712345678 about the road", "second"]);
    expect(out[0][0]).toBe(1);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://emb.example.test/v1/embeddings");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("BAAI/bge-m3");
    expect(JSON.stringify(body)).not.toContain("01712345678");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
  });
  it("rejects wrong dimension, non-numbers, wrong count, HTTP errors and timeouts", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    f.mockResolvedValueOnce(ok([{ index: 0, embedding: vec(10) }]));
    await expect(embed(["a"])).rejects.toMatchObject({ kind: "bad_response" });
    f.mockResolvedValueOnce(ok([{ index: 0, embedding: [...vec().slice(1), NaN] }]));
    await expect(embed(["a"])).rejects.toMatchObject({ kind: "bad_response" });
    f.mockResolvedValueOnce(ok([]));
    await expect(embed(["a"])).rejects.toMatchObject({ kind: "bad_response" });
    f.mockResolvedValueOnce(new Response("no", { status: 503 }));
    await expect(embed(["a"])).rejects.toMatchObject({ kind: "http" });
    f.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    await expect(embed(["a"])).rejects.toBeInstanceOf(EmbeddingError);
  });
  it("embeds only redacted public fields and formats pgvector text", () => {
    expect(issueEmbeddingText({ title: "গর্ত", description: "ফোন 01712345678", area: "ওয়ার্ড ৩" })).not.toContain("01712345678");
    expect(toVector([1, 2.5])).toBe("[1,2.5]");
  });
});
