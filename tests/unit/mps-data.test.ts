import { describe, expect, it } from "vitest";
import { loadMps, validateMps, toChunks } from "../../scripts/mps-lib.mjs";

describe("MP data file", () => {
  const doc = loadMps();
  it("is valid: 300 unique seats, Bangla and English names, one vacant seat", () => { expect(validateMps(doc)).toEqual([]); });
  it("uses current spellings and keeps the old ones as aliases", () => {
    const s = doc.seats.find((x: { seat_no: number }) => x.seat_no === 281);
    expect(s).toMatchObject({ name_en: "Chattogram-4", name_bn: "চট্টগ্রাম-৪", aliases_en: ["Chittagong-4"], status: "vacant", mp: null });
  });
  it("gives single-seat districts no number", () => {
    expect(doc.seats.find((x: { seat_no: number }) => x.seat_no === 298)).toMatchObject({ name_en: "Khagrachari", name_bn: "খাগড়াছড়ি" });
  });
  it("splits into chunks of at most 100", () => { expect(toChunks(doc).map((c: unknown[]) => c.length)).toEqual([100, 100, 100]); });
  it("rejects bad data", () => {
    const bad = structuredClone(doc);
    bad.seats[0].mp.name_bn = ""; bad.seats[1].seat_no = 1; bad.seats.pop();
    const e = validateMps(bad).join("\n");
    expect(e).toMatch(/expected 300 seats/); expect(e).toMatch(/duplicate seat_no/); expect(e).toMatch(/Bangla name/);
  });
});
