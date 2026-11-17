import { beforeEach, describe, expect, it } from "vitest";
import { limited, readJson } from "@/lib/http";
import { resetRateLimits } from "@/lib/rate-limit";

beforeEach(resetRateLimits);
const post = (body: string, headers: Record<string, string> = {}) => new Request("http://x/api", { method: "POST", body, headers });

describe("readJson", () => {
  it("parses valid JSON", async () => {
    const r = await readJson(post('{"a":1}'));
    expect(r).toEqual({ ok: true, data: { a: 1 } });
  });
  it("rejects oversized bodies with 413", async () => {
    const r = await readJson(post(JSON.stringify({ text: "x".repeat(2000) })), 1024);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.status).toBe(413);
  });
  it("rejects malformed JSON with 400", async () => {
    const r = await readJson(post("{nope"));
    if (r.ok) throw new Error("should fail");
    expect(r.res.status).toBe(400);
  });
});

describe("limited", () => {
  it("returns 429 with Retry-After on a burst from one IP", () => {
    const req = () => new Request("http://x/api", { headers: { "x-forwarded-for": "9.9.9.9" } });
    for (let i = 0; i < 10; i++) expect(limited(req(), "intake", null, 10)).toBeNull();
    const res = limited(req(), "intake", null, 10);
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBeTruthy();
  });
});

import { sameOrigin } from "@/lib/http";
describe("sameOrigin (CSRF second layer)", () => {
  it("accepts no Origin and the same host, refuses others and garbage", () => {
    expect(sameOrigin(null, "jonokotha.vercel.app")).toBe(true);
    expect(sameOrigin("https://jonokotha.vercel.app", "jonokotha.vercel.app")).toBe(true);
    expect(sameOrigin("https://evil.example", "jonokotha.vercel.app")).toBe(false);
    expect(sameOrigin("null", "jonokotha.vercel.app")).toBe(false);
  });
});
