import { expect, test } from "@playwright/test";

test.describe("golden path smoke", () => {
  test("home loads in Bangla with a report call to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    await expect(page.getByRole("link", { name: "সমস্যা জানান" }).first()).toBeVisible();
  });

  test("phone shows the bottom tab bar, desktop shows the top nav links", async ({ page, isMobile }) => {
    await page.goto("/");
    const tabs = page.locator("nav").filter({ has: page.getByRole("link", { name: "আমি" }) });
    if (isMobile) await expect(tabs.first()).toBeVisible();
    else await expect(page.getByRole("navigation").first().getByRole("link", { name: "এলাকা" })).toBeVisible();
  });

  test("reporting needs sign-in: signed-out visitors land on the sign-in form", async ({ page }) => {
    await page.goto("/report");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("ইমেইল")).toBeVisible();
  });

  test("language switch changes the page to English", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /language|ভাষা/i }).first().click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("office is guarded: signed-out visitors are sent to sign-in and returned afterwards", async ({ page }) => {
    await page.goto("/office");
    await expect(page).toHaveURL(/\/login\?need=1&next=%2Foffice/);
    await expect(page.getByRole("heading", { name: "সাইন ইন দরকার" })).toBeVisible();
  });

  test("no horizontal scroll at this width", async ({ page }) => {
    for (const path of ["/", "/report", "/me", "/login"]) {
      await page.goto(path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("phase 2 public pages", () => {
  test("explore: loads the public list from the API, sample banner, search narrows the list, map tab opens", async ({ page }) => {
    const item = (ref: string, title: string, lat: number) => ({ ref, title, category: "drainage", description: "d", area: "ওয়ার্ড ২", status: "submitted", legacy_status: "received", created_at: "2026-11-10T06:00:00Z", summary: null, similar_refs: [], constituency: "demo-1", is_sample: true, affected_count: 3, location: { lat, lng: 90.4, approximate: true } });
    await page.route("**/api/v1/issues?**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [item("JK-S-1", "ড্রেন বন্ধ হয়ে আছে", 23.8), item("JK-S-2", "রাস্তায় গর্ত", 23.81)], page: { next_cursor: null, limit: 50 }, request_id: "t" }) }));
    await page.goto("/area");
    await expect(page.getByText("নমুনা: এখানকার").first()).toBeVisible();
    await expect(page.getByText("২টি সমস্যা পাওয়া গেছে")).toBeVisible();
    await page.getByLabel("খুঁজুন").fill("ড্রেন");
    await expect(page.getByText("১টি সমস্যা পাওয়া গেছে")).toBeVisible();
    await page.getByLabel("খুঁজুন").fill("zzzz");
    await expect(page.getByRole("heading", { name: "কিছু মেলেনি" })).toBeVisible();
    await page.getByRole("tab", { name: "মানচিত্র" }).click();
    await expect(page.getByRole("region", { name: /সমস্যার মানচিত্র/ })).toBeVisible();
  });

  test("ideas: loads from the API, sample banner, tabs switch, support needs sign-in, new idea needs sign-in", async ({ page }) => {
    const idea = (ref: string, title: string, status: string) => ({ ref, constituency_key: "demo-1", category: "facilities", title, body: "বিবরণ", status, decision_note: null, created_at: "2026-11-10T06:00:00Z", is_sample: true, support_count: 7 });
    await page.route("**/api/v1/ideas?**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [idea("ID-1", "বাজারের পাশে টয়লেট", "under_consideration"), idea("ID-2", "স্কুলের পাশে গতিরোধক", "published")], page: { next_cursor: null, limit: 50 }, request_id: "t" }) }));
    await page.goto("/ideas");
    await expect(page.getByText("নমুনা: এখানকার আইডিয়া").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /আমিও চাই.{0,3} জানাতে সাইন ইন/ }).first()).toBeVisible();
    await page.getByRole("tab", { name: "বিবেচনায়" }).click();
    await expect(page.getByRole("tabpanel").filter({ hasText: "বিবেচনায় আছে" }).first()).toBeVisible();
    await page.getByLabel("আইডিয়া খুঁজুন").fill("zzzz");
    await expect(page.getByRole("heading", { name: "কিছু মেলেনি" })).toBeVisible();
    await page.goto("/ideas/new");
    await expect(page.getByRole("link", { name: "সাইন ইন" }).first()).toBeVisible();
  });

  test("find your MP: area search shows a labelled card; border ward asks to confirm; profile shows period and no ranking", async ({ page }) => {
    await page.goto("/mp");
    await page.getByLabel("আপনার এলাকা বা ওয়ার্ডের নাম লিখুন").fill("ওয়ার্ড ৩");
    await expect(page.getByRole("heading", { name: "নমুনা জনপ্রতিনিধি ১" })).toBeVisible();
    await page.getByLabel("আপনার এলাকা বা ওয়ার্ডের নাম লিখুন").fill("ওয়ার্ড ৫");
    await expect(page.getByText("দুটি নির্বাচনী এলাকার সীমানায়")).toBeVisible();
    await page.goto("/mp/rep-demo-1");
    await expect(page.getByText("সময়কাল:")).toBeVisible();
    await expect(page.getByText("র‍্যাঙ্কিং করা হয় না")).toBeVisible();
    await page.getByRole("link", { name: "এই সংখ্যা কীভাবে হিসাব করা হয়" }).click();
    await expect(page).toHaveURL(/\/mp\/method/);
    await page.goto("/mp/unknown");
    await expect(page.getByRole("heading", { name: "পাতাটি পাওয়া যায়নি" })).toBeVisible();
  });

  test("onboarding walks three screens and can be skipped; help and privacy are reachable from the footer", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page.getByRole("heading", { name: "সমস্যা জানান" })).toBeVisible();
    await page.getByRole("button", { name: "পরের ধাপ" }).click();
    await page.getByRole("button", { name: "পরের ধাপ" }).click();
    await expect(page.getByRole("link", { name: "শুরু করুন" })).toBeVisible();
    await page.getByRole("link", { name: "শুরু করুন" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByText("জনকথায় নতুন?")).toHaveCount(0);
    await page.getByRole("link", { name: "সাহায্য" }).last().click();
    await expect(page.getByRole("heading", { name: "সাহায্য ও নিরাপত্তা" })).toBeVisible();
    await expect(page.getByText("৯৯৯")).toBeVisible();
  });

  test("notifications are labelled sample; settings can clear device data", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByText("নমুনা: নিচের নোটিফিকেশনগুলো")).toBeVisible();
    await page.getByRole("button", { name: "সব পড়া হয়েছে চিহ্নিত করুন" }).click();
    await expect(page.getByText("নতুন", { exact: true })).toHaveCount(0);
    await page.goto("/settings");
    await page.getByRole("button", { name: "এই ডিভাইসের তথ্য মুছুন" }).click();
    await page.getByRole("button", { name: "হ্যাঁ, মুছুন" }).click();
    await expect(page.getByText("এই ডিভাইসের তথ্য মুছে ফেলা হয়েছে।")).toBeVisible();
  });

  test("admin and office announcements are guarded for signed-out visitors", async ({ page }) => {
    for (const path of ["/admin", "/admin/moderation", "/office/announcements"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?need=1&next=${encodeURIComponent(path).replace(/%/g, "%")}`));
    }
  });
});
