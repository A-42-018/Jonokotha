import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";

/**
 * Collects the audit evidence for docs/aibc/phase3 (screenshots and full axe results, every impact level).
 * Only runs when AUDIT_OUT is set:  AUDIT_OUT=docs/aibc/phase3 PW_PORT=3100 npx playwright test evidence
 */
const out = process.env.AUDIT_OUT;
test.skip(!out, "set AUDIT_OUT to collect evidence");
test.setTimeout(180_000);

const SCREENS: [string, string][] = [
  ["home", "/"], ["explore", "/area"], ["ideas", "/ideas"], ["find-mp", "/mp"], ["help", "/help"], ["sign-in", "/login"], ["offline", "/offline"],
  ["report-wizard", "/dev/screens/report"], ["issue-detail", "/dev/screens/issue"], ["office-overview", "/dev/screens/office"],
  ["office-case", "/dev/screens/case"], ["announcements", "/dev/screens/announcements"], ["admin-verification", "/dev/screens/admin-verification"], ["admin-moderation", "/dev/screens/admin-moderation"],
];

for (const lang of ["bn", "en"] as const) {
  test(`evidence (${lang})`, async ({ page, context, baseURL }, info) => {
    await context.addCookies([{ name: "lang", value: lang, url: baseURL! }]);
    const vp = info.project.name.replace("mobile-375", "375").replace("desktop-1280", "1280");
    mkdirSync(path.join(out!, "screenshots"), { recursive: true });
    const rows: unknown[] = [];
    for (const [name, url] of SCREENS) {
      const res = await page.goto(url);
      if (res?.status() !== 200) { rows.push({ screen: name, url, skipped: res?.status() }); continue; }
      await page.waitForLoadState("networkidle");
      await page.reload(); // fonts use display: optional; the second load has them cached
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out!, "screenshots", `${name}-${lang}-${vp}.png`), fullPage: true });
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      rows.push({ screen: name, url, passes: r.passes.length, violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })), incomplete: r.incomplete.map((v) => v.id) });
    }
    writeFileSync(path.join(out!, `axe-${lang}-${vp}.json`), JSON.stringify({ date: new Date().toISOString(), axe: "@axe-core/playwright, tags wcag2a wcag2aa wcag21a wcag21aa wcag22aa", lang, viewport: vp, results: rows }, null, 2));
  });
}
