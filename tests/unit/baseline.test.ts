import { describe, expect, it } from "vitest";
import { chooseDuplicateThreshold, chooseRoutingConfidence, MIN_SAMPLES } from "../../src/lib/eval-real/baseline";
import { realExamplesToCases } from "../../src/lib/eval-real/dataset";

// deterministic synthetic measurements: duplicates score high, non-duplicates low, with some overlap in the middle
const pairs = Array.from({ length: 80 }, (_, i) => { const dup = i % 4 === 0; const base = dup ? 0.75 + (i % 20) * 0.012 : 0.4 + (i % 25) * 0.015; return { score: Math.round(base * 1000) / 1000, duplicate: dup }; });

describe("thresholds from measured baselines", () => {
  it("chooses the cut-off with the best recall that still meets the precision floor, and reports the evidence", () => {
    const c = chooseDuplicateThreshold(pairs, 0.9, "2026-12-01")!;
    expect(c).not.toBeNull();
    expect(c.basis).toMatchObject({ n: 80, measured_on: "2026-12-01" });
    expect(c.basis.precision as number).toBeGreaterThanOrEqual(0.9);
    const sel = pairs.filter((p) => p.score >= c.threshold);
    expect(sel.filter((p) => p.duplicate).length / sel.length).toBeGreaterThanOrEqual(0.9);
    // a lower cut-off would break the floor or not add recall
    const lower = pairs.filter((p) => p.score >= c.threshold - 0.1);
    expect(lower.filter((p) => p.duplicate).length / lower.length).toBeLessThan(c.basis.precision as number + 1e-9);
  });
  it("refuses to choose from too few cases, no duplicates, or an unreachable precision", () => {
    expect(chooseDuplicateThreshold(pairs.slice(0, MIN_SAMPLES - 1))).toBeNull();
    expect(chooseDuplicateThreshold(pairs.map((p) => ({ ...p, duplicate: false })))).toBeNull();
    expect(chooseDuplicateThreshold(pairs.map((p) => ({ score: 0.5, duplicate: p.duplicate })), 0.99)).toBeNull();
  });
  it("routing confidence: lowest cut-off above which accuracy meets the target, not supported by a handful of cases", () => {
    const rows = Array.from({ length: 100 }, (_, i) => { const confidence = 0.3 + (i / 100) * 0.7; return { confidence, correct: confidence > 0.6 || i % 5 === 0 }; });
    const c = chooseRoutingConfidence(rows, 0.9)!;
    expect(c.threshold).toBeGreaterThan(0.5);
    expect(c.basis.accuracy_above as number).toBeGreaterThanOrEqual(0.9);
    expect(chooseRoutingConfidence(rows.slice(0, 10))).toBeNull();
    expect(chooseRoutingConfidence(rows.map((r) => ({ ...r, correct: false })))).toBeNull();
  });
});

describe("consented examples to eval cases", () => {
  it("maps the export format and rejects malformed files", () => {
    const raw = { generated_at: "2026-12-01", examples: [
      { id: "real-0123456789", text: "রাস্তায় গর্ত আছে অনেক দিন ধরে", category: "roads", language: "bn", expected_agency: "lged", source: "consented_real" },
      { id: "real-abcdef0123", text: "Water logging near the market", category: "drainage", language: "mixed", expected_agency: null, source: "consented_real" }] };
    const cases = realExamplesToCases(raw);
    expect(cases).toMatchObject([{ lang: "bn", agency: "lged", real: true }, { lang: "banglish", agency: "" }]);
    expect(() => realExamplesToCases({ examples: [{ id: "x" }] })).toThrow();
    expect(() => realExamplesToCases({ generated_at: "x", examples: [{ ...raw.examples[0], source: "synthetic" }] })).toThrow();
  });
});
