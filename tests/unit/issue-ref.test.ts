import { describe, expect, it } from "vitest";
import { normaliseRef } from "@/lib/issue-ref";

describe("track a report: reference number input", () => {
  it("accepts the stored shape and what people type", () => {
    expect(normaliseRef("JK-2026-1001")).toBe("JK-2026-1001");
    expect(normaliseRef("  jk-2026-1001 ")).toBe("JK-2026-1001");
    expect(normaliseRef("JK ২০২৬ ১০০১")).toBe("JK-2026-1001");
    expect(normaliseRef("jk_2026_1001")).toBe("JK-2026-1001");
  });
  it("rejects anything else, so the page never builds a path from free text", () => {
    for (const bad of ["", "1001", "JK-26-1001", "JK-2026-", "JK-2026-1001/../admin", "<script>", "AB-2026-1001"]) expect(normaliseRef(bad), bad).toBeNull();
  });
});
