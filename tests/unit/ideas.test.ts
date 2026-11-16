import { describe, expect, it } from "vitest";
import { ideasFor, shownSupports, similarIdeas } from "@/lib/ideas";
import { SAMPLE_IDEAS } from "@/lib/sample";

const label = (c: string) => c;

describe("ideas", () => {
  it("popular sorts by support, newest by date, review keeps only under-review statuses", () => {
    const pop = ideasFor(SAMPLE_IDEAS, "popular", "", "all", label);
    expect(pop[0].supports).toBeGreaterThanOrEqual(pop[1].supports);
    const newest = ideasFor(SAMPLE_IDEAS, "newest", "", "all", label);
    expect(newest[0].createdAt >= newest[1].createdAt).toBe(true);
    const review = ideasFor(SAMPLE_IDEAS, "review", "", "all", label);
    expect(review.length).toBeGreaterThan(0);
    expect(review.every((i) => ["moderation", "office_review", "needs_info", "under_consideration"].includes(i.status))).toBe(true);
  });
  it("filters by text and category", () => {
    expect(ideasFor(SAMPLE_IDEAS, "newest", "টয়লেট", "all", label)).toHaveLength(1);
    expect(ideasFor(SAMPLE_IDEAS, "newest", "", "health", label).every((i) => i.category === "health")).toBe(true);
  });
  it("suggests similar ideas for a near-duplicate and none for unrelated text", () => {
    expect(similarIdeas("বাজারের পাশে পাবলিক টয়লেট দরকার", SAMPLE_IDEAS)[0]?.id).toBe("idea-sample-1");
    expect(similarIdeas("zzz qqq", SAMPLE_IDEAS)).toEqual([]);
    expect(similarIdeas("ab", SAMPLE_IDEAS)).toEqual([]);
  });
  it("support count adds this device's one support", () => {
    expect(shownSupports(SAMPLE_IDEAS[0], true)).toBe(SAMPLE_IDEAS[0].supports + 1);
    expect(shownSupports(SAMPLE_IDEAS[0], false)).toBe(SAMPLE_IDEAS[0].supports);
  });
});
