import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as pubHelplines } from "../../src/app/api/v1/helplines/route";
import { GET as pubSources } from "../../src/app/api/v1/data-sources/route";
import { GET as pubRetention } from "../../src/app/api/v1/retention-policies/route";
import { GET as pubNotices } from "../../src/app/api/v1/service-notices/route";
import { GET as pubKpi } from "../../src/app/api/v1/kpi-baselines/route";
import { GET as listSources, POST as regSource } from "../../src/app/api/v1/admin/ingestion/sources/route";
import { POST as licence } from "../../src/app/api/v1/admin/ingestion/sources/[key]/licence/route";
import { POST as runNow } from "../../src/app/api/v1/admin/ingestion/sources/[key]/run/route";
import { GET as listRuns } from "../../src/app/api/v1/admin/ingestion/runs/route";
import { GET as listHl, POST as proposeHl } from "../../src/app/api/v1/admin/helplines/route";
import { POST as verifyHl } from "../../src/app/api/v1/admin/helplines/[key]/verify/route";
import { GET as listHolds, POST as placeHold } from "../../src/app/api/v1/admin/legal-holds/route";
import { POST as releaseHold } from "../../src/app/api/v1/admin/legal-holds/[id]/release/route";
import { POST as postNotice } from "../../src/app/api/v1/admin/service-notices/route";
import { POST as resolveNotice } from "../../src/app/api/v1/admin/service-notices/[id]/resolve/route";
import { GET as listPen, POST as newPen } from "../../src/app/api/v1/admin/pentest/route";
import { POST as updPen } from "../../src/app/api/v1/admin/pentest/[ref]/route";
import { GET as getPilot } from "../../src/app/api/v1/admin/pilot/route";
import { POST as pilotSite } from "../../src/app/api/v1/admin/pilot/sites/route";
import { PUT as pilotBudget } from "../../src/app/api/v1/admin/pilot/budget/route";
import { POST as pilotCost } from "../../src/app/api/v1/admin/pilot/costs/route";
import { GET as myEval, POST as offerEval } from "../../src/app/api/v1/me/eval-examples/route";
import { DELETE as withdrawEval } from "../../src/app/api/v1/me/eval-examples/[id]/route";
import { GET as pendingEval } from "../../src/app/api/v1/admin/ai/eval-examples/route";
import { POST as reviewEval } from "../../src/app/api/v1/admin/ai/eval-examples/[id]/review/route";
import { GET as evalSet } from "../../src/app/api/v1/admin/ai/eval-set/route";
import { GET as routingAcc } from "../../src/app/api/v1/admin/ai/routing-accuracy/route";
import { GET as listThr, POST as setThr } from "../../src/app/api/v1/admin/ai/thresholds/route";
import { GET as sttSummary, POST as sttRecord } from "../../src/app/api/v1/admin/ai/speech-tests/route";
import { POST as snapshot } from "../../src/app/api/v1/office/kpi-baselines/snapshot/route";
import { POST as manualKpi } from "../../src/app/api/v1/admin/kpi-baselines/manual/route";
import { POST as publishKpi } from "../../src/app/api/v1/admin/kpi-baselines/publish/route";
import { POST as setConsent } from "../../src/app/api/v1/me/consents/route";
import { runSource, type DueSource } from "../../src/lib/ingest/run";
import { resetFetcherState, type FetchLike } from "../../src/lib/ingest/fetcher";
import { admin, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, B: { id: string; key: string };
let citizen: TestUser, adminU: TestUser, adminV: TestUser, manager: TestUser, managerB: TestUser;
const stamp = Date.now().toString(36);
const srcKey = `t-src-${stamp}`, hlKey = `t-hl-${stamp}`;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.anon;
  A = await makeConstituency(); B = await makeConstituency();
  citizen = await makeUser("citizen"); adminU = await makeUser("admin"); adminV = await makeUser("admin");
  manager = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  managerB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
});
afterAll(async () => {
  as(null);
  await admin.from("ingestion_sources").delete().like("key", `t-%${stamp}`);
  await admin.from("knowledge_sources").delete().like("name", `API source ${stamp}%`);
  await admin.from("helplines").delete().like("key", `t-%${stamp}`);
  await admin.from("service_notices").delete().like("title_en", `T6 ${stamp}%`);
  await admin.from("pentest_findings").delete().like("reported_by", `T6 ${stamp}%`);
  await admin.from("legal_holds").delete().like("authority_ref", `T6-${stamp}%`);
  await admin.from("pilot_sites").delete().in("constituency_id", [A.id, B.id]);
  await admin.from("pilot_cost_entries").delete().like("source_ref", `T6-${stamp}%`);
  await admin.from("kpi_baselines").delete().in("constituency_id", [A.id, B.id]);
  await admin.from("eval_candidates").delete().not("id", "is", null);
  await admin.from("ai_thresholds").delete().eq("key", "duplicate_min_score");
  await admin.from("stt_test_runs").delete().eq("provider", `t6-${stamp}`);
  await admin.from("pilot_budget_lines").delete().in("line", ["hosting_app", "support"]);
  await cleanup([A.id, B.id]);
});

describe("ingestion routes", () => {
  it("only administrators register and review sources; an unchecked source cannot be enabled or run; unknown keys are rejected", async () => {
    const body = { key: srcKey, name: `API source ${stamp}`, kind: "osm", url: "https://example.org/data.json", license: "ODbL 1.0", attribution: "© OpenStreetMap contributors", min_interval_ms: 1000 };
    as(citizen); expect((await call(regSource, "POST", "/api/v1/admin/ingestion/sources", { body })).status).toBe(403);
    as(null); expect((await call(regSource, "POST", "/api/v1/admin/ingestion/sources", { body })).status).toBe(401);
    as(adminU);
    expect((await call(regSource, "POST", "/api/v1/admin/ingestion/sources", { body: { ...body, personal_data: true } })).status).toBe(422);
    expect((await call(regSource, "POST", "/api/v1/admin/ingestion/sources", { body: { ...body, url: "http://example.org/x" } })).status).toBe(422);
    expect((await call(regSource, "POST", "/api/v1/admin/ingestion/sources", { body })).status).toBe(201);
    const run = await call(runNow, "POST", `/api/v1/admin/ingestion/sources/${srcKey}/run`, { params: { key: srcKey } });
    expect(run.status).toBe(409); expect(run.json.field_errors?._).toBe("licence_not_checked");
    expect((await call(licence, "POST", `/x`, { params: { key: srcKey }, body: { license_ok: true, enable: true } })).status).toBe(200);
    const list = await call(listSources, "GET", "/api/v1/admin/ingestion/sources");
    expect(list.json.data.find((s: { key: string }) => s.key === srcKey)).toMatchObject({ enabled: true, license_ok: true });
    as(citizen); expect((await call(listSources, "GET", "/api/v1/admin/ingestion/sources")).status).toBe(403);
    as(null);
    const pub = await call(pubSources, "GET", "/api/v1/data-sources");
    expect(pub.json.data.find((s: { key: string }) => s.key === srcKey)).toMatchObject({ license: "ODbL 1.0", attribution: "© OpenStreetMap contributors" });
    expect(JSON.stringify(pub.json.data)).not.toMatch(/license_ok|min_interval|enabled/);
  });

  it("runSource (service role, injected fetch): obeys robots.txt, records lineage, stages records, drops personal data; a blocked path writes no lineage", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const svc = createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: s } = await admin.from("ingestion_sources").select("id,key,url,kind,license,min_interval_ms,max_bytes,is_demo").eq("key", srcKey).single();
    const geo = JSON.stringify([{ id: "p1", name: "Public office" }, { id: "p2", contact: "who@example.com" }]);
    const hits: string[] = [];
    const mk = (robots: string): FetchLike => async (url) => {
      hits.push(url);
      const ok = (text: string, ct = "text/plain") => ({ status: 200, headers: { get: (n: string) => (n === "content-type" ? ct : null) }, text: async () => text });
      return url.endsWith("/robots.txt") ? ok(robots) : ok(geo, "application/json");
    };
    const deps = (robots: string) => ({ fetch: mk(robots), now: () => Date.now(), sleep: async () => undefined, userAgent: "TestBot/1.0" });

    resetFetcherState();
    const blocked = await runSource(svc, s as DueSource, deps("User-agent: *\nDisallow: /data"));
    expect(blocked.status).toBe("blocked_robots");
    expect(hits.filter((u) => !u.endsWith("/robots.txt"))).toHaveLength(0);
    const { data: ks0 } = await admin.from("knowledge_sources").select("id").eq("name", `API source ${stamp}`);
    expect(ks0).toHaveLength(0);

    resetFetcherState(); await admin.from("ingestion_sources").update({ last_run_at: null }).eq("id", s!.id);
    const ok = await runSource(svc, s as DueSource, deps("User-agent: *\nAllow: /"));
    expect(ok).toMatchObject({ status: "ok", staged: 1, rejected: 1 });
    const { data: ks } = await admin.from("knowledge_sources").select("checksum,license_or_terms,fetched_at,is_demo").eq("name", `API source ${stamp}`);
    expect(ks).toHaveLength(1);
    expect(ks![0].checksum).toMatch(/^[0-9a-f]{64}$/); expect(ks![0].license_or_terms).toBe("ODbL 1.0");
    resetFetcherState();
    expect((await runSource(svc, s as DueSource, deps("User-agent: *\nAllow: /"))).status).toBe("unchanged");

    as(adminU);
    const runs = await call(listRuns, "GET", `/api/v1/admin/ingestion/runs?source=${srcKey}`);
    expect(runs.json.data.map((r: { status: string }) => r.status).sort()).toEqual(["blocked_robots", "ok", "unchanged"]);
  });
});

describe("helplines routes", () => {
  it("proposed by one admin, verified by another, then public; the proposer cannot verify; non-admins are refused", async () => {
    const body = { key: hlKey, number: "999", name_bn: "জাতীয় জরুরি সেবা", name_en: "National emergency service", source_url: "https://example.org/999" };
    as(citizen); expect((await call(proposeHl, "POST", "/api/v1/admin/helplines", { body })).status).toBe(403);
    as(adminU);
    expect((await call(proposeHl, "POST", "/api/v1/admin/helplines", { body: { ...body, number: "12" } })).status).toBe(422);
    expect((await call(proposeHl, "POST", "/api/v1/admin/helplines", { body })).status).toBe(201);
    const self = await call(verifyHl, "POST", "/x", { params: { key: hlKey }, body: { decision: "verified", method: "Read the official page and called the number" } });
    expect(self.status).toBe(409); expect(self.json.field_errors?._).toBe("second_person");
    as(null); expect((await call(pubHelplines, "GET", "/api/v1/helplines")).json.data.some((h: { key: string }) => h.key === hlKey)).toBe(false);
    as(adminV);
    expect((await call(verifyHl, "POST", "/x", { params: { key: hlKey }, body: { decision: "verified", method: "short" } })).status).toBe(422);
    const ok = await call(verifyHl, "POST", "/x", { params: { key: hlKey }, body: { decision: "verified", method: "Read the official page and called the number", evidence_checksum: "c".repeat(64) } });
    expect(ok.status).toBe(200);
    as(null);
    const pub = await call(pubHelplines, "GET", "/api/v1/helplines");
    const row = pub.json.data.find((h: { key: string }) => h.key === hlKey);
    expect(row).toMatchObject({ number: "999", source_url: "https://example.org/999" });
    expect(Object.keys(row)).not.toContain("verified_by");
    expect(pub.headers.get("cache-control")).toContain("max-age");
    as(adminU); expect((await call(listHl, "GET", "/api/v1/admin/helplines")).json.data.find((h: { key: string }) => h.key === hlKey).verification_status).toBe("verified");
  });
});

describe("governance, notices and pentest routes", () => {
  it("legal hold place and release; notices public while active; retention register is public", async () => {
    as(citizen); expect((await call(placeHold, "POST", "/api/v1/admin/legal-holds", { body: { subject_type: "user", subject_id: citizen.id, reason: "Preserve for the inquiry", authority_ref: `T6-${stamp}` } })).status).toBe(403);
    as(adminU);
    expect((await call(placeHold, "POST", "/api/v1/admin/legal-holds", { body: { subject_type: "user", subject_id: citizen.id, reason: "short", authority_ref: `T6-${stamp}` } })).status).toBe(422);
    const h = await call(placeHold, "POST", "/api/v1/admin/legal-holds", { body: { subject_type: "user", subject_id: citizen.id, reason: "Preserve for the inquiry", authority_ref: `T6-${stamp}` } });
    expect(h.status).toBe(201);
    expect((await call(placeHold, "POST", "/api/v1/admin/legal-holds", { body: { subject_type: "user", subject_id: citizen.id, reason: "Preserve for the inquiry", authority_ref: `T6-${stamp}-2` } })).status).toBe(409);
    expect((await call(listHolds, "GET", "/api/v1/admin/legal-holds")).json.data.length).toBeGreaterThanOrEqual(1);
    expect((await call(releaseHold, "POST", "/x", { params: { id: h.json.data.id }, body: { reason: "Order lifted" } })).status).toBe(200);
    expect((await call(releaseHold, "POST", "/x", { params: { id: h.json.data.id }, body: { reason: "Order lifted" } })).status).toBe(404);

    const n = await call(postNotice, "POST", "/api/v1/admin/service-notices", { body: { severity: "degraded", title_bn: "ধীর গতি", title_en: `T6 ${stamp} slow` } });
    expect(n.status).toBe(201);
    as(null);
    expect((await call(pubNotices, "GET", "/api/v1/service-notices")).json.data.map((x: { title_en: string }) => x.title_en)).toContain(`T6 ${stamp} slow`);
    as(adminU); await call(resolveNotice, "POST", "/x", { params: { id: n.json.data.id } });
    as(null);
    expect((await call(pubNotices, "GET", "/api/v1/service-notices")).json.data.map((x: { title_en: string }) => x.title_en)).not.toContain(`T6 ${stamp} slow`);
    expect((await call(pubRetention, "GET", "/api/v1/retention-policies")).json.data.length).toBeGreaterThan(5);
  });

  it("pentest findings follow the fix and retest rules over the API", async () => {
    as(adminU);
    const f = await call(newPen, "POST", "/api/v1/admin/pentest", { body: { title: "Missing authorisation check", severity: "high", reported_by: `T6 ${stamp}` } });
    expect(f.status).toBe(201);
    const ref = f.json.data.ref;
    const up = (b: object) => call(updPen, "POST", "/x", { params: { ref }, body: b });
    expect((await up({ status: "retest_passed", retest_by: "Tester", retest_note: "Looks fine to me now" })).status).toBe(409);
    expect((await up({ status: "accepted_risk", acceptance_reason: "We will live with this one" })).status).toBe(409);
    expect((await up({ status: "fixed_pending_retest" })).status).toBe(422);
    expect((await up({ status: "fixed_pending_retest", fix_ref: "PR 77" })).status).toBe(200);
    expect((await up({ status: "retest_passed", retest_by: "Tester", retest_note: "Retested: access denied for the second account" })).status).toBe(200);
    const l = await call(listPen, "GET", "/api/v1/admin/pentest");
    expect(l.json.data.findings.find((x: { ref: string }) => x.ref === ref).status).toBe("retest_passed");
    expect(l.json.data.summary.by_status.retest_passed).toBeGreaterThanOrEqual(1);
    as(citizen); expect((await call(listPen, "GET", "/api/v1/admin/pentest")).status).toBe(403);
  });
});

describe("pilot routes", () => {
  it("site, budget and cost entries; the report compares them", async () => {
    const cat = (await admin.from("issue_categories").select("slug").limit(1).single()).data!.slug;
    as(adminU);
    expect((await call(pilotSite, "POST", "/api/v1/admin/pilot/sites", { body: { constituency: A.key, status: "live", categories: [cat] } })).status).toBe(422);
    expect((await call(pilotSite, "POST", "/api/v1/admin/pilot/sites", { body: { constituency: A.key, status: "live", categories: [cat], support_contact: "help@example.org", escalation_contact: "lead@example.org", office_verified_at: "2026-12-01" } })).status).toBe(200);
    expect((await call(pilotBudget, "PUT", "/api/v1/admin/pilot/budget", { body: { line: "support", monthly_budget_usd: 50, basis: "Two hours a week of staff time" } })).status).toBe(200);
    expect((await call(pilotCost, "POST", "/api/v1/admin/pilot/costs", { body: { month: new Date().toISOString().slice(0, 10), line: "support", amount_usd: 60, source_ref: `T6-${stamp}` } })).status).toBe(201);
    const r = (await call(getPilot, "GET", "/api/v1/admin/pilot")).json.data;
    expect(r.sites.find((s: { constituency: string }) => s.constituency === A.key).status).toBe("live");
    expect(r.cost_report.lines.find((l: { line: string }) => l.line === "support")).toMatchObject({ over_budget: true });
    as(manager); expect((await call(getPilot, "GET", "/api/v1/admin/pilot")).status).toBe(403);
  });
});

describe("AI on real use routes", () => {
  it("consent, offer, review, export; withdrawing consent removes the text", async () => {
    const issue = (await admin.from("issues").insert({ reporter_id: citizen.id, title: "Broken drain near the market", category: "drainage", description: "Water on the road since last week. Call 01712345678", constituency_id: A.id, is_demo: false }).select("ref").single().throwOnError()).data!;
    as(citizen);
    expect((await call(offerEval, "POST", "/api/v1/me/eval-examples", { body: { issue_ref: issue.ref } })).json.field_errors?._).toBe("consent_required");
    await call(setConsent, "POST", "/api/v1/me/consents", { body: { consent_type: "ai_eval_example", policy_version: "v1", granted: true } });
    const offered = await call(offerEval, "POST", "/api/v1/me/eval-examples", { body: { issue_ref: issue.ref, language: "en" } });
    expect(offered.status).toBe(201);
    expect((await call(offerEval, "POST", "/api/v1/me/eval-examples", { body: { issue_ref: issue.ref } })).status).toBe(409);
    expect((await call(myEval, "GET", "/api/v1/me/eval-examples")).json.data).toHaveLength(1);
    const { data: stored } = await admin.from("eval_candidates").select("text").eq("id", offered.json.data.id).single();
    expect(stored!.text).not.toContain("01712345678");
    as(adminU);
    expect((await call(pendingEval, "GET", "/api/v1/admin/ai/eval-examples")).json.data.length).toBeGreaterThanOrEqual(1);
    const cat = (await admin.from("issue_categories").select("slug").limit(1).single()).data!.slug;
    expect((await call(reviewEval, "POST", "/x", { params: { id: offered.json.data.id }, body: { decision: "approve", category: cat } })).status).toBe(422);
    expect((await call(reviewEval, "POST", "/x", { params: { id: offered.json.data.id }, body: { decision: "approve", category: cat, pii_checked: true } })).status).toBe(200);
    const set = await call(evalSet, "GET", "/api/v1/admin/ai/eval-set");
    expect(set.json.data.examples.length).toBeGreaterThanOrEqual(1);
    expect(set.headers.get("cache-control")).toBe("no-store");
    as(citizen);
    expect((await call(withdrawEval, "DELETE", "/x", { params: { id: offered.json.data.id } })).status).toBe(200);
    const { data: after } = await admin.from("eval_candidates").select("status,text").eq("id", offered.json.data.id).single();
    expect(after).toEqual({ status: "withdrawn", text: null });
    await admin.from("issues").delete().eq("ref", issue.ref);
  });

  it("thresholds need evidence; routing accuracy and speech summary are administrator only", async () => {
    as(adminU);
    const basis = { n: 45, metric: "precision >= 0.9", method: "labelled pairs", measured_on: "2026-12-01", precision: 0.93 };
    expect((await call(setThr, "POST", "/api/v1/admin/ai/thresholds", { body: { key: "duplicate_min_score", value: 0.83, basis: { ...basis, n: 5 } } })).status).toBe(422);
    expect((await call(setThr, "POST", "/api/v1/admin/ai/thresholds", { body: { key: "duplicate_min_score", value: 0.83, basis } })).status).toBe(200);
    expect((await call(listThr, "GET", "/api/v1/admin/ai/thresholds")).json.data[0]).toMatchObject({ key: "duplicate_min_score" });
    expect((await call(routingAcc, "GET", "/api/v1/admin/ai/routing-accuracy?days=30")).json.data.definition).toMatch(/first agency/);
    expect((await call(sttRecord, "POST", "/api/v1/admin/ai/speech-tests", { body: { provider: `t6-${stamp}`, district: "Sylhet", age_band: "45-59", environment: "street", samples: 30, word_error_rate: 0.28, participants_consented: false } })).status).toBe(422);
    expect((await call(sttRecord, "POST", "/api/v1/admin/ai/speech-tests", { body: { provider: `t6-${stamp}`, district: "Sylhet", age_band: "45-59", environment: "street", samples: 30, word_error_rate: 0.28, participants_consented: true } })).status).toBe(201);
    expect((await call(sttSummary, "GET", "/api/v1/admin/ai/speech-tests")).json.data.by_district.find((d: { district: string }) => d.district === "Sylhet").samples).toBe(30);
    as(manager);
    for (const [h, m, p] of [[routingAcc, "GET", "/api/v1/admin/ai/routing-accuracy"], [listThr, "GET", "/api/v1/admin/ai/thresholds"], [sttSummary, "GET", "/api/v1/admin/ai/speech-tests"]] as const)
      expect((await call(h, m, p)).status, p).toBe(403);
  });
});

describe("KPI baseline routes", () => {
  it("an office manager snapshots their own office only; the admin adds a manual metric and publishes; the public reads published values with method", async () => {
    as(manager);
    expect((await call(snapshot, "POST", "/api/v1/office/kpi-baselines/snapshot", { body: { constituency: A.key, days: 30 } })).status).toBe(201);
    as(managerB); expect((await call(snapshot, "POST", "/api/v1/office/kpi-baselines/snapshot", { body: { constituency: A.key, days: 30 } })).status).toBe(404);
    as(citizen); expect((await call(snapshot, "POST", "/api/v1/office/kpi-baselines/snapshot", { body: { constituency: A.key } })).status).toBe(404);
    as(manager); expect((await call(publishKpi, "POST", "/api/v1/admin/kpi-baselines/publish", { body: { constituency: A.key, period_end: new Date().toISOString().slice(0, 10) } })).status).toBe(403);
    as(adminU);
    const today = new Date().toISOString().slice(0, 10), start = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    expect((await call(manualKpi, "POST", "/api/v1/admin/kpi-baselines/manual", { body: { constituency: A.key, metric: "accessibility_task_completion_pct", value: 80, n: 10, method: "Moderated task test, 10 participants", definition: "Share who finished the report task unaided", period_start: start, period_end: today } })).status).toBe(201);
    expect((await call(publishKpi, "POST", "/api/v1/admin/kpi-baselines/publish", { body: { constituency: A.key, period_end: today } })).json.data.published).toBeGreaterThan(5);
    as(null);
    const pub = await call(pubKpi, "GET", `/api/v1/kpi-baselines?constituency=${A.key}`);
    expect(pub.json.data.find((k: { metric_key: string }) => k.metric_key === "accessibility_task_completion_pct")).toMatchObject({ value: 80, n: 10 });
    expect(pub.json.data.every((k: { method: string; definition: string }) => k.method && k.definition)).toBe(true);
  });
});
