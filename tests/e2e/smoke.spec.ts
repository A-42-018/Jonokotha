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
