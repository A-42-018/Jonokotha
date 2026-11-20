import { z, type ZodType } from "zod";

/**
 * Optional local model through Ollama (https://ollama.com), for privacy, cost and offline work: the text never leaves the machine.
 * Off unless AI_PROVIDER=ollama and OLLAMA_BASE_URL are set (for example http://127.0.0.1:11434). OLLAMA_MODEL picks the model.
 * It speaks Ollama's native /api/chat with a JSON schema in `format` (structured output), so every agent keeps its Zod contract:
 * `runAgent` validates the result exactly as it does for Claude. Small local models are weaker in Bangla, so measure with
 * `AI_PROVIDER=ollama npm run eval` before relying on one (docs/aibc/local-llm.md).
 */
export interface LocalProvider { baseUrl: string; model: string }

export function localProvider(env: Record<string, string | undefined> = process.env): LocalProvider | null {
  if (env.AI_PROVIDER !== "ollama") return null;
  const base = (env.OLLAMA_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s]+$/.test(base)) return null;
  return { baseUrl: base, model: (env.OLLAMA_MODEL ?? "qwen2.5:7b").trim() };
}

export class LocalModelError extends Error {
  constructor(public kind: "timeout" | "http" | "bad_response", message: string) { super(message); }
}

export interface LocalResult { content: unknown; usage: { input: number; output: number } }

/** One structured call. Throws LocalModelError; the caller turns it into a typed outcome. */
export async function ollamaStructured(p: LocalProvider, o: { system: string; input: string; schema: ZodType; maxTokens: number; timeoutMs: number }, doFetch: typeof fetch = fetch): Promise<LocalResult> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs);
  try {
    const res = await doFetch(`${p.baseUrl}/api/chat`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({
        model: p.model, stream: false, format: z.toJSONSchema(o.schema),
        options: { temperature: 0, num_predict: o.maxTokens },
        messages: [{ role: "system", content: `${o.system}\nReply with JSON only, matching the given schema.` }, { role: "user", content: o.input }],
      }),
    });
    if (!res.ok) throw new LocalModelError("http", `Ollama answered ${res.status}`);
    const j = (await res.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
    let content: unknown;
    try { content = JSON.parse(j.message?.content ?? ""); } catch { throw new LocalModelError("bad_response", "The local model did not return JSON."); }
    return { content, usage: { input: j.prompt_eval_count ?? 0, output: j.eval_count ?? 0 } };
  } catch (e) {
    if (e instanceof LocalModelError) throw e;
    if ((e as { name?: string })?.name === "AbortError") throw new LocalModelError("timeout", "The local model timed out.");
    throw new LocalModelError("http", "The local model could not be reached.");
  } finally { clearTimeout(timer); }
}

/** True when some model can answer: a local Ollama model or an Anthropic key. */
export const aiAvailable = (env: Record<string, string | undefined> = process.env): boolean => !!localProvider(env) || !!env.ANTHROPIC_API_KEY;
