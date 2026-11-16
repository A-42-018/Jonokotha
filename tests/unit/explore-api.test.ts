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
  it("labels the citizen cost as their own estimate, not official", () => {
    const f = { title: "t", problem: "P", solution: "S", benefit: "", area: "", category: "roads", cost: "m" };
    expect(ideaBody(f, { problem: "সমস্যা", solution: "সমাধান", benefit: "উপকার", area: "এলাকা", cost: "নিজের অনুমান, সরকারি হিসাব নয়" }, "মাঝারি")).toContain("নিজের অনুমান, সরকারি হিসাব নয়: মাঝারি");
  });
});

import { answeredPercent, medianLabel, repView, sourceHost } from "@/lib/mp-api";

describe("mp api helpers", () => {
  const area = { key: "demo-1", name_bn: "এলাকা ১", name_en: "Area 1", district: null, is_demo: true };
  const rep = { id: "r1", full_name: "নাম", office_title: null, official_contact: null, source_url: "https://example.org/a/b?x=1", verified_at: "2026-11-16", is_sample: true };
  it("builds the card view with a role fallback and the area name in the chosen language", () => {
    expect(repView(rep, area, "en", "Representative")).toMatchObject({ role: "Representative", constituency: "Area 1", sample: true });
    expect(repView({ ...rep, office_title: "এমপি" }, area, "bn", "x")).toMatchObject({ role: "এমপি", constituency: "এলাকা ১" });
  });
  it("shows only the host of a source link and tolerates a bad one", () => {
    expect(sourceHost(rep.source_url)).toBe("example.org");
    expect(sourceHost("not a url")).toBeNull();
    expect(sourceHost(null)).toBeNull();
  });
  it("answered percent has no divide by zero; median switches to days from 24 hours", () => {
    expect(answeredPercent({ received: 10, answered: 7 })).toBe(70);
    expect(answeredPercent({ received: 0, answered: 0 })).toBe(0);
    expect(medianLabel(null)).toBeNull();
    expect(medianLabel(0.2)).toEqual({ unit: "hours", n: 1 });
    expect(medianLabel(52)).toEqual({ unit: "days", n: 2 });
  });
});
