import { describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/lib/api-client";
import { toExploreIssue, type PublicIssue } from "@/lib/explore-api";
import { uploadPhotos } from "@/lib/report-api";

const item: PublicIssue = { ref: "JK-1", title: "ড্রেন", category: "drainage", area: "ওয়ার্ড ২", legacy_status: "received", created_at: "2026-11-10T06:00:00Z", is_sample: false, affected_count: 4, location: { lat: 23.81, lng: 90.41, approximate: true } };

describe("toExploreIssue", () => {
  it("maps the API item: legacy status, approximate point, me-too count", () => {
    expect(toExploreIssue(item)).toMatchObject({ ref: "JK-1", status: "received", lat: 23.81, lng: 90.41, supports: 4, createdAt: item.created_at });
    expect(toExploreIssue(item).sample).toBeUndefined();
  });
  it("keeps the sample flag and tolerates a missing location", () => {
    const r = toExploreIssue({ ...item, is_sample: true, location: null, affected_count: undefined });
    expect(r.sample).toBe(true);
    expect(r.lat).toBeUndefined();
    expect(r.supports).toBeUndefined();
  });
});

describe("api client", () => {
  const res = (status: number, json: unknown, headers: Record<string, string> = {}) => vi.fn().mockResolvedValue(new Response(JSON.stringify(json), { status, headers })) as unknown as typeof fetch;
  it("unwraps the envelope and sends the Idempotency-Key", async () => {
    const f = res(201, { data: { ref: "R" }, request_id: "x" }, { "Idempotent-Replay": "true" });
    const out = await api<{ ref: string }>("/issues", { body: { a: 1 }, idempotencyKey: "key-12345" }, f);
    expect(out).toMatchObject({ data: { ref: "R" }, replayed: true });
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-12345");
    expect(init.method).toBe("POST");
  });
  it("throws ApiError with code, field errors and retry-after; status 0 means no network", async () => {
    await expect(api("/x", {}, res(429, { code: "rate_limited", field_errors: {} }, { "Retry-After": "7" }))).rejects.toMatchObject({ code: "rate_limited", status: 429, retryAfter: 7 });
    await expect(api("/x", {}, res(422, { code: "validation_failed", field_errors: { lat: "range" } }))).rejects.toMatchObject({ fieldErrors: { lat: "range" } });
    const down = vi.fn().mockRejectedValue(new TypeError("offline")) as unknown as typeof fetch;
    const e = await api("/x", {}, down).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.isNetwork).toBe(true);
  });
});

describe("uploadPhotos", () => {
  it("uploads each photo and counts the ones that failed", async () => {
    const up = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({});
    const photo = { blob: new Blob(["a"]), caption: "" };
    expect(await uploadPhotos("JK-1", [photo, photo, photo], up)).toBe(1);
    expect(up).toHaveBeenCalledTimes(3);
  });
});

import { ideaBody, toIdea, type ApiIdea } from "@/lib/ideas-api";

describe("ideas api mapping", () => {
  const base: ApiIdea = { ref: "ID-1", constituency_key: "demo-1", category: "roads", title: "টয়লেট", body: "দরকার", status: "published", decision_note: null, created_at: "2026-11-10T06:00:00Z", support_count: 5 };
  it("maps API statuses to citizen labels and keeps the public reason", () => {
    expect(toIdea(base).status).toBe("submitted");
    expect(toIdea({ ...base, status: "declined", decision_note: "বাজেট নেই" })).toMatchObject({ status: "not_planned", reason: "বাজেট নেই", supports: 5 });
    expect(toIdea({ ...base, status: "pending_review", category: null, is_sample: true })).toMatchObject({ status: "moderation", category: "other", sample: true });
  });
  it("joins the form parts into one labelled body and skips empty ones", () => {
    const f = { title: "t", problem: "P", solution: "S", benefit: "", area: "", category: "roads", cost: "" };
    expect(ideaBody(f, { problem: "সমস্যা", solution: "সমাধান", benefit: "উপকার", area: "এলাকা", cost: "খরচ" }, "")).toBe("সমস্যা: P\n\nসমাধান: S");
  });
});
