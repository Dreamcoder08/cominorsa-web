import { defineConfig, devices } from "@playwright/test";

// Twenty CRM's local Docker stack (docker/twenty/) already owns port 3000,
// so the site's dev server runs on 3001 in local dev — see
// docker/twenty/README.md and app/api/crm-lead/route.ts. Not auto-started
// here (webServer would need the same Twenty/.env prerequisites as
// `pnpm dev`, which this config has no business assuming): run `pnpm dev
// -- --port 3001` yourself first, then `pnpm test:e2e`.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
