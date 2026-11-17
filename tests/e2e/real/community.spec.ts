import { expect, test, type BrowserContext } from "@playwright/test";
import { api, buildWorld, dropWorld, resolveIssue, sessionFor, skipUnlessReal, submitIssue, type World } from "./support";

/** §21.3 scenarios 9, 14 and 15: ideas, "me too" and the rate-then-appeal loop, on the real API. */
test.describe.configure({ mode: "serial" });

let w: World;
let a: BrowserContext, b: BrowserContext, office: BrowserContext, moderator: BrowserContext;

test.beforeAll(async ({ browser }, info) => {
  skipUnlessReal();
  w = await buildWorld(info);
  [a, b, office, moderator] = await Promise.all([
    sessionFor(browser, info, w.accounts.citizenA), sessionFor(browser, info, w.accounts.citizenB),
    sessionFor(browser, info, w.accounts.officeA), sessionFor(browser, info, w.accounts.moderator),
  ]);
});
test.afterAll(async () => {
  await Promise.all([a?.close(), b?.close(), office?.close(), moderator?.close()]);
  if (w) await dropWorld(w);
});

test("9. a citizen submits an idea and supports another citizen's idea, once", async () => {
  const mine = await api(a.request, "POST", "/ideas", { constituency: w.A.key, category: "roads", title: "বাজারে বাতি বসানো হোক", body: "রাতে বাজারের পথ অন্ধকার, সোলার বাতি বসালে নিরাপদ হবে।" });
  expect(mine.status, JSON.stringify(mine.json)).toBe(201);
  expect(mine.json.data.status).toBe("pending_review"); // waits for a moderator
  const theirs = await api(b.request, "POST", "/ideas", { constituency: w.A.key, title: "খেলার মাঠ সংস্কার", body: "স্কুলের পাশের মাঠে জল জমে, নিকাশ করা হোক।" });
  expect(theirs.status).toBe(201);
  const ref = theirs.json.data.ref as string;
  // Not public, so not supportable, until a moderator publishes it.
  expect((await api(a.request, "POST", `/ideas/${ref}/support`)).status).toBeGreaterThanOrEqual(400);
  const pub = await api(moderator.request, "POST", "/admin/moderation/review", { type: "idea", ref, action: "publish" });
  expect(pub.status, JSON.stringify(pub.json)).toBe(200);
  const first = await api(a.request, "POST", `/ideas/${ref}/support`);
  expect(first.status, JSON.stringify(first.json)).toBe(200);
  const again = await api(a.request, "POST", `/ideas/${ref}/support`); // one per account
  expect(again.status).toBe(200);
  expect(again.json.data.support_count ?? again.json.data.count).toBe(first.json.data.support_count ?? first.json.data.count);
  expect((await api(b.request, "POST", `/ideas/${ref}/support`)).status).toBeGreaterThanOrEqual(400); // not your own
  const list = await api(a.request, "GET", `/ideas?constituency=${w.A.key}`);
  expect(JSON.stringify(list.json.data)).toContain(ref);
  expect(JSON.stringify(list.json)).not.toContain(w.accounts.citizenA.id); // who supported is never exposed
});

test("14. citizen B taps 'me too' on A's issue: the count rises once per account and B hears the next update", async () => {
  const ref = await submitIssue(a.request, w);
  expect((await api(a.request, "POST", `/issues/${ref}/affected`)).status).toBe(409); // the reporter already counts
  const one = await api(b.request, "POST", `/issues/${ref}/affected`);
  expect(one.status, JSON.stringify(one.json)).toBe(200);
  expect(one.json.data.affected_count).toBe(1);
  const twice = await api(b.request, "POST", `/issues/${ref}/affected`);
  expect(twice.json.data.affected_count).toBe(1);
  expect((await api(a.request, "GET", `/issues/${ref}`)).json.data.affected_count).toBe(1);
  await api(b.request, "POST", "/me/follows", { type: "issue", target: ref });

  const before = (await api(b.request, "GET", "/me/notifications")).json.data ?? [];
  expect((await api(office.request, "POST", `/office/issues/${ref}/acknowledge`, { message: "পেয়েছি, কাজ হবে।" })).status).toBe(200);
  const after = (await api(b.request, "GET", "/me/notifications")).json.data ?? [];
  expect(after.length).toBeGreaterThan(before.length);
  expect(JSON.stringify(after)).toContain(ref);

  // Withdrawing brings the count back; the second withdrawal changes nothing.
  expect((await api(b.request, "DELETE", `/issues/${ref}/affected`)).status).toBe(200);
  expect((await api(b.request, "DELETE", `/issues/${ref}/affected`)).status).toBe(200);
  expect((await api(a.request, "GET", `/issues/${ref}`)).json.data.affected_count).toBe(0);
});

test("15. a citizen rates a resolved case, then appeals; the case cannot close before the office responds", async () => {
  const ref = await submitIssue(a.request, w, { title: "নলকূপ নষ্ট" });
  await resolveIssue(office.request, ref);
  const rate = await api(a.request, "POST", `/issues/${ref}/feedback`, { rating: 2, comment: "ঠিকমতো হয়নি" });
  expect(rate.status, JSON.stringify(rate.json)).toBe(201);
  const appeal = await api(a.request, "POST", `/issues/${ref}/reopen`, { reason: "কল এখনও কাজ করছে না, আবার দেখুন।" });
  expect(appeal.status, JSON.stringify(appeal.json)).toBe(200);
  expect((await api(a.request, "GET", `/issues/${ref}`)).json.data.status).toBe("reopened");
  // Closing straight from "reopened" is not allowed: the office has to respond first.
  const early = await api(office.request, "POST", `/office/issues/${ref}/close`, { reason: "বন্ধ" });
  expect(early.status).toBe(409);
  expect(early.json.code).toBe("invalid_transition");
  // Office responds and resolves again; only then can it be closed (with a reason inside the review period).
  expect((await api(office.request, "POST", `/office/issues/${ref}/acknowledge`, { message: "আবার দেখা হচ্ছে।" })).status).toBe(200);
  const fix = await api(office.request, "POST", `/office/issues/${ref}/resolve`, { resolution_note: "নলকূপ মেরামত করা হয়েছে।", evidence_url: "https://example.test/e/tubewell.jpg" });
  expect(fix.status, JSON.stringify(fix.json)).toBe(200);
  const close = await api(office.request, "POST", `/office/issues/${ref}/close`, { reason: "নাগরিক সন্তুষ্ট, কাজ শেষ।" });
  expect(close.status, JSON.stringify(close.json)).toBe(200);
  expect((await api(a.request, "GET", `/issues/${ref}`)).json.data.status).toBe("closed");

  // A rejected issue can be appealed too, with no time limit.
  const rejected = await submitIssue(a.request, w, { title: "অন্য এলাকার সমস্যা" });
  expect((await api(office.request, "POST", `/office/issues/${rejected}/reject`, { reason: "এই এলাকার বাইরে", appeal_route: "জেলা প্রশাসকের কার্যালয়" })).status).toBe(200);
  expect((await api(a.request, "POST", `/issues/${rejected}/reopen`, { reason: "এটি আমার এলাকার ভেতরেই পড়ে।" })).status).toBe(200);
});
