// Regenerates the README screenshots in docs/screenshots/ from a running dev server (default http://localhost:3000).
// The pages use the code-only simulated demo (cookie jk_demo=1), so nothing is read from or written to the database.
// Usage: npm run dev   (other terminal)   node scripts/readme-screenshots.mjs [baseUrl]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });

const shots = [
  // [file, path, lang, options]
  ["home", "/", "en"],
  ["home-bn", "/", "bn"],
  ["report", "/report", "en"],
  ["area", "/area", "en"],
  ["issue", "/issue/JKD-2026-0101", "en"],
  ["ideas", "/ideas", "en"],
  ["polls", "/polls", "en"],
  ["consultations", "/consultations", "en"],
  ["projects", "/projects", "en"],
  ["budgeting", "/budgeting", "en"],
  ["commitments", "/commitments", "en"],
  ["ask", "/ask", "en"],
  ["mp", "/mp", "en"],
  ["demo", "/demo", "en"],
];

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
for (const [device, viewport, mobile] of [["desktop", { width: 1280, height: 860 }, false], ["mobile", { width: 390, height: 844 }, true]]) {
  for (const [name, path, lang] of shots) {
    if (mobile && !["home", "home-bn", "report", "issue", "area"].includes(name)) continue;
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, colorScheme: "light" });
    await ctx.addCookies([
      { name: "jk_demo", value: "1", url: base },
      { name: "lang", value: lang, url: base },
    ]);
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: "networkidle", timeout: 90_000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }); // hides the dev-mode indicator
    await page.waitForTimeout(800);
    const file = `${out}/${name}-${device}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log("saved", file);
    await ctx.close();
  }
}

// Office (staff) screens: sign in with the one-click demo account (needs DEMO_LOGIN=true and the demo users, see docs/runbooks/demo-data.md).
// These read the real database as that account, so they show whatever demo cases exist there.
const office = [["office-queue", "/office"], ["office-case", "/office/JK-2026-1004"], ["office-analytics", "/office/analytics"]];
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: "light" });
  await ctx.addCookies([{ name: "lang", value: "en", url: base }]);
  const page = await ctx.newPage();
  await page.goto(base + "/login", { waitUntil: "networkidle", timeout: 90_000 });
  const btn = page.locator('button[name="role"][value="staff"]');
  if (await btn.count()) {
    await Promise.all([page.waitForURL("**/office**", { timeout: 90_000 }), btn.click()]);
    for (const [name, path] of office) {
      await page.goto(base + path, { waitUntil: "networkidle", timeout: 90_000 });
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.waitForTimeout(800);
      const skip = page.getByRole("button", { name: "Not now" }); // first-visit office tour
      if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(400); }
      await page.screenshot({ path: `${out}/${name}-desktop.png` });
      console.log("saved", `${out}/${name}-desktop.png`);
    }
  } else console.log("demo login is off: skipped office screens");
  await ctx.close();
}
await browser.close();
