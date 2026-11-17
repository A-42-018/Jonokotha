import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as publicFlags } from "../../src/app/api/v1/features/route";
import { GET as listFlags, POST as saveFlag } from "../../src/app/api/v1/admin/feature-flags/route";
import { GET as listCats } from "../../src/app/api/v1/categories/route";
import { POST as saveCat } from "../../src/app/api/v1/admin/categories/route";
import { GET as listSla, POST as saveSla } from "../../src/app/api/v1/admin/sla-policies/route";
import { POST as updateArea } from "../../src/app/api/v1/admin/constituencies/[key]/route";
import { POST as saveAgency } from "../../src/app/api/v1/admin/agencies/route";
import { GET as listAccounts } from "../../src/app/api/v1/admin/accounts/route";
import { POST as platformInvite } from "../../src/app/api/v1/admin/platform-invitations/route";
import { DELETE as revokePlatform } from "../../src/app/api/v1/admin/platform-invitations/[id]/route";
import { POST as acceptPlatform } from "../../src/app/api/v1/invitations/platform/accept/route";
import { GET as listIntegrations, POST as saveIntegration } from "../../src/app/api/v1/admin/integrations/route";
import { GET as securityEvents } from "../../src/app/api/v1/admin/security-events/route";
import { GET as systemHealth } from "../../src/app/api/v1/admin/system-health/route";
import { GET as listSources, POST as manageSource } from "../../src/app/api/v1/admin/knowledge-sources/route";
import { POST as demoData } from "../../src/app/api/v1/admin/demo-data/route";
import { GET as listComments, POST as postComment } from "../../src/app/api/v1/ideas/[ref]/comments/route";
import { POST as reportContent } from "../../src/app/api/v1/reports/route";
import { GET as listPolls } from "../../src/app/api/v1/polls/route";
import { GET as getPoll } from "../../src/app/api/v1/polls/[ref]/route";
import { POST as vote } from "../../src/app/api/v1/polls/[ref]/vote/route";
import { GET as officePolls, POST as createPoll } from "../../src/app/api/v1/office/polls/route";
import { GET as pollResults, POST as pollAction } from "../../src/app/api/v1/office/polls/[ref]/[action]/route";
import { GET as snapshot } from "../../src/app/api/v1/constituencies/[key]/snapshot/route";
import { GET as feedbackSummary, POST as sendFeedback } from "../../src/app/api/v1/projects/[ref]/feedback/route";
import { POST as projectDetails } from "../../src/app/api/v1/office/projects/[ref]/details/route";
import { POST as editProject } from "../../src/app/api/v1/office/projects/[ref]/route";
import { GET as getProject } from "../../src/app/api/v1/projects/[ref]/route";
import { GET as listFollows, POST as addFollow } from "../../src/app/api/v1/me/follows/route";
import { POST as createIssue } from "../../src/app/api/v1/issues/route";
import { GET as officeIssue } from "../../src/app/api/v1/office/issues/[ref]/route";
import { POST as startVideo } from "../../src/app/api/v1/issues/[ref]/video/route";
import { POST as completeVideo } from "../../src/app/api/v1/issues/[ref]/video/[id]/complete/route";
import { GET as issueMedia } from "../../src/app/api/v1/issues/[ref]/media/route";
import { clearFlagCache } from "../../src/lib/capabilities";
import { serviceClient } from "../../src/lib/supabase/service";
import { admin, anonClient, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, B: { id: string; key: string };
let adminU: TestUser, citizen: TestUser, citizen2: TestUser, manager: TestUser, mp: TestUser, officer: TestUser, managerB: TestUser, moderator: TestUser;
let ideaRef: string;
const slugs: string[] = [], agencyKeys: string[] = [];

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.anon;
  A = await makeConstituency(); B = await makeConstituency();
  adminU = await makeUser("admin"); moderator = await makeUser("moderator"); citizen = await makeUser("citizen"); citizen2 = await makeUser("citizen");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  mp = await makeUser("staff", { constituencyId: A.id, officeRole: "mp" });
  officer = await makeUser("staff", { constituencyId: A.id, officeRole: "case_officer" });
  managerB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
  const { data } = await admin.from("ideas").insert({ author_id: citizen.id, constituency_id: A.id, title: "Repair the market road", body: "Please repair the market road before the rains.", status: "published" }).select("ref").single().throwOnError();
  ideaRef = data!.ref;
});
afterAll(async () => {
  as(null);
  await admin.from("feature_flags").update({ enabled: true }).in("key", ["idea_comments", "polls"]); await admin.from("feature_flags").delete().eq("key", "p5_test_flag"); clearFlagCache();
  await admin.from("ideas").delete().in("constituency_id", [A.id, B.id]); await admin.from("polls").delete().in("constituency_id", [A.id, B.id]);
  await admin.from("announcements").delete().in("constituency_id", [A.id, B.id]); await admin.from("projects").delete().in("constituency_id", [A.id, B.id]);
  await admin.from("sla_policies").delete().in("constituency_id", [A.id, B.id]);
  await admin.from("issue_categories").delete().in("slug", slugs); await admin.from("agencies").delete().in("key", agencyKeys);
  await admin.from("knowledge_sources").delete().like("name", "p5-%"); await admin.from("platform_invitations").delete().like("email", "%p5inv%");
  await cleanup([A.id, B.id]);
});

describe("feature flags and capability labels (B5.3, B5.13)", () => {
  it("the public list needs no sign-in; only an admin can change a flag; the change is audited", async () => {
    as(null); const l = await call(publicFlags, "GET", "/x");
    expect(l.status).toBe(200); expect(l.json.data.find((f: { key: string }) => f.key === "official_registration")).toMatchObject({ enabled: false, data_status: "planned" });
    for (const u of [citizen, manager, mp, moderator]) { as(u); expect((await call(saveFlag, "POST", "/x", { body: { key: "polls", enabled: true } })).status).toBe(403); }
    as(adminU);
    expect((await call(saveFlag, "POST", "/x", { body: { key: "p5_test_flag", enabled: true, data_status: "demo", create: true } })).status).toBe(201);
    expect((await call(saveFlag, "POST", "/x", { body: { key: "p5_test_flag", enabled: true, create: true } })).status).toBe(409);
    expect((await call(saveFlag, "POST", "/x", { body: { key: "nope_nope", enabled: true } })).status).toBe(404);
    expect((await call(saveFlag, "POST", "/x", { body: { key: "p5_test_flag", enabled: false, data_status: "weird" } })).status).toBe(422);
    expect((await call(listFlags, "GET", "/x")).json.data.length).toBeGreaterThan(5);
    const { data: a } = await admin.from("audit_logs").select("action").eq("resource_id", "p5_test_flag"); expect(a!.map((x) => x.action)).toContain("feature_flag.create");
    as(manager); expect((await call(listFlags, "GET", "/x")).status).toBe(403);
  });
  it("every response carries data_status; a disabled flag answers 404 feature_disabled; a non-live flag labels the response", async () => {
    as(null);
    expect((await call(listCats, "GET", "/x")).json.data_status).toBe("live");
    as(adminU); await call(saveFlag, "POST", "/x", { body: { key: "polls", enabled: false } }); clearFlagCache();
    as(null); const off = await call(listPolls, "GET", "/x");
    expect(off.status).toBe(404); expect(off.json.code).toBe("feature_disabled");
    as(adminU); await call(saveFlag, "POST", "/x", { body: { key: "polls", enabled: true, data_status: "sample" } }); clearFlagCache();
    as(null); const sample = await call(listPolls, "GET", "/x"); expect(sample.status).toBe(200); expect(sample.json.data_status).toBe("sample");
    as(adminU); await call(saveFlag, "POST", "/x", { body: { key: "polls", enabled: true, data_status: "live" } }); clearFlagCache();
  });
});

describe("categories, SLA, directory records (B5.3, B5.15)", () => {
  it("admins create and update categories (bn/en names, parent, priority, active); service codes are stable; others are refused", async () => {
    const body = { slug: "p5_cat", name_bn: "পরীক্ষা", name_en: "Test category", default_priority: "high" }; slugs.push("p5_cat", "p5_sub");
    as(manager); expect((await call(saveCat, "POST", "/x", { body })).status).toBe(403);
    as(adminU);
    const c1 = await call(saveCat, "POST", "/x", { body }); expect(c1.status).toBe(201);
    expect((await call(saveCat, "POST", "/x", { body: { ...body, name_en: "Renamed" } })).status).toBe(200);
    expect((await call(saveCat, "POST", "/x", { body: { slug: "p5_sub", name_bn: "উপ", name_en: "Sub", parent: "p5_cat" } })).status).toBe(201);
    expect((await call(saveCat, "POST", "/x", { body: { slug: "p5_sub2", name_bn: "x", name_en: "x", parent: "nope" } })).status).toBe(422);
    expect((await call(saveCat, "POST", "/x", { body: { slug: "Bad Slug", name_bn: "x", name_en: "x" } })).status).toBe(422);
    expect((await call(saveCat, "POST", "/x", { body: { ...body, default_priority: "huge" } })).status).toBe(422);
    const row = (await call(listCats, "GET", "/x")).json.data.find((c: { slug: string }) => c.slug === "p5_cat");
    expect(row).toMatchObject({ name_en: "Renamed", default_priority: "high", service_code: "JK-P5-CAT", is_active: true });
    expect((await admin.from("issue_categories").update({ service_code: "CHANGED" }).eq("slug", "p5_cat")).error).not.toBeNull();   // the code never changes
    await call(saveCat, "POST", "/x", { body: { ...body, is_active: false } });
    as(null); expect((await call(listCats, "GET", "/x")).json.data.find((c: { slug: string }) => c.slug === "p5_cat")).toBeUndefined();   // inactive hidden from the public
    as(adminU); expect((await call(listCats, "GET", "/x")).json.data.find((c: { slug: string }) => c.slug === "p5_cat")).toBeTruthy();
  });
  it("SLA targets per office and category: admin anywhere, an office manager for their own area only", async () => {
    const body = { constituency: A.key, category: "roads", ack_target_hours: 24, update_target_hours: 72 };
    as(citizen); expect((await call(saveSla, "POST", "/x", { body })).status).toBe(404);
    as(mp); expect((await call(saveSla, "POST", "/x", { body })).status).toBe(403);
    as(managerB); expect((await call(saveSla, "POST", "/x", { body })).status).toBe(404);
    as(manager); expect((await call(saveSla, "POST", "/x", { body: { ack_target_hours: 24, update_target_hours: 72 } })).status).toBe(403);   // global: admin only
    expect((await call(saveSla, "POST", "/x", { body })).status).toBe(200);
    expect((await call(saveSla, "POST", "/x", { body: { ...body, ack_target_hours: 12 } })).status).toBe(200);       // same scope: updated, not duplicated
    expect((await call(saveSla, "POST", "/x", { body: { ...body, ack_target_hours: 0 } })).status).toBe(422);
    expect((await call(saveSla, "POST", "/x", { body: { ...body, category: "nonesuch" } })).status).toBe(422);
    expect((await admin.from("sla_policies").select("ack_target_hours").eq("constituency_id", A.id)).data).toEqual([{ ack_target_hours: 12 }]);
    as(adminU); expect((await call(listSla, "GET", "/x")).json.data.some((p: { constituency: string }) => p.constituency === A.key)).toBe(true);
  });
  it("directory records: admin edits an area and adds an agency with its source and check date; audited", async () => {
    as(manager); expect((await call(updateArea, "POST", "/x", { params: { key: A.key }, body: { name_en: "Hacked" } })).status).toBe(403);
    as(adminU); expect((await call(updateArea, "POST", "/x", { params: { key: A.key }, body: { name_en: "Area A renamed", district: "Dhaka" } })).status).toBe(200);
    expect((await call(updateArea, "POST", "/x", { params: { key: "no-such-area" }, body: {} })).status).toBe(404);
    expect((await admin.from("constituencies").select("name_en,district").eq("id", A.id).single()).data).toEqual({ name_en: "Area A renamed", district: "Dhaka" });
    const ag = { key: "p5-test-agency", name_bn: "পরীক্ষা সংস্থা", name_en: "Test agency", categories: ["roads"], source: "example.test", url: "https://example.test", checked_at: "2026-11-01" }; agencyKeys.push(ag.key);
    as(manager); expect((await call(saveAgency, "POST", "/x", { body: ag })).status).toBe(403);
    as(adminU);
    expect((await call(saveAgency, "POST", "/x", { body: { ...ag, checked_at: undefined } })).status).toBe(422);
    expect((await call(saveAgency, "POST", "/x", { body: ag })).status).toBe(201);
    expect((await call(saveAgency, "POST", "/x", { body: { ...ag, name_en: "Test agency 2" } })).status).toBe(200);
    expect((await admin.from("agencies").select("name_en").eq("key", ag.key).single()).data!.name_en).toBe("Test agency 2");
  });
});

describe("users, platform invitations, integrations, alerts, health (B5.3)", () => {
  it("lists accounts without emails, audited as an admin read; moderators and others cannot", async () => {
    as(adminU); const r = await call(listAccounts, "GET", "/x?role=moderator");
    expect(r.status).toBe(200); expect(r.json.data.every((a: { role: string }) => a.role === "moderator")).toBe(true); expect(JSON.stringify(r.json.data)).not.toMatch(/@/);
    const { data: a } = await admin.from("audit_logs").select("action,actor_id").eq("action", "admin.access").eq("actor_id", adminU.id); expect((a ?? []).length).toBeGreaterThan(0);
    for (const u of [moderator, manager, citizen]) { as(u); expect((await call(listAccounts, "GET", "/x")).status).toBe(403); }
    as(adminU); expect((await call(listAccounts, "GET", "/x?role=emperor")).status).toBe(422);
  });
  it("moderators and admins join by invitation: token once, matching confirmed email, single use, revocable, audited", async () => {
    const invitee = await makeUser("citizen"), second = await makeUser("citizen");
    as(manager); expect((await call(platformInvite, "POST", "/x", { body: { email: invitee.email, role: "moderator" } })).status).toBe(403);
    as(adminU);
    expect((await call(platformInvite, "POST", "/x", { body: { email: invitee.email, role: "citizen" } })).status).toBe(422);
    const r = await call(platformInvite, "POST", "/x", { body: { email: invitee.email, role: "moderator" } });
    expect(r.status).toBe(201); const token = r.json.data.invite_token; expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect((await call(platformInvite, "POST", "/x", { body: { email: invitee.email, role: "moderator" } })).status).toBe(409);
    const { data: row } = await admin.from("platform_invitations").select("token_hash").eq("id", r.json.data.id).single(); expect(row!.token_hash).not.toContain(token);
    as(citizen); expect((await call(acceptPlatform, "POST", "/x", { body: { token } })).status).toBe(403);   // another account
    as(invitee); expect((await call(acceptPlatform, "POST", "/x", { body: { token: "0".repeat(48) } })).status).toBe(404);
    expect((await call(acceptPlatform, "POST", "/x", { body: { token } })).json.data.role).toBe("moderator");
    expect((await admin.from("profiles").select("role").eq("id", invitee.id).single()).data!.role).toBe("moderator");
    expect((await call(acceptPlatform, "POST", "/x", { body: { token } })).status).toBe(404);               // single use
    // a citizen cannot promote themselves, even right after someone else's invitation was accepted
    as(second); await second.sb.from("profiles").update({ role: "admin" }).eq("id", second.id);
    expect((await admin.from("profiles").select("role").eq("id", second.id).single()).data!.role).toBe("citizen");
    as(adminU); const r2 = await call(platformInvite, "POST", "/x", { body: { email: second.email, role: "admin" } });
    expect((await call(revokePlatform, "DELETE", "/x", { params: { id: r2.json.data.id } })).json.data.revoked).toBe(true);
    as(second); expect((await call(acceptPlatform, "POST", "/x", { body: { token: r2.json.data.invite_token } })).status).toBe(404);
    const { data: au } = await admin.from("audit_logs").select("action").eq("resource_id", r.json.data.id); expect(au!.map((x) => x.action).sort()).toEqual(["platform_invitation.accept", "platform_invitation.create"]);
  });
  it("integrations show enabled and whether a key is present, never the key; only admins change them", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-very-secret-value";
    as(adminU); const l = await call(listIntegrations, "GET", "/x");
    expect(l.json.data.find((i: { provider: string }) => i.provider === "anthropic")).toMatchObject({ enabled: true, key_present: true });
    expect(JSON.stringify(l.json)).not.toContain("sk-very-secret-value");
    delete process.env.ANTHROPIC_API_KEY;
    expect((await call(saveIntegration, "POST", "/x", { body: { provider: "resend", enabled: true, note: "pilot" } })).json.data.enabled).toBe(true);
    expect((await call(saveIntegration, "POST", "/x", { body: { provider: "nonesuch", enabled: true } })).status).toBe(404);
    await call(saveIntegration, "POST", "/x", { body: { provider: "resend", enabled: false } });
    as(manager); expect((await call(listIntegrations, "GET", "/x")).status).toBe(403); expect((await call(saveIntegration, "POST", "/x", { body: { provider: "resend", enabled: true } })).status).toBe(403);
  });
  it("the security alerts feed shows blocked and denied requests without personal data, to admins only", async () => {
    as(citizen); await call(saveFlag, "POST", "/x", { body: { key: "polls", enabled: true }, ip: "198.51.100.77" });
    as(null); await call(saveCat, "POST", "/x", { body: {}, ip: "198.51.100.78" });
    as(adminU); const r = await call(securityEvents, "GET", "/x?hours=1");
    expect(r.status).toBe(200); expect(r.json.data.summary.permission_denied).toBeGreaterThan(0); expect(r.json.data.summary.auth_failure).toBeGreaterThan(0);
    expect(JSON.stringify(r.json.data)).not.toMatch(/198\.51\.100|@example/);
    expect((await call(securityEvents, "GET", "/x?kind=nonsense")).status).toBe(422);
    as(moderator); expect((await call(securityEvents, "GET", "/x")).status).toBe(403);
    expect((await anonClient.from("security_events").select("id")).data ?? []).toEqual([]);
  });
  it("system health reports the database, storage, queues, jobs, AI provider and delivery; admin only", async () => {
    as(adminU); const r = await call(systemHealth, "GET", "/x");
    expect(r.status).toBe(200); expect(Object.keys(r.json.data.checks).sort()).toEqual(["ai_provider", "database", "jobs", "notification_delivery", "queues", "storage"]);
    expect(r.json.data.checks.database.ok).toBe(true); expect(r.json.data.checks.storage.ok).toBe(true);
    as(manager); expect((await call(systemHealth, "GET", "/x")).status).toBe(403);
  });
  it("knowledge sources: add (needs licence and link), refresh, retire; admin only", async () => {
    as(manager); expect((await call(manageSource, "POST", "/x", { body: { action: "add", name: "p5-src", url: "https://example.test", license: "CC-BY" } })).status).toBe(403);
    as(adminU);
    expect((await call(manageSource, "POST", "/x", { body: { action: "add", name: "p5-src", url: "ftp://x", license: "CC-BY" } })).status).toBe(422);
    const a = await call(manageSource, "POST", "/x", { body: { action: "add", name: "p5-src", url: "https://example.test/data", license: "CC-BY 4.0" } });
    expect(a.status).toBe(201); const id = a.json.data.id;
    expect((await call(manageSource, "POST", "/x", { body: { action: "retire", id } })).json.data.status).toBe("retired");
    expect((await call(manageSource, "POST", "/x", { body: { action: "refresh", id } })).json.data.status).toBe("active");
    expect((await call(manageSource, "POST", "/x", { body: { action: "refresh", id: "00000000-0000-4000-8000-000000000000" } })).status).toBe(404);
    expect((await call(listSources, "GET", "/x")).json.data.some((s: { id: string }) => s.id === id)).toBe(true);
  });
  it("demo data tools work outside production and are refused in production by the environment and by the database setting", async () => {
    as(manager); expect((await call(demoData, "POST", "/x", { body: { action: "load" } })).status).toBe(403);
    as(adminU);
    const { data: demo } = await admin.from("constituencies").select("id").eq("is_demo", true).eq("is_active", true).limit(1);
    if (demo?.length) {
      expect((await call(demoData, "POST", "/x", { body: { action: "load" } })).status).toBe(200);
      expect((await call(demoData, "POST", "/x", { body: { action: "reset" } })).status).toBe(200);
    }
    process.env.APP_ENV = "production"; expect((await call(demoData, "POST", "/x", { body: { action: "reset" } })).status).toBe(403); delete process.env.APP_ENV;
    await admin.from("app_settings").update({ value: "production" }).eq("key", "environment");
    expect((await call(demoData, "POST", "/x", { body: { action: "reset" } })).json.code).toBe("rule_not_met");
    await admin.from("app_settings").update({ value: "development" }).eq("key", "environment");
    expect((await call(demoData, "POST", "/x", { body: { action: "wipe" } })).status).toBe(422);
  });
});

describe("idea comments (B5.5)", () => {
  const post = (u: TestUser | null, body: object) => { as(u); return call(postComment, "POST", "/x", { params: { ref: ideaRef }, body }); };
  it("a verified account comments on a public idea; personal data is removed; the public list has no author", async () => {
    expect((await post(null, { body: "hello there" })).status).toBe(401);
    expect((await post(citizen2, { body: "x" })).status).toBe(422);
    const r = await post(citizen2, { body: "Good idea, call me on 01712345678" }); expect(r.status).toBe(201);
    as(null); const l = await call(listComments, "GET", "/x", { params: { ref: ideaRef } });
    expect(l.json.data).toHaveLength(1); expect(l.json.data[0].body).not.toContain("01712345678"); expect(Object.keys(l.json.data[0]).sort()).toEqual(["body", "created_at", "id"]);
    const { data: hidden } = await admin.from("ideas").insert({ author_id: citizen.id, constituency_id: A.id, title: "Hidden one here", body: "A pending idea body text.", status: "pending_review" }).select("ref").single();
    as(citizen2); expect((await call(postComment, "POST", "/x", { params: { ref: hidden!.ref }, body: { body: "sneaky" } })).status).toBe(404);   // not public
  });
  it("is limited to 10 a day per person, can be reported, and a moderator hides it with a reason", async () => {
    const c3 = await makeUser("citizen");
    expect((await post(c3, { body: "the first of many" })).status).toBe(201);
    const { data: idea } = await admin.from("ideas").select("id").eq("ref", ideaRef).single();
    await admin.from("idea_comments").insert(Array.from({ length: 9 }, (_, i) => ({ idea_id: idea!.id, author_id: c3.id, body: `bulk comment ${i}` })));
    const over = await post(c3, { body: "one too many" }); expect(over.status).toBe(409);
    as(null); const l = (await call(listComments, "GET", "/x", { params: { ref: ideaRef } })).json.data; const id = l[0].id;
    as(citizen); expect((await call(reportContent, "POST", "/x", { body: { type: "idea_comment", ref: id, reason: "abuse" } })).status).toBe(201);
    expect((await call(reportContent, "POST", "/x", { body: { type: "idea_comment", ref: id, reason: "abuse" } })).status).toBe(409);
    expect((await call(reportContent, "POST", "/x", { body: { type: "idea_comment", ref: "00000000-0000-4000-8000-000000000000", reason: "spam" } })).status).toBe(404);
    as(moderator);
    const { data: queue } = await moderator.sb.rpc("moderation_queue", { p_limit: 50 }); expect((queue ?? []).some((r: { target_type: string; target_ref: string }) => r.target_type === "idea_comment" && r.target_ref === id)).toBe(true);
    const { error } = await moderator.sb.rpc("moderate_item", { p_type: "idea_comment", p_ref: id, p_action: "hide", p_reason: "Abusive wording" }); expect(error).toBeNull();
    as(null); expect((await call(listComments, "GET", "/x", { params: { ref: ideaRef } })).json.data.map((x: { id: string }) => x.id)).not.toContain(id);
    await moderator.sb.rpc("moderate_item", { p_type: "idea_comment", p_ref: id, p_action: "restore", p_reason: "Wrongly hidden" });
    as(null); expect((await call(listComments, "GET", "/x", { params: { ref: ideaRef } })).json.data.map((x: { id: string }) => x.id)).toContain(id);
  });
  it("is switched off by its feature flag", async () => {
    as(adminU); await call(saveFlag, "POST", "/x", { body: { key: "idea_comments", enabled: false } }); clearFlagCache();
    expect((await post(citizen2, { body: "while off" })).json.code).toBe("feature_disabled");
    as(adminU); await call(saveFlag, "POST", "/x", { body: { key: "idea_comments", enabled: true } }); clearFlagCache();
  });
});

describe("polls (B5.5)", () => {
  let ref: string, options: { id: string; label: string }[];
  const act = (u: TestUser, a: string) => { as(u); return call(pollAction, "POST", "/x", { params: { ref, action: a } }); };
  it("MP or manager of the area create and publish; others cannot; the public sees only open and closed polls", async () => {
    const body = { constituency: A.key, question: "Which road first?", options: ["Market road", "School road", "market road "] };
    as(citizen); expect((await call(createPoll, "POST", "/x", { body })).status).toBe(404);
    as(officer); expect((await call(createPoll, "POST", "/x", { body })).status).toBe(404);
    as(managerB); expect((await call(createPoll, "POST", "/x", { body })).status).toBe(404);
    as(manager);
    expect((await call(createPoll, "POST", "/x", { body })).status).toBe(422);                                   // duplicate option
    expect((await call(createPoll, "POST", "/x", { body: { ...body, options: ["only one"] } })).status).toBe(422);
    expect((await call(createPoll, "POST", "/x", { body: { ...body, options: ["a", "b"], closes_at: "2020-01-01T00:00:00Z" } })).status).toBe(422);
    const r = await call(createPoll, "POST", "/x", { body: { ...body, options: ["Market road", "School road"], results_visibility: "after_close" } });
    expect(r.status).toBe(201); ref = r.json.data.ref;
    as(null); expect((await call(listPolls, "GET", `/x?constituency=${A.key}`)).json.data).toHaveLength(0);      // draft is invisible
    expect((await call(getPoll, "GET", "/x", { params: { ref } })).status).toBe(404);
    expect((await act(citizen, "publish")).status).toBe(404);
    expect((await act(manager, "close")).status).toBe(409);                                                      // draft -> closed is not allowed
    expect((await act(manager, "publish")).json.data.status).toBe("open");
    as(manager); expect((await call(officePolls, "GET", "/x")).json.data.some((p: { ref: string }) => p.ref === ref)).toBe(true);
    as(null); const g = await call(getPoll, "GET", "/x", { params: { ref } }); options = g.json.data.options; expect(options).toHaveLength(2);
    expect(g.json.data.results).toMatchObject({ results_shown: false, total_votes: 0 });
  });
  it("one vote per verified account while open; results stay hidden until the poll closes and 5 people voted; the office sees them any time", async () => {
    const voters: TestUser[] = []; for (let i = 0; i < 5; i++) voters.push(await makeUser("citizen"));
    const v = (u: TestUser | null, opt: string) => { as(u); return call(vote, "POST", "/x", { params: { ref }, body: { option_id: opt } }); };
    expect((await v(null, options[0].id)).status).toBe(401);
    expect((await v(voters[0], "00000000-0000-4000-8000-000000000000")).status).toBe(422);
    expect((await v(voters[0], options[0].id)).status).toBe(201);
    expect((await v(voters[0], options[1].id)).status).toBe(409);                                                // already voted
    for (let i = 1; i < 5; i++) expect((await v(voters[i], options[i % 2].id)).status).toBe(201);
    as(voters[0]); const mine = await call(getPoll, "GET", "/x", { params: { ref } }); expect(mine.json.data.results).toMatchObject({ results_shown: false, total_votes: 5, my_option_id: options[0].id });
    expect(JSON.stringify(mine.json.data.results)).not.toMatch(/"votes"/);
    as(manager); expect((await call(pollResults, "GET", "/x", { params: { ref, action: "results" } })).json.data.options.map((o: { votes: number }) => o.votes).reduce((a: number, b: number) => a + b, 0)).toBe(5);
    as(citizen); expect((await call(pollResults, "GET", "/x", { params: { ref, action: "results" } })).status).toBe(404);
    expect((await act(manager, "close")).json.data.status).toBe("closed");
    expect((await v(voters[0], options[0].id)).status).toBe(409);                                                // closed
    as(null); const after = await call(getPoll, "GET", "/x", { params: { ref } });
    expect(after.json.data.results.results_shown).toBe(true); expect(after.json.data.results.options.map((o: { votes: number }) => o.votes).sort()).toEqual([2, 3]);
  });
  it("small polls hide their counts from the public even after closing; due polls close themselves and followers hear before closing", async () => {
    as(manager);
    const r = await call(createPoll, "POST", "/x", { body: { constituency: A.key, question: "A small poll here?", options: ["Yes", "No"], closes_at: new Date(Date.now() + 3_600_000).toISOString() } });
    const small = r.json.data.ref; as(manager); await call(pollAction, "POST", "/x", { params: { ref: small, action: "publish" } });
    const follower = await makeUser("citizen"); const nonVoter = await makeUser("citizen");
    for (const u of [follower, nonVoter]) { as(u); await call(addFollow, "POST", "/x", { body: { type: "area", target: A.key } }); }
    const { data: opts } = await anonClient.from("public_poll_options").select("id").eq("poll_ref", small);
    as(follower); await call(vote, "POST", "/x", { params: { ref: small }, body: { option_id: opts![0].id } });
    const { data: n } = await admin.rpc("poll_closing_reminders"); expect(n).toBe(1);                              // nonVoter only
    expect((await admin.from("notifications").select("user_id").eq("type", "poll_closing").eq("ref", small)).data).toEqual([{ user_id: nonVoter.id }]);
    expect((await admin.rpc("poll_closing_reminders")).data).toBe(0);                                              // once
    await admin.from("polls").update({ closes_at: new Date(Date.now() - 1000).toISOString() }).eq("ref", small);
    expect((await admin.rpc("close_due_polls")).data).toBe(1);
    as(null); expect((await call(getPoll, "GET", "/x", { params: { ref: small } })).json.data.results).toMatchObject({ results_shown: false, total_votes: 1 });
  });
});

describe("snapshot, projects and follows (B5.5)", () => {
  it("the snapshot counts public issues in three groups with a definition and date range; unknown areas 404", async () => {
    const mk = async (status: string, vis = true) => (await admin.from("issues").insert({ reporter_id: citizen.id, title: "Snapshot test", category: "roads", description: "snapshot", constituency_id: A.id, constituency_key: A.key, public_visibility: vis, status }).select("id").single().throwOnError()).data!.id;
    await mk("submitted"); await mk("in_progress"); await mk("resolved"); await mk("submitted", false);
    as(null); const r = await call(snapshot, "GET", "/x", { params: { key: A.key } });
    expect(r.json.data).toMatchObject({ reported: 1, in_progress: 1, resolved: 1, constituency: A.key }); expect(r.json.data.definition).toMatch(/Not a ranking/); expect(r.json.data.from).toBeTruthy();
    expect((await call(snapshot, "GET", "/x?from=2020-01-01&to=2020-02-01", { params: { key: A.key } })).json.data).toMatchObject({ reported: 0, resolved: 0 });
    expect((await call(snapshot, "GET", "/x?from=2026-02-01&to=2026-01-01", { params: { key: A.key } })).status).toBe(422);
    expect((await call(snapshot, "GET", "/x", { params: { key: "nope" } })).status).toBe(404);
  });
  it("project transparency: budget source with verification date, delay explanation when the end date moves later, post-completion feedback", async () => {
    as(mp);
    const created = await admin.from("projects").insert({ constituency_id: A.id, title: "Drain project p5", status: "in_progress", start_date: "2026-01-01", expected_end_date: "2026-12-01" }).select("ref").single().throwOnError(); const ref = created.data!.ref;
    const det = (u: TestUser, body: object) => { as(u); return call(projectDetails, "POST", "/x", { params: { ref }, body }); };
    expect((await det(citizen, { budget_source: "ADP" })).status).toBe(404); expect((await det(officer, { budget_source: "ADP" })).status).toBe(404);
    expect((await det(mp, { budget_source: "Annual Development Programme 2026-27" })).status).toBe(422);          // needs a verification date
    expect((await det(mp, { budget_source: "Annual Development Programme 2026-27", budget_verified_at: "2026-11-01", procurement_ref: "e-GP 12345" })).status).toBe(200);
    as(null); const pub = await call(getProject, "GET", "/x", { params: { ref } });
    expect(pub.json.data).toMatchObject({ budget_source: "Annual Development Programme 2026-27", budget_verified_at: "2026-11-01", procurement_ref: "e-GP 12345" });
    const edit = (body: object) => { as(manager); return call(editProject, "POST", "/x", { params: { ref }, body }); };
    expect((await edit({ expected_end_date: "2027-03-01" })).status).toBe(422);                                       // later without an explanation
    expect((await edit({ expected_end_date: "2027-03-01", delay_explanation: "short" })).status).toBe(422);
    expect((await edit({ expected_end_date: "2027-03-01", delay_explanation: "Heavy rain stopped the work for two months." })).status).toBe(200);
    expect((await edit({ expected_end_date: "2027-01-01" })).status).toBe(200);                                       // earlier is fine
    as(null); expect((await call(getProject, "GET", "/x", { params: { ref } })).json.data.delay_explanation).toMatch(/Heavy rain/);
    // feedback only after completion, once per person, average shown from 5
    as(citizen2); const fb = (body: object) => call(sendFeedback, "POST", "/x", { params: { ref }, body });
    expect((await fb({ rating: 4 })).status).toBe(409);
    await admin.from("projects").update({ status: "completed" }).eq("ref", ref);
    expect((await fb({ rating: 9 })).status).toBe(422);
    expect((await fb({ rating: 4, comment: "Done well. Call 01712345678" })).status).toBe(201);
    expect((await fb({ rating: 5 })).status).toBe(409);
    as(null); expect((await call(sendFeedback, "POST", "/x", { params: { ref }, body: { rating: 3 } })).status).toBe(401);
    expect((await call(feedbackSummary, "GET", "/x", { params: { ref } })).json.data).toMatchObject({ feedback_count: 1, average_rating: null });
    for (let i = 0; i < 4; i++) { const u = await makeUser("citizen"); as(u); await call(sendFeedback, "POST", "/x", { params: { ref }, body: { rating: 5 } }); }
    as(null); expect((await call(feedbackSummary, "GET", "/x", { params: { ref } })).json.data).toMatchObject({ feedback_count: 5, average_rating: 4.8 });
    expect(JSON.stringify((await admin.from("project_feedback").select("comment")).data)).not.toContain("01712345678");
  });
  it("citizens follow projects and verified representatives; listing shows them; unknown targets are refused", async () => {
    const { data: p } = await admin.from("projects").select("ref").eq("constituency_id", A.id).limit(1).single();
    const { data: rep } = await admin.from("representatives").insert({ full_name: "P5 Rep", verification_status: "verified", is_demo: true }).select("id").single().throwOnError();
    const { data: hiddenRep } = await admin.from("representatives").insert({ full_name: "P5 Unverified", verification_status: "unverified", is_demo: true }).select("id").single().throwOnError();
    as(citizen2);
    expect((await call(addFollow, "POST", "/x", { body: { type: "project", target: p!.ref } })).status).toBe(201);
    expect((await call(addFollow, "POST", "/x", { body: { type: "representative", target: rep!.id } })).status).toBe(201);
    expect((await call(addFollow, "POST", "/x", { body: { type: "representative", target: rep!.id } })).status).toBe(201);   // idempotent
    expect((await call(addFollow, "POST", "/x", { body: { type: "representative", target: hiddenRep!.id } })).status).toBe(404);
    expect((await call(addFollow, "POST", "/x", { body: { type: "project", target: "PR-0000-0" } })).status).toBe(404);
    const l = (await call(listFollows, "GET", "/x")).json.data.filter((f: { type: string }) => ["project", "representative"].includes(f.type));
    expect(l.map((f: { type: string }) => f.type).sort()).toEqual(["project", "representative"]); expect(l.find((f: { type: string }) => f.type === "representative").label).toBe("P5 Rep");
    await admin.from("representatives").delete().in("id", [rep!.id, hiddenRep!.id]);
  });
});

describe("report fields and video evidence (B5.6)", () => {
  let ref: string, issueId: string;
  it("duration and who is affected are stored for the office only (not in the public view)", async () => {
    as(citizen);
    const r = await call(createIssue, "POST", "/x", { headers: { "idempotency-key": `idem-${Date.now()}-a` }, body: { title: "Water stopped flowing", category: "water", description: "No water in our lane.", constituencyId: A.key, duration: "Since three days, call 01712345678", affectedWho: "About 40 families" } });
    expect(r.status).toBe(201); ref = r.json.data.ref;
    const { data: row } = await admin.from("issues").select("id,duration_text,affected_who").eq("ref", ref).single(); issueId = row!.id;
    expect(row!.duration_text).toMatch(/three days/); expect(row!.duration_text).not.toContain("01712345678"); expect(row!.affected_who).toBe("About 40 families");
    as(manager); const o = await call(officeIssue, "GET", "/x", { params: { ref } }); expect(o.json.data).toMatchObject({ affected_who: "About 40 families" });
    expect((await anonClient.from("public_cases").select("*").eq("ref", ref).single()).data).not.toHaveProperty("affected_who");
    as(citizen); expect((await call(createIssue, "POST", "/x", { headers: { "idempotency-key": `idem-${Date.now()}-b` }, body: { title: "Another long one", category: "water", description: "Too long duration.", constituencyId: A.key, duration: "x".repeat(101) } })).status).toBe(422);
  });
  it("video: signed upload slot, type and size limits, content sniffing, one per issue, private until reviewed; a fake file is rejected and deleted", async () => {
    const svc = serviceClient()!;
    const start = (u: TestUser, body: object) => { as(u); return call(startVideo, "POST", "/x", { params: { ref }, body }); };
    const good = { mime_type: "video/mp4", bytes: 5000, duration_seconds: 12 };
    expect((await start(citizen2, good)).status).toBe(404);                                            // not the reporter
    expect((await start(citizen, { ...good, mime_type: "video/x-msvideo" })).status).toBe(422);
    expect((await start(citizen, { ...good, bytes: 21_000_000 })).status).toBe(422);
    expect((await start(citizen, { ...good, duration_seconds: 600 })).status).toBe(422);
    const s = await start(citizen, good); expect(s.status).toBe(201);
    expect((await start(citizen, good)).status).toBe(409);                                              // one video per issue
    const { id, upload } = s.json.data;
    as(citizen); expect((await call(completeVideo, "POST", "/x", { params: { ref, id } })).status).toBe(409);       // nothing uploaded yet
    const mp4 = new Uint8Array(5000); mp4.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    const up = await svc.storage.from("issue-video").uploadToSignedUrl(upload.path, upload.token, mp4, { contentType: "video/mp4" }); expect(up.error).toBeNull();
    const done = await call(completeVideo, "POST", "/x", { params: { ref, id } }); expect(done.status).toBe(200); expect(done.json.data.status).toBe("ready");
    const { data: m } = await admin.from("issue_media").select("visibility,moderation_status,upload_status,media_type,duration_seconds").eq("id", id).single();
    expect(m).toMatchObject({ visibility: "private", moderation_status: "pending", upload_status: "ready", media_type: "video", duration_seconds: 12 });
    as(null); expect((await call(issueMedia, "GET", "/x", { params: { ref } })).json.data).toEqual([]);           // private: invisible to the public
    as(citizen); const own = (await call(issueMedia, "GET", "/x", { params: { ref } })).json.data; expect(own[0]).toMatchObject({ type: "video", visibility: "private" }); expect(own[0].url).toMatch(/^http/);
    // a file that is not a video is rejected and removed
    await admin.from("issue_media").update({ upload_status: "rejected" }).eq("id", id);
    const s2 = await start(citizen, good); expect(s2.status).toBe(201);
    const fake = new Uint8Array(5000); fake.set([0xff, 0xd8, 0xff]);
    await svc.storage.from("issue-video").uploadToSignedUrl(s2.json.data.upload.path, s2.json.data.upload.token, fake, { contentType: "video/mp4" });
    as(citizen); const bad = await call(completeVideo, "POST", "/x", { params: { ref, id: s2.json.data.id } }); expect(bad.status).toBe(422); expect(bad.json.field_errors?.video).toBe("type");
    expect((await admin.from("issue_media").select("upload_status").eq("id", s2.json.data.id).single()).data!.upload_status).toBe("rejected");
    expect((await svc.storage.from("issue-video").download(s2.json.data.upload.path)).error).not.toBeNull();
    void issueId;
  });
});
