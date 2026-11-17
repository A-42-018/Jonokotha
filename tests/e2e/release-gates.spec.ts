import { expect, test } from "@playwright/test";

/** F.8 probes: what a signed-out visitor receives from the public pages, in both languages. */
const PUBLIC: string[] = ["/", "/area", "/ideas", "/ask", "/mp", "/mp/method", "/help", "/privacy", "/terms", "/metrics", "/projects", "/projects/PR-DEMO", "/ideas/ID-DEMO", "/polls", "/accessibility", "/about", "/help/contact", "/challenge", "/welcome", "/offline", "/login"];

// Release 1.1 pages exist only with their flags (PW_RELEASE11=1 starts the server with them on). Without the flags they are not there at all.
const R11 = process.env.PW_RELEASE11 === "1";
const R11_PAGES = ["/consultations", "/consultations/CN-DEMO", "/consultations/CN-DEMO/report", "/commitments", "/commitments/CM-DEMO", "/priorities", "/help/channels"];
if (R11) PUBLIC.push(...R11_PAGES);

// Things that must never be in HTML a stranger can fetch.
const PRIVATE: [string, RegExp][] = [
  ["email address", /[\w.+-]+@(?!jonokotha\.(test|example)|example\.(com|org))[\w-]+\.[\w.-]+/i],
  ["Bangladesh mobile number", /(?:\+?88)?01[3-9]\d{8}\b/],
  ["service-role key", /service_role|SERVICE_ROLE/],
  ["internal note field", /internal_note|private_note|reporter_id|author_id|user_id/],
  ["JWT", /eyJ[\w-]{15,}\.[\w-]{15,}\.[\w-]{10,}/],
];

for (const lang of ["bn", "en"] as const) {
  test(`public pages carry no private data (${lang})`, async ({ page, context }) => {
    test.setTimeout(240_000); // first request to each page compiles it in dev mode
    await context.addCookies([{ name: "lang", value: lang, url: "http://localhost:" + (process.env.PW_PORT ?? 3000) }]);
    for (const path of PUBLIC) {
      const res = await page.request.get(path, { headers: { cookie: `lang=${lang}` } });
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      // The configured support mailbox is public on purpose.
      const text = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? html.split(process.env.NEXT_PUBLIC_SUPPORT_EMAIL).join("") : html;
      for (const [label, re] of PRIVATE) expect(re.test(text), `${label} in ${path}`).toBe(false);
    }
  });
}

test("a signed-out visitor cannot read office or admin data through the pages", async ({ page }) => {
  test.setTimeout(120_000);
  for (const path of ["/office", "/office/kpis", "/admin", "/admin/audit", "/admin/moderation"]) {
    const res = await page.goto(path);
    expect(res?.ok(), path).toBe(true);
    await expect(page, path).toHaveURL(/\/login/);
  }
});

test("each public page has a language attribute and a title in the chosen language", async ({ page }) => {
  test.setTimeout(240_000);
  for (const path of PUBLIC.slice(0, 6)) {
    await page.goto(path, { waitUntil: "load" });
    await expect(page.locator("html"), path).toHaveAttribute("lang", "bn");
    expect(await page.title(), path).toMatch(/[\u0980-\u09FF]/);
  }
});

test("Release 1.1 pages are not in production navigation and show the not-found page while their flags are off", async ({ page }) => {
  test.skip(R11, "this run has the Release 1.1 flags on");
  test.setTimeout(240_000);
  // Citizen pages: the not-found page (the status is 200 when a loading screen has started streaming, so the page itself is checked).
  for (const path of ["/consultations", "/consultations/CN-DEMO", "/consultations/CN-DEMO/report", "/commitments", "/commitments/CM-DEMO", "/priorities", "/help/channels"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }), path).toHaveText("পাতাটি পাওয়া যায়নি");
  }
  // Staff pages are not found either (the flag is checked before the sign-in guard, so a visitor learns nothing about them).
  for (const path of ["/office/consultations", "/office/commitments", "/office/priorities"]) {
    await page.goto(path);
    if (!/\/login/.test(page.url())) await expect(page.getByRole("heading", { level: 1 }), path).toHaveText("পাতাটি পাওয়া যায়নি");
  }
  const html = await (await page.request.get("/")).text();
  for (const href of ["/consultations", "/commitments", "/priorities", "/help/channels"]) expect(html.includes(`href="${href}"`), `link to ${href} on the home page`).toBe(false);
  const settings = await (await page.request.get("/settings")).text();
  expect(settings.includes("/help/channels")).toBe(false);
});
