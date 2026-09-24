// tests/e2e/static-cookie-consent.spec.ts
//
// T7: real browser coverage for `src/client/dom/cookie-consent.ts` +
// `src/client/dom/ga4.ts`, the vanilla replacement for
// `app/CookieConsent.tsx` / `app/CookiePreferencesButton.tsx`, against
// the built static site. Proves the actual GA4-loading contract that a
// source read can't: GA4 must never be requested before an explicit
// "granted" decision, must never be requested after "denied", and the
// stored decision (same `localStorage` key/values as the React version)
// must survive a reload.
//
// GA4 network calls are captured via Playwright's `request` event, which
// fires the moment Chromium issues a request — including one
// `guarded-test.ts`'s context-level route then aborts, since every
// non-loopback host is blocked there regardless of method. That means
// this suite can assert "GA4 was requested" without ever letting the
// request actually reach Google: `guarded-test.ts` already guarantees
// that for every test in this repo, and this file adds no separate
// route override on top of it.
//
// Requires `dist-static/` to have been BUILT WITH a real
// NEXT_PUBLIC_GA_MEASUREMENT_ID (see build.ts's `define`) — otherwise
// `GA_MEASUREMENT_ID` bakes to `""` and the "granted" branch never calls
// `loadGa4` at all, same as production with the variable unset. See
// odd/tasks/bun-vanilla-migration.md's T7 verification notes for the
// exact rebuild command used for this spec run.

import { expect, test, type Page } from "./guarded-test";

const STORAGE_KEY = "cominorsa-consent";
const GA_REQUEST_PATTERN = /googletagmanager\.com\/gtag\/js/;

function banner(page: Page) {
  return page.locator(".cookie-consent");
}

function trackGaRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (GA_REQUEST_PATTERN.test(request.url())) urls.push(request.url());
  });
  return urls;
}

async function getStoredConsent(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
}

test.describe("static cookie consent", () => {
  test("shows the banner and issues no GA4 request before any decision", async ({ page }) => {
    const gaRequests = trackGaRequests(page);
    await page.goto("/");

    await expect(banner(page)).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/has-cookie-banner/);
    // Give any (incorrect) eager load a moment to fire before asserting
    // its absence.
    await page.waitForTimeout(300);
    expect(gaRequests).toEqual([]);
    expect(await getStoredConsent(page)).toBeNull();
  });

  test("accepting requests the real GA4 script and stores the decision", async ({ page }) => {
    const gaRequests = trackGaRequests(page);
    await page.goto("/");
    await expect(banner(page)).toBeVisible();

    await page.getByRole("button", { name: "Aceptar" }).click();

    await expect.poll(() => gaRequests.length).toBeGreaterThan(0);
    expect(gaRequests[0]).toMatch(GA_REQUEST_PATTERN);
    await expect(banner(page)).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/has-cookie-banner/);
    expect(await getStoredConsent(page)).toBe("granted");
  });

  test("rejecting hides the banner, stores the decision, and never requests GA4", async ({ page }) => {
    const gaRequests = trackGaRequests(page);
    await page.goto("/");
    await expect(banner(page)).toBeVisible();

    await page.getByRole("button", { name: "Rechazar" }).click();

    await expect(banner(page)).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/has-cookie-banner/);
    expect(await getStoredConsent(page)).toBe("denied");
    await page.waitForTimeout(300);
    expect(gaRequests).toEqual([]);
  });

  test("an accepted decision persists across reload — no banner, GA4 requested again", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Aceptar" }).click();
    expect(await getStoredConsent(page)).toBe("granted");

    const gaRequests = trackGaRequests(page);
    await page.reload();

    await expect(banner(page)).toHaveCount(0);
    await expect.poll(() => gaRequests.length).toBeGreaterThan(0);
  });

  test("a rejected decision persists across reload — no banner reappears", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Rechazar" }).click();
    expect(await getStoredConsent(page)).toBe("denied");

    await page.reload();

    await expect(banner(page)).toHaveCount(0);
    expect(await getStoredConsent(page)).toBe("denied");
  });

  test("the footer preferences button clears the decision and reopens the banner", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Rechazar" }).click();
    expect(await getStoredConsent(page)).toBe("denied");

    await page.locator("#cookie-preferences-button").click();
    await page.waitForLoadState("load");

    expect(await getStoredConsent(page)).toBeNull();
    await expect(banner(page)).toBeVisible();
  });
});
