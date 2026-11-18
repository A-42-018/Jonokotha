import { defineConfig } from "@playwright/test";

const port = Number(process.env.PW_PORT ?? 3000);
const ci = !!process.env.CI;
// Local: installed Chrome (no browser download). CI sets PW_CHANNEL="" to use the installed chromium.
const channel = process.env.PW_CHANNEL === "" ? {} : { channel: process.env.PW_CHANNEL ?? "chrome" };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "mobile-375", use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, ...channel } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 }, ...channel } },
  ],
  webServer: {
    command: ci ? `npm run build && npm run start -- -p ${port}` : `npm run dev -- -p ${port}`,
    url: `http://localhost:${port}`,
    env: { JK_AUDIT: "1", ...(process.env.PW_RELEASE11 === "1" ? { NEXT_PUBLIC_FLAG_RELEASE11: "1", NEXT_DIST_DIR: ".next-r11" } : {}), ...(process.env.PW_RELEASE2 === "1" ? { NEXT_PUBLIC_FLAG_RELEASE2: "1", NEXT_DIST_DIR: ".next-r2" } : {}), ...(process.env.PW_DADU === "1" ? { NEXT_PUBLIC_FLAG_DADU: "1", NEXT_PUBLIC_FLAG_DADU_VOICE: "1", NEXT_DIST_DIR: ".next-dadu" } : {}), ...(process.env.E2E_REAL === "1" ? { NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "" } : {}) },
    // The real-stack run must start its own server so it talks to the local Supabase, not whatever was running.
    reuseExistingServer: !ci && process.env.PW_REUSE_SERVER !== "0",
    timeout: 180_000,
  },
});
