import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getPublic } from "../../src/app/api/v1/issues/[ref]/route";
import { DELETE as unaffect, POST as affect } from "../../src/app/api/v1/issues/[ref]/affected/route";
import { GET as listFollows, POST as addFollow } from "../../src/app/api/v1/me/follows/route";
import { DELETE as removeFollow } from "../../src/app/api/v1/me/follows/[id]/route";
import { admin, anonClient, as, call, cleanup, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, reporter: TestUser, u1: TestUser, u2: TestUser, ref: string, hiddenRef: string;

beforeAll(async () => {
  A = await makeConstituency();
  reporter = await makeUser("citizen"); u1 = await makeUser("citizen"); u2 = await makeUser("citizen");
  const mk = async (extra = {}) => (await admin.from("issues").insert({ reporter_id: reporter.id, title: "Broken streetlight", category: "roads", description: "Dark road.", constituency_id: A.id, ...extra }).select("ref").single().throwOnError()).data!.ref as string;
  ref = await mk(); hiddenRef = await mk({ public_visibility: false });
});
afterAll(async () => { as(null); await cleanup([A.id]); });

const aff = (r: string, del = false) => call(del ? unaffect : affect, del ? "DELETE" : "POST", `/api/v1/issues/${r}/affected`, { params: { ref: r } });

describe("আমারও একই সমস্যা", () => {
  it("needs sign-in; counts once per user; withdrawing is idempotent", async () => {
    as(null);
    expect((await aff(ref)).status).toBe(401);
    as(u1);
    expect((await aff(ref)).json.data).toMatchObject({ affected: true, affected_count: 1 });
    expect((await aff(ref)).json.data.affected_count).toBe(1);
    as(u2);
    expect((await aff(ref)).json.data.affected_count).toBe(2);
    expect((await aff(ref, true)).json.data).toMatchObject({ affected: false, affected_count: 1 });
    expect((await aff(ref, true)).json.data.affected_count).toBe(1);
  });

  it("the reporter cannot add themselves; hidden or unknown issues are 404", async () => {
    as(reporter);
    expect((await aff(ref)).json.code).toBe("rule_not_met");
    as(u1);
    expect((await aff(hiddenRef)).status).toBe(404);
    expect((await aff("JK-2026-9999")).status).toBe(404);
  });

  it("the public count appears on the detail without revealing who; anonymous cannot read the table", async () => {
    as(null);
    const r = await call(getPublic, "GET", `/api/v1/issues/${ref}`, { params: { ref } });
    expect(r.json.data.affected_count).toBe(1);
    expect(JSON.stringify(r.json)).not.toContain(u1.id);
    const t = await anonClient.from("issue_affected").select("*");
    expect(t.data ?? []).toEqual([]);
    expect(t.error).not.toBeNull();
  });

  it("a user cannot read, add or delete another user's affected rows directly", async () => {
    const mine = await u1.sb.from("issue_affected").select("user_id");
    expect((mine.data ?? []).every((r) => r.user_id === u1.id)).toBe(true);
    const { data: issue } = await admin.from("issues").select("id").eq("ref", ref).single();
    expect((await u2.sb.from("issue_affected").insert({ issue_id: issue!.id, user_id: u2.id })).error).not.toBeNull();
  });
});

describe("follows", () => {
  const post = (body: unknown) => call(addFollow, "POST", "/api/v1/me/follows", { body });
  it("follows an issue, an area and a category; duplicates return the same follow; lists only your own", async () => {
    as(u1);
    const a = await post({ type: "issue", target: ref });
    expect(a.status).toBe(201);
    expect((await post({ type: "issue", target: ref })).json.data.id).toBe(a.json.data.id);
    expect((await post({ type: "area", target: A.key })).status).toBe(201);
    const { data: cat } = await admin.from("issue_categories").select("slug").eq("is_active", true).limit(1).single();
    expect((await post({ type: "category", target: cat!.slug })).status).toBe(201);
    const list = await call(listFollows, "GET", "/api/v1/me/follows");
    expect(list.json.data).toHaveLength(3);
    as(u2);
    expect((await call(listFollows, "GET", "/api/v1/me/follows")).json.data).toEqual([]);
  });

  it("validates input and rejects unknown targets", async () => {
    as(u1);
    expect((await post({ type: "planet", target: "x" })).status).toBe(422);
    expect((await post({ type: "area", target: "no-such-area" })).status).toBe(422);
    expect((await post({ type: "category", target: "no_such_cat" })).status).toBe(422);
    expect((await post({ type: "issue", target: hiddenRef })).status).toBe(404);
    expect((await post({ type: "issue", target: ref, extra: 1 })).status).toBe(422);
    as(null);
    expect((await post({ type: "issue", target: ref })).status).toBe(401);
  });

  it("only the owner can stop following; a stranger's id looks like not found", async () => {
    as(u1);
    const id = (await call(listFollows, "GET", "/api/v1/me/follows")).json.data[0].id as string;
    as(u2);
    expect((await call(removeFollow, "DELETE", `/api/v1/me/follows/${id}`, { params: { id } })).status).toBe(404);
    as(u1);
    expect((await call(removeFollow, "DELETE", `/api/v1/me/follows/${id}`, { params: { id } })).json.data).toMatchObject({ removed: true });
    expect((await call(removeFollow, "DELETE", `/api/v1/me/follows/${id}`, { params: { id } })).status).toBe(404);
    expect((await call(removeFollow, "DELETE", "/api/v1/me/follows/not-a-uuid", { params: { id: "not-a-uuid" } })).status).toBe(404);
  });
});
