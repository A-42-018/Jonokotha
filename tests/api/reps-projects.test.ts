import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as listReps } from "../../src/app/api/v1/representatives/route";
import { GET as getRep } from "../../src/app/api/v1/representatives/[id]/route";
import { GET as resp } from "../../src/app/api/v1/constituencies/[key]/responsiveness/route";
import { GET as listAnn } from "../../src/app/api/v1/announcements/route";
import { POST as saveAnn } from "../../src/app/api/v1/office/announcements/route";
import { POST as withdrawAnn } from "../../src/app/api/v1/office/announcements/[ref]/withdraw/route";
import { GET as listProj } from "../../src/app/api/v1/projects/route";
import { GET as getProj } from "../../src/app/api/v1/projects/[ref]/route";
import { POST as newProj } from "../../src/app/api/v1/office/projects/route";
import { POST as editProj } from "../../src/app/api/v1/office/projects/[ref]/route";
import { POST as addMs } from "../../src/app/api/v1/office/projects/[ref]/milestones/route";
import { POST as editMs } from "../../src/app/api/v1/office/projects/[ref]/milestones/[id]/route";
import { admin, anonClient, as, call, cleanup, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, B: { id: string; key: string };
let citizen: TestUser, manager: TestUser, mp: TestUser, officer: TestUser, managerB: TestUser, repId: string;

beforeAll(async () => {
  A = await makeConstituency(); B = await makeConstituency();
  citizen = await makeUser("citizen");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  mp = await makeUser("staff", { constituencyId: A.id, officeRole: "mp" });
  officer = await makeUser("staff", { constituencyId: A.id, officeRole: "case_officer" });
  managerB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
  const { data } = await admin.from("representatives").insert({ full_name: "Test Representative", verification_status: "verified", is_demo: true, verified_at: new Date().toISOString(), source_url: "https://example.test/rep" }).select("id").single().throwOnError();
  repId = data!.id;
  await admin.from("representative_constituencies").insert({ representative_id: repId, constituency_id: A.id }).throwOnError();
  await admin.from("representative_fields").insert({ representative_id: repId, field: "bio", value: "Sample biography.", source_url: "https://example.test/bio", source_checked_at: "2026-11-01" }).throwOnError();
});
afterAll(async () => {
  as(null);
  await admin.from("representatives").delete().eq("id", repId);
  await admin.from("announcements").delete().in("constituency_id", [A.id, B.id]); await admin.from("projects").delete().in("constituency_id", [A.id, B.id]);
  await cleanup([A.id, B.id]);
});

describe("representatives", () => {
  it("lists verified representatives with fields that carry a source and a check date", async () => {
    as(null);
    const l = (await call(listReps, "GET", `/api/v1/representatives?constituency=${A.key}`)).json.data;
    expect(l.map((r: { id: string }) => r.id)).toEqual([repId]);
    const d = (await call(getRep, "GET", `/api/v1/representatives/${repId}`, { params: { id: repId } })).json.data;
    expect(d.fields[0]).toEqual({ field: "bio", value: "Sample biography.", source_url: "https://example.test/bio", checked_at: "2026-11-01" });
    expect(d.constituencies[0].key).toBe(A.key);
    expect((await call(listReps, "GET", `/api/v1/representatives?constituency=${B.key}`)).json.data).toEqual([]);
    await admin.from("representatives").update({ verification_status: "revoked" }).eq("id", repId);
    expect((await call(getRep, "GET", `/api/v1/representatives/${repId}`, { params: { id: repId } })).status).toBe(404);
    expect((await anonClient.from("representative_fields").select("*").eq("representative_id", repId)).data ?? []).toEqual([]);
    await admin.from("representatives").update({ verification_status: "verified" }).eq("id", repId);
  });
});

describe("announcements", () => {
  const save = (u: TestUser, body: object) => { as(u); return call(saveAnn, "POST", "/api/v1/office/announcements", { body }); };
  it("only the MP or office manager of the area publish; the public sees published ones; withdrawal removes them; audited", async () => {
    const body = { constituency: A.key, title: "Road repair starts Monday", body: "Repairs begin on the market road on Monday. Call 01712345678." };
    expect((await save(citizen, body)).status).toBe(404);
    expect((await save(officer, body)).status).toBe(404);
    expect((await save(managerB, body)).status).toBe(404);
    expect((await save(manager, { ...body, title: "x" })).status).toBe(422);
    const ref = (await save(mp, body)).json.data.ref;
    as(null);
    const pub = (await call(listAnn, "GET", `/api/v1/announcements?constituency=${A.key}`)).json.data;
    expect(pub).toHaveLength(1); expect(pub[0].body).not.toContain("01712345678");
    const draft = await save(manager, { ...body, publish: false });
    expect(draft.json.data.status).toBe("draft");
    as(null); expect((await call(listAnn, "GET", `/api/v1/announcements?constituency=${A.key}`)).json.data).toHaveLength(1);
    as(citizen); expect((await call(withdrawAnn, "POST", `/api/v1/office/announcements/${ref}/withdraw`, { params: { ref } })).status).toBe(404);
    as(manager); expect((await call(withdrawAnn, "POST", `/api/v1/office/announcements/${ref}/withdraw`, { params: { ref } })).json.data.status).toBe("withdrawn");
    as(null); expect((await call(listAnn, "GET", `/api/v1/announcements?constituency=${A.key}`)).json.data).toHaveLength(0);
    const { data: a } = await admin.from("audit_logs").select("action").eq("resource_id", ref); expect(a!.map((x) => x.action).sort()).toEqual(["announcement.publish", "announcement.withdrawn"]);
  });
});

describe("projects and milestones", () => {
  let ref: string, msId: string;
  const post = (h: Parameters<typeof call>[0], u: TestUser, path: string, body: object, params: Record<string, string> = {}) => { as(u); return call(h, "POST", path, { body, params }); };
  it("creates a project (a source needs its check date), adds and updates milestones; the public reads them", async () => {
    const proj = { constituency: A.key, title: "Drain upgrade, ward 3", description: "Replace the old drain.", budget_text: "BDT 2.5 million (council notice)", source_url: "https://example.test/notice", source_checked_at: "2026-11-10", start_date: "2026-12-01", expected_end_date: "2027-02-01" };
    expect((await post(newProj, citizen, "/api/v1/office/projects", proj)).status).toBe(404);
    expect((await post(newProj, officer, "/api/v1/office/projects", proj)).status).toBe(404);
    expect((await post(newProj, manager, "/api/v1/office/projects", { ...proj, source_checked_at: undefined })).status).toBe(422);
    expect((await post(newProj, manager, "/api/v1/office/projects", { ...proj, expected_end_date: "2026-01-01" })).status).toBe(422);
    const r = await post(newProj, mp, "/api/v1/office/projects", proj);
    expect(r.status).toBe(201); ref = r.json.data.ref;
    expect((await post(addMs, manager, `/api/v1/office/projects/${ref}/milestones`, { title: "Survey", due_date: "2026-12-10" }, { ref })).status).toBe(201);
    const m2 = await post(addMs, manager, `/api/v1/office/projects/${ref}/milestones`, { title: "Pour concrete", due_date: "2027-01-10" }, { ref });
    msId = m2.json.data.id;
    const ed = (b: object) => post(editMs, manager, `/api/v1/office/projects/${ref}/milestones/${msId}`, b, { ref, id: msId });
    expect((await ed({ status: "delayed" })).status).toBe(422);
    expect((await ed({ status: "delayed", note: "Rain delay" })).json.data.status).toBe("delayed");
    expect((await post(editMs, managerB, `/api/v1/office/projects/${ref}/milestones/${msId}`, { status: "done" }, { ref, id: msId })).status).toBe(404);
    expect((await post(editProj, manager, `/api/v1/office/projects/${ref}`, { status: "in_progress" }, { ref })).json.data.status).toBe("in_progress");
    expect((await post(editProj, manager, `/api/v1/office/projects/${ref}`, { status: "bogus" }, { ref })).status).toBe(422);
    as(null);
    const d = (await call(getProj, "GET", `/api/v1/projects/${ref}`, { params: { ref } })).json.data;
    expect(d).toMatchObject({ status: "in_progress", source_checked_at: "2026-11-10", is_sample: true });
    expect(d.milestones.map((m: { title: string; status: string }) => `${m.title}:${m.status}`)).toEqual(["Survey:pending", "Pour concrete:delayed"]);
    expect((await call(listProj, "GET", `/api/v1/projects?constituency=${A.key}`)).json.data).toHaveLength(1);
    expect((await call(listProj, "GET", `/api/v1/projects?constituency=${B.key}`)).json.data).toHaveLength(0);
    expect((await anonClient.from("projects").select("*")).data ?? []).toEqual([]);
  });
});

describe("responsiveness", () => {
  it("counts activity for one area over stated dates, as a description and never a ranking", async () => {
    const mk = async () => (await admin.from("issues").insert({ reporter_id: citizen.id, title: "Pothole here", category: "roads", description: "hole", constituency_id: A.id }).select("id,ref").single().throwOnError()).data!;
    const i1 = await mk(); await mk(); await mk();
    as(manager);
    const { data: issue } = await manager.sb.from("issues").select("id").eq("ref", i1.ref).single();
    await manager.sb.rpc("transition_issue", { p_issue: issue!.id, p_to: "acknowledged", p_fields: {} }).throwOnError();
    as(null);
    const r = (await call(resp, "GET", `/api/v1/constituencies/${A.key}/responsiveness`, { params: { key: A.key } })).json.data;
    expect(r).toMatchObject({ constituency: A.key, received: 3, answered: 1, pending: 2, method_url: "/mp/method" });
    expect(r.median_hours_to_first_response).not.toBeNull();
    expect(r.from).toBeTruthy(); expect(r.to).toBeTruthy(); expect(r.note).toMatch(/Not a ranking/);
    const empty = (await call(resp, "GET", `/api/v1/constituencies/${B.key}/responsiveness`, { params: { key: B.key } })).json.data;
    expect(empty).toMatchObject({ received: 0, answered: 0, median_hours_to_first_response: null });
    expect((await call(resp, "GET", `/api/v1/constituencies/${A.key}/responsiveness?from=2026-12-01&to=2026-01-01`, { params: { key: A.key } })).status).toBe(422);
    expect((await call(resp, "GET", "/api/v1/constituencies/no-such/responsiveness", { params: { key: "no-such" } })).status).toBe(404);
    const old = (await call(resp, "GET", `/api/v1/constituencies/${A.key}/responsiveness?from=2020-01-01&to=2020-02-01`, { params: { key: A.key } })).json.data;
    expect(old.received).toBe(0);
  });
});
