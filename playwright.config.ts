import { defineConfig } from "@playwright/test";

const port = 3000;
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
    reuseExistingServer: !ci,
    timeout: 180_000,
  },
});
