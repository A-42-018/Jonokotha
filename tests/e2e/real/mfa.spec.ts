import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { api, buildWorld, dropWorld, sessionFor, skipUnlessReal, type World } from "./support";

/**
 * Task F.4: step-up for admin pages. This turns `enforce_mfa` on for the whole database while it runs, so it must not share
 * a run with the other real specs: use `npm run test:e2e:real -- --mfa` (one worker, only this file). Needs TOTP enabled in
 * supabase/config.toml ([auth.mfa.totp]) and `npx supabase start` after that change.
 */
test.describe.configure({ mode: "serial" });
test.skip(process.env.E2E_MFA !== "1", "run with `npm run test:e2e:real -- --mfa` (it switches enforce_mfa on for the database)");

let w: World;
test.beforeAll(async ({}, info) => {
  skipUnlessReal();
  w = await buildWorld(info);
  await w.admin.from("app_settings").update({ value: "true" }).eq("key", "enforce_mfa").throwOnError();
});
test.afterAll(async () => {
  if (w) { await w.admin.from("app_settings").update({ value: "false" }).eq("key", "enforce_mfa"); await dropWorld(w); }
});

/** RFC 6238 (SHA-1, 30 s, 6 digits) so the test can play the authenticator app. */
function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretBase32.replace(/=+$/, "").replace(/\s/g, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

test("an admin with only a password is sent to the code screen, enrols, and then reaches the admin page", async ({ browser }, info) => {
  const ctx = await sessionFor(browser, info, w.accounts.admin);
  // The API refuses first, with the stable code the UI reacts to.
  const denied = await api(ctx.request, "GET", "/admin/audit");
  expect(denied.status).toBe(403);
  expect(denied.json.field_errors?._).toBe("mfa_required");

  const page = await ctx.newPage();
  await page.goto("/admin/audit");
  await expect(page).toHaveURL(/\/mfa\?next=%2Fadmin%2Faudit/);
  await page.getByRole("button", { name: "Link an authenticator" }).click();
  await expect(page.getByAltText(/QR code/)).toBeVisible();
  const secret = (await page.locator("code").first().textContent())!.trim();

  // A wrong code is refused and keeps the person on the screen.
  await page.getByLabel("6-digit code from the app").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/did not match/)).toBeVisible();
  await expect(page).toHaveURL(/\/mfa/);

  await page.getByLabel("6-digit code from the app").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/admin\/audit$/);
  expect((await api(ctx.request, "GET", "/admin/audit")).status).toBe(200);
  await ctx.close();
});

test("a moderator and an office manager are not asked: only MP, moderator and admin need the code", async ({ browser }, info) => {
  const office = await sessionFor(browser, info, w.accounts.officeA);
  expect((await api(office.request, "GET", "/office/issues")).status).toBe(200);
  const page = await office.newPage();
  await page.goto("/office");
  await expect(page).toHaveURL(/\/office$/);
  await office.close();

  const mod = await sessionFor(browser, info, w.accounts.moderator);
  const res = await api(mod.request, "GET", "/admin/moderation");
  expect(res.status).toBe(403);
  expect(res.json.field_errors?._).toBe("mfa_required");
  await mod.close();
});
