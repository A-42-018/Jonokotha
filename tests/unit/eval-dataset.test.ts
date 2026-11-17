import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGENCIES } from "@/lib/demo-data";
import { pickAgency } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";
import { redactPii } from "@/lib/pii";

type Case = { id: string; lang: string; text: string; category: string; agency: string; dup_group?: string; pii?: { kind: string; value: string }[] };
const { cases } = JSON.parse(readFileSync("tests/ai/dataset.v0.json", "utf8")) as { cases: Case[] };

describe("eval dataset v0 (task 1.10)", () => {
  it("has 100+ cases in Bangla, English and Banglish, unique ids, every category", () => {
    expect(cases.length).toBeGreaterThanOrEqual(100);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(new Set(cases.map((c) => c.lang))).toEqual(new Set(["bn", "en", "banglish"]));
    for (const k of CATEGORIES) expect(cases.some((c) => c.category === k), k).toBe(true);
  });
  it("every expected category is valid and its expected agency matches the sourced directory", () => {
    for (const c of cases) {
      expect(CATEGORIES as readonly string[]).toContain(c.category);
      expect(pickAgency(AGENCIES, c.category).id, c.id).toBe(c.agency);
      expect(c.text.length).toBeGreaterThan(10);
    }
  });
  it("duplicate groups have 2 or more members, all in one category", () => {
    const g = new Map<string, Case[]>();
    for (const c of cases) if (c.dup_group) g.set(c.dup_group, [...(g.get(c.dup_group) ?? []), c]);
    expect(g.size).toBeGreaterThanOrEqual(10);
    for (const [k, m] of g) { expect(m.length, k).toBeGreaterThanOrEqual(2); expect(new Set(m.map((c) => c.category)).size, k).toBe(1); }
  });
  it("planted personal data really appears in the text, and nothing else looks like personal data", () => {
    for (const c of cases) {
      for (const p of c.pii ?? []) expect(c.text, c.id).toContain(p.value);
      if (!c.pii) expect(redactPii(c.text).found, c.id).toEqual([]);
    }
  });
});
