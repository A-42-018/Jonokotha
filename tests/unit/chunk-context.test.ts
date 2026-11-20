import { beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.fn();
vi.mock("@/lib/ai/run", () => ({ runAgent: (o: unknown) => run(o) }));
import { contextLlmEnabled, modelContext } from "@/lib/ai/context";

const doc = { title: "Pothole repair", text: "Call 16163 to report a pothole. The office answers within 7 days." };
beforeEach(() => { run.mockReset(); delete process.env.KNOWLEDGE_CONTEXT_LLM; delete process.env.ANTHROPIC_API_KEY; });

describe("model-written chunk context", () => {
  it("is off unless asked for and a key exists", () => {
    expect(contextLlmEnabled()).toBe(false);
    process.env.KNOWLEDGE_CONTEXT_LLM = "1";
    expect(contextLlmEnabled()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "k";
    expect(contextLlmEnabled()).toBe(true);
  });

  it("returns the line and sends only redacted, bounded text", async () => {
    run.mockResolvedValue({ ok: true, data: { context: "This passage says how to report a pothole to the office." } });
    expect(await modelContext({ ...doc, text: `${doc.text} Ring 01712345678.` }, "Call 16163 to report a pothole.")).toBe("This passage says how to report a pothole to the office.");
    const input = run.mock.calls[0][0].input as string;
    expect(input).not.toContain("01712345678");
    expect(run.mock.calls[0][0].agent).toBe("ingest");
  });

  it("rejects a line with a number the document does not contain", async () => {
    run.mockResolvedValue({ ok: true, data: { context: "Report potholes on 999 within 3 days." } });
    expect(await modelContext(doc, "Call 16163 to report a pothole.")).toBeNull();
  });

  it("accepts numbers that are in the document", async () => {
    run.mockResolvedValue({ ok: true, data: { context: "Call 16163 about potholes; they answer within 7 days." } });
    expect(await modelContext(doc, "Call 16163")).toMatch(/16163/);
  });

  it("returns null when the model fails", async () => {
    run.mockResolvedValue({ ok: false, reason: "timeout", runId: null });
    expect(await modelContext(doc, "x")).toBeNull();
  });
});
