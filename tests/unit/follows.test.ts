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
