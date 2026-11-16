import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGENCIES } from "@/lib/demo-data";
import { pickAgency } from "@/lib/store";

const seed = readFileSync("supabase/seed/seed.sql", "utf8");

describe("agency seed", () => {
  it("contains every in-code agency with its source URL", () => {
    for (const a of AGENCIES) {
      expect(seed, a.id).toContain(`'${a.id}'`);
      if (a.url) expect(seed, a.id).toContain(a.url);
    }
  });
  it("routes each category to a directory agency", () => {
    expect(pickAgency(AGENCIES, "roads").id).toBe("ag-lged");
    expect(pickAgency(AGENCIES, "flooding").id).toBe("ag-wasa");
    expect(pickAgency(AGENCIES, "other").id).toBe("ag-office");
  });
});
