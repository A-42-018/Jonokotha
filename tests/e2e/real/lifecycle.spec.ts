import { expect, test, type BrowserContext } from "@playwright/test";
import { api, buildWorld, dropWorld, gotoOk, latestCode, skipUnlessReal, sessionFor, submitIssue, uploadPhoto, type World } from "./support";

/**
 * Masterplan §21.3 scenarios 1-8: one issue travels from registration to feedback, on the real API and a local Supabase.
 * The steps depend on each other, so they run in order (serial) inside one world, at 375px and at 1280px.
 */
test.describe.configure({ mode: "serial" });

const INTERNAL = "ভেতরের নোট: ঠিকাদারকে ফোন করতে হবে";
const PUBLIC = "আমরা কাজ শুরু করেছি, দুই দিনের মধ্যে ভরাট হবে।";

let w: World;
let citizen: BrowserContext, office: BrowserContext, anon: BrowserContext;
let ref = "";

test.beforeAll(async ({ browser }, info) => {
  skipUnlessReal();
  w = await buildWorld(info);
  citizen = await sessionFor(browser, info, w.accounts.citizenA);
  office = await sessionFor(browser, info, w.accounts.officeA);
  anon = await sessionFor(browser, info, null);
});
test.afterAll(async () => {
  await Promise.all([citizen?.close(), office?.close(), anon?.close()]);
  if (w) await dropWorld(w);
});

test("1. a citizen registers with an email code and selects a constituency", async ({ browser }, info) => {
  const ctx = await sessionFor(browser, info, null);
  const page = await ctx.newPage();
  const email = `e2e-new-${Date.now().toString(36)}@example.test`;
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  const code = await latestCode(email);
  test.skip(!code, "the local mail catcher (Mailpit, port 54324) is not reachable");
  await page.getByLabel("Code from your email").fill(code!);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/report/);
  // First sign-in asks once for the constituency; the choice is stored and shown in the header.
  const dialog = page.getByRole("dialog", { name: "Choose your constituency" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Sample Constituency/ }).click();
  await expect(dialog).toBeHidden();
  expect((await ctx.cookies()).find((c) => c.name === "constituency")?.value).toBe("demo-1");
  await expect(page.getByRole("button", { name: /Sample Constituency/ }).first()).toBeVisible();
  // The new account exists and is a citizen, not staff.
  const { data } = await w.admin.from("profiles").select("role").eq("id", (await w.admin.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === email)!.id).single();
  expect(data?.role).toBe("citizen");
  await w.admin.auth.admin.deleteUser((await w.admin.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === email)!.id);
  await ctx.close();
});

test("2. a citizen submits a report with a map pin and a photo", async () => {
  ref = await submitIssue(citizen.request, w);
  expect(ref).toMatch(/^JK-/);
  const up = await uploadPhoto(citizen.request, ref, "গর্তের ছবি");
  expect(up.status, JSON.stringify(up.json)).toBe(201);
  // Public view: the point is approximate (grid cell), never the exact pin.
  const pub = await api(anon.request, "GET", `/issues/${ref}`);
  expect(pub.status).toBe(200);
  expect(pub.json.data.location?.approximate).toBe(true);
  expect(JSON.stringify(pub.json)).not.toContain("23.7808");
  // The photo is private and pending, so a visitor gets none of it.
  expect((await api(anon.request, "GET", `/issues/${ref}/media`)).json.data ?? []).toHaveLength(0);
  expect(((await api(citizen.request, "GET", `/issues/${ref}/media`)).json.data ?? []).length).toBe(1);
});

test("3. the citizen sees the reference number and a status timeline", async () => {
  const page = await citizen.newPage();
  await page.goto(`/issue/${ref}`);
  await expect(page.getByText(ref).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("রাস্তায় বড় গর্ত");
  await expect(page.locator("ol, ul").filter({ hasText: /received|submitted/i }).first()).toBeVisible();
  const { json } = await api(citizen.request, "GET", `/issues/${ref}`);
  expect(json.data.status).toBe("submitted");
  expect(json.data.timeline[0].status).toBe("submitted");
  await page.close();
});

test("4. the office manager acknowledges and assigns the report", async () => {
  const q = await api(office.request, "GET", "/office/issues");
  expect(q.status).toBe(200);
  expect(JSON.stringify(q.json.data)).toContain(ref);
  const ack = await api(office.request, "POST", `/office/issues/${ref}/acknowledge`, { message: "আপনার অভিযোগ পেয়েছি।" });
  expect(ack.status, JSON.stringify(ack.json)).toBe(200);
  const asg = await api(office.request, "POST", `/office/issues/${ref}/assign`, { assignee: w.accounts.officeA.id, reason: "এলাকার দায়িত্বে" });
  expect(asg.status, JSON.stringify(asg.json)).toBe(200);
  const page = await office.newPage();
  await page.goto("/office");
  await expect(page.getByText(ref).first()).toBeVisible();
  await page.goto(`/office/${ref}`);
  await expect(page.getByText(ref).first()).toBeVisible();
  await page.close();
  const detail = await api(office.request, "GET", `/office/issues/${ref}`);
  expect(detail.json.data.status).toBe("assigned");
});

test("5. staff add a public update and a private note; the citizen sees only the update", async () => {
  expect((await api(office.request, "POST", `/office/issues/${ref}/update`, { note: INTERNAL })).status).toBe(201);
  const pubUpdate = await api(office.request, "POST", `/office/issues/${ref}/update`, { note: PUBLIC, public: true });
  expect(pubUpdate.status, JSON.stringify(pubUpdate.json)).toBe(201);
  const forCitizen = JSON.stringify((await api(citizen.request, "GET", `/issues/${ref}`)).json);
  expect(forCitizen).toContain(PUBLIC);
  expect(forCitizen).not.toContain(INTERNAL);
  const forVisitor = JSON.stringify((await api(anon.request, "GET", `/issues/${ref}`)).json);
  expect(forVisitor).toContain(PUBLIC);
  expect(forVisitor).not.toContain(INTERNAL);
  expect(JSON.stringify((await api(office.request, "GET", `/office/issues/${ref}`)).json)).toContain(INTERNAL);
  const page = await citizen.newPage();
  await gotoOk(page, `/issue/${ref}`);
  await expect(page.getByText(PUBLIC).first()).toBeVisible();
  await expect(page.getByText(INTERNAL)).toHaveCount(0);
  await page.close();
});

test("6. staff forward it and record the external reference", async () => {
  const r = await api(office.request, "POST", `/office/issues/${ref}/forward`, { agency_name: "সড়ক ও জনপথ বিভাগ (নমুনা)", external_reference: "RHD-E2E-001", notes: "ফোনে জানানো হয়েছে" });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  const detail = (await api(office.request, "GET", `/office/issues/${ref}`)).json.data;
  expect(detail.status).toBe("referred_to_authority");
  expect(JSON.stringify(detail.referrals ?? detail)).toContain("RHD-E2E-001");
  // The citizen sees that it was forwarded, in the status; the wording never claims it was "officially registered".
  const pub = (await api(citizen.request, "GET", `/issues/${ref}`)).json.data;
  expect(pub.status).toBe("referred_to_authority");
});

test("7. the office resolves it with evidence", async () => {
  expect((await api(office.request, "POST", `/office/issues/${ref}/update`, { status: "in_progress" })).status).toBe(200);
  const r = await api(office.request, "POST", `/office/issues/${ref}/resolve`, { resolution_note: "গর্ত ভরাট করা হয়েছে।", evidence_url: "https://example.test/evidence/fixed.jpg" });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  const pub = (await api(anon.request, "GET", `/issues/${ref}`)).json.data;
  expect(pub.status).toBe("resolved");
  const { data: events } = await w.admin.from("issue_events").select("to_status").eq("issue_id", (await w.admin.from("issues").select("id").eq("ref", ref).single()).data!.id);
  expect(events?.map((e) => e.to_status)).toEqual(expect.arrayContaining(["acknowledged", "assigned", "referred_to_authority", "in_progress", "resolved"]));
});

test("8. the citizen gives feedback, once; an unresolved citizen can reopen", async () => {
  const fb = await api(citizen.request, "POST", `/issues/${ref}/feedback`, { rating: 4, comment: "কাজ হয়েছে, ধন্যবাদ" });
  expect(fb.status, JSON.stringify(fb.json)).toBe(201);
  expect((await api(citizen.request, "POST", `/issues/${ref}/feedback`, { rating: 5 })).status).toBe(409); // once per issue
  // A second issue the citizen says is not fixed: reopen with a reason.
  const second = await submitIssue(citizen.request, w, { title: "ড্রেন আবার বন্ধ" });
  const ok = await api(office.request, "POST", `/office/issues/${second}/acknowledge`, { message: "পেয়েছি" });
  expect(ok.status).toBe(200);
  expect((await api(office.request, "POST", `/office/issues/${second}/resolve`, { resolution_note: "পরিষ্কার করা হয়েছে", evidence_url: "https://example.test/e/2.jpg" })).status).toBe(200);
  const re = await api(citizen.request, "POST", `/issues/${second}/reopen`, { reason: "এখনও পানি জমে আছে, সমস্যা মেটেনি।" });
  expect(re.status, JSON.stringify(re.json)).toBe(200);
  expect((await api(citizen.request, "GET", `/issues/${second}`)).json.data.status).toBe("reopened");
  const page = await citizen.newPage();
  await page.goto(`/issue/${ref}`);
  await expect(page.getByText(ref).first()).toBeVisible();
  await page.close();
});
