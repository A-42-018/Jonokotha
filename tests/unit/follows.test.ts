import { describe, expect, it } from "vitest";
import { isFollowing, isRating, NO_FOLLOWS, toggleFollow } from "@/lib/follows";

describe("follows", () => {
  it("toggles without mutating", () => {
    const a = toggleFollow(NO_FOLLOWS, "issues", "JK-1");
    expect(a.issues).toEqual(["JK-1"]);
    expect(NO_FOLLOWS.issues).toEqual([]);
    expect(toggleFollow(a, "issues", "JK-1").issues).toEqual([]);
    expect(isFollowing(a, "issues", "JK-1")).toBe(true);
    expect(toggleFollow(a, "categories", "roads").categories).toEqual(["roads"]);
  });
  it("accepts only whole ratings 1 to 5", () => {
    expect([1, 3, 5].every(isRating)).toBe(true);
    expect([0, 6, 2.5, NaN, "3", undefined].some(isRating)).toBe(false);
  });
});

import { feedFor } from "@/lib/follows";
import { SAMPLE_ISSUES } from "@/lib/sample";
import { unreadOf } from "@/components/citizen/NotificationList";
import { SAMPLE_NOTICES } from "@/lib/sample";

describe("feed and notifications", () => {
  it("shows nothing when nothing is followed", () => {
    expect(feedFor(NO_FOLLOWS, SAMPLE_ISSUES)).toEqual([]);
  });
  it("matches followed categories, areas and issues, newest update first, capped", () => {
    const byCat = feedFor({ ...NO_FOLLOWS, categories: ["roads"] }, SAMPLE_ISSUES);
    expect(byCat.length).toBeGreaterThan(0);
    expect(byCat.every((i) => i.category === "roads")).toBe(true);
    expect(feedFor({ ...NO_FOLLOWS, areas: ["demo-1"] }, SAMPLE_ISSUES, 3)).toHaveLength(3);
    expect(feedFor({ ...NO_FOLLOWS, issues: ["JK-SAMPLE-104"] }, SAMPLE_ISSUES).map((i) => i.ref)).toEqual(["JK-SAMPLE-104"]);
    const all = feedFor({ ...NO_FOLLOWS, areas: ["demo-1"] }, SAMPLE_ISSUES, 20);
    expect(all[0].updatedAt >= all[1].updatedAt).toBe(true);
  });
  it("counts unread notices", () => {
    expect(unreadOf(SAMPLE_NOTICES, []).length).toBe(SAMPLE_NOTICES.length);
    expect(unreadOf(SAMPLE_NOTICES, ["n1", "n2"]).length).toBe(SAMPLE_NOTICES.length - 2);
  });
});
