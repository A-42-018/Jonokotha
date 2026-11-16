import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

/** Phase 3.2 budget: <= 150 KB gzip of JavaScript on first load of `/` (scripts a modern browser actually runs). */
const BUDGET = 150 * 1024;

async function firstLoadScripts(request: import("@playwright/test").APIRequestContext, path: string) {
  const html = await (await request.get(path)).text();
  const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/g)].filter((m) => !/\bnoModule\b/i.test(m[0]));
  const srcs = [...new Set(tags.map((m) => m[1]))];
  const files = await Promise.all(srcs.map(async (src) => {
    const body = await (await request.get(src)).body();
    return { src, gzip: gzipSync(body).length, text: body.toString("utf8") };
  }));
  return files;
}

test("first-load JS for / stays within 150 KB gzip, without map, Supabase or Zod", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop-1280", "same bytes on every viewport");
  const files = await firstLoadScripts(request, "/");
  const total = files.reduce((n, f) => n + f.gzip, 0);
  info.annotations.push({ type: "first-load-js-kb", description: (total / 1024).toFixed(1) });
  expect(total, `first-load JS is ${(total / 1024).toFixed(1)} KB gzip`).toBeLessThanOrEqual(BUDGET);
  for (const f of files) {
    expect(f.text, `${f.src} contains the map library`).not.toContain("maplibre-gl");
    expect(f.text, `${f.src} contains the Supabase client`).not.toContain("AuthApiError");
    expect(f.text, `${f.src} contains Zod`).not.toContain("ZodError");
  }
});

test("every SVG illustration stays within the 90 KB budget (heroes are the largest)", async () => {
  const dir = path.join(process.cwd(), "public/illustrations");
  const big = readdirSync(dir).filter((f) => f.endsWith(".svg") && statSync(path.join(dir, f)).size > 90 * 1024);
  expect(big).toEqual([]);
});
