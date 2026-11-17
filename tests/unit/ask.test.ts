import { describe, expect, it } from "vitest";
import { validateAsk } from "@/lib/ask";


describe("ask your MP", () => {
  it("validates kind, topic, subject and message", () => {
    expect(validateAsk({ kind: "private", topic: "roads", subject: "Pothole", message: "There is a big pothole." })).toEqual({});
    expect(Object.keys(validateAsk({ kind: "", topic: "x", subject: "ab", message: "short" })).sort()).toEqual(["kind", "message", "subject", "topic"]);
  });
});
