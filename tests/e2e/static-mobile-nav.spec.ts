// tests/e2e/static-mobile-nav.spec.ts
//
// T7: real browser coverage for `src/client/dom/mobile-nav.ts`, the
// vanilla replacement for the former React `app/MobileNav.tsx` (removed at
// the T11 cutover), against the built static site (`dist-static/`, served
// locally — see odd/tasks/bun-vanilla-migration.md for the exact serve
// command). Originally mirrored `tests/qa/mobile-nav-interaction.test.mjs`,
// a jsdom+React unit suite for the focus-trap logic; that file was removed
// at T11 once this spec plus `src/client/lib/focus-trap.test.ts` (bun
// test, unit-tests `computeFocusTrapTarget` in isolation) covered the same
// behavior against the real, framework-free build.
//
// Runs at a 390px viewport (a real phone width) because the panel only
// renders at all under app/globals.css's `@media (max-width: 820px)`.

import { expect, test } from "./guarded-test";

test.use({ viewport: { width: 390, height: 844 } });

function toggle(page: import("./guarded-test").Page) {
  return page.locator(".mobile-nav-toggle");
}

function panel(page: import("./guarded-test").Page) {
  return page.locator("#mobile-nav-panel");
}

test.describe("static mobile nav", () => {
  test("toggle opens the panel and moves focus to the first nav link", async ({ page }) => {
    await page.goto("/");
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");

    await toggle(page).click();

    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(panel(page)).toHaveAttribute("data-open", "true");
    await expect(panel(page)).not.toHaveAttribute("inert", "");
    const firstLink = panel(page).locator("a[href]").first();
    await expect(firstLink).toBeFocused();
  });

  test("Escape closes the panel and returns focus to the toggle", async ({ page }) => {
    await page.goto("/");
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");

    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(panel(page)).toHaveAttribute("data-open", "false");
    await expect(toggle(page)).toBeFocused();
  });

  test("Tab on the last focusable element wraps to the first (forward trap)", async ({ page }) => {
    await page.goto("/");
    await toggle(page).click();
    const focusable = panel(page).locator('a[href], button:not([disabled])');
    const count = await focusable.count();
    await focusable.nth(count - 1).focus();

    await page.keyboard.press("Tab");

    await expect(focusable.first()).toBeFocused();
  });

  test("Shift+Tab on the first focusable element wraps to the last (backward trap)", async ({ page }) => {
    await page.goto("/");
    await toggle(page).click();
    const focusable = panel(page).locator('a[href], button:not([disabled])');
    await expect(focusable.first()).toBeFocused();

    await page.keyboard.press("Shift+Tab");

    const count = await focusable.count();
    await expect(focusable.nth(count - 1)).toBeFocused();
  });

  test("clicking a nav link closes the panel", async ({ page }) => {
    await page.goto("/");
    await toggle(page).click();
    const firstLink = panel(page).locator("a[href]").first();

    await firstLink.click();

    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(panel(page)).toHaveAttribute("data-open", "false");
  });

  test("resizing to the desktop breakpoint closes an open panel", async ({ page }) => {
    await page.goto("/");
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");

    await page.setViewportSize({ width: 1280, height: 900 });

    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(panel(page)).toHaveAttribute("data-open", "false");
  });
});
