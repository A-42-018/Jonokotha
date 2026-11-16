import { describe, expect, it } from "vitest";
import { redactPii } from "@/lib/pii";

describe("redactPii", () => {
  it("removes Bangladesh mobile numbers in common formats", () => {
    for (const n of ["01712345678", "+8801712345678", "8801712345678", "01712-345678", "+880 1712 345678", "০১৭১২৩৪৫৬৭৮", "+৮৮০১৭১২৩৪৫৬৭৮"]) {
      const r = redactPii(`আমার নম্বর ${n}, ফোন করুন`);
      expect(r.found, n).toContain("phone");
      expect(r.text, n).not.toMatch(/[0-9০-৯]{6}/);
    }
  });
  it("removes emails", () => {
    const r = redactPii("contact rahim.uddin@example.com please");
    expect(r.found).toEqual(["email"]);
    expect(r.text).not.toContain("@");
  });
  it("removes NID-length numbers (10, 13, 17 digits), English and Bangla", () => {
    for (const n of ["1234567890", "1990123456789", "19901234567890123", "১২৩৪৫৬৭৮৯০১২৩৪"]) {
      const r = redactPii(`NID ${n} দেখুন`);
      expect(r.found, n).toContain("id");
      expect(r.text, n).not.toContain(n);
    }
  });
  it("keeps ordinary text and short numbers", () => {
    const t = "মিরপুর ১০ নম্বর রোডে ৩টি গর্ত, ২০২৬ সালে ১২ জন আহত। Road 12 has 3 potholes.";
    expect(redactPii(t)).toEqual({ text: t, found: [] });
  });
  it("handles mixed content in one message", () => {
    const r = redactPii("ফোন 01812345678 ইমেইল a@b.co রাস্তা খারাপ");
    expect(r.found.sort()).toEqual(["email", "phone"]);
    expect(r.text).toContain("রাস্তা খারাপ");
  });
});
