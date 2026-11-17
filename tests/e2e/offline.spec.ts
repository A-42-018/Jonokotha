import { expect, test } from "@playwright/test";

const DRAFT = { quick: "", values: { title: "রাস্তায় বড় গর্ত", description: "বাজারের সামনে রাস্তায় বড় গর্ত, রিকশা উল্টে যায়।", area: "ওয়ার্ড ৩", category: "roads" }, ai: [], edited: [], step: 4 };

test.describe("offline and resilience", () => {
  test("offline banner appears when the connection drops and confirms when it is back", async ({ page, context }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await context.setOffline(true);
    await expect(page.getByRole("status").filter({ hasText: "আপনি অফলাইনে আছেন" })).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByRole("status").filter({ hasText: "আবার অনলাইনে এসেছেন" })).toBeVisible();
  });

  test("a report submitted with no signal is saved on the phone, then sent when the connection returns", async ({ page, context }) => {
    const res = await page.goto("/dev/screens/report");
    test.skip(res?.status() !== 200, "demo screens are off (start the server with JK_AUDIT=1)");
    await page.evaluate((d) => localStorage.setItem("jonokotha:report-draft:v2", JSON.stringify(d)), DRAFT);
    await page.reload();
    await page.waitForLoadState("networkidle");

    await context.setOffline(true);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole("heading", { name: "সমস্যাটি ফোনে রাখা হয়েছে" })).toBeVisible();
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem("jonokotha:report-queue:v1") ?? "[]"));
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ title: "রাস্তায় বড় গর্ত", state: "queued" });
    expect(await page.evaluate(() => localStorage.getItem("jonokotha:report-draft:v2"))).toBeNull();

    let posted: { key: string | undefined; title: string } | undefined;
    await page.route("**/api/v1/issues", async (route) => {
      posted = { key: route.request().headers()["idempotency-key"], title: route.request().postDataJSON().title };
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { ref: "JK-TEST-1", status: "submitted" } }) });
    });
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText("ফোনে রাখা সমস্যা পাঠানো হয়েছে। সমস্যা নম্বর: JK-TEST-1")).toBeVisible();
    expect(posted).toEqual({ key: queued[0].id, title: "রাস্তায় বড় গর্ত" });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jonokotha:report-queue:v1") ?? "[]"))).toEqual([]);
  });

  test("a queued report can be discarded from My Reports after confirming", async ({ page }) => {
    await page.route("**/api/v1/issues", (route) => route.abort("internetdisconnected")); // still no signal: the report stays queued
    await page.goto("/me");
    await page.evaluate(() => localStorage.setItem("jonokotha:report-queue:v1", JSON.stringify([{ id: "q1", title: "ড্রেন বন্ধ", body: {}, queuedAt: "2026-12-14T06:00:00Z", state: "queued" }])));
    await page.reload();
    await expect(page.getByRole("heading", { name: "পাঠানোর অপেক্ষায়" })).toBeVisible();
    await expect(page.getByText("ইন্টারনেট এলে পাঠানো হবে")).toBeVisible();
    await page.getByRole("button", { name: "বাদ দিন" }).click();
    await page.getByRole("button", { name: "হ্যাঁ, বাদ দিন" }).click();
    await expect(page.getByRole("heading", { name: "পাঠানোর অপেক্ষায়" })).toHaveCount(0);
  });

  test("a rendering error shows the route error screen with retry, inside the app shell", async ({ page }) => {
    const res = await page.goto("/dev/screens/boom");
    test.skip(res?.status() === 404 || res?.status() === undefined, "demo screens are off (start the server with JK_AUDIT=1)");
    await expect(page.getByRole("heading", { name: "কিছু একটা ঠিকমতো হয়নি" })).toBeVisible();
    await expect(page.getByRole("button", { name: "আবার চেষ্টা করুন" })).toBeVisible();
    await expect(page.getByRole("link", { name: "হোম" }).first()).toBeVisible(); // header/tab bar survived
  });

  test("with the service worker active, an offline navigation shows the offline page, and the cache is versioned", async ({ page, context }) => {
    await page.goto("/");
    const reg = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return null;
      const r = await Promise.race([navigator.serviceWorker.ready, new Promise((res) => setTimeout(() => res(null), 4000))]);
      return r ? (r as ServiceWorkerRegistration).active?.scriptURL ?? null : null;
    });
    test.skip(!reg, "the service worker is registered in production builds only");
    expect(reg).toMatch(/\/sw\.js\?v=[\w-]+$/);
    await page.reload(); // the worker now controls the page
    await context.setOffline(true);
    await page.goto("/area").catch(() => {});
    await expect(page.getByRole("heading", { name: "ইন্টারনেট নেই" })).toBeVisible();
    const keys = await page.evaluate(() => caches.keys());
    expect(keys.filter((k) => k.startsWith("jk-"))).toHaveLength(1);
  });
});
