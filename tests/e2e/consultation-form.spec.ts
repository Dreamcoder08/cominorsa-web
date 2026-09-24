import { expect, test, type Page } from "./guarded-test";

/**
 * Stubs `window.open` and records its arguments instead of tracking a real
 * popup via `context.waitForEvent("page")`. Not just a style preference:
 * while tracking down why that (and `page.waitForRequest`) hung for 30s
 * against this exact form (back when it was React's app/ConsultationForm.tsx,
 * pre-T11), the actual cause turned out to be a pre-enhancement
 * native-submission race documented on `gotoAndWaitForEnhancement` below —
 * with no submit listener attached yet, neither `window.open` nor `fetch`
 * ever ran, so there was nothing for either waiter to catch. That race is
 * now handled by waiting for the form's `data-enhanced` marker, set by
 * src/client/dom/consultation-form.ts once its listener is attached (P7:
 * the button itself renders enabled), but stubbing `window.open` remains the
 * right approach on its own merits: it needs no browser-level popup/tab
 * machinery and can't flake on tab-timing regardless.
 */
async function stubWindowOpen(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __openCalls: string[] }).__openCalls = [];
    window.open = (url) => {
      (window as unknown as { __openCalls: string[] }).__openCalls.push(
        String(url ?? ""),
      );
      return null;
    };
  });
}

async function getOpenedUrls(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __openCalls: string[] }).__openCalls,
  );
}

// Historical filter, kept harmless: pre-T11 (React SSR with a per-request
// CSP nonce) browsers would hide a script's `nonce` attribute from JS once
// validated, which could surface as a benign hydration-mismatch console
// warning. The static build (T11) has no SSR, no hydration, and no nonce
// at all, so this should never actually fire anymore — left in place only
// as a defensive no-op in case a future change reintroduces something
// nonce-shaped.
const KNOWN_UNRELATED_ERROR_SUBSTRINGS = ["hydration-mismatch"];

function isKnownUnrelatedError(text: string) {
  return KNOWN_UNRELATED_ERROR_SUBSTRINGS.some((s) => text.includes(s));
}

/** src/client/dom/consultation-form.ts sets `data-enhanced` on the form
 * once its submit listener is attached (P7: the button renders enabled,
 * so it no longer signals readiness). Waiting for that instead of a fixed
 * delay is what makes this deterministic rather than "probably enough
 * time" flakiness. */
async function gotoAndWaitForEnhancement(page: Page, path = "/") {
  await page.goto(path);
  // Playwright's default 5s expect-timeout assumes normal load; running
  // this whole suite's browsers in parallel against one shared dev server
  // can genuinely push real script-execution past that under CPU
  // contention — this is a generous ceiling for a legitimately slow
  // environment, not a race being paved over (the marker appears
  // deterministically once the listener attaches; there's no scenario
  // where waiting longer changes the outcome).
  await expect(page.locator(".consultation-form[data-enhanced]")).toHaveCount(1, {
    timeout: 15000,
  });
}

test.describe("homepage smoke", () => {
  test("loads with no unexpected console errors", async ({ page }) => {
    const unexpectedErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !isKnownUnrelatedError(msg.text())) {
        unexpectedErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      if (!isKnownUnrelatedError(String(err))) {
        unexpectedErrors.push(String(err));
      }
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(unexpectedErrors).toEqual([]);
  });

  test("header WhatsApp CTA opens wa.me with the default inquiry message", async ({
    page,
  }) => {
    await page.goto("/");
    const cta = page.locator("a.header-cta");
    await expect(cta).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/51910728575\?text=/,
    );
    await expect(cta).toHaveAttribute("target", "_blank");
  });
});

test.describe("consultation form — the real client-facing lead flow", () => {
  const SAMPLE_LEAD = {
    name: "Rosa Elvira Quispe Mamani",
    city: "Piura",
    service: "REINFO",
    question:
      "Necesito ayuda para renovar mi inscripcion REINFO antes del vencimiento de este mes.",
  };

  test("submitting opens the prepared WhatsApp message and posts matching lead data", async ({
    page,
    crmLeadPayloads,
  }) => {
    await stubWindowOpen(page);
    await gotoAndWaitForEnhancement(page);
    await page.locator("#consulta").scrollIntoViewIfNeeded();

    const nameInput = page.getByLabel("Nombre completo");
    const cityInput = page.getByLabel("Ciudad o región");
    const questionInput = page.getByLabel("Escribe tu consulta");
    await expect(nameInput).toHaveAttribute("maxlength", "120");
    await expect(cityInput).toHaveAttribute("maxlength", "120");
    await expect(questionInput).toHaveAttribute("maxlength", "2000");

    await nameInput.fill(SAMPLE_LEAD.name);
    await cityInput.fill(SAMPLE_LEAD.city);
    await page.selectOption('select[name="service"]', {
      label: SAMPLE_LEAD.service,
    });
    await questionInput.fill(SAMPLE_LEAD.question);

    await page.click('.consultation-form button[type="submit"]');

    // WhatsApp: right number, right message content.
    await expect.poll(() => getOpenedUrls(page)).toHaveLength(1);
    const [openedUrl] = await getOpenedUrls(page);
    expect(openedUrl).toContain("wa.me/51910728575");
    const decodedUrl = decodeURIComponent(openedUrl);
    expect(decodedUrl).toContain(SAMPLE_LEAD.name);
    expect(decodedUrl).toContain(SAMPLE_LEAD.city);
    expect(decodedUrl).toContain(SAMPLE_LEAD.service);

    // The guarded fixture captures the JSON at the browser boundary and
    // fulfills it without allowing the local app to invoke a provider.
    await expect.poll(() => crmLeadPayloads.length).toBeGreaterThan(0);
    expect(crmLeadPayloads[0]).toMatchObject({
      name: SAMPLE_LEAD.name,
      city: SAMPLE_LEAD.city,
      service: SAMPLE_LEAD.service,
      question: SAMPLE_LEAD.question,
      whatsappLine: "51910728575",
    });

    await expect(page.locator(".form-status")).toContainText(
      "Preparamos tu mensaje en WhatsApp. Revísalo y envíalo para completar tu consulta.",
    );
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
    await page.selectOption('select[name="service"]', {
      label: SAMPLE_LEAD.service,
    });
    await page.selectOption('select[name="whatsapp"]', "51987817100");
    await page.fill('textarea[name="question"]', SAMPLE_LEAD.question);

    await page.click('.consultation-form button[type="submit"]');

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

    // Submit with every field left empty — native HTML5 required validation
    // must block it before the form's own JS handler ever runs.
    await page.click('.consultation-form button[type="submit"]');
    await page.waitForTimeout(300);

    expect(await getOpenedUrls(page)).toEqual([]);
    expect(crmLeadPayloads).toHaveLength(0);
    await expect(page.locator(".form-status")).toHaveText("");
  });
});
