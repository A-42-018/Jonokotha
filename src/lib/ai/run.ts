import { createHash } from "node:crypto";
import { z, type ZodType } from "zod";
import { anthropic } from "../anthropic";
import { logAiRun, type AiAgent, type AiStatus } from "./log";
import { glossaryText } from "./glossary";
import type { Prompt } from "./prompts";

/**
 * One way to call the model (masterplan §17): a forced tool call whose input schema comes from the Zod schema, the result
 * validated with the same schema, every call logged (model, prompt version, tokens, latency, cost, outcome), and a
 * typed outcome instead of an exception. Callers use `outcome.ok` and otherwise take their manual path:
 *   timeout | refused | invalid_output | error | no_key
 * Inputs must already be redacted (src/lib/pii.ts); only a hash of the input is stored.
 */
export type AiOutcome<T> =
  | { ok: true; data: T; runId: string | null; latencyMs: number }
  | { ok: false; reason: "no_key" | "timeout" | "refused" | "invalid_output" | "error"; runId: string | null };

export interface RunOptions<T> {
  agent: AiAgent;
  prompt: Prompt;
  /** Name and description the model sees for the tool. */
  tool: { name: string; description: string };
  schema: ZodType<T>;
  /** Redacted user content. */
  input: string;
  maxTokens?: number;
  timeoutMs?: number;
  issueId?: string | null;
  actorId?: string | null;
  requestId?: string | null;
  /** The person asked for simple language (user_preferences.simple_language_mode); output is written with short sentences and common words. */
  simpleLanguage?: boolean;
}

/**
 * System prompt as blocks, STABLE content first so the provider can cache the prefix (B5.10): shared rules and the Bangla glossary
 * (same for every call), then the agent's own prompt (same per agent and version), then, last and uncached, the per-person style.
 * Only the first two blocks carry cache_control; changing the style never invalidates them.
 */
export const SHARED_RULES = "You are part of Jonokotha, a civic platform for Bangladeshi citizens and MP offices. Be accurate, neutral and non-partisan. Never invent facts. If you cannot do the task from the given data, say so through the tool's fields instead of guessing.";
export function buildSystem(prompt: Prompt, simpleLanguage = false) {
  const blocks: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[] = [
    { type: "text", text: `${SHARED_RULES}\n${glossaryText()}`, cache_control: { type: "ephemeral" } },
    { type: "text", text: prompt.system, cache_control: { type: "ephemeral" } },
  ];
  if (simpleLanguage) blocks.push({ type: "text", text: "STYLE: write for a reader with limited reading practice: short sentences, everyday words, no jargon, one idea per sentence." });
  return blocks;
}

export const defaultModel = () => process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

/** Cost is only reported when the operator sets prices; we never guess a price. USD per million tokens. */
export function costUsd(usage: { input: number; output: number } | null): number | null {
  const pin = Number(process.env.AI_PRICE_IN_PER_MTOK), pout = Number(process.env.AI_PRICE_OUT_PER_MTOK);
  if (!usage || !Number.isFinite(pin) || !Number.isFinite(pout) || !process.env.AI_PRICE_IN_PER_MTOK || !process.env.AI_PRICE_OUT_PER_MTOK) return null;
  return Math.round(((usage.input * pin + usage.output * pout) / 1_000_000) * 1e6) / 1e6;
}

export const hashInput = (s: string) => createHash("sha256").update(s).digest("hex");

export async function runAgent<T>(o: RunOptions<T>): Promise<AiOutcome<T>> {
  const model = defaultModel();
  const base = { agent: o.agent, model, promptId: o.prompt.id, promptVersion: o.prompt.version, inputHash: hashInput(o.input), issueId: o.issueId ?? null, actorId: o.actorId ?? null, requestId: o.requestId ?? null };
  const finish = async (status: AiStatus, extra: { output?: unknown; usage?: { input: number; output: number } | null; errorClass?: string; latencyMs: number }) => {
    const runId = await logAiRun({ ...base, status, output: extra.output ?? null, latencyMs: extra.latencyMs, usage: extra.usage ?? null, costUsd: costUsd(extra.usage ?? null), errorClass: extra.errorClass ?? null });
    return runId;
  };

  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: "no_key", runId: null }; // manual path, nothing to log

  const started = Date.now();
  let usage: { input: number; output: number } | null = null;
  try {
    const res = await anthropic().messages.create({
      model,
      max_tokens: o.maxTokens ?? 600,
      system: buildSystem(o.prompt, o.simpleLanguage),
      tools: [{ name: o.tool.name, description: o.tool.description, input_schema: z.toJSONSchema(o.schema) as { type: "object" } }],
      tool_choice: { type: "tool", name: o.tool.name },
      messages: [{ role: "user", content: o.input }],
    }, { timeout: o.timeoutMs ?? 20_000 });
    const latencyMs = Date.now() - started;
    usage = { input: res.usage?.input_tokens ?? 0, output: res.usage?.output_tokens ?? 0 };

    if ((res.stop_reason as string) === "refusal") return { ok: false, reason: "refused", runId: await finish("refused", { usage, latencyMs }) };
    const block = res.content.find((b) => b.type === "tool_use" && b.name === o.tool.name);
    const parsed = block && block.type === "tool_use" ? o.schema.safeParse(block.input) : null;
    if (!parsed?.success) return { ok: false, reason: "invalid_output", runId: await finish("invalid_output", { usage, latencyMs, errorClass: block ? "schema" : "no_tool_call" }) };
    return { ok: true, data: parsed.data, latencyMs, runId: await finish("ok", { output: parsed.data, usage, latencyMs }) };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const name = (e as { name?: string })?.name ?? "Error";
    const timedOut = /timeout|abort/i.test(name) || /timed? ?out/i.test(String((e as Error)?.message ?? ""));
    return { ok: false, reason: timedOut ? "timeout" : "error", runId: await finish(timedOut ? "timeout" : "error", { usage, latencyMs, errorClass: name }) };
  }
}
