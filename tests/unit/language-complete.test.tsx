import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "@/components/LoginForm";
import PersonalizationPanel from "@/components/me/PersonalizationPanel";
import { fmtMoney, groupDigits } from "@/lib/country";
import { filterIssues } from "@/lib/explore";
import { fmtDay, fmtNum } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { cleanDigits, cleanNumerals, NUMERALS_KEY, setNumerals, toLatinDigits } from "@/lib/numerals";
import { searchPlaces } from "@/lib/places";
import { matchesQuery, skeleton } from "@/lib/translit";

const verifyOtp = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/login" }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({ auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: null }), verifyOtp } }) }));

beforeEach(() => { verifyOtp.mockReset(); localStorage.clear(); window.dispatchEvent(new Event("jk-local-change")); });
afterEach(() => { setNumerals("auto"); vi.unstubAllGlobals(); });

describe("numerals", () => {
  it("follow the language by default and the setting when one is chosen", () => {
    expect(fmtNum(2026, "bn")).toBe("২০২৬");
    expect(fmtNum(2026, "en")).toBe("2026");
    setNumerals("latin");
    expect(fmtNum(2026, "bn")).toBe("2026");
    setNumerals("bn");
    expect(fmtNum(2026, "en")).toBe("২০২৬");
    expect(fmtDay("2026-11-16T10:00:00Z", "en")).toMatch(/১৬/);
    setNumerals("latin");
    expect(fmtDay("2026-11-16T10:00:00Z", "bn")).toMatch(/16 নভেম্বর 2026/);
  });
  it("an unknown stored value means auto", () => {
    expect(cleanNumerals("x")).toBe("auto");
    expect(cleanNumerals(null)).toBe("auto");
    expect(cleanNumerals("latin")).toBe("latin");
  });
  it("phone numbers and codes accept both digit sets, spaces and dashes", () => {
    expect(toLatinDigits("০১৭১২-৩৪৫৬৭৮")).toBe("01712-345678");
    expect(cleanDigits("০১৭১২ ৩৪৫-৬৭৮")).toBe("01712345678");
    expect(cleanDigits("+৮৮০ 1712-345678")).toBe("+8801712345678");
    expect(cleanDigits("১২৩ ৪৫৬")).toBe("123456");
    expect(cleanDigits("abc")).toBe("");
  });
});

describe("money", () => {
  it("groups the lakh and crore way", () => {
    expect(groupDigits("999")).toBe("999");
    expect(groupDigits("1500")).toBe("1,500");
    expect(groupDigits("125000")).toBe("1,25,000");
    expect(groupDigits("12345678")).toBe("1,23,45,678");
    expect(groupDigits("1234567", "western")).toBe("1,234,567");
  });
  it("shows ৳ with the digits the page uses", () => {
    expect(fmtMoney(1234567, "bn")).toBe("৳১২,৩৪,৫৬৭");
    expect(fmtMoney(1234567, "en")).toBe("৳12,34,567");
    expect(fmtMoney(-2500, "en")).toBe("-৳2,500");
    setNumerals("latin");
    expect(fmtMoney(100000, "bn")).toBe("৳1,00,000");
  });
});

describe("Banglish search", () => {
  it("rasta bhanga finds রাস্তা ভাঙা, and plain Bangla and Latin text still match", () => {
    expect(skeleton("রাস্তা ভাঙা")).toBe(skeleton("rasta bhanga"));
    expect(matchesQuery("মিরপুরে রাস্তা ভাঙা", "rasta bhanga")).toBe(true);
    expect(matchesQuery("মিরপুরে রাস্তা ভাঙা", "রাস্তা")).toBe(true);
    expect(matchesQuery("Broken road in Mirpur", "road")).toBe(true);
    expect(matchesQuery("মিরপুরে রাস্তা ভাঙা", "mirpur")).toBe(true);
    expect(matchesQuery("মিরপুরে রাস্তা ভাঙা", "bati")).toBe(false);
    expect(matchesQuery("anything", "")).toBe(true);
  });
  it("Bangla digits match Latin digits in search", () => {
    expect(matchesQuery("ওয়ার্ড ৩ (নমুনা)", "3")).toBe(true);
    expect(matchesQuery("Ward 3", "৩")).toBe(true);
  });
  it("one letter never matches by sound", () => {
    expect(matchesQuery("রাস্তা", "r")).toBe(false);
  });
  it("works in the area search and the explore filter", () => {
    expect(searchPlaces("ward 3", "bn").map((p) => p.id)).toEqual(["w3"]);
    const issue = { id: "1", title: "রাস্তা ভাঙা", area: "মিরপুর", category: "road", status: "open", createdAt: "2026-11-01T00:00:00Z", lat: 23.8, lng: 90.4, supports: 0 } as never;
    const f = { q: "rasta", category: "all", status: "all", range: "all" } as never;
    expect(filterIssues([issue], f, Date.now(), () => "", () => "")).toHaveLength(1);
  });
});

describe("sign-in code", () => {
  it("accepts Bangla digits and sends Latin digits", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(dict.bn.loginEmail), "a@b.com");
    await user.click(screen.getByRole("button", { name: dict.bn.loginSend }));
    await user.type(await screen.findByLabelText(dict.bn.loginCode), "১২৩৪৫৬");
    await user.click(screen.getByRole("button", { name: dict.bn.loginVerify }));
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith({ email: "a@b.com", token: "123456", type: "email" }));
  });
});

describe("Settings numerals", () => {
  it("choosing Latin digits is stored on this device and changes formatting at once", async () => {
    const user = userEvent.setup();
    render(<PersonalizationPanel signedIn={false} />);
    expect(screen.getByRole("radio", { name: new RegExp(dict.bn.pzNumAuto.slice(0, 8)) })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: new RegExp(dict.bn.pzNumLatin.slice(0, 10)) }));
    expect(JSON.parse(localStorage.getItem(NUMERALS_KEY) ?? "null")).toBe("latin");
    expect(fmtNum(7, "bn")).toBe("7");
  });
});

describe("conjunct and mark checks on every string", () => {
  const out: [string, string][] = [];
  const walk = (o: unknown, path: string) => {
    if (typeof o === "string") out.push([path, o]);
    else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
  };
  walk(dict.bn, "bn");
  it("no virama at the end of a word, no non-joiner, and a joiner only in the র‍্য form", () => {
    // The only joiner in use is র + ZWJ + ্ + য (র‍্যা as in র‍্যাংকিং), which keeps the ya-phala form instead of a reph.
    const bad = out.filter(([, s]) => /্(?=[\s.,।?!;:)]|$)/.test(s) || /‌/.test(s) || /‍/.test(s.replace(/র‍্য/g, "")));
    expect(bad.map(([k]) => k)).toEqual([]);
  });
  it("ya-phala and reph sequences stay in one Unicode order (composed, never ে + া for ো)", () => {
    expect(out.filter(([, s]) => /ে\u09BE|ে\u09D7/.test(s)).map(([k]) => k)).toEqual([]);
    expect(out.filter(([, s]) => s !== s.normalize("NFC")).map(([k]) => k)).toEqual([]);
  });
});
