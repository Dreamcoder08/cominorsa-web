// tests/e2e/static-landmarks.spec.ts
//
// P3 (audit P1-4, P1-5): the skip link is the first thing a keyboard user
// reaches on every page and jumps past the site header into
// `<main id="contenido">`; header/footer are landmarks outside <main>.

import { expect, test } from "./guarded-test";

for (const path of ["/", "/seguridad-minera", "/privacidad"]) {
  test(`${path}: first Tab focuses the skip link, which targets main#contenido outside the header`, async ({ page }) => {
    await page.goto(path);

    await page.keyboard.press("Tab");
    const skip = page.locator("a.skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toHaveAttribute("href", "#contenido");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contenido$/);

    const structure = await page.evaluate(() => ({
      mainId: document.querySelector("main")?.id,
      headerInMain: !!document.querySelector("main header.site-header"),
      footerInMain: !!document.querySelector("main footer"),
      headerLandmark: !!document.querySelector("body > header.site-header"),
      footerLandmark: !!document.querySelector("body > footer"),
    }));
    expect(structure).toEqual({
      mainId: "contenido",
      headerInMain: false,
      footerInMain: false,
      headerLandmark: true,
      footerLandmark: true,
    });
  });
}
