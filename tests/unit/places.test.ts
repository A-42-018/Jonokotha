import { describe, expect, it } from "vitest";
import { inBangladesh, searchPlaces } from "@/lib/places";

describe("places", () => {
  it("finds sample wards by Bangla or Latin digits and either language", () => {
    expect(searchPlaces("ওয়ার্ড ৩", "bn").map((p) => p.id)).toEqual(["w3"]);
    expect(searchPlaces("ওয়ার্ড 3", "bn").map((p) => p.id)).toEqual(["w3"]);
    expect(searchPlaces("ward 5", "en").map((p) => p.id)).toEqual(["w5"]);
    expect(searchPlaces("   ", "bn")).toEqual([]);
    expect(searchPlaces("zzz", "en")).toEqual([]);
  });
  it("accepts only pins inside Bangladesh", () => {
    expect(inBangladesh({ lat: 23.8, lng: 90.4 })).toBe(true);
    expect(inBangladesh({ lat: 0, lng: 0 })).toBe(false);
    expect(inBangladesh({ lat: 51.5, lng: -0.1 })).toBe(false);
  });
});
