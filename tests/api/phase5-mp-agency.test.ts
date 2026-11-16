import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as saveAnn } from "../../src/app/api/v1/office/announcements/route";
import { POST as publishAnn } from "../../src/app/api/v1/office/announcements/[ref]/publish/route";
import { GET as listAnn } from "../../src/app/api/v1/announcements/route";
import { GET as listApprovals } from "../../src/app/api/v1/office/approvals/route";
import { POST as decide } from "../../src/app/api/v1/office/approvals/[id]/decision/route";
import { POST as setApproval } from "../../src/app/api/v1/office/constituencies/[key]/mp-approval/route";
import { POST as publicReply } from "../../src/app/api/v1/office/issues/[ref]/public-reply/route";
import { POST as editProj } from "../../src/app/api/v1/office/projects/[ref]/route";
import { POST as newProj } from "../../src/app/api/v1/office/projects/route";
import { GET as listTasks, POST as delegate } from "../../src/app/api/v1/office/tasks/route";
import { POST as taskStatus } from "../../src/app/api/v1/office/tasks/[id]/status/route";
import { GET as mpOverview } from "../../src/app/api/v1/office/mp/overview/route";
import { GET as liaisonCases } from "../../src/app/api/v1/liaison/cases/route";
import { POST as liaisonAct } from "../../src/app/api/v1/liaison/referrals/[id]/[action]/route";
import { POST as register } from "../../src/app/api/v1/office/referrals/[id]/register/route";
import { POST as integration } from "../../src/app/api/v1/admin/agency-integrations/route";
import { GET as publicReferrals } from "../../src/app/api/v1/issues/[ref]/referrals/route";
import { POST as invite } from "../../src/app/api/v1/office/invitations/route";
import { POST as accept } from "../../src/app/api/v1/invitations/accept/route";
import { admin, as, call, cleanup, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, B: { id: string; key: string };
let citizen: TestUser, manager: TestUser, mp: TestUser, officer: TestUser, managerB: TestUser, adminU: TestUser, liaison: TestUser, otherLiaison: TestUser;
let agencyId: string, otherAgencyId: string, issueRef: string, issueId: string, referralId: string;

beforeAll(async () => {
  A = await makeConstituency(); B = await makeConstituency();
  citizen = await makeUser("citizen");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  mp = await makeUser("staff", { constituencyId: A.id, officeRole: "mp" });
  officer = await makeUser("staff", { constituencyId: A.id, officeRole: "case_officer" });
  managerB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
  adminU = await makeUser("admin");
  const ag = (n: string) => admin.from("agencies").insert({ name_bn: n, name_en: n, categories: ["roads"], source: "test" }).select("id").single().throwOnError();
  agencyId = (await ag("p5-agency-a")).data!.id; otherAgencyId = (await ag("p5-agency-b")).data!.id;
  liaison = await makeUser("staff", { constituencyId: A.id, officeRole: "agency_liaison" });
  otherLiaison = await makeUser("staff", { constituencyId: A.id, officeRole: "agency_liaison" });
  await admin.from("office_members").update({ agency_id: agencyId }).eq("user_id", liaison.id).throwOnError();
  await admin.from("office_members").update({ agency_id: otherAgencyId }).eq("user_id", otherLiaison.id).throwOnError();
  const { data: i } = await admin.from("issues").insert({ reporter_id: citizen.id, title: "Broken road near school", category: "roads", description: "Large hole in road", constituency_id: A.id, constituency_key: A.key }).select("id,ref").single().throwOnError();
  issueId = i!.id; issueRef = i!.ref;
});
afterAll(async () => {
  as(null);
  await admin.from("announcements").delete().in("constituency_id", [A.id, B.id]); await admin.from("projects").delete().in("constituency_id", [A.id, B.id]);
  await cleanup([A.id, B.id]);
  await admin.from("agencies").delete().in("id", [agencyId, otherAgencyId]);   // after the issues (referrals reference agencies)
});

describe("MP approval (B5.1)", () => {
  it("only the MP or an admin of the area can switch approval on", async () => {
    as(manager); expect((await call(setApproval, "POST", "/x", { params: { key: A.key }, body: { required: true } })).status).toBe(404);
    as(citizen); expect((await call(setApproval, "POST", "/x", { params: { key: A.key }, body: { required: true } })).status).toBe(404);
    as(mp); const r = await call(setApproval, "POST", "/x", { params: { key: A.key }, body: { required: true } });
    expect(r.status).toBe(200); expect(r.json.data.mp_approval_required).toBe(true);
    as(mp); expect((await call(setApproval, "POST", "/x", { params: { key: A.key }, body: { required: "yes" } })).status).toBe(422);
  });

  it("an office manager's announcement waits for the MP, who can approve it; the public sees it only then", async () => {
    as(manager);
    const s = await call(saveAnn, "POST", "/api/v1/office/announcements", { body: { constituency: A.key, title: "Bridge opens on Friday", body: "The new bridge opens to traffic on Friday morning." } });
    expect(s.status).toBe(201); expect(s.json.data.status).toBe("pending_approval"); expect(s.json.data.approval_required).toBe(true);
    const ref = s.json.data.ref;
    as(null); expect((await call(listAnn, "GET", `/api/v1/announcements?constituency=${A.key}`)).json.data).toHaveLength(0);
    as(manager); expect((await call(publishAnn, "POST", "/x", { params: { ref } })).status).toBe(409);
    const pend = (await call(listApprovals, "GET", "/x?status=pending")).json.data;
    expect(pend).toHaveLength(1);
    const id = pend[0].id;
    as(manager); expect((await call(decide, "POST", "/x", { params: { id }, body: { decision: "approve" } })).status).toBe(403);
    as(officer); expect((await call(decide, "POST", "/x", { params: { id }, body: { decision: "approve" } })).status).toBe(404);
    as(managerB); expect((await call(decide, "POST", "/x", { params: { id }, body: { decision: "approve" } })).status).toBe(404);
    as(mp); expect((await call(decide, "POST", "/x", { params: { id }, body: { decision: "bad" } })).status).toBe(422);
    as(mp); expect((await call(decide, "POST", "/x", { params: { id }, body: { decision: "approve" } })).json.data.status).toBe("approved");
    as(mp); expect((await call(decide, "POST", "/x", { params: { id }, body: { decision: "approve" } })).status).toBe(409);
    as(null); expect((await call(listAnn, "GET", `/api/v1/announcements?constituency=${A.key}`)).json.data).toHaveLength(1);
    const { data: audit } = await admin.from("audit_logs").select("action").eq("resource_id", ref);
    expect((audit ?? []).map((a) => a.action)).toEqual(expect.arrayContaining(["announcement.request_approval", "approval.approve"]));
    const { data: n } = await admin.from("notifications").select("type").eq("user_id", manager.id).eq("type", "approval_decision");
    expect(n).toHaveLength(1);
  });

  it("a rejection needs a reason and sends the announcement back to draft; the MP's own announcement is published directly", async () => {
    as(manager);
    const ref = (await call(saveAnn, "POST", "/x", { body: { constituency: A.key, title: "Another announcement", body: "Another announcement body text." } })).json.data.ref;
    as(mp); const id = (await call(listApprovals, "GET", "/x?status=pending")).json.data[0].id;
    expect((await call(decide, "POST", "/x", { params: { id }, body: { decision: "reject" } })).status).toBe(422);
    expect((await call(decide, "POST", "/x", { params: { id }, body: { decision: "reject", note: "Wording is not final" } })).json.data.status).toBe("rejected");
    const { data } = await admin.from("announcements").select("status").eq("ref", ref).single();
    expect(data!.status).toBe("draft");
    const own = await call(saveAnn, "POST", "/x", { body: { constituency: A.key, title: "MP's own post", body: "Published straight away by the MP." } });
    expect(own.json.data.status).toBe("published");
  });

  it("public replies and project changes follow the same rule", async () => {
    as(manager);
    const reply = await call(publicReply, "POST", "/x", { params: { ref: issueRef }, body: { note: "We are looking into this. Call 01712345678." } });
    expect(reply.status).toBe(202);
    const { data: before } = await admin.from("issue_events").select("id").eq("issue_id", issueId).eq("is_public", true).eq("event_type", "note");
    expect(before).toHaveLength(0);
    as(mp); const pend = (await call(listApprovals, "GET", "/x?status=pending")).json.data;
    expect(pend).toHaveLength(1); expect(pend[0].target_type).toBe("public_reply"); expect(pend[0].payload.note).not.toContain("01712345678");
    await call(decide, "POST", "/x", { params: { id: pend[0].id }, body: { decision: "approve" } });
    const { data: after } = await admin.from("issue_events").select("public_message,actor_id").eq("issue_id", issueId).eq("is_public", true).eq("event_type", "note");
    expect(after).toHaveLength(1); expect(after![0].actor_id).toBe(manager.id);
    // The generic note path cannot bypass approval.
    as(manager);
    const { error } = await manager.sb.rpc("add_issue_note", { p_issue: issueId, p_note: "sneaky", p_public: true });
    expect(error?.code).toBe("JK003");
    // project
    as(mp); const ref = (await call(newProj, "POST", "/x", { body: { constituency: A.key, title: "New drain project" } })).json.data.ref;
    as(manager); const ch = await call(editProj, "POST", "/x", { params: { ref }, body: { status: "in_progress" } });
    expect(ch.json.data.approval_required).toBe(true);
    expect((await admin.from("projects").select("status").eq("ref", ref).single()).data!.status).toBe("planned");
    as(mp); const p2 = (await call(listApprovals, "GET", "/x?status=pending")).json.data;
    await call(decide, "POST", "/x", { params: { id: p2[0].id }, body: { decision: "approve" } });
    expect((await admin.from("projects").select("status").eq("ref", ref).single()).data!.status).toBe("in_progress");
    // Switch it off again: managers publish directly.
    as(mp); await call(setApproval, "POST", "/x", { params: { key: A.key }, body: { required: false } });
    as(manager); expect((await call(saveAnn, "POST", "/x", { body: { constituency: A.key, title: "Direct announcement", body: "Direct announcement body text." } })).json.data.status).toBe("published");
  });
});

describe("delegation (B5.1)", () => {
  it("MP and manager delegate to active staff of the area; others cannot; the assignee updates the task", async () => {
    const body = { constituency: A.key, assignee: officer.id, title: "Visit the bridge site" };
    as(officer); expect((await call(delegate, "POST", "/x", { body })).status).toBe(404); // a case officer cannot even see the area queue
    as(citizen); expect((await call(delegate, "POST", "/x", { body })).status).toBe(404);
    as(mp); expect((await call(delegate, "POST", "/x", { body: { ...body, assignee: managerB.id } })).status).toBe(422);
    expect((await call(delegate, "POST", "/x", { body: { ...body, title: "x" } })).status).toBe(422);
    expect((await call(delegate, "POST", "/x", { body: { ...body, issue_ref: "JK-NOPE-1" } })).status).toBe(422);
    const t = await call(delegate, "POST", "/x", { body: { ...body, issue_ref: issueRef } });
    expect(t.status).toBe(201);
    const id = t.json.data.id;
    as(officer); expect((await call(listTasks, "GET", "/x?mine=1")).json.data.map((x: { id: string }) => x.id)).toEqual([id]);
    expect((await call(taskStatus, "POST", "/x", { params: { id }, body: { status: "cancelled" } })).status).toBe(403);
    expect((await call(taskStatus, "POST", "/x", { params: { id }, body: { status: "done" } })).json.data.status).toBe("done");
    as(managerB); expect((await call(taskStatus, "POST", "/x", { params: { id }, body: { status: "open" } })).status).toBe(404);
    as(mp); expect((await call(listTasks, "GET", "/x")).json.data).toHaveLength(1);
    as(manager); expect((await call(listTasks, "GET", "/x")).json.data).toHaveLength(1);
    const { data: n } = await admin.from("notifications").select("type").eq("user_id", officer.id).eq("type", "task_assigned");
    expect(n).toHaveLength(1);
  });
  it("the MP overview combines analytics with pending work, for MP and manager only", async () => {
    as(mp); const r = await call(mpOverview, "GET", `/x?constituency=${A.key}`);
    expect(r.status).toBe(200); expect(r.json.data).toHaveProperty("pending_approvals");
    as(officer); expect([403, 404]).toContain((await call(mpOverview, "GET", `/x?constituency=${A.key}`)).status);
    as(citizen); expect([403, 404]).toContain((await call(mpOverview, "GET", `/x?constituency=${A.key}`)).status);
  });
  it("an MP cannot alter audit history or delete reports", async () => {
    as(mp);
    expect((await mp.sb.from("audit_logs").delete().neq("action", "")).data ?? []).toEqual([]);
    const del = await mp.sb.from("issues").delete().eq("id", issueId).select();
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    expect((await admin.from("issues").select("id").eq("id", issueId)).data).toHaveLength(1);
    const upd = await mp.sb.from("audit_logs").update({ action: "x" }).neq("action", "").select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
  });
});

describe("agency liaison and referral stages (B5.2, B5.4)", () => {
  it("a liaison is invited for an agency; an invitation without one is refused", async () => {
    as(manager);
    expect((await call(invite, "POST", "/x", { body: { email: "liaison@example.test", constituency: A.key, role: "agency_liaison" } })).status).toBe(422);
    const r = await call(invite, "POST", "/x", { body: { email: liaison.email, constituency: B.key, role: "agency_liaison", agency_id: agencyId } });
    expect(r.status).toBe(404);
    as(managerB);
    const ok = await call(invite, "POST", "/x", { body: { email: liaison.email, constituency: B.key, role: "agency_liaison", agency_id: agencyId } });
    expect(ok.status).toBe(201);
    as(liaison); const acc = await call(accept, "POST", "/x", { body: { token: ok.json.data.invite_token } });
    expect(acc.status).toBe(200);
    const { data: m } = await admin.from("office_members").select("agency_id").eq("user_id", liaison.id).eq("constituency_id", B.id).single();
    expect(m!.agency_id).toBe(agencyId);
    await admin.from("office_members").delete().eq("user_id", liaison.id).eq("constituency_id", B.id);
  });

  it("sees only cases referred to their agency, with no reporter or internal notes", async () => {
    const { data: r } = await admin.from("issue_agency_referrals").insert({ issue_id: issueId, agency_id: agencyId, agency_name: "p5-agency-a", external_reference: "EXT-1", visibility: "public" }).select("id").single().throwOnError();
    referralId = r!.id;
    await admin.from("issue_events").insert({ issue_id: issueId, event_type: "note", internal_note: "INTERNAL SECRET", is_public: false }).throwOnError();
    as(liaison); const mine = await call(liaisonCases, "GET", "/x");
    expect(mine.json.data).toHaveLength(1);
    expect(mine.json.data[0].ref).toBe(issueRef);
    expect(JSON.stringify(mine.json.data)).not.toMatch(/SECRET|reporter/);
    expect((await liaison.sb.from("issue_events").select("id").eq("issue_id", issueId)).data ?? []).toEqual([]);
    expect((await liaison.sb.from("issues").select("id").eq("id", issueId)).data ?? []).toEqual([]);
    as(otherLiaison); expect((await call(liaisonCases, "GET", "/x")).json.data).toEqual([]);
    as(citizen); expect((await call(liaisonCases, "GET", "/x")).json.data).toEqual([]);
    as(null); expect((await call(liaisonCases, "GET", "/x")).status).toBe(401);
  });

  it("acknowledges, adds updates, records a reference and closes with evidence; others cannot", async () => {
    const act = (u: TestUser | null, action: string, body: object = {}) => { as(u); return call(liaisonAct, "POST", "/x", { params: { id: referralId, action }, body }); };
    expect((await act(otherLiaison, "acknowledge")).status).toBe(404);
    expect((await act(manager, "acknowledge")).status).toBe(404);
    expect((await act(null, "acknowledge")).status).toBe(401);
    expect((await act(liaison, "nope")).status).toBe(404);
    const ack = await act(liaison, "acknowledge");
    expect(ack.json.data.registration_status).toBe("received");
    expect((await act(liaison, "updates", { note: "Team assigned. Call 01712345678", public: true })).status).toBe(201);
    const { data: ev } = await admin.from("issue_events").select("public_message,metadata").eq("issue_id", issueId).eq("is_public", true);
    expect(JSON.stringify(ev)).toContain("Team assigned"); expect(JSON.stringify(ev)).not.toContain("01712345678");
    expect((await act(liaison, "reference", {})).status).toBe(422);
    expect((await act(liaison, "reference", { external_reference: "AG-2026-77", channel: "https://agency.example/track" })).status).toBe(200);
    expect((await act(liaison, "close", { evidence: "x" })).status).toBe(422);
    expect((await act(liaison, "close", { evidence: "Photo of repaired road: https://example.test/p.jpg" })).json.data.task_status).toBe("closed");
    expect((await act(liaison, "close", { evidence: "again again" })).status).toBe(409);
    expect((await act(liaison, "updates", { note: "late note" })).status).toBe(409);
  });

  it("never reports a case as officially registered without a confirmed integration and proof", async () => {
    const reg = (u: TestUser, body: object) => { as(u); return call(register, "POST", "/x", { params: { id: referralId }, body }); };
    expect((await reg(manager, { proof: "ticket screenshot" })).status).toBe(409);
    expect((await reg(liaison, { proof: "ticket screenshot" })).status).toBe(404);
    as(manager); expect((await call(integration, "POST", "/x", { body: { agency_id: agencyId, kind: "api", status: "confirmed" } })).status).toBe(403);
    as(adminU); expect((await call(integration, "POST", "/x", { body: { agency_id: agencyId, kind: "api", status: "confirmed", note: "Agreed with the agency IT desk" } })).status).toBe(200);
    expect((await reg(manager, { proof: "x" })).status).toBe(422);
    expect((await reg(managerB, { proof: "ticket screenshot" })).status).toBe(404);
    expect((await reg(manager, { reference: "AG-2026-77", proof: "Ticket page screenshot, 17 Nov" })).json.data.registration_status).toBe("officially_registered");
    as(null);
    const pub = await call(publicReferrals, "GET", "/x", { params: { ref: issueRef } });
    expect(pub.json.data).toEqual([expect.objectContaining({ agency_name: "p5-agency-a", registration_status: "officially_registered", integration_confirmed: true })]);
    expect(JSON.stringify(pub.json.data)).not.toMatch(/proof|external_reference|reporter/);
    // the database refuses a registered row without proof even for the service role
    const bad = await admin.from("issue_agency_referrals").update({ registration_status: "officially_registered", registration_proof: null }).eq("id", referralId);
    expect(bad.error).not.toBeNull();
    const { data: audit } = await admin.from("audit_logs").select("action").eq("resource_id", issueId);
    expect((audit ?? []).map((a) => a.action)).toEqual(expect.arrayContaining(["referral.acknowledge", "referral.close", "referral.register"]));
  });
});
