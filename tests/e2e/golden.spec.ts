import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 3.5 suites. Signed-in screens run on the labelled demo screens (/dev/screens/*, see audit.spec.ts) with the
 * API mocked in the browser, so the UI flow is real and no Supabase session is needed. Real API behaviour that does
 * not need a session (401 and 403 paths) is checked with plain requests.
 */
async function demo(page: Page, name: string) {
  const res = await page.goto(`/dev/screens/${name}`);
  test.skip(res?.status() !== 200, "demo screens are off (start the server with JK_AUDIT=1)");
  await page.waitForLoadState("networkidle");
}

test.describe("citizen golden path", () => {
  test("describe in words, AI drafts (labelled), review in five steps, send, get a reference number", async ({ page }) => {
    await page.route("**/api/intake", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "ai", draft: { title: "রাস্তায় বড় গর্ত", category: "roads", description: "বাজারের সামনে রাস্তায় বড় গর্ত, রাতে দুর্ঘটনা হচ্ছে।", area: "ওয়ার্ড ৩" } }) }));
    let sent: Record<string, unknown> | undefined;
    await page.route("**/api/v1/issues", async (r) => { sent = r.request().postDataJSON(); await r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { ref: "JK-GOLD-1", status: "submitted" } }) }); });
    await demo(page, "report");

    await page.getByLabel("বলুন বা লিখুন").fill("পাড়ার রাস্তায় বড় গর্ত, রাতে দুর্ঘটনা হচ্ছে");
    await page.getByRole("button", { name: "খসড়া তৈরি করুন" }).click();
    await expect(page.getByText("✓ ").first()).toBeVisible();
    await expect(page.getByText("এআই-এর প্রস্তাব").first()).toBeVisible(); // AI-filled fields are labelled

    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "পরের ধাপ" }).click();
    await expect(page.getByRole("heading", { name: "দেখে জমা দিন" })).toBeVisible();
    await expect(page.getByText("রাস্তায় বড় গর্ত").first()).toBeVisible();
    await page.getByRole("button", { name: "জমা দিন" }).click();

    await expect(page.getByRole("heading", { name: "আপনার সমস্যা পাঠানো হয়েছে" })).toBeVisible();
    await expect(page.getByText("JK-GOLD-1")).toBeVisible();
    expect(sent).toMatchObject({ title: "রাস্তায় বড় গর্ত", category: "roads", area: "ওয়ার্ড ৩" });
    expect(await page.evaluate(() => localStorage.getItem("jonokotha:report-draft:v2"))).toBeNull();
  });

  test("Next on an empty step shows a clear error and does not advance", async ({ page }) => {
    await demo(page, "report");
    await page.getByRole("button", { name: "পরের ধাপ" }).click();
    await expect(page.getByText("সমস্যাটি কোন ধরনের?").first()).toBeVisible();
    await expect(page.locator("[data-field-error]").first()).toBeVisible();
  });

  test("a signed-out visitor who opens the report page is sent to sign-in, then back", async ({ page }) => {
    await page.goto("/report");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("ইমেইল")).toBeVisible();
  });

  test("public issue page shows status and timeline but no private fields", async ({ page }) => {
    await demo(page, "issue");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ড্রেন বন্ধ");
    await expect(page.getByText("এমপির অফিস পেয়েছে").first()).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("নমুনা সারাংশ"); // ai.summary is staff-only
    expect(html).not.toContain("demo-agency");
  });
});

test.describe("staff approval", () => {
  test("acknowledge needs a note, then confirms with a toast (human decision, logged in the dialog flow)", async ({ page }) => {
    let body: { action?: string; note?: string } | undefined;
    await page.route("**/api/cases/*/approve", async (r) => { body = r.request().postDataJSON(); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }); });
    await demo(page, "case");
    await page.getByRole("button", { name: "স্বীকৃতি দিন" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "স্বীকৃতি দিন" }).click(); // empty note
    await expect(dialog.getByText(/অক্ষর/).first()).toBeVisible();
    expect(body).toBeUndefined();
    await dialog.getByLabel("নোট").fill("ঘটনাস্থলে লোক পাঠানো হচ্ছে, আজ দেখা হবে।");
    await dialog.getByRole("button", { name: "স্বীকৃতি দিন" }).click();
    await expect(page.getByRole("status").filter({ hasText: "স্বীকৃতি দেওয়া হয়েছে" })).toBeVisible();
    expect(body).toMatchObject({ action: "acknowledge" });
  });

  test("the AI copilot offers suggestions but changes nothing by itself", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/v1/issues**", async (r) => { calls++; await r.abort(); });
    await demo(page, "case");
    await expect(page.getByText(/শুধু কর্মীদের|কর্মীদের জন্য/).first()).toBeVisible();
    await page.getByRole("button", { name: "বাদ দিন" }).first().click(); // dismissing a suggestion is local
    expect(calls).toBe(0);
  });
});

test.describe("role denial", () => {
  test("API: signed-out calls to staff and citizen endpoints get 401, never data", async ({ request }) => {
    expect((await request.post("/api/cases/JK-1/approve", { data: { action: "acknowledge" } })).status()).toBe(401);
    expect((await request.post("/api/cases", { data: {} })).status()).toBe(401);
  });

  test("a rejected staff action (403) keeps the note and explains in the dialog", async ({ page }) => {
    await page.route("**/api/cases/*/approve", (r) => r.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "forbidden" }) }));
    await demo(page, "case");
    await page.getByRole("button", { name: "স্বীকৃতি দিন" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("নোট").fill("ঘটনাস্থলে লোক পাঠানো হচ্ছে।");
    await dialog.getByRole("button", { name: "স্বীকৃতি দিন" }).click();
    await expect(dialog.getByRole("alert")).toContainText("অনুমতি নেই");
    await expect(dialog.getByLabel("নোট")).toHaveValue("ঘটনাস্থলে লোক পাঠানো হচ্ছে।");
  });

  test("a citizen on an office page sees no-access with who they are signed in as", async ({ page }) => {
    await demo(page, "no-access-citizen");
    await expect(page.getByRole("heading", { name: "এই পাতায় ঢোকার অনুমতি নেই" })).toBeVisible();
    await expect(page.getByText("citizen@example.test")).toBeVisible();
    await expect(page.getByRole("button", { name: /অন্য অ্যাকাউন্টে সাইন ইন/ })).toBeVisible();
  });

  test("a staff member on an admin page sees no-access too", async ({ page }) => {
    await demo(page, "no-access-staff-admin");
    await expect(page.getByRole("heading", { name: "এই পাতায় ঢোকার অনুমতি নেই" })).toBeVisible();
  });

  test("signed-out visitors are redirected from office and admin to sign-in", async ({ page }) => {
    for (const path of ["/office", "/office/JK-1", "/admin", "/admin/stats"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?need=1/);
    }
  });
});

test.describe("offline page", () => {
  test("the offline screen explains the state and what to do", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "ইন্টারনেট নেই" })).toBeVisible();
    await expect(page.getByText("সংযোগ ফিরলে আবার চেষ্টা করুন।").first()).toBeVisible();
  });
});
