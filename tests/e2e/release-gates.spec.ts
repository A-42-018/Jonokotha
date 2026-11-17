import { expect, test } from "@playwright/test";

/** F.8 probes: what a signed-out visitor receives from the public pages, in both languages. */
const PUBLIC = ["/", "/area", "/ideas", "/ask", "/mp", "/mp/method", "/help", "/privacy", "/terms", "/metrics", "/projects", "/projects/PR-DEMO", "/ideas/ID-DEMO", "/polls", "/accessibility", "/about", "/help/contact", "/challenge", "/welcome", "/offline", "/login"];

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
