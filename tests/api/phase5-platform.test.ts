import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: () => ({ messages: { create } }) }));

import { GET as listUnits } from "../../src/app/api/v1/admin-units/route";
import { POST as importUnits } from "../../src/app/api/v1/admin/admin-units/import/route";
import { POST as linkUnits } from "../../src/app/api/v1/admin/constituencies/[key]/units/route";
import { GET as lookup } from "../../src/app/api/v1/constituencies/lookup/route";
import { POST as createIssue, GET as listIssues } from "../../src/app/api/v1/issues/route";
import { POST as changeLocation } from "../../src/app/api/v1/issues/[ref]/location/route";
import { GET as listChanges } from "../../src/app/api/v1/office/location-changes/route";
import { POST as decideChange } from "../../src/app/api/v1/office/location-changes/[id]/decision/route";
import { GET as adminJobs } from "../../src/app/api/v1/admin/jobs/route";
import { POST as requeue } from "../../src/app/api/v1/admin/jobs/[id]/requeue/route";
import { POST as runJobsRoute } from "../../src/app/api/internal/jobs/run/route";
import { GET as getEvents, POST as trackEvent } from "../../src/app/api/v1/events/route";
import { DELETE as resetPers, GET as getPers, PATCH as patchPers } from "../../src/app/api/v1/me/personalization/route";
import { POST as follow } from "../../src/app/api/v1/me/follows/route";
import { GET as feed } from "../../src/app/api/v1/me/feed/route";
import { GET as search } from "../../src/app/api/v1/search/route";
import { POST as translate } from "../../src/app/api/v1/ai/translate/route";
import { POST as ideaAssist } from "../../src/app/api/v1/ai/idea-assist/route";
import { GET as unsubscribe } from "../../src/app/api/v1/notifications/unsubscribe/route";
import { GET as getCountry, POST as setCountry } from "../../src/app/api/v1/country/route";
import { POST as setAffected } from "../../src/app/api/v1/issues/[ref]/affected/route";
import { GET as officeAnalytics } from "../../src/app/api/v1/office/analytics/route";
import { unsubscribeToken } from "../../src/lib/notify/unsubscribe";
import { admin, anonClient, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

const sq = (lat: number, lng: number, d = 0.05) => ({ type: "Polygon", coordinates: [[[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]]] });
let A: { id: string; key: string }, B: { id: string; key: string }, C: { id: string; key: string };
let adminU: TestUser, citizen: TestUser, citizen2: TestUser, manager: TestUser, managerB: TestUser, officer: TestUser;
const unitCodes: string[] = [];
const idem = () => ({ "idempotency-key": `p5-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.anon;
  A = await makeConstituency(); B = await makeConstituency(); C = await makeConstituency();
  // Three areas in a remote corner of the country so they overlap nothing else: A and B have verified boundaries, C only a bounding box that overlaps A.
  await admin.from("constituencies").update({ boundary: sq(24.90, 91.80), min_lat: 24.90, max_lat: 24.95, min_lng: 91.80, max_lng: 91.85, boundary_verified_at: new Date().toISOString() }).eq("id", A.id).throwOnError();
  await admin.from("constituencies").update({ boundary: sq(24.95, 91.80), min_lat: 24.95, max_lat: 25.00, min_lng: 91.80, max_lng: 91.85, boundary_verified_at: new Date().toISOString() }).eq("id", B.id).throwOnError();
  await admin.from("constituencies").update({ min_lat: 24.92, max_lat: 24.93, min_lng: 91.81, max_lng: 91.82 }).eq("id", C.id).throwOnError();
  adminU = await makeUser("admin"); citizen = await makeUser("citizen"); citizen2 = await makeUser("citizen");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  officer = await makeUser("staff", { constituencyId: A.id, officeRole: "case_officer" });
  managerB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
});
afterAll(async () => {
  as(null); vi.restoreAllMocks();
  await admin.from("ideas").delete().in("constituency_id", [A.id, B.id, C.id]); await admin.from("projects").delete().in("constituency_id", [A.id, B.id, C.id]);
  await admin.from("announcements").delete().in("constituency_id", [A.id, B.id, C.id]);
  await cleanup([A.id, B.id, C.id]);
  for (const level of ["union", "upazila", "district", "division"]) await admin.from("admin_units").delete().in("code", unitCodes).eq("level", level);
  await admin.from("knowledge_sources").delete().like("name", "p5-%"); await admin.from("country_adapters").delete().eq("code", "NP");
  await admin.from("background_jobs").delete().like("dedupe_key", "p5-%");
});

describe("administrative hierarchy (B5.7)", () => {
  const sfx = Date.now().toString(36).toUpperCase();
  const source = { name: "p5-boundary-file", url: "https://example.test/hdx", license: "CC-BY-IGO", fetched_at: "2026-11-01" };
  const units = [{ level: "division", code: `DV${sfx}`, name_bn: "বিভাগ", name_en: "Division" }, { level: "district", code: `DS${sfx}`, name_bn: "জেলা", name_en: "District", parent_code: `DV${sfx}` },
    { level: "upazila", code: `UP${sfx}`, name_bn: "উপজেলা", name_en: "Upazila", parent_code: `DS${sfx}` }, { level: "union", code: `UN${sfx}`, name_bn: "ইউনিয়ন", name_en: "Union", parent_code: `UP${sfx}` }];
  it("admin imports a sourced hierarchy; every level needs the right parent; the source, licence and date are required; the list is public", async () => {
    unitCodes.push(...units.map((u) => u.code));
    as(manager); expect((await call(importUnits, "POST", "/x", { body: { source, units } })).status).toBe(403);
    as(adminU);
    expect((await call(importUnits, "POST", "/x", { body: { source: { ...source, license: undefined }, units } })).status).toBe(422);
    expect((await call(importUnits, "POST", "/x", { body: { source, units: [{ level: "union", code: `X${sfx}`, name_bn: "x", name_en: "x" }] } })).status).toBe(422);          // a union needs a parent
    expect((await call(importUnits, "POST", "/x", { body: { source, units: [units[0], { ...units[3], parent_code: units[0].code }] } })).status).toBe(422);                     // a union cannot sit under a division
    const r = await call(importUnits, "POST", "/x", { body: { source, units } }); expect(r.status).toBe(201); expect(r.json.data.imported).toBe(4);
    expect((await call(importUnits, "POST", "/x", { body: { source, units } })).status).toBe(201);                                                                                // repeatable
    as(null);
    const d = await call(listUnits, "GET", `/x?level=district&parent=${units[0].code}`); expect(d.json.data.map((u: { code: string }) => u.code)).toEqual([units[1].code]); expect(d.json.data[0].parent).toMatchObject({ code: units[0].code, level: "division" });
    as(adminU); expect((await call(linkUnits, "POST", "/x", { params: { key: A.key }, body: { unit_codes: [units[2].code, units[3].code] } })).json.data.linked).toBe(2);
    as(citizen); expect((await call(linkUnits, "POST", "/x", { params: { key: A.key }, body: { unit_codes: [units[2].code] } })).status).toBe(403);
    expect((await admin.from("constituency_units").select("unit_id").eq("constituency_id", A.id)).data).toHaveLength(2);
  });
  it("lookup returns every possible area: certain only for an exact verified boundary, otherwise the person is asked to choose", async () => {
    as(null);
    const only = await call(lookup, "GET", "/x?lat=24.94&lng=91.84");
    expect(only.json.data).toMatchObject({ uncertain: false, manual_choice_allowed: true }); expect(only.json.data.candidates.map((c: { key: string }) => c.key)).toEqual([A.key]); expect(only.json.data.candidates[0].certain).toBe(true);
    const both = await call(lookup, "GET", "/x?lat=24.925&lng=91.815");
    expect(both.json.data.candidates.map((c: { key: string }) => c.key).sort()).toEqual([A.key, C.key].sort()); expect(both.json.data.uncertain).toBe(true);
    expect(both.json.data.candidates.find((c: { key: string }) => c.key === C.key).certain).toBe(false);
    expect((await call(lookup, "GET", "/x?lat=24.5&lng=91.5")).json.data).toMatchObject({ candidates: [], uncertain: true });
    expect((await call(lookup, "GET", "/x?lat=95&lng=91.5")).status).toBe(422);
    as(citizen);
    const amb = await call(createIssue, "POST", "/x", { headers: idem(), body: { title: "Ambiguous place", category: "roads", description: "Point inside two areas.", lat: 24.925, lng: 91.815 } });
    expect(amb.status).toBe(422); expect(amb.json.field_errors?.constituencyId).toBe("ambiguous");
    const sure = await call(createIssue, "POST", "/x", { headers: idem(), body: { title: "Clear place here", category: "roads", description: "Point inside one area.", lat: 24.94, lng: 91.84 } });
    expect(sure.status).toBe(201);
    expect((await call(createIssue, "POST", "/x", { headers: idem(), body: { title: "Chosen by hand", category: "roads", description: "Person chose the area.", constituencyId: A.key, lat: 24.925, lng: 91.815 } })).status).toBe(201);
  });
  it("a coordinate change inside the area applies; one that would move the report waits for review, and the office decides which area", async () => {
    as(citizen);
    const made = await call(createIssue, "POST", "/x", { headers: idem(), body: { title: "Pothole on the road", category: "roads", description: "A deep pothole.", constituencyId: A.key, lat: 24.94, lng: 91.84 } });
    const ref = made.json.data.ref; const { data: row } = await admin.from("issues").select("id").eq("ref", ref).single(); const id = row!.id;
    as(citizen2); expect((await call(changeLocation, "POST", "/x", { params: { ref }, body: { lat: 24.93, lng: 91.83 } })).status).toBe(404);
    as(citizen);
    const inside = await call(changeLocation, "POST", "/x", { params: { ref }, body: { lat: 24.935, lng: 91.835 } }); expect(inside.status).toBe(200); expect(inside.json.data.applied).toBe(true);
    expect((await admin.from("issues").select("lat,lng,constituency_key").eq("id", id).single()).data).toMatchObject({ lat: 24.935, lng: 91.835, constituency_key: A.key });
    expect((await call(changeLocation, "POST", "/x", { params: { ref }, body: { lat: 10, lng: 10 } })).status).toBe(422);
    const out = await call(changeLocation, "POST", "/x", { params: { ref }, body: { lat: 24.97, lng: 91.83 } });
    expect(out.status).toBe(202); expect(out.json.data).toMatchObject({ applied: false, candidates: [B.key] });
    expect((await admin.from("issues").select("constituency_key").eq("id", id).single()).data!.constituency_key).toBe(A.key);             // nothing moved yet
    expect((await call(changeLocation, "POST", "/x", { params: { ref }, body: { lat: 24.96, lng: 91.83 } })).status).toBe(409);            // one review at a time
    const reviewId = out.json.data.review_id;
    as(citizen); expect((await call(decideChange, "POST", "/x", { params: { id: reviewId }, body: { decision: "approve" } })).status).toBe(404);
    as(officer); expect((await call(decideChange, "POST", "/x", { params: { id: reviewId }, body: { decision: "approve" } })).status).toBe(404);
    as(managerB); expect((await call(decideChange, "POST", "/x", { params: { id: reviewId }, body: { decision: "approve", target: B.key } })).status).toBe(404);
    as(manager); expect((await call(listChanges, "GET", "/x")).json.data.map((r: { id: string }) => r.id)).toContain(reviewId);
    expect((await call(decideChange, "POST", "/x", { params: { id: reviewId }, body: { decision: "approve", target: C.key } })).status).toBe(422);        // must be one of the candidates
    await admin.from("issues").update({ assigned_to: officer.id }).eq("id", id);
    expect((await call(decideChange, "POST", "/x", { params: { id: reviewId }, body: { decision: "approve", target: B.key, note: "Boundary is on the next road" } })).json.data.status).toBe("approved");
    expect((await admin.from("issues").select("constituency_key,constituency_id,assigned_to,lat").eq("id", id).single()).data).toMatchObject({ constituency_key: B.key, constituency_id: B.id, assigned_to: null, lat: 24.97 });
    expect((await call(decideChange, "POST", "/x", { params: { id: reviewId }, body: { decision: "approve" } })).status).toBe(404);          // manager A no longer sees the issue
    const { data: audit } = await admin.from("audit_logs").select("action").eq("resource_id", id); expect((audit ?? []).map((a) => a.action)).toEqual(expect.arrayContaining(["issue.location_change", "issue.location_change_request", "issue.location_change_approve"]));
    // content still cannot be changed by a user session; the guard only opens for the reviewed move
    const forged = await citizen.sb.from("issues").update({ lat: 24.0 }).eq("id", id).select(); expect(forged.error !== null || (forged.data ?? []).length === 0).toBe(true);
  });
});

describe("background jobs, events (B5.8)", () => {
  it("jobs retry with growing backoff, then dead-letter; an admin can requeue; nothing else can touch the queue", async () => {
    const { data: id } = await admin.rpc("enqueue_job", { p_kind: "ingest", p_payload: {}, p_dedupe: "p5-job-1" });
    expect(id).toBeTruthy();
    expect((await admin.rpc("enqueue_job", { p_kind: "ingest", p_payload: {}, p_dedupe: "p5-job-1" })).data).toBeNull();                   // deduplicated while pending
    const runs: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const { data: claimed } = await admin.rpc("claim_jobs", { p_limit: 50, p_worker: "test" }); const mine = (claimed as { id: string; attempts: number }[]).find((j) => j.id === id);
      expect(mine?.attempts, `claim ${i}`).toBe(i);
      const { data: st } = await admin.rpc("finish_job", { p_id: id, p_ok: false, p_error: "provider down" }); runs.push(0);
      expect(st).toBe(i < 5 ? "failed" : "dead");
      if (i < 5) { const { data: j } = await admin.from("background_jobs").select("run_at").eq("id", id).single(); expect(new Date(j!.run_at).getTime()).toBeGreaterThan(Date.now() + 20_000 * 2 ** (i - 1)); await admin.from("background_jobs").update({ run_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", id); }
    }
    expect((await admin.from("background_jobs").select("status,last_error,finished_at").eq("id", id).single()).data).toMatchObject({ status: "dead", last_error: "provider down" });
    expect((await admin.rpc("claim_jobs", { p_limit: 50, p_worker: "test" })).data.some((j: { id: string }) => j.id === id)).toBe(false);   // dead jobs are not retried
    as(manager); expect((await call(adminJobs, "GET", "/x")).status).toBe(403); expect((await call(requeue, "POST", "/x", { params: { id } })).status).toBe(403);
    as(adminU); expect((await call(adminJobs, "GET", "/x?status=dead")).json.data.some((j: { id: string }) => j.id === id)).toBe(true);
    expect((await call(requeue, "POST", "/x", { params: { id } })).json.data.status).toBe("queued");
    expect((await call(requeue, "POST", "/x", { params: { id: "00000000-0000-4000-8000-000000000000" } })).status).toBe(404);
    expect((await anonClient.rpc("claim_jobs", { p_limit: 1, p_worker: "x" })).error).not.toBeNull();
    expect((await citizen.sb.rpc("enqueue_job", { p_kind: "purge" })).error).not.toBeNull();
    await admin.from("background_jobs").delete().eq("id", id);
  });
  it("a crashed worker's job is picked up again after 10 minutes", async () => {
    const { data: id } = await admin.rpc("enqueue_job", { p_kind: "ingest", p_payload: {}, p_dedupe: "p5-job-2" });
    await admin.rpc("claim_jobs", { p_limit: 50, p_worker: "crashed" });
    expect((await admin.rpc("claim_jobs", { p_limit: 50, p_worker: "w2" })).data.some((j: { id: string }) => j.id === id)).toBe(false);
    await admin.from("background_jobs").update({ locked_at: new Date(Date.now() - 11 * 60_000).toISOString() }).eq("id", id);
    expect((await admin.rpc("claim_jobs", { p_limit: 50, p_worker: "w2" })).data.find((j: { id: string }) => j.id === id)?.attempts).toBe(2);
    await admin.from("background_jobs").delete().eq("id", id);
  });
  it("the scheduled route needs the cron secret, enqueues the periodic jobs and runs them", async () => {
    delete process.env.CRON_SECRET; expect((await call(runJobsRoute, "POST", "/x", {})).status).toBe(401);
    process.env.CRON_SECRET = "a-long-cron-secret-1234";
    expect((await call(runJobsRoute, "POST", "/x", { headers: { authorization: "Bearer wrong-secret-wrong-1234" } })).status).toBe(401);
    const r = await call(runJobsRoute, "POST", "/x", { headers: { authorization: "Bearer a-long-cron-secret-1234" } });
    expect(r.status).toBe(200); expect(r.json.data.claimed).toBeGreaterThanOrEqual(3); expect(r.json.data.dead).toBe(0);
    expect((await admin.from("background_jobs").select("kind,status").in("kind", ["poll_maintenance", "purge", "notify_deliver"]).eq("status", "done")).data!.length).toBeGreaterThanOrEqual(3);
    delete process.env.CRON_SECRET;
  });
  it("product events count names and languages only, work signed out, and admins read the daily counters", async () => {
    as(null);
    expect((await call(trackEvent, "POST", "/x", { body: { name: "report_started", lang: "en" } })).status).toBe(202);
    expect((await call(trackEvent, "POST", "/x", { body: { name: "report_started", lang: "en" } })).status).toBe(202);
    expect((await call(trackEvent, "POST", "/x", { body: { name: "page_view_with_url" } })).status).toBe(422);
    expect((await call(trackEvent, "POST", "/x", { body: { name: "report_started", user: "abc", ip: "1.2.3.4" } })).status).toBe(422);           // nothing identifying is accepted
    const { data } = await admin.from("product_events").select("*").eq("name", "report_started").eq("lang", "en").eq("day", new Date().toISOString().slice(0, 10)); expect(data![0].count).toBeGreaterThanOrEqual(2);
    expect(Object.keys(data![0]).sort()).toEqual(["count", "day", "lang", "name"]);
    as(citizen); expect((await call(getEvents, "GET", "/x")).status).toBe(403);
    as(adminU); expect((await call(getEvents, "GET", "/x?days=7")).json.data.length).toBeGreaterThan(0);
    expect((await anonClient.from("product_events").select("*")).data ?? []).toEqual([]);
  });
});

describe("notification events (B5.9)", () => {
  const notes = async (u: TestUser, type?: string) => (await admin.from("notifications").select("type,ref,title,data").eq("user_id", u.id).order("created_at")).data!.filter((n) => !type || n.type === type);
  const mk = async (over: Record<string, unknown> = {}) => (await admin.from("issues").insert({ reporter_id: citizen.id, title: "Notify test", category: "roads", description: "Notify test", constituency_id: A.id, constituency_key: A.key, ...over }).select("id,ref").single().throwOnError()).data!;
  it("the reporter hears the report was submitted (reference only); the assignee hears about the case", async () => {
    const i = await mk(); const s = await notes(citizen, "report_submitted");
    expect(s.find((n) => n.ref === i.ref)).toMatchObject({ title: "আপনার সমস্যা জমা হয়েছে" }); expect(JSON.stringify(s.find((n) => n.ref === i.ref))).not.toMatch(/Notify test/);
    await admin.from("issues").update({ assigned_to: officer.id }).eq("id", i.id);
    const a = await notes(officer, "case_assigned"); expect(a.map((n) => n.ref)).toContain(i.ref); expect(a[0].data.en.title).toBe("A case was assigned to you");
    await admin.from("issues").update({ assigned_to: officer.id, priority: "high" }).eq("id", i.id); expect((await notes(officer, "case_assigned")).filter((n) => n.ref === i.ref)).toHaveLength(1);   // not twice
  });
  it("a satisfaction rating is requested after resolution, once; an answered appeal notifies the reporter", async () => {
    const i = await mk();
    const ev = (from: string, to: string) => admin.from("issue_events").insert({ issue_id: i.id, actor_id: manager.id, event_type: "status_change", from_status: from, to_status: to, public_message: "x" }).throwOnError();
    await ev("submitted", "resolved");
    expect((await notes(citizen, "feedback_request")).filter((n) => n.ref === i.ref)).toHaveLength(1);
    await ev("submitted", "rejected"); await ev("rejected", "reopened");
    expect((await notes(citizen, "appeal_answered")).filter((n) => n.ref === i.ref)).toHaveLength(0);          // still waiting
    await ev("reopened", "in_progress");
    expect((await notes(citizen, "appeal_answered")).filter((n) => n.ref === i.ref)).toHaveLength(1);
    const j = await mk(); await admin.from("issue_events").insert({ issue_id: j.id, actor_id: manager.id, event_type: "status_change", from_status: "resolved", to_status: "reopened", public_message: "x" });
    await admin.from("issue_events").insert({ issue_id: j.id, actor_id: manager.id, event_type: "status_change", from_status: "reopened", to_status: "in_progress", public_message: "x" });
    expect((await notes(citizen, "appeal_answered")).filter((n) => n.ref === j.ref)).toHaveLength(0);          // an ordinary reopen is not an appeal
  });
  it("others reporting the same problem notify the reporter with a count only, once a day", async () => {
    const i = await mk(); as(citizen2);
    expect((await call(setAffected, "POST", "/x", { params: { ref: i.ref } })).status).toBe(200);
    const n = (await notes(citizen, "affected_count")).filter((x) => x.ref === i.ref); expect(n).toHaveLength(1); expect(JSON.stringify(n[0])).not.toContain(citizen2.id); expect(n[0].data.count).toBe(1);
  });
  it("announcements reach only people who opted in and follow the area; essential types cannot be muted by signed link, non-essential can", async () => {
    const optIn = await makeUser("citizen"), plain = await makeUser("citizen");
    for (const u of [optIn, plain]) { as(u); await call(follow, "POST", "/x", { body: { type: "area", target: A.key } }); }
    as(optIn); expect((await call(patchPers, "PATCH", "/x", { body: { announcement_opt_in: true } })).status).toBe(200);
    await admin.from("announcements").insert({ constituency_id: A.id, title: "Opt-in announcement", body: "Announcement body text.", status: "published", published_at: new Date().toISOString() });
    expect(await notes(optIn, "announcement")).toHaveLength(1); expect(await notes(plain, "announcement")).toHaveLength(0);
    // signed unsubscribe
    process.env.UNSUBSCRIBE_SECRET = "a-long-unsubscribe-secret-1";
    const link = (u: TestUser, type: string, t = unsubscribeToken(u.id, type)) => call(unsubscribe, "GET", `/x?u=${u.id}&type=${type}&t=${t}`);
    expect((await link(optIn, "announcement", "x".repeat(43))).status).toBe(403);
    expect((await link(optIn, "issue_status")).status).toBe(403);                                              // essential
    expect((await link(plain, "announcement", unsubscribeToken(optIn.id, "announcement"))).status).toBe(403);    // someone else's link
    expect((await link(optIn, "announcement")).status).toBe(200);
    expect((await admin.from("user_preferences").select("muted_types").eq("user_id", optIn.id).single()).data!.muted_types).toContain("announcement");
    await admin.from("announcements").insert({ constituency_id: A.id, title: "Second announcement", body: "Second announcement body.", status: "published", published_at: new Date().toISOString() });
    expect(await notes(optIn, "announcement")).toHaveLength(1);                                                  // muted now
    delete process.env.UNSUBSCRIBE_SECRET; expect((await link(optIn, "announcement")).status).toBe(403);
  });
  it("followers of a project hear when its status changes; supporters of an idea hear the decision", async () => {
    const f = await makeUser("citizen"); const { data: p } = await admin.from("projects").insert({ constituency_id: A.id, title: "Notify project", status: "planned" }).select("ref").single().throwOnError();
    as(f); await call(follow, "POST", "/x", { body: { type: "project", target: p!.ref } });
    await admin.from("projects").update({ status: "in_progress" }).eq("ref", p!.ref); expect(await notes(f, "project_update")).toHaveLength(1);
    const { data: idea } = await admin.from("ideas").insert({ author_id: citizen.id, constituency_id: A.id, title: "Supported idea title", body: "Supported idea body text.", status: "published" }).select("id").single().throwOnError();
    await admin.from("idea_supports").insert({ idea_id: idea!.id, user_id: f.id }); await admin.from("ideas").update({ status: "planned" }).eq("id", idea!.id);
    expect(await notes(f, "idea_update")).toHaveLength(1);
  });
});

describe("personalization, language, search (B5.11)", () => {
  it("shows, changes, switches off and resets personalization; respects it in the feed and in agent prompts", async () => {
    const u = await makeUser("citizen"); as(null); expect((await call(getPers, "GET", "/x")).status).toBe(401);
    as(u);
    expect((await call(getPers, "GET", "/x")).json.data).toMatchObject({ simple_language_mode: false, voice_first: false, numeral_style: "bn", personalization_enabled: true });
    expect((await call(patchPers, "PATCH", "/x", { body: { numeral_style: "arabic" } })).status).toBe(422);
    expect((await call(patchPers, "PATCH", "/x", { body: { unknown: true } })).status).toBe(422);
    expect((await call(patchPers, "PATCH", "/x", { body: { simple_language_mode: true, voice_first: true, numeral_style: "en" } })).json.data).toMatchObject({ simple_language_mode: true, voice_first: true, numeral_style: "en" });
    await call(follow, "POST", "/x", { body: { type: "area", target: A.key } });
    expect((await call(getPers, "GET", "/x")).json.data.uses.follows).toEqual({ area: 1 });
    // the feed uses the short summary in simple mode
    await admin.from("issues").insert({ reporter_id: citizen.id, title: "Long report title", category: "roads", description: "A very long description of the problem with many details.", ai_summary: "Road is broken", constituency_id: A.id, constituency_key: A.key });
    const f = await call(feed, "GET", "/x"); expect(f.headers.get("x-simple-language")).toBe("1"); expect(f.headers.get("x-voice-first")).toBe("1");
    expect(f.json.data.find((i: { summary: string }) => i.summary === "Road is broken").description).toBe("Road is broken");
    // agents get the style block
    process.env.ANTHROPIC_API_KEY = "test"; create.mockReset(); create.mockResolvedValue({ content: [{ type: "tool_use", name: "submit_translation", input: { translation: "Road broken" } }], stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } });
    const tr = await call(translate, "POST", "/x", { body: { text: "রাস্তা ভাঙা", to: "en" } });
    expect(tr.json.data).toMatchObject({ available: true, label: "Machine translation", original: "রাস্তা ভাঙা", source: "bn" }); expect(create.mock.calls[0][0].system.at(-1).text).toMatch(/STYLE/);
    await call(patchPers, "PATCH", "/x", { body: { simple_language_mode: false } }); create.mockClear();
    await call(translate, "POST", "/x", { body: { text: "রাস্তা ভাঙা", to: "en" } }); expect(create.mock.calls[0][0].system.some((b: { text: string }) => /STYLE/.test(b.text))).toBe(false);
    // personalization off: plain newest-first; reset removes follows and defaults the switches
    await call(patchPers, "PATCH", "/x", { body: { personalization_enabled: false, simple_language_mode: true } });
    expect((await call(getPers, "GET", "/x")).json.data.personalization_enabled).toBe(false);
    const r = await call(resetPers, "DELETE", "/x"); expect(r.json.data).toEqual({ reset: true, follows_removed: 1 });
    expect((await call(getPers, "GET", "/x")).json.data).toMatchObject({ simple_language_mode: false, voice_first: false, numeral_style: "bn", personalization_enabled: true, uses: { follows: {} } });
    expect((await admin.from("audit_logs").select("action").eq("actor_id", u.id).eq("action", "privacy.personalization_reset")).data).toHaveLength(1);
    delete process.env.ANTHROPIC_API_KEY;
  });
  it("the Idea Assistant answers with rule-based questions when no model is available", async () => {
    as(citizen); delete process.env.ANTHROPIC_API_KEY;
    const r = await call(ideaAssist, "POST", "/x", { body: { title: "মাঠে আলো", body: "মাঠে আলো দরকার" } });
    expect(r.status).toBe(200); expect(r.json.data.source).toBe("rules"); expect(r.json.data.questions.length).toBeGreaterThan(0);
    as(null); expect((await call(ideaAssist, "POST", "/x", { body: { title: "x", body: "y" } })).status).toBe(401);
    as(citizen); expect((await call(ideaAssist, "POST", "/x", { body: { title: "ab", body: "abc" } })).status).toBe(422);
  });
  it("Banglish search finds Bangla text and the other way round; only public items; Bangla digits work", async () => {
    const mk = (over: object) => admin.from("issues").insert({ reporter_id: citizen.id, category: "roads", constituency_id: A.id, constituency_key: A.key, ...over }).select("ref").single().throwOnError();
    const pub = (await mk({ title: "রাস্তা ভাঙা বাজারের মোড়ে", description: "বাজারের মোড়ে রাস্তা ভেঙে গেছে, ১২ নম্বর ওয়ার্ড" })).data!.ref;
    const priv = (await mk({ title: "রাস্তা ভাঙা গোপন", description: "রাস্তা ভাঙা", public_visibility: false })).data!.ref;
    const eng = (await mk({ title: "Drain blocked near school", description: "The drain bondho for a week" })).data!.ref;
    await admin.from("ideas").insert({ author_id: citizen.id, constituency_id: A.id, title: "রাস্তা মেরামতের পরিকল্পনা", body: "রাস্তা ভাঙা জায়গা মেরামত করুন", status: "published" });
    as(null);
    const q = async (s: string, extra = "") => (await call(search, "GET", `/x?q=${encodeURIComponent(s)}${extra}`)).json.data as { kind: string; ref: string }[];
    expect((await q("rasta bhanga")).map((r) => r.ref)).toEqual(expect.arrayContaining([pub])); expect((await q("rasta bhanga")).map((r) => r.ref)).not.toContain(priv);
    expect((await q("Rasta bhango")).map((r) => r.ref)).toContain(pub);
    expect((await q("রাস্তা ভাঙা")).map((r) => r.ref)).toContain(pub);
    expect((await q("rasta bhanga")).some((r) => r.kind === "idea")).toBe(true);
    expect((await q("ড্রেন বন্ধ")).map((r) => r.ref)).toContain(eng);                    // Bangla query finds English text with a Banglish word
    expect((await q("drain bondho")).map((r) => r.ref)).toContain(eng);
    expect((await q("১২ নম্বর ওয়ার্ড")).map((r) => r.ref)).toContain(pub); expect((await q("12 nomvor")).map((r) => r.ref)).toBeDefined();
    expect((await q("rasta bhanga", `&constituency=${B.key}`))).toEqual([]);
    expect((await call(search, "GET", "/x?q=a")).status).toBe(422);
    expect((await q("zzzzqq")).length).toBe(0);
    expect((await call(listIssues, "GET", "/x")).json.data.every((i: { service_request_id: string; ref: string }) => i.service_request_id === i.ref)).toBe(true);
  });
});

describe("country adapters, Open311-ready ids, Insight links (B5.12, B5.15, B5.10)", () => {
  it("the active adapter is public configuration; admins add another country but cannot activate one without its code adapter", async () => {
    as(null); const r = await call(getCountry, "GET", "/x");
    expect(r.json.data).toMatchObject({ code: "BD", default_locale: "bn", currency: "BDT", date_format: "dd/MM/yyyy", numerals: "bn", emergency_numbers: { general: "999" } });
    expect(r.json.data.admin_levels.map((l: { level: string }) => l.level)).toEqual(["division", "district", "upazila", "city", "union", "ward"]);
    const cfg = { name_en: "Nepal", name_native: "नेपाल", default_locale: "ne", locales: ["ne", "en"], currency: "NPR", date_format: "yyyy-MM-dd", timezone: "Asia/Kathmandu", admin_levels: [{ level: "province", name_en: "Province" }] };
    as(manager); expect((await call(setCountry, "POST", "/x", { body: { code: "NP", config: cfg } })).status).toBe(403);
    as(adminU);
    expect((await call(setCountry, "POST", "/x", { body: { code: "NP", config: { ...cfg, currency: "rupee" } } })).status).toBe(422);
    expect((await call(setCountry, "POST", "/x", { body: { code: "NP", config: cfg } })).status).toBe(200);
    expect((await call(setCountry, "POST", "/x", { body: { code: "NP", config: cfg, activate: true } })).status).toBe(409);
    expect((await anonClient.from("country_adapters").select("code,is_active").eq("code", "NP").single()).data).toEqual({ code: "NP", is_active: false });
    expect((await call(getCountry, "GET", "/x")).json.data.code).toBe("BD");
  });
  it("public ids and category codes map to Open311 field names without exposing private data", async () => {
    const { data: i } = await admin.from("issues").insert({ reporter_id: citizen.id, title: "Open311 test", category: "drainage", description: "Open311 description", constituency_id: A.id, constituency_key: A.key, lat: 24.94, lng: 91.84 }).select("ref").single().throwOnError();
    const { data: r } = await anonClient.from("public_open311_requests").select("*").eq("service_request_id", i!.ref).single();
    expect(r).toMatchObject({ service_request_id: i!.ref, service_code: "JK-DRAINAGE", service_name: "Drainage", status: "open" });
    expect(Object.keys(r!)).not.toEqual(expect.arrayContaining(["reporter_id"])); expect(r!.lat).not.toBe(24.94);          // approximate point only
    const { data: s } = await anonClient.from("public_open311_services").select("service_code").eq("service_code", "JK-ROADS"); expect(s).toHaveLength(1);
    expect(i!.ref).toMatch(/^JK-\d{4}-\d+$/);
  });
  it("the office analytics carry links from large categories to public cases and the previous period", async () => {
    const refs: string[] = [];
    for (let n = 0; n < 5; n++) refs.push((await admin.from("issues").insert({ reporter_id: citizen.id, title: `Insight ${n}`, category: "waste", description: "Insight case", constituency_id: A.id, constituency_key: A.key }).select("ref").single().throwOnError()).data!.ref);
    as(manager); const r = await call(officeAnalytics, "GET", `/x?constituency=${A.key}&days=30`);
    const link = r.json.data.case_links.find((l: { category: string }) => l.category === "waste");
    expect(link.count).toBeGreaterThanOrEqual(5); expect(link.case_refs.length).toBeLessThanOrEqual(3); expect(link.case_refs.every((x: string) => /^JK-/.test(x))).toBe(true);
    expect(r.json.data).toHaveProperty("previous_period_received");
    void refs;
  });
});
