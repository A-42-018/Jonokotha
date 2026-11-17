import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { buildWorld, dropWorld, sessionFor, skipUnlessReal, submitIssue, type Account, type World } from "./support";

/**
 * Task F.2: axe (WCAG 2.2 AA) on signed-in screens with a REAL session, in Bangla and English, at 375 and 1280px.
 * The phase 3 audit covered these screens through labelled demo screens; this runs the live pages with live data.
 */
let w: World;
let ref = "";

test.beforeAll(async ({ browser }, info) => {
  skipUnlessReal();
  w = await buildWorld(info);
  const c = await sessionFor(browser, info, w.accounts.citizenA);
  ref = await submitIssue(c.request, w);
  await c.close();
});
test.afterAll(async () => { if (w) await dropWorld(w); });

async function serious(page: Page) {
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const SCREENS: { who: keyof World["accounts"]; paths: (ref: string) => string[] }[] = [
  { who: "citizenA", paths: (r) => ["/report", "/me", "/ask", "/ask/inbox", "/notifications", "/settings", `/issue/${r}`] },
  { who: "officeA", paths: (r) => ["/office", `/office/${r}`, "/office/announcements"] },
  { who: "admin", paths: () => ["/admin", "/admin/moderation", "/admin/verification", "/admin/ai-runs", "/admin/audit", "/admin/stats"] },
];

for (const { who, paths } of SCREENS) {
  for (const lang of ["bn", "en"] as const) {
    test(`axe: ${who} pages in ${lang} have no serious or critical violations`, async ({ browser }, info) => {
      const acct: Account = w.accounts[who];
      const ctx = await sessionFor(browser, info, acct, lang);
      const page = await ctx.newPage();
      const failures: Record<string, string[]> = {};
      for (const path of paths(ref)) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBeLessThan(400);
        expect(new URL(page.url()).pathname, `${path} must not bounce to sign-in or no-access`).toBe(path);
        const bad = await serious(page);
        if (bad.length) failures[path] = bad;
      }
      expect(failures).toEqual({});
      await ctx.close();
    });
  }
}
