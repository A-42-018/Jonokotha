import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility audit (Phase 3.1). Signed-in screens cannot be reached without a Supabase session, so they are
 * rendered with labelled demo data at /dev/screens/[name] (dev server, or a production server started with JK_AUDIT=1).
 */
const SIGNED_IN = ["report", "issue", "office", "case", "announcements", "admin-verification", "admin-moderation"];
const PUBLIC = ["/", "/area", "/ideas", "/mp", "/help", "/offline"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function hasDemoScreens(page: Page) {
  const res = await page.goto("/dev/screens/report");
  return !!res && res.status() === 200;
}

async function serious(page: Page) {
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

for (const lang of ["bn", "en"] as const) {
  test.describe(`audit (${lang})`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: "lang", value: lang, url: baseURL! }]);
    });

    for (const name of SIGNED_IN) {
      test(`axe: signed-in screen ${name} has no serious or critical violations`, async ({ page }) => {
        test.skip(!(await hasDemoScreens(page)), "demo screens are off (start the server with JK_AUDIT=1)");
        await page.goto(`/dev/screens/${name}`);
        expect(await serious(page)).toEqual([]);
      });
    }

    for (const path of [...PUBLIC, "/login", "/me", "/welcome", "/settings", "/privacy", "/notifications"]) {
      test(`renders in ${lang} without an error page: ${path}`, async ({ page }) => {
        const res = await page.goto(path);
        expect(res?.status()).toBeLessThan(400);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.locator("#__next_error__")).toHaveCount(0);
        await expect(page.locator("main h1, main h2").first()).toBeVisible();
      });
    }

    for (const path of PUBLIC) {
      test(`reflow at 200% zoom: no horizontal scroll on ${path}`, async ({ page, isMobile }) => {
        test.skip(isMobile, "zoom is simulated by a narrower viewport; run on desktop");
        await page.setViewportSize({ width: 640, height: 400 }); // 1280px at 200%
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        await page.setViewportSize({ width: 320, height: 256 }); // 1280px at 400% (WCAG 1.4.10)
        await page.waitForTimeout(100);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      });
    }
  });
}

test("reduced motion: nothing keeps animating on the home page", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getComputedTiming().iterations ?? 1) !== 1).length);
  expect(running).toBe(0);
});

test("keyboard only: every stop in the report wizard shows a focus ring", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard order is checked on desktop");
  test.skip(!(await hasDemoScreens(page)), "demo screens are off (start the server with JK_AUDIT=1)");
  await page.goto("/dev/screens/report");
  await page.waitForLoadState("networkidle");
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
      // Choice rows (radio/checkbox) draw the ring on the label via :has(:focus-visible).
      const parentRing = !!el.closest("label") && getComputedStyle(el.closest("label") as Element).outlineStyle !== "none";
      return { id: `${el.tagName}:${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 20) ?? ""}`, ring: ring || parentRing };
    });
    if (!stop) continue;
    expect(stop.ring, `no visible focus ring on ${stop.id}`).toBe(true);
    seen.add(stop.id);
  }
  expect(seen.size).toBeGreaterThan(8);
});

for (const name of ["issue-long", "case-long", "office"]) {
  test(`long unbroken text wraps: no horizontal scroll on ${name}`, async ({ page }) => {
    const res = await page.goto(`/dev/screens/${name}`);
    test.skip(res?.status() !== 200, "demo screens are off (start the server with JK_AUDIT=1)");
    await page.waitForLoadState("networkidle");
    const over = await page.evaluate(() => {
      const doc = document.documentElement;
      // Table scrolls inside its own wrapper are fine; the page itself must not.
      return { page: doc.scrollWidth - doc.clientWidth, wide: [...document.querySelectorAll("main *")].filter((e) => !e.closest("[data-scroll-x], .overflow-x-auto") && e.getBoundingClientRect().right > doc.clientWidth + 1 && getComputedStyle(e).position !== "fixed").slice(0, 3).map((e) => e.tagName + "." + String(e.className).slice(0, 60)) };
    });
    expect(over.page, `page is wider than the screen: ${over.wide.join(", ")}`).toBeLessThanOrEqual(0);
  });
}
