import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mock } from "./r11-mocks";

/**
 * Release 1.1 screens (F7.*) with the API mocked in the browser, like golden.spec.ts: no Supabase session needed.
 * Needs the flags, so start with `PW_RELEASE11=1 PW_REUSE_SERVER=0 npm run test:e2e -- tests/e2e/release11.spec.ts` (npm run test:e2e:r11 does it).
 * Checks: axe (WCAG 2 A/AA, 2.1 A/AA) in light and dark, Bangla and English, at 375 and 1280 px; no sideways scrolling; scenarios 16 and 17 as a visitor sees them.
 */
test.skip(process.env.PW_RELEASE11 !== "1", "the Release 1.1 flags are off in this run");

const PAGES = ["/consultations", "/consultations/CN-DEMO", "/consultations/CN-DEMO/report", "/commitments", "/commitments/CM-DEMO", "/priorities", "/polls", "/help/channels", "/ideas/ID-DEMO", "/settings"];

for (const theme of ["light", "dark"] as const) {
  for (const lang of ["bn", "en"] as const) {
    test(`axe and layout: Release 1.1 pages in ${theme}, ${lang}`, async ({ page, context }) => {
      test.setTimeout(300_000);
      await context.addCookies([{ name: "lang", value: lang, url: `http://localhost:${process.env.PW_PORT ?? 3000}` }]);
      await page.addInitScript((t) => localStorage.setItem("jonokotha:theme:v1", JSON.stringify(t)), theme);
      await mock(page);
      for (const path of PAGES) {
        await page.goto(path, { waitUntil: "load" });
        await page.waitForLoadState("networkidle");
        if (theme === "dark") await expect(page.locator("html"), path).toHaveAttribute("data-theme", "dark");
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${path} ${v.id}: ${v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} ${n.html.slice(0, 140)}`).join(" | ")}`), path).toEqual([]);
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(wide, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
      }
    });
  }
}

test("scenario 16 as a visitor sees it: groups above the minimum, statement figures hidden when too few, nothing about individuals", async ({ page }) => {
  await page.context().addCookies([{ name: "lang", value: "bn", url: `http://localhost:${process.env.PW_PORT ?? 3000}` }]);
  await mock(page);
  await page.goto("/consultations/CN-DEMO/report");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("আপনারা বললেন");
  await expect(page.getByText("মোট ১৪ জন অংশ নিয়েছেন")).toBeVisible();
  await expect(page.getByText(/ছোট দল ৫ জনের কম বলে দেখানো হয়নি/)).toBeVisible();
  await expect(page.getByText("দুই দলের মত আলাদা")).toBeVisible();
  const small = page.locator("li", { hasText: "নালা পরিষ্কার আগে হোক" });
  await expect(small.getByText(/উত্তর ৫টির কম/)).toBeVisible();
  await expect(small.getByText(/%/)).toHaveCount(0);
  // Voting is for signed-in people: a visitor is asked to sign in, and no statement figures are on the voting page.
  await page.goto("/consultations/CN-DEMO");
  await expect(page.getByRole("link", { name: "সাইন ইন করুন" })).toBeVisible();
  await expect(page.getByRole("button", { name: "একমত" })).toHaveCount(0);
  await expect(page.getByText(/%/)).toHaveCount(0);
});

test("scenario 17 as a visitor sees it: progress to the threshold, the due date and the public overdue label", async ({ page }) => {
  await page.context().addCookies([{ name: "lang", value: "bn", url: `http://localhost:${process.env.PW_PORT ?? 3000}` }]);
  await mock(page);
  await page.goto("/ideas/ID-DEMO");
  await expect(page.getByText("অফিসের উত্তরের সীমা")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByText("সীমা পূরণ হয়েছে")).toBeVisible();
  await expect(page.getByText("অফিস উত্তর দিতে দেরি করেছে")).toBeVisible();
  await expect(page.getByText(/উত্তরের শেষ দিন ছিল/)).toBeVisible();
  // For and against points replace the comment thread when the server has them on.
  await page.getByRole("button", { name: "পক্ষে-বিপক্ষের কথা দেখুন" }).click();
  await expect(page.getByText("রাতে নিরাপদ হবে")).toBeVisible();
  await expect(page.getByText("খরচ বেশি")).toBeVisible();
  await expect(page.getByRole("button", { name: "মন্তব্য দেখুন" })).toHaveCount(0);
});

test("the navigation shows the Release 1.1 links only with the flags on, and nothing leaks to the phone tab bar", async ({ page, isMobile }) => {
  await page.context().addCookies([{ name: "lang", value: "bn", url: `http://localhost:${process.env.PW_PORT ?? 3000}` }]);
  await mock(page);
  await page.goto("/");
  await expect(page.locator('main a[href="/commitments"]')).toBeVisible();
  await expect(page.locator('main a[href="/priorities"]')).toBeVisible();
  await expect(page.locator('main a[href="/consultations"]')).toBeVisible();
  // The phone tab bar keeps its five cells; the new pages are reached from the home list, not from the bar.
  if (isMobile) await expect(page.locator('nav.fixed a')).toHaveCount(5);
});
