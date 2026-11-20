import { describe, expect, it } from "vitest";
import { chunkText, contextHeader, cosine, splitSentences, withContext } from "@/lib/ai/chunking";

describe("splitSentences", () => {
  it("splits on the Bangla danda and Latin punctuation", () => {
    expect(splitSentences("রাস্তা ভাঙা। ড্রেন বন্ধ! Is it urgent? Yes.")).toEqual(["রাস্তা ভাঙা।", "ড্রেন বন্ধ!", "Is it urgent?", "Yes."]);
  });
});

describe("cosine", () => {
  it("is 1 for the same direction, 0 for orthogonal and 0 for an empty vector", () => {
    expect(cosine([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe("chunkText", () => {
  const text = "Roads are mended by the city office. Report a pothole with a photo. Water bills are paid at the utility counter. Pay online or in person.";

  it("packs sentences by size without an embedder and says so", async () => {
    const c = await chunkText(text, { maxChars: 80, minChars: 10 });
    expect(c.length).toBeGreaterThan(1);
    expect(c.every((x) => x.method === "sentence" && x.text.length <= 80)).toBe(true);
    expect(c.map((x) => x.text).join(" ")).toBe(text);
  });

  it("breaks where the topic changes when sentence vectors say so (variable length)", async () => {
    const topic = (s: string) => (/road|pothole/i.test(s) ? [1, 0] : [0, 1]);
    const c = await chunkText(text, { maxChars: 500, minChars: 10, breakBelow: 0.5, embed: async (t) => t.map(topic) });
    expect(c.map((x) => x.method)).toEqual(["semantic", "semantic"]);
    expect(c[0].text).toMatch(/pothole/);
    expect(c[1].text).toMatch(/Water bills/);
    expect(c[0].text.length).not.toBe(c[1].text.length);
  });

  it("does not close a short chunk on a topic break", async () => {
    const c = await chunkText("A. B.", { minChars: 120, embed: async () => [[1, 0], [0, 1]] });
    expect(c).toHaveLength(1);
  });

  it("falls back to size-only packing when the embedder fails", async () => {
    const c = await chunkText(text, { maxChars: 80, minChars: 10, embed: async () => { throw new Error("down"); } });
    expect(c.every((x) => x.method === "sentence")).toBe(true);
  });

  it("splits one over-long sentence at word boundaries", async () => {
    const long = Array.from({ length: 40 }, () => "word").join(" ");
    const c = await chunkText(long, { maxChars: 50 });
    expect(c.length).toBeGreaterThan(2);
    expect(c.every((x) => x.text.length <= 50)).toBe(true);
  });

  it("returns nothing for empty text", async () => { expect(await chunkText("   ")).toEqual([]); });
});

describe("contextHeader", () => {
  it("names the document, source, date, agency and part", () => {
    const h = contextHeader({ title: "Pothole repair", source: "City Corporation site", checkedAt: "2026-11-16", agency: "City Corporation", part: [2, 3] });
    expect(h).toBe("[Pothole repair | source: City Corporation site, checked 2026-11-16 | agency: City Corporation | part 2 of 3]");
    expect(withContext(h, "Call the office.")).toBe(`${h}\nCall the office.`);
  });
  it("leaves out the part when there is only one", () => {
    expect(contextHeader({ title: "T", source: "S", checkedAt: "2026-01-01", part: [1, 1] })).toBe("[T | source: S, checked 2026-01-01]");
  });
});
