import { describe, expect, it } from "vitest";
import { clearDeviceData } from "@/lib/settings";

describe("clearDeviceData", () => {
  it("removes only this app's keys", () => {
    localStorage.setItem("jonokotha:follows:v1", "{}");
    localStorage.setItem("jonokotha:ask:v1", "[]");
    localStorage.setItem("other-site:key", "keep");
    expect(clearDeviceData()).toBe(2);
    expect(localStorage.getItem("other-site:key")).toBe("keep");
    expect(localStorage.getItem("jonokotha:follows:v1")).toBeNull();
  });
});
