import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import districts from "@/lib/data/bd-districts.json";
import { districtAt } from "@/lib/seat-locate";

describe("districtAt (find my seat from my location)", () => {
  it.each([
    ["Dhaka city", 23.78, 90.41, "Dhaka"],
    ["Tangail town", 24.25, 89.92, "Tangail"],
    ["Chattogram city", 22.34, 91.83, "Chattogram"],
    ["Sylhet city", 24.9, 91.87, "Sylhet"],
    ["Rajshahi city", 24.37, 88.6, "Rajshahi"],
    ["Cox's Bazar town", 21.45, 91.97, "Cox's Bazar"],
    ["Cumilla town", 23.46, 91.18, "Cumilla"],
  ])("%s is in %s", (_n, lat, lng, name) => {
    expect(districtAt(lat, lng)?.en).toBe(name);
  });

  it("returns null far from any district (Bay of Bengal, other countries)", () => {
    expect(districtAt(20.5, 90.0)).toBeNull();
    expect(districtAt(26.5, 85.0)).toBeNull();
  });

  it("has an outline for every district named in the seat list, and the names match", () => {
    const seats = JSON.parse(readFileSync("supabase/seed/data/mps-13th-2026-11-16.json", "utf8")).seats as { district_en: string; district_bn: string }[];
    const names = new Set(seats.map((s) => s.district_en));
    const have = new Set(districts.districts.map((d) => d.en));
    expect(have.size).toBe(64);
    for (const n of names) expect(have.has(n), n).toBe(true);
    for (const d of districts.districts) expect(seats.find((s) => s.district_en === d.en)?.district_bn).toBe(d.bn);
  });
});
