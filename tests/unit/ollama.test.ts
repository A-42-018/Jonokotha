import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: () => ({ messages: { create } }) }));
const logged: Record<string, unknown>[] = [];
vi.mock("@/lib/ai/log", () => ({ logAiRun: async (r: Record<string, unknown>) => { logged.push(r); return `run-${logged.length}`; } }));

import { aiAvailable, localProvider, LocalModelError, ollamaStructured } from "@/lib/ai/ollama";
import { runAgent } from "@/lib/ai/run";
import { INTAKE_V1 } from "@/lib/ai/prompts";

const Schema = z.object({ title: z.string().min(1), n: z.number() });
const opts = { agent: "intake" as const, prompt: INTAKE_V1, tool: { name: "t", description: "d" }, schema: Schema, input: "redacted text" };
const reply = (content: string, extra = {}) => ({ ok: true, status: 200, json: async () => ({ message: { content }, prompt_eval_count: 12, eval_count: 7, ...extra }) });

beforeEach(() => { logged.length = 0; create.mockReset(); delete process.env.ANTHROPIC_API_KEY; delete process.env.AI_PROVIDER; delete process.env.OLLAMA_BASE_URL; delete process.env.OLLAMA_MODEL; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("localProvider", () => {
  it("is off unless AI_PROVIDER=ollama and a valid base URL are set", () => {
    expect(localProvider({})).toBeNull();
    expect(localProvider({ AI_PROVIDER: "ollama" })).toBeNull();
    expect(localProvider({ AI_PROVIDER: "ollama", OLLAMA_BASE_URL: "not a url" })).toBeNull();
    expect(localProvider({ AI_PROVIDER: "anthropic", OLLAMA_BASE_URL: "http://127.0.0.1:11434" })).toBeNull();
  });
  it("strips trailing slashes and defaults the model", () => {
    expect(localProvider({ AI_PROVIDER: "ollama", OLLAMA_BASE_URL: "http://127.0.0.1:11434//" })).toEqual({ baseUrl: "http://127.0.0.1:11434", model: "qwen2.5:7b" });
    expect(localProvider({ AI_PROVIDER: "ollama", OLLAMA_BASE_URL: "http://h:1", OLLAMA_MODEL: "llama3.2" })?.model).toBe("llama3.2");
  });
  it("counts as an available model, like a key does", () => {
    expect(aiAvailable({})).toBe(false);
    expect(aiAvailable({ ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(aiAvailable({ AI_PROVIDER: "ollama", OLLAMA_BASE_URL: "http://h:1" })).toBe(true);
  });
});

describe("ollamaStructured", () => {
  const p = { baseUrl: "http://h:1", model: "m" };
  const o = { system: "s", input: "i", schema: Schema, maxTokens: 50, timeoutMs: 1000 };

  it("posts a JSON schema as format with temperature 0 and returns content and token counts", async () => {
    const f = vi.fn().mockResolvedValue(reply('{"title":"x","n":1}'));
    const r = await ollamaStructured(p, o, f as unknown as typeof fetch);
    expect(r).toEqual({ content: { title: "x", n: 1 }, usage: { input: 12, output: 7 } });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("http://h:1/api/chat");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "m", stream: false, options: { temperature: 0, num_predict: 50 } });
    expect(body.format.properties).toHaveProperty("title");
  });
  it("maps a non-JSON answer, an HTTP error and a dead server to typed errors", async () => {
    await expect(ollamaStructured(p, o, (async () => reply("not json")) as unknown as typeof fetch)).rejects.toMatchObject({ kind: "bad_response" });
    await expect(ollamaStructured(p, o, (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch)).rejects.toMatchObject({ kind: "http" });
    await expect(ollamaStructured(p, o, (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch)).rejects.toBeInstanceOf(LocalModelError);
  });
  it("times out", async () => {
    const f = (async (_u: string, init: { signal: AbortSignal }) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" }))))) as unknown as typeof fetch;
    await expect(ollamaStructured(p, { ...o, timeoutMs: 10 }, f)).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("runAgent with a local model", () => {
  beforeEach(() => { process.env.AI_PROVIDER = "ollama"; process.env.OLLAMA_BASE_URL = "http://h:1"; process.env.OLLAMA_MODEL = "qwen2.5:7b"; });

  it("works without an Anthropic key, never calls Claude, validates with the same schema and logs the local model", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply('{"title":"x","n":2}')));
    const r = await runAgent(opts);
    expect(r).toMatchObject({ ok: true, data: { title: "x", n: 2 } });
    expect(create).not.toHaveBeenCalled();
    expect(logged[0]).toMatchObject({ status: "ok", model: "ollama:qwen2.5:7b", usage: { input: 12, output: 7 } });
  });
  it("turns a schema mismatch into invalid_output, not data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply('{"title":"","n":"x"}')));
    expect(await runAgent(opts)).toMatchObject({ ok: false, reason: "invalid_output" });
    expect(logged[0]).toMatchObject({ status: "invalid_output" });
  });
  it("turns an unreachable server into error so the caller uses its fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await runAgent(opts)).toMatchObject({ ok: false, reason: "error" });
  });
});
