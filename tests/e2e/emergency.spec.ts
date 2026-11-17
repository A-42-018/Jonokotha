import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Task F.5: when the server flags imminent harm the guidance screen replaces the normal success flow. The API is mocked in
 * the browser (like golden.spec.ts), so no Supabase session is needed; the real server behaviour is tested in tests/api.
 */
const EM = { kind: "violence", guidance: { bn: "প্রাণের ঝুঁকি বা এখনই হামলার আশঙ্কা থাকলে আগে ৯৯৯-এ ফোন করুন।", en: "If anyone's life is at risk or an attack is happening, call 999 first." }, numbers: ["999", "109"] };

async function openReport(page: Page, lang: "bn" | "en") {
  await page.context().addCookies([{ name: "lang", value: lang, url: "http://localhost:3000" }]);
  await page.route("**/api/intake", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "ai", draft: { title: "হুমকি দিচ্ছে", category: "roads", description: "একজন আমাকে মেরে ফেলার হুমকি দিচ্ছে।", area: "ওয়ার্ড ৩" } }) }));
  await page.route("**/api/v1/issues", (r) => r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { ref: "JK-EM-1", status: "submitted", emergency: EM } }) }));
  const res = await page.goto("/dev/screens/report", { waitUntil: "domcontentloaded" });
  test.skip(res?.status() !== 200, "demo screens are off (start the server with JK_AUDIT=1)");
}

async function sendReport(page: Page, lang: "bn" | "en") {
  const bn = lang === "bn";
  const draft = page.getByRole("button", { name: bn ? "খসড়া তৈরি করুন" : /Create draft/i });
  // Typing before the page has hydrated is lost; retry until the button reacts to the text.
  await expect(async () => {
    await page.getByLabel(bn ? "বলুন বা লিখুন" : /Speak or type/i).fill("একজন আমাকে মেরে ফেলার হুমকি দিচ্ছে");
    await expect(draft).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await draft.click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: bn ? "পরের ধাপ" : "Next", exact: true }).click();
  await page.getByRole("button", { name: bn ? "জমা দিন" : "Submit", exact: true }).click();
}

for (const lang of ["bn", "en"] as const) {
  test(`report with imminent harm shows the guidance screen first, in ${lang}`, async ({ page }) => {
    await openReport(page, lang);
    await sendReport(page, lang);
    const title = lang === "bn" ? "আগে নিজের নিরাপত্তা দেখুন" : "Your safety comes first";
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText(EM.guidance[lang])).toBeVisible(); // the server's text, as given
    await expect(page.locator('a[href="tel:999"]')).toBeVisible();
    await expect(page.locator('a[href="tel:109"]')).toBeVisible();
    await expect(page.getByText("JK-EM-1")).toBeVisible();
    // The normal success heading is not shown until the person chooses to go on.
    await expect(page.getByRole("heading", { name: lang === "bn" ? "আপনার সমস্যা পাঠানো হয়েছে" : /Your report has been sent/i })).toHaveCount(0);
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    // Touch targets of the call buttons are large.
    const box = await page.locator('a[href="tel:999"]').boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.getByRole("button", { name: lang === "bn" ? "আমার রিপোর্ট দেখুন" : "View my report" }).click();
    await expect(page.getByText("JK-EM-1").first()).toBeVisible();
    await expect(page.getByText(EM.guidance[lang])).toBeVisible(); // still above the normal success screen
  });
}

test("a quiet emergency note sits on the ask page and links to help", async ({ page }) => {
  await page.goto("/ask", { waitUntil: "domcontentloaded" });
  const note = page.getByTestId("emergency-note");
  await expect(note).toBeVisible();
  await expect(note.locator('a[href="tel:999"]')).toBeVisible();
  await note.getByRole("link", { name: "বিস্তারিত" }).click();
  await expect(page).toHaveURL(/\/help#emergency/);
  await expect(page.locator("#emergency")).toBeVisible();
});

test("the issue page says plainly that sending to an authority is not an official registration", async ({ page }) => {
  const res = await page.goto("/dev/screens/issue", { waitUntil: "domcontentloaded" });
  test.skip(res?.status() !== 200, "demo screens are off");
  await expect(page.getByText(/সরকারি চ্যানেল নয়/)).toBeVisible();
});
