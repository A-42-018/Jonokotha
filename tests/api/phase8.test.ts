import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { GET as budgetSources } from "../../src/app/api/v1/budget/sources/route";
import { GET as budgetEntries } from "../../src/app/api/v1/budget/entries/route";
import { GET as offBudget, POST as offCreateBudget } from "../../src/app/api/v1/office/budget/sources/route";
import { POST as addEntry } from "../../src/app/api/v1/office/budget/sources/[ref]/entries/route";
import { POST as withdrawSrc } from "../../src/app/api/v1/office/budget/sources/[ref]/withdraw/route";
import { POST as retractEntry } from "../../src/app/api/v1/office/budget/entries/[id]/retract/route";
import { GET as adminBudget } from "../../src/app/api/v1/admin/budget/sources/route";
import { POST as verifySrc } from "../../src/app/api/v1/admin/budget/sources/[ref]/verify/route";
import { GET as listIntegrations, POST as setIntegration } from "../../src/app/api/v1/admin/agency-integrations/route";
import { PUT as putKey } from "../../src/app/api/v1/admin/agency-integrations/[id]/key/route";
import { POST as receipt } from "../../src/app/api/v1/integrations/agency/receipts/route";
import { GET as volRules } from "../../src/app/api/v1/volunteers/rules/route";
import { POST as volApply } from "../../src/app/api/v1/volunteers/apply/route";
import { GET as volMe } from "../../src/app/api/v1/volunteers/me/route";
import { POST as volWithdraw } from "../../src/app/api/v1/volunteers/[id]/withdraw/route";
import { GET as pubKiosks } from "../../src/app/api/v1/kiosks/route";
import { GET as myAssisted, POST as postAssisted } from "../../src/app/api/v1/volunteer/reports/route";
import { GET as offVolunteers } from "../../src/app/api/v1/office/volunteers/route";
import { POST as volDecision } from "../../src/app/api/v1/office/volunteers/[id]/decision/route";
import { POST as mkKiosk } from "../../src/app/api/v1/office/kiosks/route";
import { POST as retKiosk } from "../../src/app/api/v1/office/kiosks/[id]/retire/route";
import { GET as odCatalogue } from "../../src/app/api/v1/open-data/route";
import { GET as odDataset } from "../../src/app/api/v1/open-data/[slug]/route";
import { GET as regOverview } from "../../src/app/api/v1/office/regions/overview/route";
import { GET as regMine } from "../../src/app/api/v1/office/regions/mine/route";
import { GET as regList, POST as regGrant } from "../../src/app/api/v1/admin/regional-admins/route";
import { POST as regRevoke } from "../../src/app/api/v1/admin/regional-admins/[id]/revoke/route";
import { GET as pbList } from "../../src/app/api/v1/participatory-budgets/route";
import { GET as pbGet } from "../../src/app/api/v1/participatory-budgets/[ref]/route";
import { PUT as pbBallot } from "../../src/app/api/v1/participatory-budgets/[ref]/ballot/route";
import { GET as offPbList, POST as offPbCreate } from "../../src/app/api/v1/office/participatory-budgets/route";
import { GET as offPbGet } from "../../src/app/api/v1/office/participatory-budgets/[ref]/route";
import { POST as offPbAction } from "../../src/app/api/v1/office/participatory-budgets/[ref]/[action]/route";
import { GET as rtiGuideGet } from "../../src/app/api/v1/rti/guide/route";
import { GET as rtiList, POST as rtiCreate } from "../../src/app/api/v1/rti/drafts/route";
import { DELETE as rtiDelete, GET as rtiGet, PATCH as rtiPatch } from "../../src/app/api/v1/rti/drafts/[id]/route";
import { GET as mpList } from "../../src/app/api/v1/mp-records/route";
import { GET as mpGet } from "../../src/app/api/v1/mp-records/[ref]/route";
import { GET as adminMp, POST as adminMpCreate } from "../../src/app/api/v1/admin/mp-records/route";
import { POST as mpSummary } from "../../src/app/api/v1/admin/mp-records/[ref]/summary/route";
import { POST as mpPublish } from "../../src/app/api/v1/admin/mp-records/[ref]/publish/route";
import { POST as mpWithdraw } from "../../src/app/api/v1/admin/mp-records/[ref]/withdraw/route";
import { GET as o311Get, POST as o311Post } from "../../src/app/api/v1/open311/v2/[...path]/route";
import { GET as readiness } from "../../src/app/api/v1/admin/countries/[code]/readiness/route";
import { PUT as setGate } from "../../src/app/api/v1/admin/countries/[code]/gates/[gate]/route";
import { POST as setCountry } from "../../src/app/api/v1/country/route";
import { registerAdapter } from "../../src/lib/country";
import { BANGLADESH } from "../../src/lib/country/bd";
import { receiptMessage } from "../../src/lib/release2/receipt";
import { clearFlagCache } from "../../src/lib/capabilities";
import { admin, as, call, cleanup, env, makeConstituency, makeUser, type TestUser } from "./harness";

let A: { id: string; key: string }, B: { id: string; key: string };
let mgr: TestUser, mp: TestUser, mgrB: TestUser, adminU: TestUser, mod1: TestUser, mod2: TestUser, vol: TestUser, stranger: TestUser, regionalU: TestUser, citizens: TestUser[];
const future = (d = 7) => new Date(Date.now() + d * 86400_000).toISOString();
const FLAGS = ["open_data", "assisted_reporting", "participatory_budgeting", "rti_helper", "mp_records", "official_registration", "open311_api"];
const denied = (n: number) => expect([403, 404]).toContain(n);
const refP = (ref: string) => ({ ref }); const idP = (id: string) => ({ id });
const createdUnits: string[] = [], createdReps: string[] = [], createdAgencies: string[] = [];

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url; process.env.SUPABASE_SERVICE_ROLE_KEY = env.service; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.anon;
  delete process.env.ANTHROPIC_API_KEY;
  A = await makeConstituency(); B = await makeConstituency();
  mgr = await makeUser("staff", { constituencyId: A.id, officeRole: "office_manager" });
  mp = await makeUser("staff", { constituencyId: A.id, officeRole: "mp" });
  mgrB = await makeUser("staff", { constituencyId: B.id, officeRole: "office_manager" });
  regionalU = await makeUser("staff");
  adminU = await makeUser("admin"); mod1 = await makeUser("moderator"); mod2 = await makeUser("moderator");
  vol = await makeUser("citizen"); stranger = await makeUser("citizen");
  citizens = []; for (let i = 0; i < 7; i++) citizens.push(await makeUser("citizen"));
  await admin.from("follows").insert(citizens.map((u) => ({ user_id: u.id, target_type: "area", constituency_id: A.id }))).throwOnError();
  await admin.from("feature_flags").update({ enabled: true }).in("key", FLAGS).throwOnError();
  clearFlagCache();
});
afterAll(async () => {
  as(null);
  await admin.from("feature_flags").update({ enabled: false }).in("key", FLAGS); clearFlagCache();
  const ids = [A.id, B.id];
  await admin.from("pb_cycles").delete().in("constituency_id", ids);
  await admin.from("assisted_reports").delete().in("constituency_id", ids);
  await admin.from("budget_entries").delete().in("constituency_id", ids);
  await admin.from("budget_sources").delete().in("constituency_id", ids);
  await admin.from("volunteers").delete().in("constituency_id", ids); await admin.from("kiosks").delete().in("constituency_id", ids);
  await admin.from("regional_admins").delete().not("id", "is", null);
  await admin.from("constituency_units").delete().in("constituency_id", ids);
  if (createdUnits.length) await admin.from("admin_units").delete().in("id", createdUnits);
  await admin.from("mp_records").delete().in("representative_id", createdReps.length ? createdReps : ["00000000-0000-0000-0000-000000000000"]);
  if (createdReps.length) await admin.from("representatives").delete().in("id", createdReps);
  await admin.from("agency_receipts").delete().not("id", "is", null);
  await admin.from("country_gates").delete().eq("country_code", "ZZ"); await admin.from("country_adapters").delete().eq("code", "ZZ");
  await admin.from("rti_drafts").delete().in("user_id", [citizens[0]?.id ?? ""]);
  await cleanup(ids);
  if (createdAgencies.length) { await admin.from("issue_agency_referrals").delete().in("agency_id", createdAgencies); await admin.from("agency_integrations").delete().in("agency_id", createdAgencies); await admin.from("agencies").delete().in("id", createdAgencies); }
});

describe("B8.1 budget and expenditure transparency", () => {
  let ref = "", entryId = "";
  const body = () => ({ constituency: A.key, title: "Annual development programme 2026-27", publisher: "Local Government Division", doc_kind: "adp", source_url: "https://example.org/adp-2026.pdf", fiscal_year: "2026-27" });
  it("the area's office records a source and an entry; roles and validation are enforced", async () => {
    as(null); expect((await call(offCreateBudget, "POST", "/x", { body: body() })).status).toBe(401);
    as(citizens[0]); denied((await call(offCreateBudget, "POST", "/x", { body: body() })).status);
    as(mgrB); expect((await call(offCreateBudget, "POST", "/x", { body: body() })).status, "other area").toBe(404);
    as(mgr);
    expect((await call(offCreateBudget, "POST", "/x", { body: { ...body(), source_url: "http://insecure.example/x" } })).status).toBe(422);
    expect((await call(offCreateBudget, "POST", "/x", { body: { ...body(), fiscal_year: "2026" } })).status).toBe(422);
    expect((await call(offCreateBudget, "POST", "/x", { body: { ...body(), extra: 1 } })).status, "unknown field").toBe(422);
    const made = await call(offCreateBudget, "POST", "/x", { body: body() });
    expect(made.status).toBe(201); ref = made.json.data.ref; expect(made.json.data.status).toBe("pending");
    expect((await call(addEntry, "POST", "/x", { params: refP(ref), body: { kind: "allocated", label: "Market road repair", amount: -1, source_page: "p. 14" } })).status).toBe(422);
    const e = await call(addEntry, "POST", "/x", { params: refP(ref), body: { kind: "allocated", label: "Market road repair", amount: 2500000, source_page: "p. 14" } });
    expect(e.status).toBe(201); expect(e.json.data.public).toBe(false);
    as(mgrB); denied((await call(addEntry, "POST", "/x", { params: refP(ref), body: { kind: "spent", label: "Other area item", amount: 1, source_page: "p. 1" } })).status);
    as(mgr);
    const mine = await call(offBudget, "GET", `/x?constituency=${A.key}`);
    expect(mine.json.data[0]).toMatchObject({ ref, status: "pending", entries: 1 });
    as(null);
    expect((await call(budgetEntries, "GET", `/x?constituency=${A.key}`)).json.data).toHaveLength(0);
  });
  it("a different moderator or admin verifies; then it is public with its source; withdrawal and retraction hide it", async () => {
    as(mgr); denied((await call(verifySrc, "POST", "/x", { params: refP(ref), body: { decision: "verify" } })).status);
    as(citizens[0]); expect((await call(adminBudget, "GET", "/x")).json.data, "a citizen sees no queue").toEqual([]);
    as(mod1);
    const queue = await call(adminBudget, "GET", "/x");
    expect(queue.status).toBe(200); expect(queue.json.data.map((s: { ref: string }) => s.ref)).toContain(ref);
    expect((await call(verifySrc, "POST", "/x", { params: refP(ref), body: { decision: "reject" } })).status, "reject needs a note").toBe(422);
    expect((await call(verifySrc, "POST", "/x", { params: refP(ref), body: { decision: "verify", note: "checked against the original" } })).status).toBe(200);
    expect((await call(verifySrc, "POST", "/x", { params: refP(ref), body: { decision: "verify" } })).status, "already decided").toBe(409);
    as(null);
    const srcs = await call(budgetSources, "GET", `/x?constituency=${A.key}&fiscal_year=2026-27`);
    expect(srcs.json.data[0]).toMatchObject({ ref, publisher: "Local Government Division", source_url: "https://example.org/adp-2026.pdf" });
    const ents = await call(budgetEntries, "GET", `/x?constituency=${A.key}&kind=allocated`);
    expect(ents.json.data).toHaveLength(1);
    expect(ents.json.data[0]).toMatchObject({ source_ref: ref, source_page: "p. 14", fiscal_year: "2026-27", is_sample: true });
    entryId = ents.json.data[0].id;
    expect((await call(budgetEntries, "GET", "/x?kind=bogus")).status).toBe(422);
    expect(JSON.stringify(ents.json)).not.toMatch(/total|created_by|verified_by/);
    as(mgr);
    expect((await call(retractEntry, "POST", "/x", { params: idP(entryId), body: { reason: "x" } })).status).toBe(422);
    expect((await call(retractEntry, "POST", "/x", { params: idP("not-a-uuid"), body: { reason: "wrong amount" } })).status).toBe(404);
    expect((await call(retractEntry, "POST", "/x", { params: idP(entryId), body: { reason: "wrong amount" } })).status).toBe(200);
    as(null); expect((await call(budgetEntries, "GET", `/x?constituency=${A.key}`)).json.data).toHaveLength(0);
    as(mgr);
    const e2 = await call(addEntry, "POST", "/x", { params: refP(ref), body: { kind: "spent", label: "Drain cleaning", amount: 40000.25, source_page: "p. 20" } });
    expect(e2.json.data.public).toBe(true);
    expect((await call(withdrawSrc, "POST", "/x", { params: refP(ref), body: { reason: "ok" } })).status).toBe(422);
    expect((await call(withdrawSrc, "POST", "/x", { params: refP(ref), body: { reason: "The document was replaced" } })).status).toBe(200);
    as(null); expect((await call(budgetEntries, "GET", `/x?constituency=${A.key}`)).json.data).toHaveLength(0);
    expect((await call(budgetSources, "GET", `/x?constituency=${A.key}`)).json.data).toHaveLength(0);
  });
  it("an admin can verify too", async () => {
    as(mgr); const made = await call(offCreateBudget, "POST", "/x", { body: { ...body(), title: "Second paper, expenditure report", doc_kind: "expenditure_report" } });
    as(adminU); expect((await call(verifySrc, "POST", "/x", { params: refP(made.json.data.ref), body: { decision: "verify" } })).status).toBe(200);
  });
});

describe("B8.2 signed agency receipts", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const other = generateKeyPairSync("ed25519");
  let integ = "", referral = "", referralOther = "", agencyId = "";
  const signed = (o: { integration_id: string; referral_id: string; agency_reference: string; issued_at: string }, key = privateKey) => ({ ...o, signature: sign(null, Buffer.from(receiptMessage(o)), key).toString("base64") });
  it("integration and key are admin-only; nothing is registered until the agency signs", async () => {
    const { data: ag } = await admin.from("agencies").insert({ name_bn: "টেস্ট সংস্থা", name_en: "P8 Test Agency", categories: ["roads"], source: "test" }).select("id").single().throwOnError(); agencyId = ag!.id; createdAgencies.push(agencyId);
    const { data: ag2 } = await admin.from("agencies").insert({ name_bn: "অন্য", name_en: "P8 Other Agency", categories: ["roads"], source: "test" }).select("id").single().throwOnError(); createdAgencies.push(ag2!.id);
    const { data: issue } = await admin.from("issues").insert({ reporter_id: citizens[1].id, title: "t", category: "roads", description: "test issue", constituency_id: A.id }).select("id").single().throwOnError();
    referral = (await admin.from("issue_agency_referrals").insert({ issue_id: issue!.id, agency_id: agencyId, agency_name: "P8 Test Agency" }).select("id").single().throwOnError()).data!.id;
    referralOther = (await admin.from("issue_agency_referrals").insert({ issue_id: issue!.id, agency_id: ag2!.id, agency_name: "P8 Other Agency" }).select("id").single().throwOnError()).data!.id;
    as(mgr); denied((await call(listIntegrations, "GET", "/x")).status);
    as(adminU);
    const made = await call(setIntegration, "POST", "/x", { body: { agency_id: agencyId, kind: "api", status: "confirmed", note: "test integration" } });
    expect(made.status).toBe(200); integ = made.json.data.id;
    as(mgr); denied((await call(putKey, "PUT", "/x", { params: idP(integ), body: { public_key_pem: pem } })).status);
    as(adminU);
    expect((await call(putKey, "PUT", "/x", { params: idP(integ), body: { public_key_pem: "-----BEGIN PUBLIC KEY-----\nnot a key not a key not a key not a key not a key not a key\n-----END PUBLIC KEY-----" } })).status).toBe(422);
    expect((await call(putKey, "PUT", "/x", { params: idP(integ), body: { public_key_pem: pem } })).status).toBe(200);
    const other2 = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "pem" }).toString();
    expect((await call(putKey, "PUT", "/x", { params: idP(integ), body: { public_key_pem: other2 } })).status, "RSA is not accepted").toBe(422);
    const list = await call(listIntegrations, "GET", "/x");
    const row = list.json.data.find((r: { id: string }) => r.id === integ);
    expect(row).toMatchObject({ has_key: true, status: "confirmed", receipts: 0 }); expect(row.key_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(list.json)).not.toContain("BEGIN PUBLIC KEY");
    const { data: r } = await admin.from("issue_agency_referrals").select("registration_status").eq("id", referral).single(); expect(r!.registration_status).toBe("forwarded");
  });
  it("a valid signature registers the referral with the signed text as proof; every other case is a 403 that reveals nothing; replays do no harm", async () => {
    as(null);
    const base = { integration_id: integ, referral_id: referral, agency_reference: "AG-2026-501", issued_at: new Date().toISOString() };
    const bad = [
      ["wrong key", signed(base, other.privateKey)], ["changed reference", { ...signed(base), agency_reference: "AG-2026-999" }],
      ["other referral of another agency", signed({ ...base, referral_id: referralOther })], ["unknown integration", signed({ ...base, integration_id: crypto.randomUUID() })],
      ["stale", signed({ ...base, issued_at: new Date(Date.now() - 9 * 86400_000).toISOString() })],
    ] as const;
    for (const [name, b] of bad) expect((await call(receipt, "POST", "/x", { body: b })).status, name).toBe(403);
    expect((await call(receipt, "POST", "/x", { body: { ...signed(base), extra: 1 } })).status).toBe(422);
    expect((await call(receipt, "POST", "/x", { body: { ...signed(base), signature: "short" } })).status).toBe(422);
    const ok = await call(receipt, "POST", "/x", { body: signed(base) });
    expect(ok.status).toBe(200); expect(ok.json.data).toMatchObject({ registration_status: "officially_registered", already: false });
    const { data: r } = await admin.from("issue_agency_referrals").select("registration_status,registration_reference,registration_proof,integration_id").eq("id", referral).single();
    expect(r).toMatchObject({ registration_status: "officially_registered", registration_reference: "AG-2026-501", integration_id: integ }); expect(r!.registration_proof).toMatch(/Signed receipt/);
    expect((await call(receipt, "POST", "/x", { body: signed(base) })).json.data.already, "replay").toBe(true);
    const { data: r2 } = await admin.from("issue_agency_referrals").select("registration_status").eq("id", referralOther).single(); expect(r2!.registration_status).toBe("forwarded");
    as(adminU); expect((await call(listIntegrations, "GET", "/x")).json.data.find((x: { id: string }) => x.id === integ).receipts).toBe(1);
    await admin.from("feature_flags").update({ enabled: false }).eq("key", "official_registration"); clearFlagCache();
    as(null); expect((await call(receipt, "POST", "/x", { body: signed(base) })).status, "flag off").toBe(404);
    await admin.from("feature_flags").update({ enabled: true }).eq("key", "official_registration"); clearFlagCache();
  });
});

describe("B8.3 volunteers, kiosks and assisted reports", () => {
  let volId = "", kioskId = "", ref = "";
  const consent = { method: "read_aloud_agreed", version: "v1-draft", agreed_to_file: true, agreed_to_publish: true, understands_no_account: true, language: "bn" };
  const report = (o: Record<string, unknown> = {}) => ({ constituency: A.key, kiosk_id: kioskId || undefined, consent, title: "Broken tube well", category: "water", description: "The tube well near the mosque has been broken for a week. Call 01712345678.", area: "Ward 3", ...o });
  it("rules are public drafts; anyone verified applies; the office decides; kiosks are listed publicly", async () => {
    as(null);
    const rules = await call(volRules, "GET", "/x"); expect(rules.json.data).toMatchObject({ reviewed: false, conduct_version: "v1-draft" }); expect(rules.json.data.consent.bn.length).toBeGreaterThan(20);
    expect((await call(volApply, "POST", "/x", { body: { constituency: A.key, accept_conduct: true, conduct_version: "v1-draft" } })).status).toBe(401);
    as(vol);
    expect((await call(volApply, "POST", "/x", { body: { constituency: A.key, accept_conduct: false, conduct_version: "v1-draft" } })).status, "conduct must be accepted").toBe(422);
    const ap = await call(volApply, "POST", "/x", { body: { constituency: A.key, accept_conduct: true, conduct_version: "v1-draft" } });
    expect(ap.status).toBe(201); volId = ap.json.data.id;
    expect((await call(volApply, "POST", "/x", { body: { constituency: A.key, accept_conduct: true, conduct_version: "v1-draft" } })).status, "twice").toBe(409);
    expect((await call(volMe, "GET", "/x")).json.data[0]).toMatchObject({ status: "pending", constituency: A.key });
    expect((await call(postAssisted, "POST", "/x", { body: report(), headers: { "idempotency-key": crypto.randomUUID() } })).status, "pending volunteer").toBe(403);
    as(stranger); denied((await call(volDecision, "POST", "/x", { params: idP(volId), body: { decision: "approve" } })).status);
    as(mgrB); denied((await call(volDecision, "POST", "/x", { params: idP(volId), body: { decision: "approve" } })).status);
    as(mgr);
    expect((await call(volDecision, "POST", "/x", { params: idP(volId), body: { decision: "reject" } })).status, "reject needs a note").toBe(422);
    expect((await call(volDecision, "POST", "/x", { params: idP(volId), body: { decision: "approve", note: "trained" } })).status).toBe(200);
    const k = await call(mkKiosk, "POST", "/x", { body: { constituency: A.key, label: "Union help desk", place_text: "Beside the Union Parishad office" } });
    expect(k.status).toBe(201); kioskId = k.json.data.id;
    as(vol); denied((await call(mkKiosk, "POST", "/x", { body: { constituency: A.key, label: "My kiosk" } })).status);
    as(null); expect((await call(pubKiosks, "GET", `/x?constituency=${A.key}`)).json.data[0]).toMatchObject({ label: "Union help desk" });
    as(mgr); const ov = await call(offVolunteers, "GET", `/x?constituency=${A.key}`);
    expect(ov.json.data.volunteers[0]).toMatchObject({ id: volId, status: "active" }); expect(ov.json.data.kiosks).toHaveLength(1);
    as(stranger); denied((await call(offVolunteers, "GET", `/x?constituency=${A.key}`)).status);
  });
  it("a volunteer files for someone else only with the full consent; the case is labelled assisted, personal data is removed, and others cannot read the list", async () => {
    as(vol);
    const key = () => ({ "idempotency-key": crypto.randomUUID() });
    expect((await call(postAssisted, "POST", "/x", { body: report() })).status, "idempotency key is required").toBe(400);
    for (const bad of [{ ...consent, agreed_to_publish: false }, { ...consent, understands_no_account: undefined }, { ...consent, method: "assumed" }]) expect((await call(postAssisted, "POST", "/x", { body: report({ consent: bad }), headers: key() })).status, JSON.stringify(bad)).toBe(422);
    expect((await call(postAssisted, "POST", "/x", { body: report({ constituency: B.key }), headers: key() })).status, "other area").toBe(403);
    expect((await call(postAssisted, "POST", "/x", { body: report({ extra: 1 }), headers: key() })).status).toBe(422);
    const made = await call(postAssisted, "POST", "/x", { body: report(), headers: key() });
    expect(made.status).toBe(201); ref = made.json.data.ref; expect(made.json.data.label).toBe("assisted");
    const { data: issue } = await admin.from("issues").select("source_channel,reporter_id,description").eq("ref", ref).single();
    expect(issue).toMatchObject({ source_channel: "assisted", reporter_id: vol.id }); expect(issue!.description).not.toContain("01712345678");
    const { data: ar } = await admin.from("assisted_reports").select("consent_method,consent_version,kiosk_id").eq("constituency_id", A.id).single();
    expect(ar).toMatchObject({ consent_method: "read_aloud_agreed", consent_version: "v1-draft", kiosk_id: kioskId });
    expect((await call(myAssisted, "GET", "/x")).json.data).toEqual([expect.objectContaining({ ref, consent_method: "read_aloud_agreed" })]);
    as(stranger); expect((await call(myAssisted, "GET", "/x")).json.data).toHaveLength(0);
    as(null); expect((await call(myAssisted, "GET", "/x")).status).toBe(401);
  });
  it("suspension stops filing, a kiosk can be retired, and a volunteer can withdraw", async () => {
    as(mgr);
    expect((await call(volDecision, "POST", "/x", { params: idP(volId), body: { decision: "suspend", note: "conduct concern raised" } })).status).toBe(200);
    as(vol); expect((await call(postAssisted, "POST", "/x", { body: report(), headers: { "idempotency-key": crypto.randomUUID() } })).status).toBe(403);
    as(mgr); expect((await call(volDecision, "POST", "/x", { params: idP(volId), body: { decision: "reinstate" } })).status).toBe(200);
    expect((await call(retKiosk, "POST", "/x", { params: idP(kioskId), body: {} })).status).toBe(200);
    as(null); expect((await call(pubKiosks, "GET", `/x?constituency=${A.key}`)).json.data).toHaveLength(0);
    as(stranger); denied((await call(volWithdraw, "POST", "/x", { params: idP(volId), body: {} })).status);
    as(vol); expect((await call(volWithdraw, "POST", "/x", { params: idP(volId), body: {} })).json.data.status).toBe("withdrawn");
  });
});

describe("B8.4 open-data portal", () => {
  it("lists datasets with the licence; serves aggregates only; small cells are hidden; CSV is safe to open", async () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ reporter_id: citizens[2].id, title: `=cmd ${i}`, category: "roads", description: "test issue", constituency_id: A.id }));
    await admin.from("issues").insert([...rows, { reporter_id: citizens[2].id, title: "t", category: "water", description: "test issue", constituency_id: A.id }]).throwOnError();
    as(null);
    const cat = await call(odCatalogue, "GET", "/x");
    expect(cat.json.data.datasets.map((d: { slug: string }) => d.slug)).toEqual(expect.arrayContaining(["issues-monthly", "resolution-monthly", "projects", "budget-entries"]));
    expect(cat.json.data.licence).toMatchObject({ code: "CC-BY-4.0", reviewed: false });
    const d = await call(odDataset, "GET", `/x?constituency=${A.key}`, { params: { slug: "issues-monthly" } });
    expect(d.status).toBe(200); expect(d.json.data.rows).toHaveLength(1);
    const { count: roads } = await admin.from("issues").select("id", { count: "exact", head: true }).eq("constituency_id", A.id).eq("category", "roads");
    expect(d.json.data.rows[0]).toMatchObject({ category: "roads", reported: roads, constituency: A.key, is_sample: true }); expect(roads).toBeGreaterThanOrEqual(6); expect(d.json.data.hidden_cells).toBe(1);
    expect(JSON.stringify(d.json.data)).not.toMatch(/=cmd|reporter|description/);
    expect(d.headers.get("x-licence")).toBe("CC-BY-4.0");
    const csv = await call(odDataset, "GET", `/x?constituency=${A.key}&format=csv`, { params: { slug: "issues-monthly" } });
    expect(csv.status).toBe(200); expect(csv.headers.get("content-type")).toMatch(/text\/csv/);
    expect((await call(odDataset, "GET", "/x?format=xml", { params: { slug: "issues-monthly" } })).status).toBe(422);
    expect((await call(odDataset, "GET", "/x", { params: { slug: "nope-nope" } })).status).toBe(404);
    expect((await call(odDataset, "GET", "/x", { params: { slug: "Bad Slug!" } })).status).toBe(404);
    expect((await call(odDataset, "GET", "/x?from=2026-12-01&to=2020-01-01", { params: { slug: "issues-monthly" } })).status, "bad range").toBe(422);
    for (const slug of ["resolution-monthly", "projects", "budget-entries"]) expect((await call(odDataset, "GET", `/x?constituency=${A.key}`, { params: { slug } })).status, slug).toBe(200);
    await admin.from("feature_flags").update({ enabled: false }).eq("key", "open_data"); clearFlagCache();
    expect((await call(odCatalogue, "GET", "/x")).status, "flag off").toBe(404);
    await admin.from("feature_flags").update({ enabled: true }).eq("key", "open_data"); clearFlagCache();
  });
  it("the CSV writer neutralises formulas", async () => {
    const { toCsv } = await import("../../src/lib/csv");
    expect(toCsv(["a"], [["=1+1"], ["@x"]])).toContain("'=1+1");
  });
});

describe("B8.5 regional administration", () => {
  let grantId = "";
  it("an administrator scopes a staff account to a unit; the holder sees aggregate counts only for areas under it", async () => {
    const mk = async (level: string, code: string, parent?: string) => { const { data } = await admin.from("admin_units").insert({ level, code, name_bn: code, name_en: code, parent_id: parent ?? null }).select("id").single().throwOnError(); createdUnits.push(data!.id); return data!.id as string; };
    const code = `P8-${Date.now().toString(36)}`;
    const div = await mk("division", code), d1 = await mk("district", `${code}-1`, div), d2 = await mk("district", `${code}-2`, div);
    await admin.from("constituency_units").insert([{ constituency_id: A.id, unit_id: d1 }, { constituency_id: B.id, unit_id: d2 }]).throwOnError();
    await admin.from("issues").insert({ reporter_id: citizens[3].id, title: "t", category: "roads", description: "test issue", constituency_id: B.id }).throwOnError();
    as(regionalU); denied((await call(regOverview, "GET", "/x")).status);
    as(mgr); denied((await call(regGrant, "POST", "/x", { body: { user_id: regionalU.id, unit_code: `${code}-1`, level: "district" } })).status);
    as(adminU);
    expect((await call(regGrant, "POST", "/x", { body: { user_id: regionalU.id, unit_code: `${code}-1`, level: "district", extra: 1 } })).status).toBe(422);
    expect((await call(regGrant, "POST", "/x", { body: { user_id: citizens[0].id, unit_code: `${code}-1`, level: "district" } })).status, "must be staff").toBe(422);
    expect((await call(regGrant, "POST", "/x", { body: { user_id: regionalU.id, unit_code: "NOPE", level: "district" } })).status).toBe(404);
    const g = await call(regGrant, "POST", "/x", { body: { user_id: regionalU.id, unit_code: `${code}-1`, level: "district", note: "pilot region" } });
    expect(g.status).toBe(201); grantId = g.json.data.id;
    expect((await call(regList, "GET", "/x")).json.data.find((r: { id: string }) => r.id === grantId)).toMatchObject({ unit_code: `${code}-1`, status: "active" });
    as(mgr); denied((await call(regList, "GET", "/x")).status);
    as(regionalU);
    const mine = await call(regMine, "GET", "/x"); expect(mine.json.data[0]).toMatchObject({ code: `${code}-1`, level: "district" });
    const ov = await call(regOverview, "GET", "/x");
    expect(ov.json.data.areas.map((a: { constituency: string }) => a.constituency)).toEqual([A.key]);
    expect(JSON.stringify(ov.json)).not.toMatch(/reporter|title|description/);
    expect((await call(regOverview, "GET", `/x?unit=${code}-2`)).json.data.areas, "unit outside scope").toHaveLength(0);
    expect((await call(regOverview, "GET", "/x?unit=bad unit!")).status).toBe(422);
    const { data: issues } = await regionalU.sb.from("issues").select("id").eq("constituency_id", A.id); expect(issues, "no case access").toHaveLength(0);
    as(adminU);
    expect((await call(regRevoke, "POST", "/x", { params: idP(grantId), body: {} })).status).toBe(200);
    as(regionalU); denied((await call(regOverview, "GET", "/x")).status);
    as(adminU); expect((await call(regRevoke, "POST", "/x", { params: idP("bad"), body: {} })).status).toBe(404);
  });
});

describe("B8.6 participatory budgeting", () => {
  let src = "", ref = "", optIds: string[] = [];
  const PLEDGE = "The office will fund the options with most votes, in order, as far as the budget allows.";
  it("needs a verified source, a pledge and the MP's approval before it opens", async () => {
    as(mgr);
    const s = await call(offCreateBudget, "POST", "/x", { body: { constituency: A.key, title: "ADP 2026-27 ward allocation", publisher: "Local Government Division", doc_kind: "adp", source_url: "https://example.org/pb-source.pdf", fiscal_year: "2026-27" } });
    src = s.json.data.ref;
    const body = { constituency: A.key, budget_source_ref: src, title: "Ward budget 2026-27", budget_amount: 900000, pledge: PLEDGE, max_choices: 2, closes_at: future(5),
      options: [{ title: "Repair market road", cost: 600000 }, { title: "Build a drain", cost: 300000 }, { title: "Street lights", cost: 250000 }] };
    expect((await call(offPbCreate, "POST", "/x", { body })).status, "source not verified yet").toBe(409);
    as(mod2); await call(verifySrc, "POST", "/x", { params: refP(src), body: { decision: "verify" } });
    as(citizens[0]); denied((await call(offPbCreate, "POST", "/x", { body })).status);
    as(mgr);
    expect((await call(offPbCreate, "POST", "/x", { body: { ...body, pledge: "too short" } })).status).toBe(422);
    expect((await call(offPbCreate, "POST", "/x", { body: { ...body, options: [body.options[0]] } })).status).toBe(422);
    expect((await call(offPbCreate, "POST", "/x", { body: { ...body, closes_at: future(400) } })).status, "too far").toBe(422);
    const made = await call(offPbCreate, "POST", "/x", { body });
    expect(made.status).toBe(201); ref = made.json.data.ref;
    as(null); expect((await call(pbGet, "GET", "/x", { params: refP(ref) })).status, "drafts are not public").toBe(404);
    as(mp);
    expect((await call(offPbAction, "POST", "/x", { params: { ref, action: "decision" }, body: { decision: "approve" } })).status, "nothing waits").toBe(409);
    as(mgr);
    expect((await call(offPbAction, "POST", "/x", { params: { ref, action: "bogus" }, body: {} })).status).toBe(404);
    expect((await call(offPbAction, "POST", "/x", { params: { ref, action: "request-open" }, body: {} })).json.data.status).toBe("pending_approval");
    expect((await call(offPbAction, "POST", "/x", { params: { ref, action: "decision" }, body: { decision: "approve" } })).status, "the manager cannot approve").toBe(403);
    as(mp);
    expect((await call(offPbAction, "POST", "/x", { params: { ref, action: "decision" }, body: { decision: "approve" } })).json.data.status).toBe("open");
    const view = await call(offPbGet, "GET", "/x", { params: refP(ref) }); optIds = view.json.data.options.map((o: { id: string }) => o.id); expect(optIds).toHaveLength(3);
    expect((await call(offPbList, "GET", "/x")).json.data.map((r: { ref: string }) => r.ref)).toContain(ref);
    as(mgrB); denied((await call(offPbGet, "GET", "/x", { params: refP(ref) })).status);
  });
  it("one ballot per verified local account, no counts before closing, funded by votes within the budget, the outcome recorded publicly", async () => {
    as(null);
    const pub = await call(pbGet, "GET", "/x", { params: refP(ref) });
    expect(pub.status).toBe(200); expect(pub.json.data).toMatchObject({ status: "open", budget_source_ref: src, is_sample: true }); expect(pub.json.data.options.every((o: { approvals: unknown }) => o.approvals === null)).toBe(true);
    expect((await call(pbList, "GET", `/x?constituency=${A.key}&status=open`)).json.data.map((r: { ref: string }) => r.ref)).toContain(ref);
    expect((await call(pbBallot, "PUT", "/x", { params: refP(ref), body: { option_ids: [optIds[0]] } })).status).toBe(401);
    as(stranger); denied((await call(pbBallot, "PUT", "/x", { params: refP(ref), body: { option_ids: [optIds[0]] } })).status);
    as(citizens[0]);
    expect((await call(pbBallot, "PUT", "/x", { params: refP(ref), body: { option_ids: optIds } })).status, "more than max_choices").toBe(422);
    expect((await call(pbBallot, "PUT", "/x", { params: refP(ref), body: { option_ids: [] } })).status).toBe(422);
    for (let i = 0; i < 6; i++) { as(citizens[i]); expect((await call(pbBallot, "PUT", "/x", { params: refP(ref), body: { option_ids: i < 4 ? [optIds[0], optIds[1]] : [optIds[0], optIds[2]] } })).status).toBe(200); }
    as(citizens[0]); expect((await call(pbGet, "GET", "/x", { params: refP(ref) })).json.data.my_ballot.option_ids).toHaveLength(2);
    as(citizens[1]); denied((await call(offPbAction, "POST", "/x", { params: { ref, action: "close" }, body: {} })).status);
    as(mgr);
    expect((await call(offPbAction, "POST", "/x", { params: { ref, action: "outcome" }, body: { followed: true } })).status, "not closed").toBe(409);
    expect((await call(offPbAction, "POST", "/x", { params: { ref, action: "close" }, body: {} })).json.data).toMatchObject({ status: "closed", result_valid: true, participants: 6 });
    as(citizens[0]); expect((await call(pbBallot, "PUT", "/x", { params: refP(ref), body: { option_ids: [optIds[0]] } })).status).toBe(409);
    as(null);
    const closed = await call(pbGet, "GET", "/x", { params: refP(ref) });
    expect(closed.json.data.options.map((o: { approvals: number; funded: boolean }) => [o.approvals, o.funded])).toEqual([[6, true], [4, true], [2, false]]);
    as(mgr);
    expect((await call(offPbAction, "POST", "/x", { params: { ref, action: "outcome" }, body: { followed: false } })).status, "deviation needs a reason").toBe(422);
    expect((await call(offPbAction, "POST", "/x", { params: { ref, action: "outcome" }, body: { followed: false, reason: "The drain needs a permit, so street lights were built first." } })).status).toBe(200);
    expect((await call(offPbAction, "POST", "/x", { params: { ref, action: "outcome" }, body: { followed: true } })).status, "only once").toBe(409);
    as(null); expect((await call(pbGet, "GET", "/x", { params: refP(ref) })).json.data).toMatchObject({ followed_result: false, deviation_reason: expect.stringContaining("permit") });
  });
  it("a cycle that has not opened can be cancelled", async () => {
    as(mgr);
    const made = await call(offPbCreate, "POST", "/x", { body: { constituency: A.key, budget_source_ref: src, title: "Second round", budget_amount: 900000, pledge: PLEDGE, closes_at: future(3), options: [{ title: "Option one", cost: 500000 }, { title: "Option two", cost: 500000 }] } });
    expect((await call(offPbAction, "POST", "/x", { params: { ref: made.json.data.ref, action: "cancel" }, body: { reason: "Not needed any more" } })).json.data.status).toBe("cancelled");
  });
});

describe("B8.7 Right to Information helper", () => {
  let id = "";
  const draft = (o: Record<string, unknown> = {}) => ({ agency_name: "Roads and Highways Department", subject: "Repair budget of the market road", info_requested: "Please give the amounts spent on repairing the market road in 2025-26. My phone is 01712345678.", format: "electronic", language: "bn", ...o });
  it("the guide is public, says it never files, and marks unreviewed deadlines", async () => {
    as(null);
    const g = await call(rtiGuideGet, "GET", "/x");
    expect(g.json.data).toMatchObject({ we_never_file: true, reviewed: false, respond_working_days: 20 }); expect(g.json.data.steps_bn).toHaveLength(5); expect(g.json.data.note).toMatch(/not legal advice/);
  });
  it("creates a draft with placeholders for the applicant's own details, removes personal data, and tracks only what the citizen reports", async () => {
    as(null); expect((await call(rtiCreate, "POST", "/x", { body: draft() })).status).toBe(401);
    as(citizens[0]);
    expect((await call(rtiCreate, "POST", "/x", { body: draft({ info_requested: "too short" }) })).status).toBe(422);
    expect((await call(rtiCreate, "POST", "/x", { body: { subject: "A subject here", info_requested: "x".repeat(30) } })).status, "agency needed").toBe(422);
    expect((await call(rtiCreate, "POST", "/x", { body: draft({ extra: 1 }) })).status).toBe(422);
    const made = await call(rtiCreate, "POST", "/x", { body: draft() });
    expect(made.status).toBe(201); id = made.json.data.id;
    const t: string = made.json.data.draft_text;
    expect(t).toContain("[আপনার নাম লিখুন]"); expect(t).toContain("তথ্য অধিকার আইন"); expect(t).not.toContain("01712345678"); expect(made.json.data.personal_data_removed).toBe(true);
    expect(made.json.data.next).toMatch(/not sent or filed/);
    const en = await call(rtiCreate, "POST", "/x", { body: draft({ language: "en", period: "2025-26" }) });
    expect(en.json.data.draft_text).toContain("Designated Officer"); expect(en.json.data.draft_text).toContain("[write your name]");
    expect((await call(rtiList, "GET", "/x")).json.data[0].timeline).toMatchObject({ state: "not_filed", self_reported: true });
    expect((await call(rtiPatch, "PATCH", "/x", { params: idP(id), body: { action: "mark_filed", on: "2999-01-01", channel: "email" } })).status, "future date").toBe(422);
    expect((await call(rtiPatch, "PATCH", "/x", { params: idP(id), body: { action: "mark_filed", channel: "email" } })).status, "date needed").toBe(422);
    const filedOn = new Date(Date.now() - 4 * 86400_000).toISOString().slice(0, 10);
    const f = await call(rtiPatch, "PATCH", "/x", { params: idP(id), body: { action: "mark_filed", on: filedOn, channel: "email", agency_reference: "AG-5" } });
    expect(f.json.data).toMatchObject({ status: "filed_by_me", self_reported: true });
    const got = await call(rtiGet, "GET", "/x", { params: idP(id) });
    expect(got.json.data.timeline.state).toBe("awaiting_answer"); expect(got.json.data.timeline.earliest_due_on).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(got.json.data.agency_reference).toBe("AG-5");
    expect((await call(rtiPatch, "PATCH", "/x", { params: idP(id), body: { action: "mark_answered", on: filedOn } })).json.data.status).toBe("answered");
  });
  it("another citizen cannot see, change or delete it; the owner can delete it", async () => {
    as(citizens[4]);
    expect((await call(rtiGet, "GET", "/x", { params: idP(id) })).status).toBe(404);
    expect((await call(rtiPatch, "PATCH", "/x", { params: idP(id), body: { action: "close" } })).status).toBe(404);
    expect((await call(rtiDelete, "DELETE", "/x", { params: idP(id) })).status).toBe(404);
    expect((await call(rtiList, "GET", "/x")).json.data).toHaveLength(0);
    as(citizens[0]); expect((await call(rtiDelete, "DELETE", "/x", { params: idP(id) })).json.data.deleted).toBe(true);
    expect((await call(rtiGet, "GET", "/x", { params: idP(id) })).status).toBe(404);
  });
});

describe("B8.8 MP activity from official records", () => {
  let rep = "", ref = "";
  const rec = () => ({ representative_id: rep, kind: "question_asked", title: "Question on rural road funding", occurred_on: "2026-03-10", session_label: "Session 4", source_name: "Parliament Secretariat record", source_url: "https://example.org/hansard/2026-03-10", source_checked_at: "2026-11-01", excerpt: "The member asked the ministry about road funds for 12 districts." });
  it("only moderators and administrators write; an official source is required; no score or ranking exists", async () => {
    rep = (await admin.from("representatives").insert({ full_name: "Test Member", verification_status: "verified", is_demo: true }).select("id").single().throwOnError()).data!.id; createdReps.push(rep);
    as(null); expect((await call(adminMpCreate, "POST", "/x", { body: rec() })).status).toBe(401);
    for (const u of [citizens[0], mgr, mp]) { as(u); denied((await call(adminMpCreate, "POST", "/x", { body: rec() })).status); denied((await call(adminMp, "GET", "/x")).status); }
    as(mod1);
    expect((await call(adminMpCreate, "POST", "/x", { body: { ...rec(), source_url: "http://insecure.example" } })).status).toBe(422);
    const { source_url, ...noSource } = rec(); void source_url;
    expect((await call(adminMpCreate, "POST", "/x", { body: noSource })).status, "source required").toBe(422);
    expect((await call(adminMpCreate, "POST", "/x", { body: { ...rec(), kind: "attendance_session" } })).status, "attendance is not a kind").toBe(422);
    expect((await call(adminMpCreate, "POST", "/x", { body: { ...rec(), score: 5 } })).status).toBe(422);
    const made = await call(adminMpCreate, "POST", "/x", { body: rec() }); expect(made.status).toBe(201); ref = made.json.data.ref;
    as(null); expect((await call(mpGet, "GET", "/x", { params: refP(ref) })).status, "a draft is not public").toBe(404);
  });
  it("the AI draft is optional and never published by itself; a second person publishes a neutral summary", async () => {
    as(mod1);
    const s = await call(mpSummary, "POST", "/x", { params: refP(ref), body: {} });
    expect(s.status).toBe(201); expect(s.json.data).toMatchObject({ ai_summary_source: "none", summary_draft: null });   // no model key in tests: manual path
    as(mod1); expect((await call(mpPublish, "POST", "/x", { params: refP(ref), body: { summary_bn: "The member asked about road funds for 12 districts." } })).status, "the author cannot publish").toBe(409);
    as(mod2);
    expect((await call(mpPublish, "POST", "/x", { params: refP(ref), body: { summary_bn: "This is the best and most active member." } })).status, "evaluative words").toBe(422);
    expect((await call(mpPublish, "POST", "/x", { params: refP(ref), body: { summary_bn: "সদস্য অত্যন্ত খারাপ প্রশ্ন করেছেন" } })).status, "evaluative Bangla").toBe(422);
    expect((await call(mpPublish, "POST", "/x", { params: refP(ref), body: { summary_bn: "short" } })).status).toBe(422);
    const ok = await call(mpPublish, "POST", "/x", { params: refP(ref), body: { summary_bn: "The member asked the ministry about road funds for 12 districts." } });
    expect(ok.json.data.status).toBe("published");
    expect((await call(adminMp, "GET", "/x?status=published")).json.data.map((r: { ref: string }) => r.ref)).toContain(ref);
    as(null);
    const list = await call(mpList, "GET", `/x?representative_id=${rep}`);
    expect(list.json.data.records).toHaveLength(1); expect(list.json.data.records[0]).toMatchObject({ ref, source_name: "Parliament Secretariat record", is_sample: true }); expect(list.json.data.note).toMatch(/no score/);
    expect(JSON.stringify(list.json)).not.toMatch(/"(score|rank|rating|total|count|percent)"/);
    for (const q of ["sort=rank", "order=score", "rank=1", "score=true"]) expect((await call(mpList, "GET", `/x?${q}`)).status, q).toBe(422);
    expect((await call(mpGet, "GET", "/x", { params: refP(ref) })).json.data.note).toMatch(/no score/);
    as(mod2); expect((await call(mpWithdraw, "POST", "/x", { params: refP(ref), body: { reason: "x" } })).status).toBe(422);
    expect((await call(mpWithdraw, "POST", "/x", { params: refP(ref), body: { reason: "The source was corrected" } })).status).toBe(200);
    as(null); expect((await call(mpList, "GET", `/x?representative_id=${rep}`)).json.data.records).toHaveLength(0);
  });
});

describe("B8.9 Open311 GeoReport v2 (read side)", () => {
  let sid = "";
  // Open311 answers with JSON arrays, so the loosely typed body is widened here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = async (p: string, q = "") => { const r = await call(o311Get, "GET", `/api/v1/open311/v2/${p}${q}`, { params: { path: p.split("/") } as never }); return { ...r, json: r.json as any }; };
  it("serves discovery, services, requests and one request in JSON and XML with the standard field names; no private data", async () => {
    const { data: i } = await admin.from("issues").insert({ reporter_id: citizens[5].id, title: "Broken light", category: "electricity", description: "The street light is not working near the school", constituency_id: A.id, is_demo: true }).select("ref").single().throwOnError(); sid = i!.ref;
    as(null);
    expect((await get("discovery.json")).json).toMatchObject([{ endpoints: [{ type: "production" }] }]);
    const sv = await get("services.json"); expect(Array.isArray(sv.json)).toBe(true); expect(sv.json[0]).toHaveProperty("service_code"); expect(sv.json[0]).toHaveProperty("service_name");
    const code = sv.json[0].service_code;
    expect((await get(`services/${code}.json`)).json).toEqual([{ service_code: code, attributes: [] }]);
    expect((await get("services/NOPE.json")).status).toBe(404);
    const hidden = await get("requests.json"); expect(hidden.json.map((r: { service_request_id: string }) => r.service_request_id), "sample data hidden by default").not.toContain(sid);
    const list = await get("requests.json", `?include_sample=true&jurisdiction_id=${A.key}&status=open`);
    expect(list.status).toBe(200);
    const r = list.json.find((x: { service_request_id: string }) => x.service_request_id === sid);
    expect(r).toMatchObject({ status: "open", service_code: expect.any(String), description: "The street light is not working near the school", agency_responsible: null, media_url: null });
    for (const k of ["service_request_id", "status", "service_name", "requested_datetime", "updated_datetime", "lat", "long", "address", "zipcode"]) expect(r, k).toHaveProperty(k);
    expect(JSON.stringify(list.json)).not.toMatch(/reporter|email|phone|title/);
    expect((await get(`requests/${sid}.json`, "")).json[0].service_request_id).toBe(sid);
    expect((await get("requests/JK-0000-0.json")).status).toBe(404);
    expect((await get("requests.json", `?include_sample=true&service_request_id=${sid}`)).json).toHaveLength(1);
    expect((await get("requests.json", "?status=pending")).status).toBe(400);
    expect((await get("requests.json", "?start_date=yesterday")).status).toBe(400);
    expect((await get("requests.json", "?include_sample=true&end_date=2000-01-01T00:00:00Z")).json).toHaveLength(0);
    const xml = await call(o311Get, "GET", `/api/v1/open311/v2/requests/${sid}.xml`, { params: { path: ["requests", `${sid}.xml`] } as never });
    expect(xml.status).toBe(200);
    const res = await o311Get(new Request(`http://localhost/api/v1/open311/v2/requests.xml?include_sample=true&service_request_id=${sid}`, { headers: { "x-forwarded-for": "10.9.9.9" } }), { params: Promise.resolve({ path: ["requests.xml"] }) } as never);
    const text = await res.text(); expect(res.headers.get("content-type")).toMatch(/xml/); expect(text).toContain("<service_requests><request><service_request_id>"); expect(text).toContain(sid);
    expect((await get("requests")).status, "extension required").toBe(404);
  });
  it("creating requests is refused in Open311's error format; the flag can switch the API off", async () => {
    const post = await call(o311Post, "POST", "/api/v1/open311/v2/requests.json", { params: { path: ["requests.json"] } as never, body: { service_code: "x" } });
    expect(post.status).toBe(403); expect(post.json as unknown).toEqual([{ code: 403, description: expect.stringContaining("not supported") }]);
    await admin.from("feature_flags").update({ enabled: false }).eq("key", "open311_api"); clearFlagCache();
    expect((await get("services.json")).status).toBe(404);
    await admin.from("feature_flags").update({ enabled: true }).eq("key", "open311_api"); clearFlagCache();
  });
});

describe("B8.10 second-country readiness", () => {
  const cfg = { name_en: "Pilotland", name_native: "Pilotland", default_locale: "en", locales: ["en"], currency: "USD", date_format: "dd/MM/yyyy", timezone: "UTC", admin_levels: [{ level: "region", name_en: "Region" }] };
  it("activation is blocked until all five reviews are recorded with evidence; every step is admin-only and audited", async () => {
    registerAdapter({ ...BANGLADESH, code: "ZZ", nameEn: "Pilotland", nameNative: "Pilotland" });
    as(mgr); denied((await call(readiness, "GET", "/x", { params: { code: "ZZ" } })).status);
    as(adminU);
    expect((await call(setCountry, "POST", "/x", { body: { code: "ZZ", config: cfg, activate: false } })).status).toBe(200);
    expect((await call(setCountry, "POST", "/x", { body: { code: "ZZ", config: cfg, activate: true } })).status, "reviews missing").toBe(409);
    const r0 = await call(readiness, "GET", "/x", { params: { code: "ZZ" } }); expect(r0.json.data).toMatchObject({ ready: false, home_country: false }); expect(r0.json.data.gates).toHaveLength(5);
    expect((await call(readiness, "GET", "/x", { params: { code: "zz" } })).status).toBe(404);
    const put = (gate: string, body: Record<string, unknown>) => call(setGate, "PUT", "/x", { params: { code: "ZZ", gate }, body });
    expect((await put("legal_review", { status: "cleared" })).status, "evidence and reviewer needed").toBe(422);
    expect((await put("made_up", { status: "cleared", evidence_ref: "doc 1 in folder", reviewer: "Firm X" })).status).toBe(404);
    as(mgr); denied((await put("legal_review", { status: "cleared", evidence_ref: "doc 1 in folder", reviewer: "Firm X" })).status);
    as(adminU);
    for (const g of ["legal_review", "electoral_review", "data_protection_review", "language_review"]) expect((await put(g, { status: "cleared", evidence_ref: "Opinion 2026/14 in the legal folder", reviewer: "Firm X, counsel" })).status).toBe(200);
    expect((await call(setCountry, "POST", "/x", { body: { code: "ZZ", config: cfg, activate: true } })).status, "four of five").toBe(409);
    expect((await put("hosting_residency", { status: "cleared", evidence_ref: "Hosting memo 3", reviewer: "Data office" })).status).toBe(200);
    expect((await call(readiness, "GET", "/x", { params: { code: "ZZ" } })).json.data.ready).toBe(true);
    expect((await put("legal_review", { status: "open" })).status).toBe(200);
    expect((await call(readiness, "GET", "/x", { params: { code: "ZZ" } })).json.data.ready, "a reopened gate").toBe(false);
    const { data: logs } = await admin.from("audit_logs").select("action").like("action", "country_gate.%"); expect((logs ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
