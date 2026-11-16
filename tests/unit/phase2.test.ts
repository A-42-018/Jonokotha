import { describe, expect, it } from "vitest";
import { boundaryBBox, inBangladesh, parsePoint } from "../../src/lib/geo";
import { chooseLanguage, urgencyGuidance } from "../../src/lib/intake-v2";
import { sniffAudio } from "../../src/lib/transcribe";
import { decodeFeedCursor, encodeFeedCursor } from "../../src/lib/feed-cursor";
import { narrativeIsGrounded } from "../../src/lib/analytics";
import { fallbackCopilot } from "../../src/lib/ai/copilot";
import { handleRpc, listTools } from "../../src/lib/mcp";
import { vapidConfigured } from "../../src/lib/notify/deliver";

describe("geo", () => {
  it("accepts only coordinates inside Bangladesh and rejects swapped ones", () => {
    expect(inBangladesh(23.8, 90.4)).toBe(true); expect(inBangladesh(90.4, 23.8)).toBe(false); expect(inBangladesh(0, 0)).toBe(false);
    expect(parsePoint("23.8,90.4")).toEqual({ lat: 23.8, lng: 90.4 });
    for (const bad of ["", "23.8", "23.8,", "a,b", "23.8,90.4,1", "0,0", "23.8, 90.4"]) expect(() => parsePoint(bad)).toThrow();
  });
  it("computes the bounding box of a closed boundary and rejects open rings, foreign points and wrong types", () => {
    const poly = { type: "Polygon", coordinates: [[[90.1, 23.1], [90.3, 23.1], [90.3, 23.4], [90.1, 23.1]]] };
    expect(boundaryBBox(poly)).toEqual({ min_lat: 23.1, max_lat: 23.4, min_lng: 90.1, max_lng: 90.3 });
    expect(boundaryBBox({ type: "MultiPolygon", coordinates: [poly.coordinates, [[[91, 24], [91.2, 24], [91.2, 24.2], [91, 24]]]] }).max_lng).toBe(91.2);
    expect(() => boundaryBBox({ type: "Polygon", coordinates: [[[90.1, 23.1], [90.3, 23.1], [90.3, 23.4], [90.1, 23.2]]] })).toThrow(/closed/);
    expect(() => boundaryBBox({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] })).toThrow(/outside/);
    expect(() => boundaryBBox({ type: "Point", coordinates: [1, 2] })).toThrow();
  });
});

describe("intake v2 helpers", () => {
  it("chooses the output language from the text unless the user chose", () => {
    expect(chooseLanguage("রাস্তা খারাপ", "auto")).toBe("bn"); expect(chooseLanguage("amar rasta kharap", "auto")).toBe("bn");
    expect(chooseLanguage("The road is broken", "auto")).toBe("en"); expect(chooseLanguage("The road is broken", "bn")).toBe("bn");
  });
  it("urgent guidance always points to 999 and the other levels never promise a time", () => {
    expect(urgencyGuidance("urgent", "bn")).toContain("৯৯৯"); expect(urgencyGuidance("urgent", "en")).toContain("999");
    expect(urgencyGuidance("routine", "en")).toMatch(/cannot promise/);
  });
  it("sniffs audio by content", () => {
    expect(sniffAudio(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))?.ext).toBe("webm");
    expect(sniffAudio(new Uint8Array([0x4f, 0x67, 0x67, 0x53]))?.ext).toBe("ogg");
    expect(sniffAudio(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]))?.ext).toBe("m4a");
    expect(sniffAudio(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
  });
});

describe("cursors and narratives", () => {
  it("feed cursors round-trip and reject tampering", () => {
    const c = encodeFeedCursor(1, "2026-11-01T10:00:00.123+00:00", "JK-2026-1001");
    expect(decodeFeedCursor(c)).toEqual({ tier: 1, ts: "2026-11-01T10:00:00.123+00:00", ref: "JK-2026-1001" });
    expect(() => decodeFeedCursor("garbage")).toThrow();
    expect(() => decodeFeedCursor(encodeFeedCursor(2, "2026-11-01T10:00:00Z", "x"))).toThrow();
    expect(() => decodeFeedCursor(encodeFeedCursor(0, "2026-11-01T10:00:00Z", "a b;drop"))).toThrow();
  });
  it("a narrative may only repeat numbers that are in the statistics (Bangla digits too)", () => {
    expect(narrativeIsGrounded("মোট ১২টি", { received: 12 })).toBe(true);
    expect(narrativeIsGrounded("মোট ১৩টি", { received: 12 })).toBe(false);
    expect(narrativeIsGrounded("কোনো সংখ্যা নেই", { received: 12 })).toBe(true);
  });
});

describe("copilot fallback", () => {
  it("lists what is missing and drafts a Bangla reply with the reference number and no time promise", () => {
    const f = fallbackCopilot({ ref: "JK-1", title: "Hole", description: "Hole.", area: "", category: "other", ai_summary: null }, false, 0);
    expect(f.missing.map((m) => m.fact)).toEqual(["F3", "F7", "F2", "F4"]);
    expect(f.reply).toContain("JK-1"); expect(f.reply).toContain("প্রতিশ্রুতি");
    expect(fallbackCopilot({ ref: "JK-2", title: "t", description: "x".repeat(80), area: "Ward 3", category: "roads", ai_summary: "S" }, true, 2).missing).toEqual([]);
  });
});

describe("MCP protocol", () => {
  const sb = {} as never;
  it("lists five tools of which only the proposal tool is not read-only", () => {
    const t = listTools(); expect(t).toHaveLength(5); expect(t.filter((x) => !x.annotations.readOnlyHint).map((x) => x.name)).toEqual(["propose_note"]);
  });
  it("rejects malformed requests and unknown methods; notifications get no reply", async () => {
    expect(await handleRpc({ jsonrpc: "1.0", id: 1, method: "ping" }, sb, { id: "u" })).toMatchObject({ error: { code: -32600 } });
    expect(await handleRpc({ jsonrpc: "2.0", id: 1, method: "x/y" }, sb, { id: "u" })).toMatchObject({ error: { code: -32601 } });
    expect(await handleRpc({ jsonrpc: "2.0", method: "x/y" }, sb, { id: "u" })).toBeNull();
    expect(await handleRpc({ jsonrpc: "2.0", id: 1, method: "ping" }, sb, { id: "u" })).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
  });
});

describe("configuration", () => {
  it("Web Push is off until both VAPID keys are set", () => { delete process.env.VAPID_PUBLIC_KEY; expect(vapidConfigured()).toBe(false); });
});
