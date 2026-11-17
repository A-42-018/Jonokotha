import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mock } from "./r2-mocks";

/**
 * Release 2 screens (F8.*) with the API mocked in the browser, like release11.spec.ts: no Supabase session needed.
 * Needs the flags, so start with `npm run test:e2e:r2` (it sets PW_RELEASE2=1 and starts its own server on port 3200).
 * Checks: axe (WCAG 2 A/AA, 2.1 A/AA) in Bangla and English at 375 and 1280 px, no sideways scrolling, and what a visitor sees on each page.
 */
test.skip(process.env.PW_RELEASE2 !== "1", "the Release 2 flags are off in this run");

const PAGES = ["/transparency", "/budget", "/budget?project=PR-DEMO", "/budgeting", "/budgeting/PB-DEMO", "/open-data", "/open-data/issues-monthly", "/rti", "/mp-records", "/volunteer", "/volunteer/consent"];
const base = () => `http://localhost:${process.env.PW_PORT ?? 3200}`;

for (const lang of ["bn", "en"] as const) {
  test(`axe and layout: Release 2 pages in ${lang}`, async ({ page, context }) => {
    test.setTimeout(300_000);
    await context.addCookies([{ name: "lang", value: lang, url: base() }]);
    await mock(page);
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${path} ${v.id}: ${v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} ${n.html.slice(0, 140)}`).join(" | ")}`), path).toEqual([]);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(wide, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
    }
  });
}

test("budget: every figure shows its document, page and link, and no total is drawn", async ({ page }) => {
  await page.context().addCookies([{ name: "lang", value: "bn", url: base() }]);
  await mock(page);
  await page.goto("/budget");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("বাজেট ও ব্যয়");
  await expect(page.getByText(/কোনো অঙ্ক যোগ, অনুমান বা তুলনা করে না/)).toBeVisible();
  const card = page.locator("article", { hasText: "বরাদ্দ" }).first();
  await expect(card.getByText(/পৃষ্ঠা ১৪/)).toBeVisible();
  await expect(card.getByRole("link", { name: "বার্ষিক উন্নয়ন কর্মসূচি ২০২৬-২৭" })).toHaveAttribute("href", "https://example.gov.bd/adp.pdf");
  await expect(page.getByText(/মোট (বরাদ্দ|ব্যয়)/)).toHaveCount(0);
});

test("participatory budgeting: advisory label, the office's own pledge, and sign-in before voting", async ({ page }) => {
  await page.context().addCookies([{ name: "lang", value: "bn", url: base() }]);
  await mock(page);
  await page.goto("/budgeting/PB-DEMO");
  await expect(page.getByText("অফিস ফল মানার কথা লিপিবদ্ধ না করা পর্যন্ত এটি শুধু পরামর্শ।").first()).toBeVisible();
  await expect(page.getByText(/জনকথা যাচাই করে না যে অফিস সত্যিই বাজেট নিয়ন্ত্রণ করে/)).toBeVisible();
  await expect(page.getByRole("link", { name: "সাইন ইন করুন" })).toBeVisible();
  await expect(page.getByRole("button", { name: "আমার ভোট জমা দিন" })).toHaveCount(0);
});

test("MP records: sourced events, no counts, no sort", async ({ page }) => {
  await page.context().addCookies([{ name: "lang", value: "bn", url: base() }]);
  await mock(page);
  await page.goto("/mp-records");
  await expect(page.getByText("সড়ক মেরামত নিয়ে প্রশ্ন")).toBeVisible();
  await expect(page.getByRole("link", { name: "সংসদের নথি খুলুন" })).toBeVisible();
  await expect(page.getByText(/কোনো গুনতি, র‍্যাঙ্ক, রেটিং বা নম্বর নেই/)).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(1);
});

test("open data: licence is marked provisional, credit line, hidden-cells note, downloads", async ({ page }) => {
  await page.context().addCookies([{ name: "lang", value: "bn", url: base() }]);
  await mock(page);
  await page.goto("/open-data/issues-monthly");
  await expect(page.getByText(/আইনজীবী যাচাই করেননি/)).toBeVisible();
  await expect(page.getByText(/৩টি ঘর বাদ দেওয়া হয়েছে/)).toBeVisible();
  await expect(page.getByRole("link", { name: "CSV নামান" })).toHaveAttribute("href", /\/api\/v1\/open-data\/issues-monthly\?format=csv/);
});

test("RTI and volunteer pages: a visitor is asked to sign in and told nothing is filed or stored", async ({ page }) => {
  await page.context().addCookies([{ name: "lang", value: "bn", url: base() }]);
  await mock(page);
  await page.goto("/rti");
  await expect(page.getByText(/জনকথা আপনার হয়ে কিছু জমা দেয় না/)).toBeVisible();
  await expect(page.getByRole("button", { name: "খসড়া তৈরি করুন" })).toHaveCount(0);
  await page.goto("/volunteer");
  await expect(page.getByText(/আমি শুধু ব্যক্তির সম্মতি নিয়ে রিপোর্ট লিখব/)).toBeVisible();
  await expect(page.getByRole("button", { name: "রিপোর্ট জমা দিন" })).toHaveCount(0);
});

test("the hub lists the sections and the phone tab bar is unchanged", async ({ page, isMobile }) => {
  await page.context().addCookies([{ name: "lang", value: "bn", url: base() }]);
  await mock(page);
  await page.goto("/transparency");
  for (const href of ["/budget", "/budgeting", "/open-data", "/mp-records", "/rti", "/volunteer"]) await expect(page.locator(`main a[href="${href}"]`)).toBeVisible();
  if (isMobile) await expect(page.locator("nav.fixed a")).toHaveCount(5);
});
