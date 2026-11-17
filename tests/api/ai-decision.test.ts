import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as decide } from "../../src/app/api/v1/ai/suggestions/[id]/decision/route";
import { admin, as, call, cleanup, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string }, citizen: TestUser, manager: TestUser, stranger: TestUser, sug: string, sug2: string;
const post = (id: string, body: unknown) => call(decide, "POST", `/api/v1/ai/suggestions/${id}/decision`, { body, params: { id } });

beforeAll(async () => {
  A = await makeConstituency();
  citizen = await makeUser("citizen"); stranger = await makeUser("staff");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  const { data: issue } = await admin.from("issues").insert({ reporter_id: citizen.id, title: "t", category: "roads", description: "d", constituency_id: A.id }).select("id").single().throwOnError();
  const mk = async () => (await admin.from("ai_suggestions").insert({ target_type: "issue", target_id: issue!.id, suggestion_type: "reply_draft", payload: { text: "hi" } }).select("id").single().throwOnError()).data!.id as string;
  sug = await mk(); sug2 = await mk();
});
afterAll(async () => { as(null); await admin.from("ai_suggestions").delete().in("id", [sug, sug2]); await cleanup([A.id]); });

describe("POST /api/v1/ai/suggestions/{id}/decision", () => {
  it("401 signed out, 403 for a citizen or staff outside the office, 404 for a bad id", async () => {
    as(null); expect((await post(sug, { decision: "accept" })).status).toBe(401);
    as(citizen); expect((await post(sug, { decision: "accept" })).status).toBe(403);
    as(stranger); expect((await post(sug, { decision: "accept" })).status).toBe(403);
    as(manager); expect((await post("not-a-uuid", { decision: "accept" })).status).toBe(404);
    expect((await post("00000000-0000-4000-8000-000000000000", { decision: "accept" })).status).toBe(404);
  });
  it("validates the body: unknown decision, edit without a value, extra keys", async () => {
    as(manager);
    expect((await post(sug, { decision: "maybe" })).status).toBe(422);
    expect((await post(sug, { decision: "edit" })).json).toMatchObject({ code: "validation_failed", field_errors: { final_value: expect.any(String) } });
    expect((await post(sug, { decision: "accept", x: 1 })).status).toBe(422);
  });
  it("in-scope staff accept and edit; a second decision is a 409", async () => {
    as(manager);
    const ok = await post(sug, { decision: "accept" });
    expect(ok.status).toBe(200);
    expect(ok.json.data).toMatchObject({ decision: "accepted", final_value: { text: "hi" } });
    expect((await post(sug, { decision: "dismiss" })).json.code).toBe("rule_not_met");
    const ed = await post(sug2, { decision: "edit", final_value: { text: "mine" } });
    expect(ed.json.data).toMatchObject({ decision: "edited", final_value: { text: "mine" } });
  });
});
