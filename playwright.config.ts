import { defineConfig, devices } from "@playwright/test";

// T11 cutover: `e2e:static`/`test:e2e` (package.json) is now deterministic
// and self-contained — Playwright's own `webServer` below builds the
// static site with a FIXED test GA measurement ID (so the consent specs
// always exercise the real GA4-loading branch, never silently skipping it
// depending on whatever `.env` happens to have — see the "Parent
// verification of T7" follow-up in odd/tasks/bun-vanilla-migration.md)
// and serves it via the real `wrangler dev` on the canonical
// wrangler.jsonc (Static Assets + the 2 API routes), not a throwaway
// static file server. `reuseExistingServer` skips the rebuild when a
// server is already listening on this port in local dev.
const PORT = 8788;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

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
  webServer: {
    command: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST123 bun run src/build/build.ts && pnpm exec wrangler dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
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
