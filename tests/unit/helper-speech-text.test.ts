import { describe, expect, it } from "vitest";
import { numberWords, speakableBangla as s } from "@/lib/helper/speech-text";

describe("Bangla numbers for the voice", () => {
  it("whole numbers", () => {
    expect(numberWords(2026)).toBe("দুই হাজার ছাব্বিশ");
    expect(numberWords(500)).toBe("পাঁচশো");
    expect(numberWords(123456)).toBe("এক লাখ তেইশ হাজার চারশো ছাপ্পান্ন");
    expect(numberWords(100)).toBe("একশো");
  });
  it("digits of either script, with groups", () => {
    expect(s("২০২৬ সালে")).toBe("দুই হাজার ছাব্বিশ সালে");
    expect(s("1,170 টাকা")).toBe("এক হাজার একশো সত্তর টাকা");
    expect(s("১,২৩,৪৫৬")).toBe("এক লাখ তেইশ হাজার চারশো ছাপ্পান্ন");
  });
  it("money, percent, fractions, ranges, ratios, time", () => {
    expect(s("৳৫০০")).toBe("পাঁচশো টাকা");
    expect(s("৫%")).toBe("পাঁচ শতাংশ");
    expect(s("১/৪ অংশ")).toBe("চার ভাগের এক ভাগ অংশ");
    expect(s("১/২")).toBe("অর্ধেক");
    expect(s("১৫-২০ দিন")).toBe("পনেরো থেকে বিশ দিন");
    expect(s("২:১")).toBe("দুই অনুপাত এক");
    expect(s("১০:৩০")).toBe("দশটা ত্রিশ মিনিট");
    expect(s("১২.৫")).toBe("বারো দশমিক পাঁচ");
  });
  it("emergency numbers and long ids are read one digit at a time", () => {
    expect(s("৯৯৯-এ ফোন করুন")).toBe("নয় নয় নয়-এ ফোন করুন");
    expect(s("১০৯ ও ১০৯৮")).toBe("এক শূন্য নয় ও এক শূন্য নয় আট");
    expect(s("০১২৩")).toBe("শূন্য এক দুই তিন");
    expect(s("১২৩৪৫৬৭৮৯০")).toBe("এক দুই তিন চার পাঁচ ছয় সাত আট নয় শূন্য");
  });
  it("codes are left alone, and text without numbers is unchanged", () => {
    expect(s("সমস্যা নম্বর AB-2026")).toContain("AB-2026");
    expect(s("স্বাগতম! আমি জমির দাদু।")).toBe("স্বাগতম! আমি জমির দাদু।");
  });
});
