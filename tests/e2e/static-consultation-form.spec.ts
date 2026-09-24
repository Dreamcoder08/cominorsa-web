// tests/e2e/static-consultation-form.spec.ts
//
// T7: real browser coverage for `src/client/dom/consultation-form.ts`,
// the vanilla replacement for `app/ConsultationForm.tsx`, against the
// built static site. Mirrors tests/e2e/consultation-form.spec.ts's
// assertions (same sample lead, same WhatsApp deep link expectations,
// same CRM payload shape) so the two implementations are held to
// exactly the same behavioral bar.

import { expect, test, type Page } from "./guarded-test";

async function stubWindowOpen(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __openCalls: string[] }).__openCalls = [];
    window.open = (url) => {
      (window as unknown as { __openCalls: string[] }).__openCalls.push(String(url ?? ""));
      return null;
    };
  });
}

async function getOpenedUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __openCalls: string[] }).__openCalls);
}

/** P7: the submit button renders enabled; `src/client/dom/consultation-form.ts`
 * marks the form `data-enhanced` once its submit handler is attached. */
async function gotoAndWaitForEnhancement(page: Page) {
  await page.goto("/");
  await expect(page.locator("#consultation-form[data-enhanced]")).toHaveCount(1, { timeout: 15000 });
}

const PREPARED_STATUS =
  "Preparamos tu mensaje en WhatsApp. Revísalo y envíalo para completar tu consulta.";

const SAMPLE_LEAD = {
  name: "Rosa Elvira Quispe Mamani",
  city: "Piura",
  service: "REINFO",
  question: "Necesito ayuda para renovar mi inscripcion REINFO antes del vencimiento de este mes.",
};

test.describe("static consultation form", () => {
  test("submitting opens the prepared WhatsApp message and posts matching lead data", async ({
    page,
    crmLeadPayloads,
  }) => {
    await stubWindowOpen(page);
    await gotoAndWaitForEnhancement(page);
    await page.locator("#consulta").scrollIntoViewIfNeeded();

    await page.fill('input[name="name"]', SAMPLE_LEAD.name);
    await page.fill('input[name="city"]', SAMPLE_LEAD.city);
    await page.selectOption('select[name="service"]', { label: SAMPLE_LEAD.service });
    await page.fill('textarea[name="question"]', SAMPLE_LEAD.question);

    await page.click("#consultation-form-submit");

    await expect.poll(() => getOpenedUrls(page)).toHaveLength(1);
    const [openedUrl] = await getOpenedUrls(page);
    expect(openedUrl).toContain("wa.me/51910728575");
    const decodedUrl = decodeURIComponent(openedUrl);
    expect(decodedUrl).toContain(SAMPLE_LEAD.name);
    expect(decodedUrl).toContain(SAMPLE_LEAD.city);
    expect(decodedUrl).toContain(SAMPLE_LEAD.service);

    await expect.poll(() => crmLeadPayloads.length).toBeGreaterThan(0);
    expect(crmLeadPayloads[0]).toMatchObject({
      name: SAMPLE_LEAD.name,
      city: SAMPLE_LEAD.city,
      service: SAMPLE_LEAD.service,
      question: SAMPLE_LEAD.question,
      // P4 honeypot: a real visitor never fills it.
      website: "",
      whatsappLine: "51910728575",
    });

    await expect(page.locator("#consultation-form-status")).toContainText(PREPARED_STATUS);
  });

  test("selecting the secondary WhatsApp line routes both effects to that number", async ({
    page,
    crmLeadPayloads,
  }) => {
    await stubWindowOpen(page);
    await gotoAndWaitForEnhancement(page);
    await page.locator("#consulta").scrollIntoViewIfNeeded();

    await page.fill('input[name="name"]', SAMPLE_LEAD.name);
    await page.fill('input[name="city"]', SAMPLE_LEAD.city);
    await page.selectOption('select[name="service"]', { label: SAMPLE_LEAD.service });
    await page.selectOption('select[name="whatsapp"]', "51987817100");
    await page.fill('textarea[name="question"]', SAMPLE_LEAD.question);

    await page.click("#consultation-form-submit");

    await expect.poll(() => getOpenedUrls(page)).toHaveLength(1);
    const [openedUrl] = await getOpenedUrls(page);
    expect(openedUrl).toContain("wa.me/51987817100");

    await expect.poll(() => crmLeadPayloads.length).toBeGreaterThan(0);
    expect(crmLeadPayloads[0]).toMatchObject({ whatsappLine: "51987817100" });
  });

  test("required fields block submission — no popup, no API call", async ({
    page,
    crmLeadPayloads,
  }) => {
    await stubWindowOpen(page);
    await gotoAndWaitForEnhancement(page);
    await page.locator("#consulta").scrollIntoViewIfNeeded();

    await page.click("#consultation-form-submit");
    await page.waitForTimeout(300);

    expect(await getOpenedUrls(page)).toEqual([]);
    expect(crmLeadPayloads).toHaveLength(0);
    await expect(page.locator("#consultation-form-status")).toHaveText("");
  });

  test("a slow/rejecting CRM POST never blocks or delays the WhatsApp handoff", async ({ page }) => {
    // Route the CRM POST to hang well past this test's own assertions,
    // proving the fetch is truly fire-and-forget rather than awaited.
    await page.route("**/api/crm-lead", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.fulfill({ status: 500, body: "late" });
    });
    await stubWindowOpen(page);
    await gotoAndWaitForEnhancement(page);
    await page.locator("#consulta").scrollIntoViewIfNeeded();

    await page.fill('input[name="name"]', SAMPLE_LEAD.name);
    await page.fill('input[name="city"]', SAMPLE_LEAD.city);
    await page.selectOption('select[name="service"]', { label: SAMPLE_LEAD.service });
    await page.fill('textarea[name="question"]', SAMPLE_LEAD.question);

    await page.click("#consultation-form-submit");

    await expect.poll(() => getOpenedUrls(page)).toHaveLength(1);
    await expect(page.locator("#consultation-form-status")).toContainText(PREPARED_STATUS, {
      timeout: 2000,
    });
  });
});

// P7 (audit P2-3): `window.open(..., "noopener")` always returns null, so
// the page can't tell whether a popup blocker stopped WhatsApp. The
// status always carries a visible link to the same prepared URL.
test.describe("static consultation form fallbacks (P7)", () => {
  test("after submitting, the status offers a link to the prepared WhatsApp URL", async ({ page }) => {
    await stubWindowOpen(page);
    await gotoAndWaitForEnhancement(page);
    await page.locator("#consulta").scrollIntoViewIfNeeded();

    await page.fill('input[name="name"]', SAMPLE_LEAD.name);
    await page.fill('input[name="city"]', SAMPLE_LEAD.city);
    await page.selectOption('select[name="service"]', { label: SAMPLE_LEAD.service });
    await page.fill('textarea[name="question"]', SAMPLE_LEAD.question);
    await page.click("#consultation-form-submit");

    await expect.poll(() => getOpenedUrls(page)).toHaveLength(1);
    const [openedUrl] = await getOpenedUrls(page);
    const fallback = page.locator("#consultation-form-status a");
    await expect(fallback).toHaveText("Si WhatsApp no se abrió, toca aquí");
    await expect(fallback).toBeVisible();
    expect(await fallback.getAttribute("href")).toBe(openedUrl);
  });
});

test.describe("static consultation form without JavaScript (P7)", () => {
  test.use({ javaScriptEnabled: false });

  test("the submit button is enabled and a direct WhatsApp link is shown", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#consultation-form-submit")).toBeEnabled();
    const direct = page.locator('#consultation-form a[href^="https://wa.me/51910728575"]');
    await expect(direct).toBeVisible();
  });
});
