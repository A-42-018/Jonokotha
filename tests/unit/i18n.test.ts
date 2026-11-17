import { describe, expect, it } from "vitest";
import { dict } from "@/lib/i18n";
import { p2 } from "@/lib/strings";

const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe("i18n", () => {
  it("bn and en have the same keys", () => {
    expect(keys(dict.en).sort()).toEqual(keys(dict.bn).sort());
  });
  it("Phase 2 strings are non-empty and placeholders match across languages", () => {
    for (const k of Object.keys(p2.bn) as (keyof typeof p2.bn)[]) {
      const bn = p2.bn[k] as string, en = p2.en[k as keyof typeof p2.en] as string;
      expect(bn.length, k).toBeGreaterThan(0);
      expect(en.length, k).toBeGreaterThan(0);
      expect((bn.match(/\{\w+\}/g) ?? []).sort(), k).toEqual((en.match(/\{\w+\}/g) ?? []).sort());
    }
  });
});
