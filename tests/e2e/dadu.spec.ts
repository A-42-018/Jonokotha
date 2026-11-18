import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Dadu (জমির দাদু): launcher, chat panel, voice navigation and the page guides, with the chat route mocked in the browser (no Supabase needed).
 * Needs the flags: start with `npm run test:e2e:dadu` (PW_DADU=1, its own server on port 3300). The scripted brain itself is covered by tests/unit/helper-*.test.ts.
 */
test.skip(process.env.PW_DADU !== "1", "the Dadu flags are off in this run");
const base = () => `http://localhost:${process.env.PW_PORT ?? 3300}`;
const ok = (data: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
const lang = (page: Page, l: "bn" | "en") => page.context().addCookies([{ name: "lang", value: l, url: base() }]);

/** The real engine, called from the browser mock: a tiny copy of the rules the tests need. */
async function mockChat(page: Page, seen: { voice: boolean[] } = { voice: [] }) {
  await page.route("**/api/v1/helper/**", (r: Route) => {
    const u = new URL(r.request().url());
    if (u.pathname.endsWith("/speech")) return r.fulfill(ok({ available: false }));
    const body = r.request().postDataJSON() as { messages: { role: string; text: string }[]; voice: boolean; lang: string };
    seen.voice.push(body.voice);
    const text = body.messages[body.messages.length - 1].text;
    if (/আত্মহত্যা/.test(text)) return r.fulfill(ok({ blocks: [{ type: "emergency", text: "আপনি একা নন। এখনই বিপদ মনে হলে ৯৯৯-এ ফোন করুন।", numbers: ["999"] }], intent: "emergency", confidence: 1, source: "emergency", lang: "bn", mood: "sorry" }));
    if (body.voice && /পোল/.test(text)) return r.fulfill(ok({ blocks: [{ type: "navigate", href: "/polls", label: "পোলের পাতা", say: "পোলের পাতা খুলছি…" }], intent: "nav_polls", confidence: 1, source: "rules", lang: "bn", mood: "happy" }));
    if (/কীভাবে/.test(text)) return r.fulfill(ok({ blocks: [{ type: "text", text: "সমস্যা জানাতে রিপোর্টের পাতায় যান।" }, { type: "link", href: "/report", label: "সমস্যা জানানোর পাতা" }, { type: "chips", items: [{ label: "পাঠানোর পর কী হয়?", send: "পাঠানোর পর কী হয়?" }] }], intent: "report", confidence: 0.95, source: "rules", lang: "bn", mood: "talk" }));
    return r.fulfill(ok({ blocks: [{ type: "text", text: "বুঝতে পারিনি।" }], intent: "out_of_scope", confidence: 0, source: "rules", lang: "bn", mood: "sorry" }));
  });
}

async function fakeSpeech(page: Page, phrase: string) {
  await page.addInitScript((said) => {
    class Rec {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null; onerror: ((e: unknown) => void) | null = null;
      start() { setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: said }], { isFinal: true })] }), 100); }
      stop() { setTimeout(() => this.onend?.(), 0); }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = Rec;
  }, phrase);
}

const open = async (page: Page, path = "/about") => {
  await page.goto(path);
  await page.locator("[data-dadu-launcher]").click();
  await expect(page.getByRole("dialog")).toBeVisible();
};

test("the launcher opens the panel; Escape closes it and returns focus", async ({ page }) => {
  await lang(page, "bn"); await mockChat(page);
  await open(page);
  await expect(page.getByRole("dialog").getByText("জমির দাদু").first()).toBeVisible();
  await expect(page.getByText("দাদু ভুল করতে পারেন")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-dadu-launcher]")).toBeFocused();
});

test("typed questions are answered with links and chips; typed chat never moves the page", async ({ page }) => {
  await lang(page, "bn"); const seen = { voice: [] as boolean[] }; await mockChat(page, seen);
  await open(page);
  await page.getByLabel("আপনার প্রশ্ন").fill("সমস্যা জানাব কীভাবে?");
  await page.getByRole("button", { name: "পাঠান" }).click();
  await expect(page.getByText("সমস্যা জানাতে রিপোর্টের পাতায় যান।")).toBeVisible();
  await expect(page.getByRole("link", { name: /সমস্যা জানানোর পাতা/ })).toHaveAttribute("href", "/report");
  await page.getByRole("button", { name: "পাঠানোর পর কী হয়?" }).click();
  await expect(page.getByText("বুঝতে পারিনি।")).toBeVisible();
  expect(seen.voice.every((v) => v === false)).toBe(true);
  expect(new URL(page.url()).pathname).toBe("/about");
});

test("emergency words show the guidance in a red alert", async ({ page }) => {
  await lang(page, "bn"); await mockChat(page);
  await open(page);
  await page.getByLabel("আপনার প্রশ্ন").fill("আমি আত্মহত্যা করতে চাই");
  await page.getByRole("button", { name: "পাঠান" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "৯৯৯" })).toBeVisible();
});

test("voice: 'পোলের পাতায় নিয়ে যাও' counts down two seconds, then opens the polls page", async ({ page }) => {
  await lang(page, "bn"); await fakeSpeech(page, "পোলের পাতায় নিয়ে যাও"); await mockChat(page);
  await open(page);
  await page.getByRole("button", { name: "বলে জিজ্ঞাসা করুন" }).click();
  await expect(page.locator("[data-dadu-going]")).toContainText("যাচ্ছি: পোলের পাতা");
  await page.waitForURL(/\/polls$/, { timeout: 10_000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("voice: Cancel stops the jump", async ({ page }) => {
  await lang(page, "bn"); await fakeSpeech(page, "পোলের পাতায় নিয়ে যাও"); await mockChat(page);
  await open(page);
  await page.getByRole("button", { name: "বলে জিজ্ঞাসা করুন" }).click();
  await expect(page.locator("[data-dadu-going]")).toBeVisible();
  await page.getByRole("button", { name: "বাতিল" }).click();
  await page.waitForTimeout(2600);
  expect(new URL(page.url()).pathname).toBe("/about");
  await expect(page.getByText("ঠিক আছে, যাচ্ছি না।")).toBeVisible();
});

test("the launcher is not drawn on typing flows and staff pages", async ({ page }) => {
  await lang(page, "bn");
  for (const path of ["/report", "/login"]) { await page.goto(path); await expect(page.locator("[data-dadu-launcher]"), path).toHaveCount(0); }
});

for (const l of ["bn", "en"] as const) {
  test(`axe and layout with the panel open in ${l}`, async ({ page }) => {
    test.setTimeout(120_000);
    await lang(page, l); await mockChat(page);
    await open(page, "/help");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.html.slice(0, 120)).join(" | ")}`)).toEqual([]);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(wide).toBeLessThanOrEqual(1);
  });
}
