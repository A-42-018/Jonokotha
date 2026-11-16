import { describe, expect, it } from "vitest";
import { remainingToday, validateAsk, type AskMessage } from "@/lib/ask";

const msg = (at: string): AskMessage => ({ id: at, kind: "private", topic: "roads", subject: "x", message: "y", at });
const now = Date.UTC(2026, 10, 16, 12);

describe("ask your MP", () => {
  it("limits messages per rolling day", () => {
    const recent = [msg("2026-11-16T10:00:00Z"), msg("2026-11-16T09:00:00Z")];
    expect(remainingToday(recent, now)).toBe(1);
    expect(remainingToday([...recent, msg("2026-11-16T08:00:00Z")], now)).toBe(0);
    expect(remainingToday([msg("2026-11-14T10:00:00Z")], now)).toBe(3);
  });
  it("validates kind, topic, subject and message", () => {
    expect(validateAsk({ kind: "private", topic: "roads", subject: "Pothole", message: "There is a big pothole." })).toEqual({});
    expect(Object.keys(validateAsk({ kind: "", topic: "x", subject: "ab", message: "short" })).sort()).toEqual(["kind", "message", "subject", "topic"]);
  });
});
