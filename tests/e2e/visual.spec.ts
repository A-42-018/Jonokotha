import { expect, test, type Page } from "@playwright/test";

/**
 * Visual regression (Phase 3.5): key screens at 375 and 1280, Bangla, deterministic data only (labelled demo screens
 * with fixed dates, and static pages). Baselines live in tests/e2e/visual.spec.ts-snapshots and were made on macOS;
 * text anti-aliasing differs per OS, so other platforms skip unless VISUAL=1 (then add their own with --update-snapshots).
 * Update after an intended UI change:  PW_PORT=3100 npx playwright test visual --update-snapshots
 */
test.skip(process.platform !== "darwin" && !process.env.VISUAL, "visual baselines are per OS; set VISUAL=1 and create them with --update-snapshots");

const SCREENS: [string, string][] = [
  ["login", "/login"],
  ["offline", "/offline"],
  ["help", "/help"],
  ["mp-method", "/mp/method"],
  ["report-wizard", "/dev/screens/report"],
  ["issue", "/dev/screens/issue"],
  ["office-overview", "/dev/screens/office"],
  ["office-case", "/dev/screens/case"],
  ["admin-verification", "/dev/screens/admin-verification"],
  ["no-access", "/dev/screens/no-access-citizen"],
];

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

for (const [name, path] of SCREENS) {
  test(`visual: ${name}`, async ({ page }) => {
    const res = await page.goto(path);
    test.skip(res?.status() !== 200, "demo screens are off (start the server with JK_AUDIT=1)");
    await settle(page);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.015 });
  });
}

test("visual: English sign-in page keeps its layout", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "lang", value: "en", url: baseURL! }]);
  await page.goto("/login");
  await settle(page);
  await expect(page).toHaveScreenshot("login-en.png", { fullPage: true, animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.015 });
});
