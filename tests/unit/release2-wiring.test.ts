import { describe, expect, it } from "vitest";
import { officeArea } from "@/lib/office-page";
import { noteTooShort } from "@/lib/r2-api";

describe("Release 2 wiring rules", () => {
  it("office pages work on one of the account's own offices, not the visitor's chosen area", () => {
    expect(officeArea(["bd-017"], null)).toBe("bd-017");
    expect(officeArea(["bd-017"], "bd-042")).toBe("bd-017");
    expect(officeArea(["bd-017", "bd-042"], "bd-042")).toBe("bd-042");
    expect(officeArea([], "bd-042")).toBe("bd-042");
    expect(officeArea([], null)).toBe("demo-1");
  });
  it("an optional note is empty or at least 5 characters, as the server requires", () => {
    expect(noteTooShort("")).toBe(false);
    expect(noteTooShort("   ")).toBe(false);
    expect(noteTooShort("ok")).toBe(true);
    expect(noteTooShort("ঠিক আছে")).toBe(false);
  });
});
