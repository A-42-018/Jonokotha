import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError, ERROR_STATUS, fromDbError, newRequestId, parse, problem } from "@/lib/api";
import { decodeCursor, encodeCursor, PageQuery, toPage, afterCursor } from "@/lib/pagination";
import { performOfficeAction } from "@/lib/office-endpoints";
import { performCitizenAction } from "@/lib/citizen-actions";

describe("error format", () => {
  it("always has code, message, field_errors and request_id, with the right HTTP status", async () => {
    for (const code of Object.keys(ERROR_STATUS) as (keyof typeof ERROR_STATUS)[]) {
      const res = problem(new ApiError(code, "m", { f: "bad" }), "req-12345678");
      expect(res.status).toBe(ERROR_STATUS[code]);
      expect(res.headers.get("x-request-id")).toBe("req-12345678");
      expect(await res.json()).toEqual({ code, message: "m", field_errors: { f: "bad" }, request_id: "req-12345678" });
    }
  });

  it("generates a request id unless a safe one is supplied", () => {
    const mk = (id?: string) => new Request("http://x.test/", { headers: id ? { "x-request-id": id } : {} });
    expect(newRequestId(mk("abc-12345678"))).toBe("abc-12345678");
    expect(newRequestId(mk("short"))).not.toBe("short");
    expect(newRequestId(mk("has spaces and <script>"))).not.toContain("<");
    expect(newRequestId(mk())).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("turns Zod failures into one 422 with a message per field", () => {
    const schema = z.object({ title: z.string().min(3), nested: z.object({ n: z.number() }) });
    try { parse(schema, { title: "x", nested: { n: "no" } }); expect.unreachable(); }
    catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.code).toBe("validation_failed");
      expect(Object.keys(err.fieldErrors).sort()).toEqual(["nested.n", "title"]);
    }
  });

  it("maps database error codes to API errors", () => {
    expect(fromDbError({ code: "JK404" }).code).toBe("not_found");
    expect(fromDbError({ code: "42501" }).code).toBe("forbidden");
    expect(fromDbError({ code: "JK001" }).code).toBe("invalid_transition");
    expect(fromDbError({ code: "JK003", details: "reopen_window_expired" }).code).toBe("rule_not_met");
    const missing = fromDbError({ code: "JK002", details: "destination" });
    expect(missing).toMatchObject({ code: "validation_failed", fieldErrors: { agency_id: expect.any(String) } });
    expect(fromDbError({ code: "XX000", message: "relation secret_table does not exist" })).toMatchObject({ code: "internal_error", message: "Something went wrong." });
  });
});

describe("cursor pagination", () => {
  const ts = "2026-11-16T07:21:00.123456+00:00";
  it("round-trips and stays opaque", () => {
    const c = encodeCursor(ts, "JK-2026-1001");
    expect(c).not.toContain("JK-2026");
    expect(decodeCursor(c)).toEqual({ createdAt: ts, ref: "JK-2026-1001" });
  });
  it("rejects tampered or injected cursors", () => {
    const bad = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    for (const c of ["", "not-base64!!", bad([ts]), bad(["x", "JK-1"]), bad([ts, "a),or(id.neq.0"]), bad([ts + ",id.eq.1", "JK-1"]), bad([1, 2]), bad({ a: 1 })]) {
      expect(() => decodeCursor(c), c).toThrow(ApiError);
    }
  });
  it("builds a keyset filter only from validated values", () => {
    expect(afterCursor({ createdAt: ts, ref: "JK-2026-1001" })).toBe(`created_at.lt.${ts},and(created_at.eq.${ts},ref.lt.JK-2026-1001)`);
  });
  it("returns the next cursor only when more rows exist", () => {
    const rows = [3, 2, 1].map((n) => ({ created_at: `2026-11-16T07:0${n}:00+00:00`, ref: `JK-${n}` }));
    const full = toPage(rows, 2);
    expect(full.items).toHaveLength(2);
    expect(decodeCursor(full.page.next_cursor!)).toMatchObject({ ref: "JK-2" });
    expect(toPage(rows.slice(0, 2), 2).page.next_cursor).toBeNull();
  });
  it("limits page size", () => {
    expect(PageQuery.parse({}).limit).toBe(20);
    expect(PageQuery.safeParse({ limit: "0" }).success).toBe(false);
    expect(PageQuery.safeParse({ limit: "51" }).success).toBe(false);
    expect(PageQuery.parse({ limit: "50" }).limit).toBe(50);
  });
});

// Validation happens before any database call, so a stub context is enough.
const ctx = (body: unknown) => ({ body, params: { ref: "JK-1" }, rid: "r-12345678", sb: {} as never, user: { id: "u" } as never }) as never;
const issue = { id: "i", status: "acknowledged" as const };
const fieldsOf = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return e instanceof ApiError ? { code: e.code, fields: Object.keys(e.fieldErrors).sort() } : String(e); } };

describe("per-endpoint validation", () => {
  it("office actions reject missing, short and unknown fields", async () => {
    expect(await fieldsOf(performOfficeAction(ctx({}), "request-information", issue))).toEqual({ code: "validation_failed", fields: ["message"] });
    expect(await fieldsOf(performOfficeAction(ctx({ message: "ab" }), "request-information", issue))).toEqual({ code: "validation_failed", fields: ["message"] });
    expect(await fieldsOf(performOfficeAction(ctx({ assignee: "not-a-uuid" }), "assign", issue))).toEqual({ code: "validation_failed", fields: ["assignee"] });
    expect(await fieldsOf(performOfficeAction(ctx({}), "forward", issue))).toEqual({ code: "validation_failed", fields: ["agency_id", "contact_channel"] });
    expect(await fieldsOf(performOfficeAction(ctx({ resolution_note: "ok" }), "resolve", issue))).toEqual({ code: "validation_failed", fields: ["resolution_note"] });
    expect(await fieldsOf(performOfficeAction(ctx({ reason: "long enough reason" }), "reject", issue))).toEqual({ code: "validation_failed", fields: ["appeal_route"] });
    expect(await fieldsOf(performOfficeAction(ctx({ master_ref: "x" }), "mark-duplicate", issue))).toEqual({ code: "validation_failed", fields: ["master_ref"] });
    expect(await fieldsOf(performOfficeAction(ctx({ typo_field: 1 }), "acknowledge", issue))).toMatchObject({ code: "validation_failed" });
    expect(await fieldsOf(performOfficeAction(ctx({ note: "n", status: "in_progress" }), "update", issue))).toMatchObject({ code: "validation_failed" });
    expect(await fieldsOf(performOfficeAction(ctx({}), "update", issue))).toMatchObject({ code: "validation_failed" });
    expect(await fieldsOf(performOfficeAction(ctx({ status: "resolved" }), "update", issue))).toMatchObject({ code: "validation_failed" }); // only under_review / in_progress
  });
  it("citizen actions validate before touching anything", async () => {
    expect(await fieldsOf(performCitizenAction(ctx({ rating: 6 }), "feedback", { id: "i", status: "resolved" }))).toEqual({ code: "validation_failed", fields: ["rating"] });
    expect(await fieldsOf(performCitizenAction(ctx({ rating: 3.5 }), "feedback", { id: "i", status: "resolved" }))).toEqual({ code: "validation_failed", fields: ["rating"] });
    expect(await fieldsOf(performCitizenAction(ctx({}), "reopen", { id: "i", status: "closed" }))).toEqual({ code: "validation_failed", fields: ["reason"] });
    expect(await fieldsOf(performCitizenAction(ctx({ message: "" }), "additional-information", { id: "i", status: "needs_information" }))).toEqual({ code: "validation_failed", fields: ["message"] });
    expect(await fieldsOf(performCitizenAction(ctx({ rating: 5 }), "feedback", { id: "i", status: "acknowledged" }))).toMatchObject({ code: "rule_not_met" });
  });
});
