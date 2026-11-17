import { expect, test, type BrowserContext } from "@playwright/test";
import { api, buildWorld, dropWorld, gotoOk, sessionFor, skipUnlessReal, type World } from "./support";

/**
 * Release 2 (backend Phase 8, migrations 0080-0083) on the real API: no mocks. Frontend Phase 9, F9.1.
 * Switches the server flags it needs on for the run and restores them afterwards.
 * Written 2026-11-17 against docs/api-v1.md "Phase 8"; expect small fixes on a first run.
 */
test.describe.configure({ mode: "serial" });

let w: World;
let office: BrowserContext, admin: BrowserContext, moderator: BrowserContext, citizen: BrowserContext, visitor: BrowserContext;
const LABEL = `রাস্তা মেরামত ${Date.now().toString(36)}`;
const FLAGS = ["budget_transparency", "rti_helper", "mp_records"];
let before: { key: string; enabled: boolean }[] = [];

test.beforeAll(async ({ browser }, info) => {
  skipUnlessReal();
  w = await buildWorld(info);
  const { data } = await w.admin.from("feature_flags").select("key,enabled").in("key", FLAGS);
  before = data ?? [];
  test.skip(before.length < FLAGS.length, "backend Phase 8 (migrations 0080-0083) is not on this local database");
  await w.admin.from("feature_flags").update({ enabled: true }).in("key", FLAGS).throwOnError();
  [office, admin, moderator, citizen, visitor] = await Promise.all([
    sessionFor(browser, info, w.accounts.officeA), sessionFor(browser, info, w.accounts.admin), sessionFor(browser, info, w.accounts.moderator),
    sessionFor(browser, info, w.accounts.citizenA), sessionFor(browser, info, null),
  ]);
});
test.afterAll(async () => {
  await Promise.all([office?.close(), admin?.close(), moderator?.close(), citizen?.close(), visitor?.close()]);
  if (w) {
    for (const f of before) await w.admin.from("feature_flags").update({ enabled: f.enabled }).eq("key", f.key);
    await dropWorld(w);
  }
});

test("a budget figure is public only after a second person verifies its source; withdrawing hides it", async () => {
  const src = await api(office.request, "POST", "/office/budget/sources", { constituency: w.A.key, title: "বার্ষিক উন্নয়ন বাজেট ২০২৬-২৭", publisher: "স্থানীয় সরকার বিভাগ", doc_kind: "annual_budget", source_url: "https://example.test/budget-2026-27.pdf", fiscal_year: "2026-27" });
  expect(src.status, JSON.stringify(src.json)).toBe(201);
  const ref = src.json.data.ref as string;
  const entry = await api(office.request, "POST", `/office/budget/sources/${ref}/entries`, { kind: "allocated", label: LABEL, amount: 1250000, source_page: "পৃষ্ঠা ১২" });
  expect(entry.status, JSON.stringify(entry.json)).toBe(201);

  // Pending: nothing public, and the office cannot verify its own record.
  const hidden = await api(visitor.request, "GET", `/budget/entries?constituency=${w.A.key}&fiscal_year=2026-27`);
  expect(hidden.status).toBe(200);
  expect(JSON.stringify(hidden.json.data)).not.toContain(LABEL);
  expect((await api(office.request, "POST", `/admin/budget/sources/${ref}/verify`, { decision: "verify" })).status).toBeGreaterThanOrEqual(400);

  const ok = await api(admin.request, "POST", `/admin/budget/sources/${ref}/verify`, { decision: "verify" });
  expect(ok.status, JSON.stringify(ok.json)).toBe(200);
  const shown = await api(visitor.request, "GET", `/budget/entries?constituency=${w.A.key}&fiscal_year=2026-27`);
  expect((shown.json.data as { label: string; amount: number }[]).find((e) => e.label === LABEL)?.amount).toBeDefined();

  // The page shows the figure, its source and the "nothing is summed" note.
  const page = await visitor.newPage();
  await gotoOk(page, "/budget");
  await expect(page.getByText(LABEL).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /বার্ষিক উন্নয়ন বাজেট/ }).first()).toBeVisible();
  await page.close();

  expect((await api(office.request, "POST", `/office/budget/sources/${ref}/withdraw`, { reason: "ভুল নথি আপলোড হয়েছিল" })).status).toBe(200);
  const gone = await api(visitor.request, "GET", `/budget/entries?constituency=${w.A.key}&fiscal_year=2026-27`);
  expect(JSON.stringify(gone.json.data)).not.toContain(LABEL);
});

test("RTI draft: only for a signed-in account, owned by that account, personal data removed", async () => {
  const body = { agency_name: "স্থানীয় সরকার বিভাগ", subject: "সড়ক মেরামতের বরাদ্দ", info_requested: "গত অর্থবছরে এই এলাকার সড়ক মেরামতে কত টাকা বরাদ্দ ও খরচ হয়েছে তার নথি চাই। আমার ফোন 01711223344।", format: "electronic", language: "bn" };
  expect((await api(visitor.request, "POST", "/rti/drafts", body)).status).toBeGreaterThanOrEqual(400);
  const made = await api(citizen.request, "POST", "/rti/drafts", body);
  expect(made.status, JSON.stringify(made.json)).toBe(201);
  expect(made.json.data.draft_text).not.toContain("01711223344");
  expect(made.json.data.personal_data_removed).toBeTruthy();
  const id = made.json.data.id as string;
  const other = await sessionFor((await citizen.browser())!, test.info(), w.accounts.citizenB);
  expect((await api(other.request, "GET", `/rti/drafts/${id}`)).status).toBe(404);
  await other.close();
  expect((await api(citizen.request, "DELETE", `/rti/drafts/${id}`)).status).toBeLessThan(300);
});

test("MP record: the writer cannot publish it; a second person can; no sort or rank parameter", async () => {
  const rep = await w.admin.from("representatives").select("id").limit(1).maybeSingle();
  test.skip(!rep.data, "no representative on this local database");
  const made = await api(admin.request, "POST", "/admin/mp-records", { representative_id: rep.data!.id, kind: "question_asked", title: "সড়ক নিয়ে প্রশ্ন", occurred_on: "2026-03-10", source_name: "জাতীয় সংসদ", source_url: "https://example.test/records/1", source_checked_at: "2026-11-01" });
  expect(made.status, JSON.stringify(made.json)).toBe(201);
  const ref = made.json.data.ref as string;
  const summary = "সংসদ সদস্য এলাকার সড়কের অবস্থা নিয়ে সংসদে একটি প্রশ্ন করেছিলেন।";
  expect((await api(admin.request, "POST", `/admin/mp-records/${ref}/publish`, { summary_bn: summary })).status).toBe(409);
  const pub = await api(moderator.request, "POST", `/admin/mp-records/${ref}/publish`, { summary_bn: summary });
  expect(pub.status, JSON.stringify(pub.json)).toBe(200);
  expect((await api(visitor.request, "GET", "/mp-records?sort=count")).status).toBe(422);
  const list = await api(visitor.request, "GET", `/mp-records?representative_id=${rep.data!.id}`);
  expect(list.status).toBe(200);
  const page = await visitor.newPage();
  await gotoOk(page, `/mp-records?mp=${rep.data!.id}`);
  await expect(page.getByText("সংসদ সদস্য এলাকার সড়কের অবস্থা").first()).toBeVisible();
  await page.close();
  await api(admin.request, "POST", `/admin/mp-records/${ref}/withdraw`, { reason: "পরীক্ষা শেষ" });
});
