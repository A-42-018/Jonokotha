import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ currentUser: vi.fn() }));

import { loginUrl, safeNext } from "@/lib/guard";
import { hasPersonalNumber } from "@/lib/report";

describe("safeNext", () => {
  it("keeps same-site paths", () => expect(safeNext("/office/JK-1")).toBe("/office/JK-1"));
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", undefined, 5])("rejects %s", (v) => {
    expect(safeNext(v)).toBe("/report");
  });
  it("encodes the return path in the login URL", () => expect(loginUrl("/office/a b")).toBe("/login?need=1&next=%2Foffice%2Fa%20b"));
});

describe("hasPersonalNumber", () => {
  it("flags Bangladeshi mobile numbers in Latin and Bangla digits", () => {
    expect(hasPersonalNumber("ফোন 01712345678")).toBe(true);
    expect(hasPersonalNumber("০১৭১২৩৪৫৬৭৮")).toBe(true);
  });
  it("ignores short numbers", () => expect(hasPersonalNumber("রাস্তা ১২ নম্বর")).toBe(false));
});
