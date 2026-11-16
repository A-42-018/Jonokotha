import { describe, expect, it } from "vitest";
import { appendTranscript, speechProblem } from "@/lib/speech";

describe("speech", () => {
  it("maps recognition errors", () => {
    expect(speechProblem("not-allowed")).toBe("denied");
    expect(speechProblem("service-not-allowed")).toBe("denied");
    expect(speechProblem("no-speech")).toBe("silence");
    expect(speechProblem("network")).toBe("network");
    expect(speechProblem("aborted")).toBeNull();
    expect(speechProblem("weird")).toBe("other");
    expect(speechProblem(undefined)).toBe("other");
  });
  it("appends phrases with single spaces", () => {
    expect(appendTranscript("", " রাস্তা ")).toBe("রাস্তা");
    expect(appendTranscript("রাস্তায় গর্ত ", "আছে")).toBe("রাস্তায় গর্ত আছে");
    expect(appendTranscript("abc", "  ")).toBe("abc");
  });
});
