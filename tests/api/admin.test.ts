import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as listIdeas } from "../../src/app/api/v1/ideas/route";
import { POST as createIdea } from "../../src/app/api/v1/ideas/route";
import { GET as listPublic } from "../../src/app/api/v1/issues/route";
import { POST as askQ } from "../../src/app/api/v1/questions/route";
import { POST as report } from "../../src/app/api/v1/reports/route";
import { GET as queue } from "../../src/app/api/v1/admin/moderation/route";
import { POST as moderate } from "../../src/app/api/v1/admin/moderation/items/route";
import { POST as review } from "../../src/app/api/v1/admin/moderation/review/route";
import { GET as listInv, POST as invite } from "../../src/app/api/v1/office/invitations/route";
import { POST as revokeInv } from "../../src/app/api/v1/office/invitations/[id]/revoke/route";
import { POST as acceptInv } from "../../src/app/api/v1/invitations/accept/route";
import { POST as verifyRep } from "../../src/app/api/v1/admin/representatives/[id]/verify/route";
import { PUT as repField } from "../../src/app/api/v1/admin/representatives/[id]/fields/route";
import { POST as setAccount } from "../../src/app/api/v1/admin/accounts/[id]/route";
import { GET as aiRuns } from "../../src/app/api/v1/admin/ai/runs/route";
import { GET as listEvals, POST as recordEval } from "../../src/app/api/v1/admin/ai/evals/route";
import { GET as auditLog } from "../../src/app/api/v1/admin/audit/route";
import { POST as importC } from "../../src/app/api/v1/admin/constituencies/import/route";
import { POST as ingest } from "../../src/app/api/v1/admin/knowledge/ingest/route";
import { GET as repLookup } from "../../src/app/api/v1/representatives/lookup/route";
import { admin, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, B: { id: string; key: string };
let citizen: TestUser, reporter2: TestUser, author: TestUser, moderator: TestUser, adminU: TestUser, manager: TestUser, officer: TestUser, managerB: TestUser;
const stamp = Date.now().toString(36);
const mkIssue = async (o: Record<string, unknown> = {}) => (await admin.from("issues").insert({ reporter_id: author.id, title: "Rude words about a neighbour", category: "other", description: "Offensive text here", constituency_id: A.id, ...o }).select("id,ref").single().throwOnError()).data!;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.anon;
  A = await makeConstituency(); B = await makeConstituency();
  citizen = await makeUser("citizen"); reporter2 = await makeUser("citizen"); author = await makeUser("citizen");
  moderator = await makeUser("moderator"); adminU = await makeUser("admin");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  officer = await makeUser("staff", { constituencyId: A.id, officeRole: "case_officer" });
  managerB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
});
afterAll(async () => {
  as(null);
  await admin.from("ideas").delete().in("constituency_id", [A.id, B.id]); await admin.from("questions").delete().in("constituency_id", [A.id, B.id]);
  await admin.from("office_invitations").delete().in("constituency_id", [A.id, B.id]);
  await admin.from("moderation_reports").delete().like("target_ref", "%"); // only this test run's reporters exist locally
  const { data: cs } = await admin.from("constituencies").select("id").like("key", `imp-${stamp}%`);
  await admin.from("knowledge_sources").delete().like("name", `HDX test ${stamp}%`);
  await cleanup([A.id, B.id, ...(cs ?? []).map((c) => c.id)]);
});

describe("reporting and moderation", () => {
  let issue: { id: string; ref: string }, ideaRef: string, pubQ: string, privQ: string;
  it("any verified account can report public content once; private or unknown content is not found", async () => {
    issue = await mkIssue();
    as(author); const i = await call(createIdea, "POST", "/api/v1/ideas", { body: { constituency: A.key, title: "A rude idea title", body: "Some rude content in the idea body." } }); ideaRef = i.json.data.ref;
    const pq = await call(askQ, "POST", "/api/v1/questions", { body: { constituency: A.key, visibility: "public", title: "A public question here", body: "Public question body text." } }); pubQ = pq.json.data.ref;
    privQ = (await call(askQ, "POST", "/api/v1/questions", { body: { constituency: A.key, visibility: "private", title: "A private question here", body: "Private question body text." } })).json.data.ref;
    const rep = (b: object) => call(report, "POST", "/api/v1/reports", { body: b });
    as(null); expect((await rep({ type: "issue", ref: issue.ref, reason: "abuse" })).status).toBe(401);
    as(citizen);
    expect((await rep({ type: "issue", ref: issue.ref, reason: "abuse", details: "Insulting. Call 01712345678" })).status).toBe(201);
    expect((await rep({ type: "issue", ref: issue.ref, reason: "spam" })).json.code).toBe("rule_not_met");     // once per person and item
    expect((await rep({ type: "idea", ref: ideaRef, reason: "abuse" })).status).toBe(404);                     // not public yet
    expect((await rep({ type: "question", ref: privQ, reason: "abuse" })).status).toBe(404);                   // private questions cannot be reported (nobody else can see them)
    expect((await rep({ type: "issue", ref: "JK-2026-9999", reason: "abuse" })).status).toBe(404);
    expect((await rep({ type: "issue", ref: issue.ref, reason: "dislike" })).status).toBe(422);
    expect((await rep({ type: "planet", ref: issue.ref, reason: "abuse" })).status).toBe(422);
    as(reporter2); expect((await rep({ type: "issue", ref: issue.ref, reason: "personal_data" })).status).toBe(201);
    const { data } = await admin.from("moderation_reports").select("details").eq("target_ref", issue.ref).eq("reporter_id", citizen.id).single(); expect(data!.details).not.toContain("01712345678");
  });
  it("the queue is for moderators and admins; it shows public excerpts only, never reporter, author or private data", async () => {
    for (const u of [citizen, manager, officer, null]) { as(u); expect((await call(queue, "GET", "/api/v1/admin/moderation")).status).toBe(u ? 403 : 401); }
    as(moderator);
    const q = (await call(queue, "GET", "/api/v1/admin/moderation")).json.data as { kind: string; target_type: string; target_ref: string; excerpt: string; reasons: string[]; report_count: number }[];
    const rep = q.find((x) => x.target_ref === issue.ref)!;
    expect(rep).toMatchObject({ kind: "report", target_type: "issue", report_count: 2 }); expect(rep.reasons.sort()).toEqual(["abuse", "personal_data"]);
    expect(q.find((x) => x.target_ref === ideaRef)).toMatchObject({ kind: "review", target_type: "idea" });
    expect(q.find((x) => x.target_ref === pubQ)).toMatchObject({ kind: "review", target_type: "question" });
    expect(q.find((x) => x.target_ref === privQ)).toBeUndefined();
    expect(JSON.stringify(q)).not.toMatch(new RegExp(`${citizen.id}|${reporter2.id}|${author.id}|reporter`));
    // a moderator cannot read private tables directly
    expect((await moderator.sb.from("issues").select("id").eq("ref", issue.ref)).data).toEqual([]);
    expect((await moderator.sb.from("questions").select("id").eq("ref", privQ)).data).toEqual([]);
  });
  it("hiding needs a reason, removes the issue from public reads, is reversible and audited; dismissing closes the reports", async () => {
    const act = (b: object) => { as(moderator); return call(moderate, "POST", "/api/v1/admin/moderation/items", { body: b }); };
    expect((await act({ type: "issue", ref: issue.ref, action: "hide" })).status).toBe(422);
    expect((await act({ type: "issue", ref: issue.ref, action: "hide", reason: "no" })).status).toBe(422);
    as(null); expect((await call(listPublic, "GET", `/api/v1/issues?constituency=${A.key}`)).json.data.map((x: { ref: string }) => x.ref)).toContain(issue.ref);
    expect((await act({ type: "issue", ref: issue.ref, action: "hide", reason: "Abusive language about a person" })).status).toBe(200);
    as(null); expect((await call(listPublic, "GET", `/api/v1/issues?constituency=${A.key}`)).json.data.map((x: { ref: string }) => x.ref)).not.toContain(issue.ref);
    as(author); expect((await author.sb.from("issues").select("ref").eq("ref", issue.ref)).data).toHaveLength(1);   // the reporter still sees their own report
    const { data: r } = await admin.from("moderation_reports").select("status,decision,decision_reason,handled_by").eq("target_ref", issue.ref);
    expect(r!.every((x) => x.status === "actioned" && x.decision === "hide" && x.handled_by === moderator.id && x.decision_reason)).toBe(true);
    expect((await act({ type: "issue", ref: issue.ref, action: "hide", reason: "Again for no reason" })).status).toBe(404);     // nothing to change
    expect((await act({ type: "issue", ref: issue.ref, action: "restore", reason: "Reviewed again: acceptable" })).status).toBe(200);
    const { data: a } = await admin.from("audit_logs").select("action,metadata").eq("resource_id", issue.ref).like("action", "moderation.%").order("created_at");
    expect(a!.map((x) => x.action)).toEqual(["moderation.hide", "moderation.restore"]); expect(a![0].metadata.reason).toContain("Abusive");
    const reporter3 = await makeUser("citizen");
    as(reporter3); await call(report, "POST", "/api/v1/reports", { body: { type: "issue", ref: issue.ref, reason: "spam" } });
    expect((await act({ type: "issue", ref: issue.ref, action: "dismiss", reason: "Not a violation of the rules" })).status).toBe(200);
    expect((await admin.from("moderation_reports").select("status").eq("reporter_id", reporter3.id).eq("target_ref", issue.ref).single()).data!.status).toBe("dismissed");
  });
  it("new ideas and public questions are published or rejected by a moderator, with a reason when rejecting", async () => {
    const rv = (b: object) => { as(moderator); return call(review, "POST", "/api/v1/admin/moderation/review", { body: b }); };
    as(citizen); expect((await call(review, "POST", "/api/v1/admin/moderation/review", { body: { type: "idea", ref: ideaRef, action: "publish" } })).status).toBe(403);
    expect((await rv({ type: "idea", ref: ideaRef, action: "reject" })).status).toBe(422);
    expect((await rv({ type: "idea", ref: ideaRef, action: "publish" })).status).toBe(200);
    expect((await rv({ type: "idea", ref: ideaRef, action: "publish" })).status).toBe(404);
    as(null); expect((await call(listIdeas, "GET", `/api/v1/ideas?constituency=${A.key}`)).json.data.map((x: { ref: string }) => x.ref)).toContain(ideaRef);
    expect((await rv({ type: "question", ref: pubQ, action: "reject", reason: "Contains a personal accusation" })).status).toBe(200);
    expect((await admin.from("questions").select("status,moderation_reason").eq("ref", pubQ).single()).data).toMatchObject({ status: "hidden" });
    expect((await rv({ type: "question", ref: privQ, action: "publish" })).status).toBe(404);          // private questions are never moderation-published
    // the author is told when an idea is published (generic text)
    const { data: n } = await admin.from("notifications").select("title").eq("user_id", author.id).like("dedupe_key", `idea:${ideaRef}:%`); expect(n!.length).toBe(1);
  });
});

describe("invitations", () => {
  let invitee: TestUser, token: string, invId: string;
  const inv = (u: TestUser, b: object) => { as(u); return call(invite, "POST", "/api/v1/office/invitations", { body: b }); };
  const accept = (u: TestUser, t: string) => { as(u); return call(acceptInv, "POST", "/api/v1/invitations/accept", { body: { token: t } }); };
  it("an office manager invites case officers into their own office only; admins invite anyone; MPs need a verified representative", async () => {
    invitee = await makeUser("citizen");
    const body = { email: invitee.email, constituency: A.key, role: "case_officer" };
    expect((await inv(citizen, body)).status).toBe(404);
    expect((await inv(officer, body)).status).toBe(404);          // unassigned case officers cannot see the office at all
    expect((await inv(managerB, body)).status).toBe(404);
    expect((await inv(manager, { ...body, role: "office_manager" })).status).toBe(403);
    expect((await inv(manager, { ...body, role: "mp" })).status).toBe(403);
    expect((await inv(adminU, { ...body, role: "mp" })).status).toBe(422);     // needs a verified representative
    const r = await inv(manager, body); expect(r.status).toBe(201);
    token = r.json.data.invite_token; invId = r.json.data.id; expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect((await inv(manager, body)).json.code).toBe("rule_not_met");        // already pending
    const { data: row } = await admin.from("office_invitations").select("token_hash").eq("id", invId).single(); expect(row!.token_hash).not.toContain(token);
    as(manager); const l = (await call(listInv, "GET", "/api/v1/office/invitations")).json.data; expect(l[0]).not.toHaveProperty("token_hash"); expect(JSON.stringify(l)).not.toContain(token);
  });
  it("accepting needs the token and the matching confirmed email; it makes the person staff of that office, once", async () => {
    expect((await accept(citizen, token)).status).toBe(403);               // different account
    expect((await accept(invitee, "0".repeat(48))).status).toBe(404);
    expect((await accept(invitee, "short")).status).toBe(422);
    as(null); expect((await call(acceptInv, "POST", "/api/v1/invitations/accept", { body: { token } })).status).toBe(401);
    const ok = await accept(invitee, token); expect(ok.status).toBe(200); expect(ok.json.data.office_role).toBe("case_officer");
    expect((await admin.from("profiles").select("role").eq("id", invitee.id).single()).data!.role).toBe("staff");
    expect((await admin.from("office_members").select("office_role,status").eq("user_id", invitee.id).eq("constituency_id", A.id).single()).data).toEqual({ office_role: "case_officer", status: "active" });
    expect((await accept(invitee, token)).status).toBe(404);               // single use
    const { data: a } = await admin.from("audit_logs").select("action").eq("resource_id", invId); expect(a!.map((x) => x.action).sort()).toEqual(["invitation.accept", "invitation.create"]);
  });
  it("a citizen cannot make themselves staff any other way; revoked and expired invitations do not work", async () => {
    const sneaky = await makeUser("citizen");
    await sneaky.sb.from("profiles").update({ role: "staff" }).eq("id", sneaky.id);
    expect((await admin.from("profiles").select("role").eq("id", sneaky.id).single()).data!.role).toBe("citizen");
    const second = await makeUser("citizen");
    const r = await inv(manager, { email: second.email, constituency: A.key, role: "case_officer" });
    as(manager); expect((await call(revokeInv, "POST", `/api/v1/office/invitations/${r.json.data.id}/revoke`, { params: { id: r.json.data.id } })).json.data.revoked).toBe(true);
    expect((await accept(second, r.json.data.invite_token)).status).toBe(404);
    const third = await makeUser("citizen"); const r3 = await inv(manager, { email: third.email, constituency: A.key, role: "case_officer" });
    await admin.from("office_invitations").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", r3.json.data.id);
    expect((await accept(third, r3.json.data.invite_token)).status).toBe(404);
    expect((await admin.from("profiles").select("role").eq("id", third.id).single()).data!.role).toBe("citizen");
  });
});

describe("administration", () => {
  let rep: string;
  it("verifies representatives with a source, sets sourced fields, and an MP can then be invited; non-admins are refused", async () => {
    rep = (await admin.from("representatives").insert({ full_name: "Candidate MP", verification_status: "unverified", is_demo: true }).select("id").single().throwOnError()).data!.id;
    await admin.from("representative_constituencies").insert({ representative_id: rep, constituency_id: A.id }).throwOnError();
    const v = (u: TestUser, b: object) => { as(u); return call(verifyRep, "POST", `/api/v1/admin/representatives/${rep}/verify`, { body: b, params: { id: rep } }); };
    expect((await v(manager, { status: "verified", source_url: "https://example.test/src" })).status).toBe(403);
    expect((await v(adminU, { status: "verified" })).status).toBe(422);
    as(null); expect((await call(repLookup, "GET", `/api/v1/representatives/lookup?area=${A.key}`)).json.data.matches[0].representatives).toEqual([]);
    expect((await v(adminU, { status: "verified", source_url: "https://example.test/src", note: "Checked against the election commission list" })).json.data.verification_status).toBe("verified");
    as(null); expect((await call(repLookup, "GET", `/api/v1/representatives/lookup?area=${A.key}`)).json.data.matches[0].representatives).toHaveLength(1);
    const f = (b: object) => { as(adminU); return call(repField, "PUT", `/api/v1/admin/representatives/${rep}/fields`, { body: b, params: { id: rep } }); };
    expect((await f({ field: "bio", value: "Biography", source_url: "https://example.test/bio" })).status).toBe(422);
    expect((await f({ field: "bio", value: "Biography", source_url: "https://example.test/bio", checked_at: "2026-11-10" })).status).toBe(200);
    const mpUser = await makeUser("citizen");
    as(adminU); const r = await call(invite, "POST", "/api/v1/office/invitations", { body: { email: mpUser.email, constituency: A.key, role: "mp", representative_id: rep } });
    expect(r.status).toBe(201);
    as(mpUser); expect((await call(acceptInv, "POST", "/api/v1/invitations/accept", { body: { token: r.json.data.invite_token } })).json.data.office_role).toBe("mp");
    expect((await admin.from("office_members").select("representative_id").eq("user_id", mpUser.id).single()).data!.representative_id).toBe(rep);
    await v(adminU, { status: "revoked" });
    as(null); expect((await call(repLookup, "GET", `/api/v1/representatives/lookup?area=${A.key}`)).json.data.matches[0].representatives).toEqual([]);
    await admin.from("representatives").delete().eq("id", rep);
  });
  it("account changes need an admin and a reason, and cannot target yourself", async () => {
    const target = await makeUser("citizen");
    const ch = (u: TestUser, id: string, b: object) => { as(u); return call(setAccount, "POST", `/api/v1/admin/accounts/${id}`, { body: b, params: { id } }); };
    expect((await ch(moderator, target.id, { role: "moderator", reason: "Trusted volunteer" })).status).toBe(403);
    expect((await ch(adminU, target.id, { role: "moderator" })).status).toBe(422);
    expect((await ch(adminU, target.id, { role: "moderator", reason: "Trusted volunteer" })).json.data.role).toBe("moderator");
    expect((await ch(adminU, adminU.id, { role: "citizen", reason: "Stepping down myself" })).json.code).toBe("rule_not_met");
    expect((await ch(adminU, target.id, { role: "citizen", status: "suspended", reason: "Repeated spam reports" })).json.data.account_status).toBe("suspended");
    expect((await admin.from("profiles").select("account_status").eq("id", target.id).single()).data!.account_status).toBe("suspended");
    expect((await call(setAccount, "POST", "/api/v1/admin/accounts/not-a-uuid", { body: { role: "citizen", reason: "xxxxx" }, params: { id: "not-a-uuid" } })).status).toBe(404);
  });
  it("AI run log, evaluations and the audit API are admin-only and reading them is audited", async () => {
    await admin.rpc("log_ai_run", { p_agent: "copilot", p_status: "ok", p_model: "m", p_prompt_id: "copilot", p_prompt_version: "v1", p_input_hash: "h", p_output: { secret: "OUT" }, p_latency_ms: 5, p_token_usage: null, p_cost_usd: null });
    for (const u of [citizen, moderator, manager]) { as(u); for (const [h, p] of [[aiRuns, "/api/v1/admin/ai/runs"], [listEvals, "/api/v1/admin/ai/evals"], [auditLog, "/api/v1/admin/audit"]] as const) expect((await call(h, "GET", p)).status).toBe(403); }
    as(adminU);
    const runs = (await call(aiRuns, "GET", "/api/v1/admin/ai/runs?agent=copilot&limit=1")).json;
    expect(runs.data[0]).toMatchObject({ agent: "copilot", prompt_version: "v1" }); expect(runs.data[0]).not.toHaveProperty("output");
    expect((await call(aiRuns, "GET", "/api/v1/admin/ai/runs?agent=copilot&include_output=true&limit=1")).json.data[0].output).toEqual({ secret: "OUT" });
    expect((await call(aiRuns, "GET", "/api/v1/admin/ai/runs?agent=nope")).status).toBe(422);
    const rec = (b: object) => call(recordEval, "POST", "/api/v1/admin/ai/evals", { body: b });
    expect((await rec({ dataset_name: "v0", dataset_size: 0, metrics: {} })).status).toBe(422);
    expect((await rec({ dataset_name: "v0", dataset_size: 118, model: "m", prompt_versions: { intake: "v2" }, metrics: { category_accuracy: 0.8, note: "keyword fallback" } })).status).toBe(201);
    expect((await call(listEvals, "GET", "/api/v1/admin/ai/evals")).json.data[0]).toMatchObject({ dataset_size: 118, metrics: { category_accuracy: 0.8 } });
    const al = await call(auditLog, "GET", `/api/v1/admin/audit?action=moderation.hide&limit=1`);
    expect(al.json.data[0].action).toBe("moderation.hide");
    expect((await call(auditLog, "GET", "/api/v1/admin/audit?actor=bad")).status).toBe(422);
    const { data: acc } = await admin.from("audit_logs").select("resource_type").eq("action", "admin.access").eq("actor_id", adminU.id);
    expect(acc!.map((x) => x.resource_type)).toEqual(expect.arrayContaining(["ai_runs", "audit_logs"]));
    // the audit trail itself stays append-only
    expect((await adminU.sb.from("audit_logs").delete().eq("action", "moderation.hide")).error).not.toBeNull();
  });
  it("imports boundaries from a sourced file (validated), after which point lookup finds them; knowledge ingest is admin-only and repeatable", async () => {
    const square = (la: number, lo: number) => ({ type: "Polygon", coordinates: [[[lo, la], [lo + 0.1, la], [lo + 0.1, la + 0.1], [lo, la + 0.1], [lo, la]]] });
    const body = { source: { name: `HDX test ${stamp}`, url: "https://data.humdata.org/test", license: "CC BY-IGO", fetched_at: "2026-11-15" },
      geojson: { type: "FeatureCollection", features: [{ type: "Feature", geometry: square(24.5, 89.5), properties: { key: `imp-${stamp}-a`, name_bn: "পরীক্ষা এলাকা", name_en: "Import test area", district: "Testpur" } }] } };
    const imp = (b: object) => { as(adminU); return call(importC, "POST", "/api/v1/admin/constituencies/import", { body: b }); };
    as(manager); expect((await call(importC, "POST", "/api/v1/admin/constituencies/import", { body })).status).toBe(403);
    expect((await imp({ ...body, source: { ...body.source, license: "" } })).status).toBe(422);
    expect((await imp({ ...body, geojson: { type: "FeatureCollection", features: [{ ...body.geojson.features[0], geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }] } })).status).toBe(422);
    const open = { ...body.geojson.features[0], geometry: { type: "Polygon", coordinates: [[[89.5, 24.5], [89.6, 24.5], [89.6, 24.6], [89.5, 24.7]]] } };
    expect((await imp({ ...body, geojson: { type: "FeatureCollection", features: [open] } })).status).toBe(422);   // ring not closed
    const ok = await imp(body); expect(ok.status).toBe(201); expect(ok.json.data.imported).toBe(1);
    expect((await imp(body)).status).toBe(201);                                                                     // re-import updates
    as(null);
    expect((await call(repLookup, "GET", "/api/v1/representatives/lookup?lat=24.55&lng=89.55")).json.data.matches[0].constituency).toMatchObject({ key: `imp-${stamp}-a`, method: "boundary", is_demo: false });
    const ing = (u: TestUser) => { as(u); return call(ingest, "POST", "/api/v1/admin/knowledge/ingest", { body: {} }); };
    expect((await ing(manager)).status).toBe(403);
    const r1 = await ing(adminU); expect(r1.status).toBe(200); expect((await ing(adminU)).json.data).toMatchObject({ added: 0, removed: 0 });
  });
});
