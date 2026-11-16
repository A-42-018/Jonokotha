import { expect, test, type Page } from "@playwright/test";
import { buildCsp } from "../../src/lib/csp";

/** Phase 3.6: safe rendering of user text, the CSP the UI needs (no violations), and upload limits in the UI. */
async function demo(page: Page, name: string) {
  const res = await page.goto(`/dev/screens/${name}`);
  test.skip(res?.status() !== 200, "demo screens are off (start the server with JK_AUDIT=1)");
}

test("user text is rendered as text: HTML and script in a report never run", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", (d) => { dialogs++; void d.dismiss(); });
  await demo(page, "issue-xss");
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  expect(dialogs).toBe(0);
  await expect(page.locator("main img[onerror], main script")).toHaveCount(0);
  await expect(page.getByText('<img src=x onerror="window.__xss=1">').first()).toBeVisible(); // shown literally
  await expect(page.locator('main a[href^="javascript:"]')).toHaveCount(0);
});

const CSP_PAGES = ["/", "/login", "/area", "/ideas", "/mp", "/help", "/offline", "/dev/screens/report", "/dev/screens/issue", "/dev/screens/office"];

test("the app runs under the proposed Content-Security-Policy with zero violations", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1280", "same policy on every viewport");
  const csp = buildCsp({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321" });
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), "content-security-policy": csp } });
  });
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  for (const path of CSP_PAGES) {
    const res = await page.goto(path);
    if (res?.status() !== 200) continue; // demo screens are off
    await page.waitForLoadState("networkidle");
    if (path === "/area") await page.getByRole("tab", { name: "মানচিত্র" }).click();
    await page.waitForTimeout(500);
    const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
    expect(violations, `CSP violations on ${path}`).toEqual([]);
  }
});

test("upload limits in the UI: a file that is not a real image is refused, even if named .jpg", async ({ page }) => {
  await demo(page, "report");
  await page.evaluate(() => localStorage.setItem("jonokotha:report-draft:v2", JSON.stringify({ quick: "", values: { title: "রাস্তায় বড় গর্ত", description: "বাজারের সামনে বড় গর্ত আছে।", area: "ওয়ার্ড ৩", category: "roads" }, ai: [], edited: [], step: 3 })));
  await page.reload();
  await page.waitForLoadState("networkidle");
  const input = page.locator('input[type="file"]');
  await expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  await input.setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await expect(page.getByRole("alert").filter({ hasText: "শুধু ছবি" })).toBeVisible();
  await expect(page.locator("main img[src^='blob:']")).toHaveCount(0);
});

test("upload limits in the UI: a photo over 15 MB is refused with the limit stated", async ({ page }) => {
  await demo(page, "report");
  await page.evaluate(() => localStorage.setItem("jonokotha:report-draft:v2", JSON.stringify({ quick: "", values: { title: "রাস্তায় বড় গর্ত", description: "বাজারের সামনে বড় গর্ত আছে।", area: "ওয়ার্ড ৩", category: "roads" }, ai: [], edited: [], step: 3 })));
  await page.reload();
  await page.waitForLoadState("networkidle");
  const big = Buffer.alloc(16 * 1024 * 1024);
  big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
  await page.locator('input[type="file"]').setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: big });
  await expect(page.getByRole("alert").filter({ hasText: "১৫ এমবি" })).toBeVisible();
});
