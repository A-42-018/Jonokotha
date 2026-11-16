import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as queue } from "../../src/app/api/v1/admin/moderation/route";
import { GET as exportMine } from "../../src/app/api/v1/me/export/route";
import { GET as getProfile, PATCH as patchProfile } from "../../src/app/api/v1/me/profile/route";
import { GET as listConsents, POST as setConsent } from "../../src/app/api/v1/me/consents/route";
import { DELETE as cancelDel, POST as requestDel } from "../../src/app/api/v1/me/deletion-request/route";
import { POST as maintenance } from "../../src/app/api/internal/maintenance/route";
import { GET as officeKpis } from "../../src/app/api/v1/office/kpis/route";
import { GET as adminKpis } from "../../src/app/api/v1/admin/kpis/route";
import { GET as health } from "../../src/app/api/health/route";
import { POST as askQ } from "../../src/app/api/v1/questions/route";
import { admin, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

let adminU: TestUser, citizen: TestUser, other: TestUser;
const areas: string[] = [];
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.anon;
  adminU = await makeUser("admin"); citizen = await makeUser("citizen"); other = await makeUser("citizen");
});
afterAll(async () => { as(null); await admin.from("app_settings").update({ value: false }).eq("key", "enforce_mfa"); await cleanup(areas); });

describe("MFA gate on privileged routes", () => {
  it("an aal1 admin gets 403 mfa_required once enforcement is on, and works while it is off", async () => {
    as(adminU);
    await admin.from("app_settings").update({ value: false }).eq("key", "enforce_mfa");
    expect((await call(queue, "GET", "/api/v1/admin/moderation")).status).toBe(200);
    await admin.from("app_settings").update({ value: true }).eq("key", "enforce_mfa");
    const r = await call(queue, "GET", "/api/v1/admin/moderation");
    expect(r.status).toBe(403);
    expect(r.json.field_errors?._).toBe("mfa_required");
    await admin.from("app_settings").update({ value: false }).eq("key", "enforce_mfa");
  });
  it("citizens are unaffected by the flag", async () => {
    await admin.from("app_settings").update({ value: true }).eq("key", "enforce_mfa");
    as(citizen);
    expect((await call(getProfile, "GET", "/api/v1/me/profile")).status).toBe(200);
    await admin.from("app_settings").update({ value: false }).eq("key", "enforce_mfa");
  });
});

describe("privacy endpoints", () => {
  it("need a session", async () => {
    as(null);
    for (const [h, m] of [[exportMine, "GET"], [getProfile, "GET"], [requestDel, "POST"], [listConsents, "GET"]] as const) expect((await call(h, m, "/x")).status).toBe(401);
  });
  it("export returns the person's data as a download; profile correction validates", async () => {
    as(citizen);
    const e = await call(exportMine, "GET", "/api/v1/me/export");
    expect(e.status).toBe(200);
    expect(e.json.data.profile.id).toBe(citizen.id);
    expect(e.headers.get("content-disposition")).toContain("attachment");
    expect((await call(patchProfile, "PATCH", "/api/v1/me/profile", { body: {} })).status).toBe(422);
    expect((await call(patchProfile, "PATCH", "/api/v1/me/profile", { body: { preferred_language: "fr" } })).status).toBe(422);
    expect((await call(patchProfile, "PATCH", "/api/v1/me/profile", { body: { display_name: "Karim", role: "admin" } })).status).toBe(422);
    const ok = await call(patchProfile, "PATCH", "/api/v1/me/profile", { body: { display_name: "Karim", preferred_language: "bn" } });
    expect(ok.status).toBe(200);
    expect((await call(getProfile, "GET", "/api/v1/me/profile")).json.data.display_name).toBe("Karim");
    as(other);
    expect((await call(exportMine, "GET", "/api/v1/me/export")).json.data.profile.display_name).not.toBe("Karim");
  });
  it("consent can be granted, listed and withdrawn", async () => {
    as(citizen);
    expect((await call(setConsent, "POST", "/api/v1/me/consents", { body: { consent_type: "privacy_notice", policy_version: "v1", granted: true } })).status).toBe(200);
    expect((await call(setConsent, "POST", "/api/v1/me/consents", { body: { consent_type: "Bad Type", policy_version: "v1", granted: true } })).status).toBe(422);
    expect((await call(listConsents, "GET", "/api/v1/me/consents")).json.data).toHaveLength(1);
    await call(setConsent, "POST", "/api/v1/me/consents", { body: { consent_type: "privacy_notice", policy_version: "v1", granted: false } });
    expect((await call(listConsents, "GET", "/api/v1/me/consents")).json.data[0].withdrawn_at).not.toBeNull();
  });
  it("deletion can be requested (202, repeatable) and cancelled", async () => {
    as(other);
    expect((await call(requestDel, "POST", "/api/v1/me/deletion-request")).status).toBe(202);
    expect((await call(requestDel, "POST", "/api/v1/me/deletion-request")).status).toBe(202);
    expect((await call(getProfile, "GET", "/api/v1/me/profile")).json.data.deletion_requested_at).not.toBeNull();
    expect((await call(cancelDel, "DELETE", "/api/v1/me/deletion-request")).json.data.cancelled).toBe(true);
    expect((await call(getProfile, "GET", "/api/v1/me/profile")).json.data.deletion_requested_at).toBeNull();
  });
});

describe("CSRF second layer", () => {
  it("a browser POST from another origin is refused; the same origin and no Origin are fine", async () => {
    as(citizen);
    const body = { consent_type: "privacy_notice", policy_version: "v1", granted: true };
    const bad = await call(setConsent, "POST", "/api/v1/me/consents", { body, headers: { origin: "https://evil.example" } });
    expect(bad.status).toBe(403);
    expect(bad.json.field_errors?._).toBe("cross_site");
    expect((await call(setConsent, "POST", "/api/v1/me/consents", { body, headers: { origin: "http://localhost" } })).status).toBe(200);
  });
});

describe("imminent-harm path", () => {
  it("a question with danger language returns fixed guidance and lands in the moderators' queue; an ordinary one does not", async () => {
    const A = await makeConstituency();
    as(citizen);
    const calm = await call(askQ, "POST", "/api/v1/questions", { body: { constituency: A.key, visibility: "private", title: "Street light repair", body: "When will the street light on my road be repaired?" } });
    expect(calm.status).toBe(201);
    expect(calm.json.data.emergency).toBeUndefined();
    const bad = await call(askQ, "POST", "/api/v1/questions", { body: { constituency: A.key, visibility: "private", title: "Please help me now", body: "He has threatened to kill me and I am scared to go home tonight." } });
    expect(bad.status).toBe(201);
    expect(bad.json.data.emergency.kind).toBe("violence");
    expect(bad.json.data.emergency.numbers).toContain("999");
    const { data } = await admin.from("moderation_reports").select("reason_code,details").eq("target_ref", bad.json.data.ref).throwOnError();
    expect(data).toHaveLength(1);
    expect(data![0].reason_code).toBe("unsafe");
    expect((await admin.from("moderation_reports").select("id").eq("target_ref", calm.json.data.ref)).data).toHaveLength(0);
    await admin.from("questions").delete().eq("constituency_id", A.id); areas.push(A.id);
  });
});

describe("KPI queries", () => {
  it("office KPIs: manager only, each metric has a definition, small groups are hidden", async () => {
    const A = await makeConstituency(), B = await makeConstituency();
    const mgr = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
    const officer = await makeUser("staff", { constituencyId: A.id, officeRole: "case_officer" });
    const mgrB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
    await admin.from("issues").insert([1, 2].map((i) => ({ reporter_id: citizen.id, title: `Broken light ${i}`, category: "road", description: "The light is out", constituency_id: A.id }))).throwOnError();
    const path = `/api/v1/office/kpis?constituency=${A.key}`;
    const ask = (u: TestUser | null, p = path) => { as(u); return call(officeKpis, "GET", p); };
    expect((await ask(null)).status).toBe(401);
    expect((await ask(citizen)).status).toBe(404);
    expect((await ask(officer)).status).toBe(404);
    expect((await ask(mgrB)).status).toBe(404);
    expect((await ask(mgr, `${path}&days=0`)).status).toBe(422);
    const r = await ask(mgr);
    expect(r.status).toBe(200);
    const m = r.json.data.metrics;
    for (const key of Object.keys(m)) expect(m[key].definition, key).toBeTypeOf("string");
    expect(m.received.value).toBeNull();           // 2 issues < 5: suppressed
    expect(m.received.suppressed).toBe(true);
    expect(m.unassigned_workload.value).toBe(2);
    await admin.from("issues").delete().eq("constituency_id", A.id); areas.push(A.id, B.id);
  });
  it("admin KPIs are for administrators only", async () => {
    for (const u of [citizen, null]) { as(u); expect((await call(adminKpis, "GET", "/api/v1/admin/kpis")).status).toBe(u ? 403 : 401); }
    as(adminU);
    const r = await call(adminKpis, "GET", "/api/v1/admin/kpis?days=7");
    expect(r.status).toBe(200);
    expect(r.json.data.metrics.ai_cost_usd.definition).toBeTypeOf("string");
    expect(r.json.data.period_days).toBe(7);
  });
});

describe("maintenance job and health", () => {
  it("maintenance needs the cron secret", async () => {
    process.env.CRON_SECRET = "a-very-long-test-secret-123";
    expect((await call(maintenance, "POST", "/api/internal/maintenance")).status).toBe(401);
    expect((await call(maintenance, "POST", "/api/internal/maintenance", { headers: { authorization: "Bearer wrong-wrong-wrong-wrong!!" } })).status).toBe(401);
    const r = await call(maintenance, "POST", "/api/internal/maintenance", { headers: { authorization: "Bearer a-very-long-test-secret-123" } });
    expect(r.status).toBe(200);
    expect(r.json.data.retention.storage_paths).toBeUndefined();
    expect(r.json.data.health.ai_runs_24h).toBeTypeOf("number");
  });
  it("health answers ok when the database is reachable", async () => {
    const r = await health();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});
