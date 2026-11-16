import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";
import { api, buildWorld, dropWorld, localEnv, sessionFor, skipUnlessReal, submitIssue, type World } from "./support";

/** §21.3 scenarios 10-13: who may see and do what, checked with real sessions and the real database policies. */
test.describe.configure({ mode: "serial" });

let w: World;
let anon: BrowserContext, a: BrowserContext, b: BrowserContext, officeA: BrowserContext, officeB: BrowserContext, moderator: BrowserContext, admin: BrowserContext;
let ref = "";

test.beforeAll(async ({ browser }, info) => {
  skipUnlessReal();
  w = await buildWorld(info);
  const ac = w.accounts;
  [anon, a, b, officeA, officeB, moderator, admin] = await Promise.all([
    sessionFor(browser, info, null), sessionFor(browser, info, ac.citizenA), sessionFor(browser, info, ac.citizenB),
    sessionFor(browser, info, ac.officeA), sessionFor(browser, info, ac.officeB), sessionFor(browser, info, ac.moderator), sessionFor(browser, info, ac.admin),
  ]);
  ref = await submitIssue(a.request, w, { title: "বিদ্যুতের তার ঝুলছে", category: "electricity" });
});
test.afterAll(async () => {
  await Promise.all([anon, a, b, officeA, officeB, moderator, admin].map((c) => c?.close()));
  if (w) await dropWorld(w);
});

test("10. someone who is not allowed cannot read private report data", async () => {
  // Visitors and other citizens get no office data and no way to act on the issue.
  expect((await api(anon.request, "GET", "/office/issues")).status).toBe(401);
  expect((await api(b.request, "GET", "/office/issues")).status).toBe(403);
  expect((await api(b.request, "GET", `/office/issues/${ref}`)).status).toBeGreaterThanOrEqual(403);
  expect((await api(b.request, "POST", `/issues/${ref}/feedback`, { rating: 5 })).status).toBe(404);
  expect((await api(b.request, "POST", `/issues/${ref}/reopen`, { reason: "কেন নয়, দেখুন তো" })).status).toBe(404);
  expect((await api(anon.request, "POST", "/issues", { title: "x", category: "roads", description: "y" })).status).toBe(401);
  // The public view never carries the reporter, the exact pin or staff-only fields.
  const pub = JSON.stringify((await api(b.request, "GET", `/issues/${ref}`)).json);
  for (const secret of [w.accounts.citizenA.id, w.accounts.citizenA.email, "reporter", "23.7808", "internal_note", "ai_summary"]) expect(pub, secret).not.toContain(secret);
  // Straight to the database with the public key: nothing private comes back.
  const env = localEnv();
  const sb = createClient(env.url, env.anon, { auth: { persistSession: false } });
  for (const table of ["issues", "issue_events", "issue_media", "notifications", "audit_logs", "consents"]) {
    const { data } = await sb.from(table).select("*").limit(5);
    expect((data ?? []).filter((r: Record<string, unknown>) => "reporter_id" in r || "internal_note" in r && r.internal_note || "user_id" in r), table).toEqual([]);
  }
  // In the browser: a citizen on the office page is told they have no access, and sees none of the queue.
  const page = await b.newPage();
  await page.goto("/office");
  await expect(page.getByText(ref)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /access|permission/i })).toBeVisible();
  await page.close();
});

test("11. office A cannot read or change office B's cases, and the other way round", async () => {
  const refB = await submitIssue(b.request, w, { constituencyId: w.B.key, title: "অফিস বি-এর এলাকার সমস্যা" });
  const queueA = JSON.stringify((await api(officeA.request, "GET", "/office/issues")).json.data);
  const queueB = JSON.stringify((await api(officeB.request, "GET", "/office/issues")).json.data);
  expect(queueA).toContain(ref);
  expect(queueA).not.toContain(refB);
  expect(queueB).toContain(refB);
  expect(queueB).not.toContain(ref);
  expect((await api(officeB.request, "GET", `/office/issues/${ref}`)).status).toBe(404);
  expect((await api(officeA.request, "GET", `/office/issues/${refB}`)).status).toBe(404);
  expect((await api(officeB.request, "POST", `/office/issues/${ref}/acknowledge`, { message: "x" })).status).toBe(404);
  expect((await api(officeA.request, "POST", `/office/issues/${refB}/reject`, { reason: "না", appeal_route: "কোথাও" })).status).toBe(404);
  const page = await officeB.newPage();
  const res = await page.goto(`/office/${ref}`);
  expect(res?.status()).toBe(404);
  await expect(page.getByText("বিদ্যুতের তার ঝুলছে")).toHaveCount(0);
  await page.close();
  expect((await w.admin.from("issues").select("status").eq("ref", ref).single()).data?.status).toBe("submitted"); // untouched
});

test("12. a moderator handles an abuse report, and reverses it when the author contests", async () => {
  expect((await api(b.request, "POST", "/reports", { type: "issue", ref, reason: "false_information", details: "এমন কিছু ঘটেনি" })).status).toBe(201);
  expect((await api(b.request, "POST", "/reports", { type: "issue", ref, reason: "spam" })).status).toBeGreaterThanOrEqual(400); // one report per person per item
  // Citizens and staff cannot reach the moderation queue.
  for (const c of [a, officeA]) expect((await api(c.request, "GET", "/admin/moderation")).status).toBe(403);
  const queue = await api(moderator.request, "GET", "/admin/moderation");
  expect(queue.status, JSON.stringify(queue.json)).toBe(200);
  const item = (queue.json.data as { target_ref: string; reasons: string[] }[]).find((i) => i.target_ref === ref);
  expect(item, "the reported issue is in the queue").toBeTruthy();
  expect(JSON.stringify(queue.json)).not.toContain(w.accounts.citizenA.email); // no author or reporter shown
  // A decision needs a reason.
  expect((await api(moderator.request, "POST", "/admin/moderation/items", { type: "issue", ref, action: "hide" })).status).toBe(422);
  expect((await api(moderator.request, "POST", "/admin/moderation/items", { type: "issue", ref, action: "hide", reason: "ব্যক্তিগত তথ্য আছে" })).status).toBe(200);
  expect((await api(anon.request, "GET", `/issues/${ref}`)).status).toBe(404); // hidden from the public
  // The author contests (appeal); the moderator reviews and restores with a reason. Both steps are in the audit trail.
  expect((await api(moderator.request, "POST", "/admin/moderation/items", { type: "issue", ref, action: "restore", reason: "আপিল যাচাই করা হয়েছে, তথ্য ঠিক আছে" })).status).toBe(200);
  expect((await api(anon.request, "GET", `/issues/${ref}`)).status).toBe(200);
  const audit = await api(admin.request, "GET", "/admin/audit");
  expect(audit.status).toBe(200);
  expect(JSON.stringify(audit.json.data)).toContain(ref);
  expect((await api(moderator.request, "GET", "/admin/audit")).status).toBe(403); // admin only
});

test("13. a visitor finds their MP from their area without signing in", async () => {
  const res = await api(anon.request, "GET", "/representatives/lookup?area=Sample");
  expect(res.status, JSON.stringify(res.json)).toBe(200);
  expect(res.json.data).toBeTruthy();
  const page = await anon.newPage();
  await page.goto("/mp");
  await expect(page).toHaveURL(/\/mp$/); // no redirect to sign-in
  await page.getByRole("searchbox").fill("Sample");
  await expect(page.getByRole("main").getByText(/Sample Constituency|constituency/i).first()).toBeVisible();
  await page.close();
});
