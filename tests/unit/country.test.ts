import { afterEach, describe, expect, it } from "vitest";
import { ADAPTERS, costLabel, country, countryName, fmtMoney, inCountryBox, levelName, useCountry } from "@/lib/country";
import { fmtDay } from "@/lib/format";

afterEach(() => { useCountry("BD"); });

describe("country adapter (F5.12)", () => {
  it("defaults to Bangladesh and exposes names, levels and cost bands", () => {
    expect(country().code).toBe("BD");
    expect(countryName("en")).toBe("Bangladesh");
    expect(levelName(0, "bn")).toBe("জেলা");
    expect(levelName(9, "en")).toBeUndefined();
    expect(costLabel("s", "en")).toContain("lakh");
    expect(costLabel("x", "en")).toBe("");
    expect(fmtMoney(1500, "en")).toBe("৳1,500");
  });
  it("box check rejects swapped, zero and foreign points", () => {
    expect(inCountryBox(23.8, 90.4)).toBe(true);
    expect(inCountryBox(90.4, 23.8)).toBe(false);
    expect(inCountryBox(0, 0)).toBe(false);
    expect(inCountryBox(Number.NaN, 90)).toBe(false);
  });
  it("a second adapter changes box, time zone and names without touching components", () => {
    ADAPTERS.XX = { ...ADAPTERS.BD, code: "XX", name: { bn: "অন্য", en: "Elsewhere" }, timezone: "Pacific/Auckland", bbox: { minLat: -47, maxLat: -34, minLng: 166, maxLng: 179 }, hierarchy: [{ bn: "অঞ্চল", en: "Region" }] };
    try {
      expect(useCountry("xx")).toBe(true);
      expect(countryName("en")).toBe("Elsewhere");
      expect(inCountryBox(23.8, 90.4)).toBe(false);
      expect(inCountryBox(-41, 174)).toBe(true);
      expect(levelName(0, "en")).toBe("Region");
      expect(fmtDay("2026-11-16T23:30:00Z", "en")).toBe("17 Nov 2026");
    } finally { delete ADAPTERS.XX; }
    expect(useCountry("nope")).toBe(false);
  });
});
