import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: () => ({ messages: { create } }) }));
const logged: Record<string, unknown>[] = [];
vi.mock("@/lib/ai/log", () => ({ logAiRun: async (r: Record<string, unknown>) => { logged.push(r); return `run-${logged.length}`; } }));

import { costUsd, hashInput, runAgent } from "@/lib/ai/run";
import { draftFromText, summarize } from "@/lib/intake";
import { INTAKE_V1 } from "@/lib/ai/prompts";

const Schema = z.object({ title: z.string().min(1), n: z.number() });
const opts = { agent: "intake" as const, prompt: INTAKE_V1, tool: { name: "t", description: "d" }, schema: Schema, input: "redacted text" };
const tool = (input: unknown, extra = {}, name = "t") => ({ content: [{ type: "tool_use", name, input }], stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 }, ...extra });

beforeEach(() => { logged.length = 0; create.mockReset(); process.env.ANTHROPIC_API_KEY = "test-key"; delete process.env.AI_PRICE_IN_PER_MTOK; delete process.env.AI_PRICE_OUT_PER_MTOK; });
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

describe("runAgent", () => {
  it("returns validated data and logs model, prompt version, tokens and a hash of the (redacted) input", async () => {
    create.mockResolvedValue(tool({ title: "x", n: 1 }));
    const r = await runAgent(opts);
    expect(r).toMatchObject({ ok: true, data: { title: "x", n: 1 }, runId: "run-1" });
    expect(logged[0]).toMatchObject({ agent: "intake", status: "ok", promptId: "intake", promptVersion: "v1", usage: { input: 10, output: 5 }, inputHash: hashInput("redacted text") });
    expect(JSON.stringify(logged[0])).not.toContain("redacted text"); // the input itself is never stored
    const call = create.mock.calls[0][0];
    expect(call.tool_choice).toEqual({ type: "tool", name: "t" });
    expect(call.tools[0].input_schema.properties).toHaveProperty("title");
  });

  it("malformed output becomes invalid_output, not an exception, and is logged", async () => {
    create.mockResolvedValue(tool({ title: "", n: "x" }));
    expect(await runAgent(opts)).toMatchObject({ ok: false, reason: "invalid_output" });
    expect(logged[0]).toMatchObject({ status: "invalid_output", errorClass: "schema" });
    create.mockResolvedValue({ content: [{ type: "text", text: "sure" }], stop_reason: "end_turn", usage: {} });
    expect(await runAgent(opts)).toMatchObject({ ok: false, reason: "invalid_output" });
    expect(logged[1]).toMatchObject({ errorClass: "no_tool_call" });
  });

  it("refusal, timeout and provider errors map to typed reasons", async () => {
    create.mockResolvedValue(tool({ title: "x", n: 1 }, { stop_reason: "refusal" }));
    expect(await runAgent(opts)).toMatchObject({ ok: false, reason: "refused" });
    create.mockRejectedValue(Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" }));
    expect(await runAgent(opts)).toMatchObject({ ok: false, reason: "timeout" });
    create.mockRejectedValue(Object.assign(new Error("401"), { name: "AuthenticationError" }));
    expect(await runAgent(opts)).toMatchObject({ ok: false, reason: "error" });
    expect(logged.map((l) => l.status)).toEqual(["refused", "timeout", "error"]);
  });

  it("without a key nothing is called and nothing is logged", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await runAgent(opts)).toEqual({ ok: false, reason: "no_key", runId: null });
    expect(create).not.toHaveBeenCalled();
    expect(logged).toHaveLength(0);
  });

  it("cost is reported only when prices are configured", () => {
    expect(costUsd({ input: 1000, output: 1000 })).toBeNull();
    process.env.AI_PRICE_IN_PER_MTOK = "3"; process.env.AI_PRICE_OUT_PER_MTOK = "15";
    expect(costUsd({ input: 1_000_000, output: 1_000_000 })).toBe(18);
  });
});

describe("intake with the manual fallback", () => {
  it("falls back to the keyword draft on any AI failure and still reports redacted PII kinds", async () => {
    create.mockRejectedValue(new Error("boom"));
    const r = await draftFromText("আমার রাস্তায় গর্ত, ফোন 01712345678");
    expect(r.source).toBe("fallback");
    expect(r.draft.category).toBe("roads");
    expect(r.pii).toContain("phone");
    expect(JSON.stringify(create.mock.calls)).not.toContain("01712345678");
  });
  it("uses the AI draft when valid and sends only redacted text to the model", async () => {
    create.mockResolvedValue(tool({ title: "রাস্তায় গর্ত", category: "roads", description: "বড় গর্ত", area: "" }, {}, "submit_draft"));
    const r = await draftFromText("pothole call 01712345678");
    expect(r.source).toBe("ai");
    expect(JSON.stringify(create.mock.calls[0][0].messages)).not.toContain("01712345678");
  });
  it("summarize returns '' on failure", async () => {
    create.mockRejectedValue(new Error("boom"));
    expect(await summarize({ title: "a", category: "roads", description: "b", area: "" })).toBe("");
  });
});
