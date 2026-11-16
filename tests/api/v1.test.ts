import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as listPublic, POST as createIssue } from "../../src/app/api/v1/issues/route";
import { GET as getPublic } from "../../src/app/api/v1/issues/[ref]/route";
import { POST as citizenAction } from "../../src/app/api/v1/issues/[ref]/[action]/route";
import { GET as listOffice } from "../../src/app/api/v1/office/issues/route";
import { GET as getOffice } from "../../src/app/api/v1/office/issues/[ref]/route";
import { POST as officeAction } from "../../src/app/api/v1/office/issues/[ref]/[action]/route";
import { POST as legacyCreate } from "../../src/app/api/cases/route";
import { POST as legacyApprove } from "../../src/app/api/cases/[ref]/approve/route";
import { admin, as, call, cleanup, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, B: { id: string; key: string }, P: { id: string; key: string };
let citizen: TestUser, other: TestUser, manager: TestUser, officer: TestUser, mp: TestUser, managerB: TestUser;
let seq = 0;
const key = () => `key-${Date.now().toString(36)}-${seq++}-xxxx`;

/** Fixture issue created straight in the database (the API's per-user create limit would otherwise get in the way). */
async function seedIssue(reporter: TestUser, c = A, extra: Record<string, unknown> = {}) {
  const { data } = await admin.from("issues").insert({ reporter_id: reporter.id, title: "Pothole near the market", category: "roads", description: "A deep pothole on the main road.", area: "Ward 3", constituency_id: c.id, ...extra })
    .select("id,ref").single().throwOnError();
  return data!;
}
const office = (ref: string, action: string, body: unknown = {}, headers: Record<string, string> = {}) =>
  call(officeAction, "POST", `/api/v1/office/issues/${ref}/${action}`, { body, headers, params: { ref, action } });
const citizenCall = (ref: string, action: string, body: unknown = {}) =>
  call(citizenAction, "POST", `/api/v1/issues/${ref}/${action}`, { body, params: { ref, action } });
const statusOf = async (id: string) => (await admin.from("issues").select("status").eq("id", id).single()).data!.status;

beforeAll(async () => {
  A = await makeConstituency(); B = await makeConstituency(); P = await makeConstituency();
  citizen = await makeUser("citizen"); other = await makeUser("citizen");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  officer = await makeUser("staff", { constituencyId: A.id, officeRole: "case_officer" });
  mp = await makeUser("staff", { constituencyId: A.id, officeRole: "mp" });
  managerB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
});
afterAll(async () => { as(null); await cleanup([A.id, B.id, P.id]); });

describe("error format and request ids", () => {
  it("returns {code, message, field_errors, request_id} and echoes a safe x-request-id", async () => {
    as(null);
    const r = await call(createIssue, "POST", "/api/v1/issues", { body: {}, headers: { "idempotency-key": key(), "x-request-id": "client-req-0001" } });
    expect(r.status).toBe(401);
    expect(r.json).toEqual({ code: "unauthenticated", message: expect.any(String), field_errors: {}, request_id: "client-req-0001" });
    expect(r.headers.get("x-request-id")).toBe("client-req-0001");
    const bad = await call(createIssue, "POST", "/api/v1/issues", { body: {}, headers: { "x-request-id": "bad id <x>" } });
    expect(bad.json.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects invalid JSON (400), oversized bodies (413) and invalid fields (422 with field_errors)", async () => {
    as(citizen);
    const k = { "idempotency-key": key() };
    expect((await call(createIssue, "POST", "/api/v1/issues", { rawBody: "{not json", headers: k })).json.code).toBe("invalid_json");
    const big = await call(createIssue, "POST", "/api/v1/issues", { rawBody: JSON.stringify({ title: "x".repeat(40_000) }), headers: k });
    expect(big.status).toBe(413); expect(big.json.code).toBe("payload_too_large");
    const inv = await call(createIssue, "POST", "/api/v1/issues", { body: { title: "x", category: "nope", description: "" }, headers: { "idempotency-key": key() } });
    expect(inv.status).toBe(422);
    expect(Object.keys(inv.json.field_errors!).sort()).toEqual(["category", "description", "title"]);
    expect(inv.json.request_id).toBeTruthy();
  });

  it("returns 404 for unknown actions, malformed refs and unknown issues, in the same format", async () => {
    as(manager);
    for (const r of [await office("JK-2026-9999", "acknowledge"), await office("JK-2026-9999", "explode"), await office("bad ref!", "acknowledge")]) {
      expect(r.status).toBe(404); expect(r.json).toMatchObject({ code: "not_found", field_errors: {} });
    }
    as(null);
    const pub = await call(getPublic, "GET", "/api/v1/issues/JK-2026-9999", { params: { ref: "JK-2026-9999" } });
    expect(pub.status).toBe(404);
  });

  it("logs one structured line per request with the request id, and never the body", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((s: unknown) => { lines.push(String(s)); });
    as(citizen);
    const r = await call(createIssue, "POST", "/api/v1/issues", { body: { title: "Secret title", category: "roads", description: "TOP-SECRET-DESCRIPTION 01712345678", constituencyId: A.key }, headers: { "idempotency-key": key(), "x-request-id": "log-test-0001" } });
    spy.mockRestore();
    expect(r.status).toBe(201);
    const entry = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((e) => e?.request_id === "log-test-0001");
    expect(entry).toMatchObject({ route: "POST /api/v1/issues", method: "POST", status: 201, actor: citizen.id });
    expect(entry.ms).toBeGreaterThanOrEqual(0);
    expect(lines.join("\n")).not.toMatch(/TOP-SECRET|01712345678|Secret title/);
    await admin.from("issues").delete().eq("ref", r.json.data.ref);
  });
});

describe("creating issues", () => {
  it("requires an Idempotency-Key, validates it, and replays the same response for a retry", async () => {
    const reporter = await makeUser("citizen"); // every request counts toward the per-user limit, so use a fresh account
    as(reporter);
    const body = { title: "Broken streetlight", category: "electricity", description: "The light on lane 4 is out.", area: "Lane 4", constituencyId: A.key };
    const none = await call(createIssue, "POST", "/api/v1/issues", { body });
    expect(none.status).toBe(400); expect(none.json.code).toBe("idempotency_key_required");
    const malformed = await call(createIssue, "POST", "/api/v1/issues", { body, headers: { "idempotency-key": "short" } });
    expect(malformed.status).toBe(422);

    const k = key();
    const first = await call(createIssue, "POST", "/api/v1/issues", { body, headers: { "idempotency-key": k } });
    expect(first.status).toBe(201);
    expect(first.json.data).toMatchObject({ ref: expect.stringMatching(/^JK-/), status: "submitted" });
    const retry = await call(createIssue, "POST", "/api/v1/issues", { body, headers: { "idempotency-key": k } });
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotent-replay")).toBe("true");
    expect(retry.json.data.ref).toBe(first.json.data.ref);
    expect(retry.json.request_id).not.toBe(first.json.request_id);
    const { count } = await admin.from("issues").select("id", { count: "exact", head: true }).eq("title", body.title).eq("reporter_id", reporter.id);
    expect(count).toBe(1);
    const clash = await call(createIssue, "POST", "/api/v1/issues", { body: { ...body, title: "Another title" }, headers: { "idempotency-key": k } });
    expect(clash.status).toBe(409); expect(clash.json.code).toBe("idempotency_conflict");
  });

  it("does not burn an Idempotency-Key on a failed request: the key can be retried with a corrected body", async () => {
    as(await makeUser("citizen"));
    const body = { title: "Broken streetlight", category: "electricity", description: "The light on lane 4 is out.", area: "Lane 4", constituencyId: A.key };
    const k2 = key();
    expect((await call(createIssue, "POST", "/api/v1/issues", { body: { ...body, category: "nope" }, headers: { "idempotency-key": k2 } })).status).toBe(422);
    expect((await call(createIssue, "POST", "/api/v1/issues", { body, headers: { "idempotency-key": k2 } })).status).toBe(201);
  });

  it("takes the reporter and the initial status from the session, never from the body, and redacts personal data", async () => {
    const reporter = await makeUser("citizen");
    as(reporter);
    const r = await call(createIssue, "POST", "/api/v1/issues", { body: { title: "Call me", category: "other", description: "Phone 01712345678 mail a@b.com", constituencyId: A.key, reporter_id: other.id }, headers: { "idempotency-key": key() } });
    expect(r.status).toBe(422); // unknown keys are rejected rather than ignored
    const ok = await call(createIssue, "POST", "/api/v1/issues", { body: { title: "Call me", category: "other", description: "Phone 01712345678 mail a@b.com", constituencyId: A.key }, headers: { "idempotency-key": key() } });
    const { data } = await admin.from("issues").select("reporter_id,status,description").eq("ref", ok.json.data.ref).single();
    expect(data).toMatchObject({ reporter_id: reporter.id, status: "submitted" });
    expect(data!.description).not.toMatch(/01712345678|a@b\.com/);
    const unknown = await call(createIssue, "POST", "/api/v1/issues", { body: { title: "Hello there", category: "other", description: "text", constituencyId: "no-such-place" }, headers: { "idempotency-key": key() } });
    expect(unknown.status).toBe(422); expect(unknown.json.field_errors).toHaveProperty("constituency");
    as(null);
    expect((await call(createIssue, "POST", "/api/v1/issues", { body: {}, headers: { "idempotency-key": key() } })).status).toBe(401);
  });

  it("limits creation per signed-in user across requests (429 with Retry-After)", async () => {
    const u = await makeUser("citizen");
    as(u);
    const statuses: number[] = [];
    let retry: string | null = null;
    for (let i = 0; i < 7; i++) {
      const r = await call(createIssue, "POST", "/api/v1/issues", { body: { title: `Report number ${i}`, category: "other", description: "text here", constituencyId: A.key }, headers: { "idempotency-key": key() } });
      statuses.push(r.status);
      if (r.status === 429) { retry = r.headers.get("retry-after"); expect(r.json.code).toBe("rate_limited"); }
    }
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses.slice(5)).toEqual([429, 429]);
    expect(Number(retry)).toBeGreaterThan(0);
  });

  it("limits anonymous reads per IP", async () => {
    as(null);
    const ip = "203.0.113.77";
    let last = 0;
    for (let i = 0; i < 121; i++) last = (await call(listPublic, "GET", "/api/v1/issues?limit=1", { ip })).status;
    expect(last).toBe(429);
  });
});

describe("public reads", () => {
  it("paginates with an opaque cursor, even when rows share a timestamp", async () => {
    const batch = Array.from({ length: 5 }, (_, i) => ({ reporter_id: citizen.id, title: `Page test ${i}`, category: "water", description: "d", area: "x", constituency_id: P.id }));
    await admin.from("issues").insert(batch).throwOnError(); // one statement: identical created_at
    as(null);
    const seen: string[] = [];
    let cursor: string | undefined, pages = 0;
    do {
      const r = await call(listPublic, "GET", `/api/v1/issues?constituency=${P.key}&limit=2${cursor ? `&cursor=${cursor}` : ""}`);
      expect(r.status).toBe(200);
      seen.push(...r.json.data.map((d: { ref: string }) => d.ref));
      cursor = r.json.page.next_cursor ?? undefined; pages++;
      expect(r.json.page.limit).toBe(2);
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect([...seen].sort().reverse()).toEqual(seen); // ordered newest/highest reference first
    expect((await call(listPublic, "GET", "/api/v1/issues?cursor=garbage")).json.code).toBe("validation_failed");
  });

  it("filters, validates query values, and never exposes private or unmeasured fields", async () => {
    as(null);
    const r = await call(listPublic, "GET", `/api/v1/issues?constituency=${P.key}&category=water&status=submitted`);
    expect(r.json.data.length).toBeGreaterThan(0);
    expect((await call(listPublic, "GET", "/api/v1/issues?category=nope")).status).toBe(422);
    expect((await call(listPublic, "GET", "/api/v1/issues?limit=500")).status).toBe(422);
    const text = JSON.stringify(r.json);
    expect(text).not.toMatch(/reporter|confidence|assigned_to|internal_note|actor/);
    expect(Object.keys(r.json.data[0]).sort()).toEqual(["affected_count", "area", "category", "constituency", "created_at", "description", "is_sample", "legacy_status", "location", "ref", "similar_refs", "status", "summary", "title"]);
  });
});

describe("office actions: authorization", () => {
  it("keeps citizens, other citizens and other offices out", async () => {
    const issue = await seedIssue(citizen);
    as(other);
    expect((await citizenCall(issue.ref, "reopen", { reason: "not mine to reopen" })).status).toBe(404);
    expect((await office(issue.ref, "acknowledge")).status).toBe(404);
    as(citizen); // the reporter sees their issue but may not use office actions
    expect((await office(issue.ref, "acknowledge")).status).toBe(403);
    expect((await call(listOffice, "GET", "/api/v1/office/issues")).status).toBe(403);
    as(managerB);
    expect((await office(issue.ref, "acknowledge")).status).toBe(404);
    expect((await call(getOffice, "GET", `/api/v1/office/issues/${issue.ref}`, { params: { ref: issue.ref } })).status).toBe(404);
    as(null);
    expect((await office(issue.ref, "acknowledge")).status).toBe(401);
    expect(await statusOf(issue.id)).toBe("submitted");
  });

  it("applies the role matrix: officers and MPs cannot do manager actions; officers only touch assigned issues", async () => {
    const issue = await seedIssue(citizen);
    as(officer);
    expect((await office(issue.ref, "update", { note: "not assigned to me" })).status).toBe(404); // cannot even see it
    await admin.rpc("assign_issue", { p_issue: issue.id, p_assignee: officer.id });
    expect((await office(issue.ref, "update", { note: "checked on site", public: false })).status).toBe(201);
    expect((await office(issue.ref, "acknowledge")).status).toBe(403);
    await admin.rpc("transition_issue", { p_issue: issue.id, p_to: "acknowledged" });
    expect((await office(issue.ref, "resolve", { resolution_note: "all done here" })).status).toBe(403);
    as(mp);
    expect((await call(listOffice, "GET", "/api/v1/office/issues")).status).toBe(200);
    expect((await office(issue.ref, "resolve", { resolution_note: "an MP cannot resolve" })).status).toBe(403);
    as(manager);
    const q = await call(listOffice, "GET", `/api/v1/office/issues?limit=50`);
    expect(q.status).toBe(200);
    expect(q.json.data.map((d: { ref: string }) => d.ref)).toContain(issue.ref);
    as(managerB);
    const qb = await call(listOffice, "GET", `/api/v1/office/issues?limit=50`);
    expect(qb.json.data.map((d: { ref: string }) => d.ref)).not.toContain(issue.ref);
  });
});

describe("office and citizen actions: a full lifecycle", () => {
  it("walks an issue through the state machine and records who did what", async () => {
    const issue = await seedIssue(citizen);
    as(manager);
    const ack = await office(issue.ref, "acknowledge", {}, { "x-request-id": "ack-request-0001" });
    expect(ack).toMatchObject({ status: 200, json: { data: { ref: issue.ref, status: "acknowledged" } } });
    const ev = await admin.from("issue_events").select("metadata,actor_id").eq("issue_id", issue.id).eq("to_status", "acknowledged").single();
    expect(ev.data).toMatchObject({ actor_id: manager.id, metadata: { request_id: "ack-request-0001" } });

    const again = await office(issue.ref, "acknowledge");
    expect(again.status).toBe(409); expect(again.json.code).toBe("invalid_transition");

    const noMsg = await office(issue.ref, "request-information", {});
    expect(noMsg.status).toBe(422); expect(noMsg.json.field_errors).toHaveProperty("message");
    expect((await office(issue.ref, "assign", { assignee: officer.id, reason: "nearest officer" })).json.data.status).toBe("assigned");
    expect((await office(issue.ref, "assign", { assignee: mp.id })).status).toBe(422); // an MP cannot be assigned

    expect((await office(issue.ref, "request-information", { message: "Which lane is it on?" })).json.data.status).toBe("needs_information");
    as(citizen);
    expect((await citizenCall(issue.ref, "additional-information", { message: "Lane 4, near the school" })).json.data.status).toBe("under_review");
    expect((await citizenCall(issue.ref, "additional-information", { message: "again" })).status).toBe(409);

    as(manager);
    const noContact = await office(issue.ref, "forward", { agency_name: "Road department" });
    expect(noContact.status).toBe(422); expect(noContact.json.field_errors).toHaveProperty("contact_channel");
    expect((await office(issue.ref, "forward", { agency_name: "Road department", contact_channel: "https://example.test/report", external_reference: "RD-77" })).json.data.status).toBe("referred_to_authority");
    expect((await office(issue.ref, "update", { status: "in_progress" })).json.data.status).toBe("in_progress");

    expect((await office(issue.ref, "update", { note: "Visible to the citizen", public: true })).status).toBe(201);
    expect((await office(issue.ref, "update", { note: "internal only SECRET-NOTE", public: false })).status).toBe(201);
    expect((await office(issue.ref, "update", { note: "n", status: "in_progress" })).status).toBe(422);
    as(null);
    const pub = await call(getPublic, "GET", `/api/v1/issues/${issue.ref}`, { params: { ref: issue.ref } });
    const timeline = JSON.stringify(pub.json.data.timeline);
    expect(timeline).toContain("Visible to the citizen");
    expect(timeline).not.toContain("SECRET-NOTE");
    expect(pub.json.data.status).toBe("in_progress");

    as(manager);
    const detail = await call(getOffice, "GET", `/api/v1/office/issues/${issue.ref}`, { params: { ref: issue.ref } });
    expect(JSON.stringify(detail.json.data.events)).toContain("SECRET-NOTE");
    expect(detail.json.data.referrals[0]).toMatchObject({ agency_name: "Road department", external_reference: "RD-77" });
    expect(detail.json.data.assignments.length).toBeGreaterThan(0);

    expect((await office(issue.ref, "resolve", { resolution_note: "Pothole filled" })).json.data.status).toBe("resolved");
    const early = await office(issue.ref, "close", {});
    expect(early.status).toBe(422); expect(early.json.field_errors).toHaveProperty("reason");
    expect((await office(issue.ref, "close", { reason: "reporter confirmed the fix" })).json.data.status).toBe("closed");

    as(citizen);
    expect((await citizenCall(issue.ref, "feedback", { rating: 5, comment: "Thank you" })).status).toBe(201);
    expect((await citizenCall(issue.ref, "feedback", { rating: 4 })).status).toBe(409);
    expect((await citizenCall(issue.ref, "reopen", { reason: "The hole is back after the rain" })).json.data.status).toBe("reopened");
    expect(await statusOf(issue.id)).toBe("reopened");
  });

  it("accepts feedback only after resolution, as 1-5", async () => {
    const issue = await seedIssue(citizen);
    as(citizen);
    const early = await citizenCall(issue.ref, "feedback", { rating: 5 });
    expect(early.status).toBe(409); expect(early.json.code).toBe("rule_not_met");
    await admin.rpc("transition_issue", { p_issue: issue.id, p_to: "acknowledged" });
    await admin.rpc("transition_issue", { p_issue: issue.id, p_to: "resolved", p_fields: { resolution_note: "done and dusted" } });
    expect((await citizenCall(issue.ref, "feedback", { rating: 0 })).status).toBe(422);
    expect((await citizenCall(issue.ref, "feedback", { rating: 3 })).status).toBe(201);
    as(other);
    expect((await citizenCall(issue.ref, "feedback", { rating: 1 })).status).toBe(404);
  });

  it("supports the decisions: reject (reason and appeal route), duplicate (master), out of jurisdiction, office reopen", async () => {
    const master = await seedIssue(citizen), dup = await seedIssue(citizen), rej = await seedIssue(citizen), out = await seedIssue(citizen);
    as(manager);
    const noAppeal = await office(rej.ref, "reject", { reason: "Not something this office handles" });
    expect(noAppeal.status).toBe(422); expect(noAppeal.json.field_errors).toHaveProperty("appeal_route");
    expect((await office(rej.ref, "reject", { reason: "Not something this office handles", appeal_route: "Write to the ward office" })).json.data.status).toBe("rejected");
    expect((await office(dup.ref, "mark-duplicate", { master_ref: "JK-0000-0000" })).status).toBe(422);
    expect((await office(dup.ref, "mark-duplicate", { master_ref: dup.ref })).status).toBe(422);
    expect((await office(dup.ref, "mark-duplicate", { master_ref: master.ref })).json.data.status).toBe("duplicate");
    expect((await admin.from("issues").select("master_issue_id").eq("id", dup.id).single()).data!.master_issue_id).toBe(master.id);
    expect((await office(out.ref, "out-of-jurisdiction", { reason: "This is a national matter" })).json.data.status).toBe("out_of_jurisdiction");
    expect((await office(out.ref, "reopen", { reason: "Agency confirmed it is ours" })).json.data.status).toBe("reopened");
    // The citizen can appeal a rejection.
    as(citizen);
    expect((await citizenCall(rej.ref, "reopen", { reason: "I disagree, please look again" })).json.data.status).toBe("reopened");
  });

  it("replays a retried action instead of failing on the second attempt", async () => {
    const issue = await seedIssue(citizen);
    as(manager);
    const k = key();
    const first = await office(issue.ref, "acknowledge", {}, { "idempotency-key": k });
    const retry = await office(issue.ref, "acknowledge", {}, { "idempotency-key": k });
    expect(first.status).toBe(200); expect(retry.status).toBe(200);
    expect(retry.headers.get("idempotent-replay")).toBe("true");
    const n = await admin.from("issue_events").select("id", { count: "exact", head: true }).eq("issue_id", issue.id).eq("to_status", "acknowledged");
    expect(n.count).toBe(1);
    // Same key, different action or issue = a different request.
    const other2 = await seedIssue(citizen);
    expect((await office(other2.ref, "acknowledge", {}, { "idempotency-key": k })).status).toBe(409);
  });
});

describe("legacy aliases keep working", () => {
  it("POST /api/cases still returns {ref} and POST /api/cases/[ref]/approve still approves", async () => {
    const u = await makeUser("citizen");
    as(u);
    const created = await call(legacyCreate, "POST", "/api/cases", { body: { title: "Legacy report", category: "roads", description: "from the old UI", area: "x", constituencyId: A.key } });
    expect(created.status).toBe(201);
    expect(created.json).toEqual({ ref: expect.stringMatching(/^JK-/) });
    const ref = created.json.ref as string;
    expect((await call(legacyApprove, "POST", `/api/cases/${ref}/approve`, { body: { action: "acknowledge" }, params: { ref } })).status).toBe(403);
    as(manager);
    const ok = await call(legacyApprove, "POST", `/api/cases/${ref}/approve`, { body: { action: "acknowledge" }, params: { ref } });
    expect(ok).toMatchObject({ status: 200, json: { ok: true } });
    const again = await call(legacyApprove, "POST", `/api/cases/${ref}/approve`, { body: { action: "acknowledge" }, params: { ref } });
    expect(again.status).toBe(409);
    as(managerB);
    expect((await call(legacyApprove, "POST", `/api/cases/${ref}/approve`, { body: { action: "refer" }, params: { ref } })).status).toBe(404);
  });
});

const RUN = Date.now().toString(36);
describe("audit trail through the API", () => {
  it("carries the request id from the HTTP request into audit_logs and names the actor", async () => {
    const issue = await seedIssue(citizen);
    as(manager);
    const r = await office(issue.ref, "acknowledge", {}, { "x-request-id": `audit-e2e-0001-${RUN}` });
    expect(r.status).toBe(200);
    const { data } = await admin.from("audit_logs").select("action,actor_id,actor_role,actor_kind,request_id,before_data,after_data").eq("resource_id", issue.id).eq("request_id", `audit-e2e-0001-${RUN}`);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ action: "issue.status_change", actor_id: manager.id, actor_role: "staff", actor_kind: "user", before_data: { status: "submitted" }, after_data: { status: "acknowledged", ref: issue.ref } });
    // The same id is in the API response, the log line and the issue event.
    expect(r.json.request_id).toBe(`audit-e2e-0001-${RUN}`);
  });

  it("records an administrator reading a private issue, and nothing for a manager doing the same", async () => {
    const issue = await seedIssue(citizen);
    const adminUser = await makeUser("admin");
    as(adminUser);
    const d = await call(getOffice, "GET", `/api/v1/office/issues/${issue.ref}`, { params: { ref: issue.ref }, headers: { "x-request-id": `audit-admin-0001-${RUN}` } });
    expect(d.status).toBe(200);
    const q = await call(listOffice, "GET", "/api/v1/office/issues?status=submitted&limit=5", { headers: { "x-request-id": `audit-admin-0002-${RUN}` } });
    expect(q.status).toBe(200);
    const rows = (await admin.from("audit_logs").select("action,actor_id,actor_role,resource_type,resource_id,request_id,metadata").eq("action", "admin.access").eq("actor_id", adminUser.id).order("created_at")).data!;
    expect(rows.map((x) => [x.resource_type, x.resource_id, x.request_id])).toEqual([["issue", issue.ref, `audit-admin-0001-${RUN}`], ["issue_list", null, `audit-admin-0002-${RUN}`]]);
    expect(rows[0].actor_role).toBe("admin");
    expect(rows[1].metadata).toEqual({ filters: ["status"], limit: 5 }); // filter names only, never values
    as(manager);
    expect((await call(getOffice, "GET", `/api/v1/office/issues/${issue.ref}`, { params: { ref: issue.ref } })).status).toBe(200);
    const mine = await admin.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "admin.access").eq("actor_id", manager.id);
    expect(mine.count).toBe(0);
  });

  it("audits issue creation by the citizen themself", async () => {
    const u = await makeUser("citizen");
    as(u);
    const r = await call(createIssue, "POST", "/api/v1/issues", { body: { title: "Audited report", category: "roads", description: "text", constituencyId: A.key }, headers: { "idempotency-key": key(), "x-request-id": `audit-create-0001-${RUN}` } });
    expect(r.status).toBe(201);
    const { data } = await admin.from("audit_logs").select("action,actor_id,actor_kind,request_id").eq("request_id", `audit-create-0001-${RUN}`).eq("action", "issue.create");
    expect(data).toEqual([{ action: "issue.create", actor_id: u.id, actor_kind: "user", request_id: `audit-create-0001-${RUN}` }]);
  });
});
