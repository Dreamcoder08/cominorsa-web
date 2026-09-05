import { test, expect, type Page, type Request } from "@playwright/test";

/**
 * Stubs `window.open` and records its arguments instead of tracking a real
 * popup via `context.waitForEvent("page")`. Not just a style preference:
 * while tracking down why that (and `page.waitForRequest`) hung for 30s
 * against this exact form, the actual cause turned out to be the
 * pre-hydration native-submission race documented on
 * `gotoAndWaitForHydration` below — with no submit handler attached yet,
 * neither `window.open` nor `fetch` ever ran, so there was nothing for
 * either waiter to catch. That race is now closed at the source
 * (ConsultationForm.tsx disables its submit button until mounted), but
 * stubbing `window.open` remains the right approach on its own merits: it
 * needs no browser-level popup/tab machinery and can't flake on tab-timing
 * regardless.
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

/** Same reasoning as stubWindowOpen's doc comment (see above) — a
 * manually-collected listener armed before the click, rather than
 * `page.waitForRequest()`. */
function captureRequestsTo(page: Page, urlSubstring: string) {
  const requests: Request[] = [];
  page.on("request", (req) => {
    if (req.url().includes(urlSubstring)) requests.push(req);
  });
  return requests;
}

// A known, expected React/CSP interaction, not a bug: browsers hide a
// script's `nonce` attribute from JS (React's hydration check included)
// once the CSP nonce has been validated, as a defense against nonce
// exfiltration — so app/layout.tsx's real per-request nonce always reads
// back as "" on the client even though it did its job server-side. See
// app/layout.tsx's suppressHydrationWarning comment on the JSON-LD
// <script> tag. Asserting "zero console errors" would otherwise make
// every run fail on this expected warning instead of whatever this suite
// is meant to catch.
const KNOWN_UNRELATED_ERROR_SUBSTRINGS = ["hydration-mismatch"];

function isKnownUnrelatedError(text: string) {
  return KNOWN_UNRELATED_ERROR_SUBSTRINGS.some((s) => text.includes(s));
}

/** ConsultationForm's submit button starts `disabled` until the component
 * mounts client-side (see the `mounted` comment in ConsultationForm.tsx) —
 * specifically so a click can never land before React has hydrated and
 * attached the real onSubmit handler. Waiting for that instead of a fixed
 * delay is what makes this deterministic rather than "probably enough
 * time" flakiness. */
async function gotoAndWaitForHydration(page: Page, path = "/") {
  await page.goto(path);
  // Playwright's default 5s expect-timeout assumes normal load; running
  // this whole suite's browsers in parallel against one shared dev server
  // (itself an unbundled Vite process, slower to interactive than a
  // production build) can genuinely push real hydration past that under
  // CPU contention — this is a generous ceiling for a legitimately slow
  // environment, not a race being paved over (the button becomes enabled
  // deterministically once mounted; there's no scenario where waiting
  // longer changes the outcome).
  await expect(
    page.locator('.consultation-form button[type="submit"]'),
  ).toBeEnabled({ timeout: 15000 });
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

  test("filling and submitting sends the lead to WhatsApp and to /api/crm-lead with matching data", async ({
    page,
  }) => {
    await stubWindowOpen(page);
    await gotoAndWaitForHydration(page);
    await page.locator("#consulta").scrollIntoViewIfNeeded();

    await page.fill('input[name="name"]', SAMPLE_LEAD.name);
    await page.fill('input[name="city"]', SAMPLE_LEAD.city);
    await page.selectOption('select[name="service"]', {
      label: SAMPLE_LEAD.service,
    });
    await page.fill('textarea[name="question"]', SAMPLE_LEAD.question);

    const apiRequests = captureRequestsTo(page, "/api/crm-lead");
    await page.click('.consultation-form button[type="submit"]');

    // WhatsApp: right number, right message content.
    await expect.poll(() => getOpenedUrls(page)).toHaveLength(1);
    const [openedUrl] = await getOpenedUrls(page);
    expect(openedUrl).toContain("wa.me/51910728575");
    const decodedUrl = decodeURIComponent(openedUrl);
    expect(decodedUrl).toContain(SAMPLE_LEAD.name);
    expect(decodedUrl).toContain(SAMPLE_LEAD.city);
    expect(decodedUrl).toContain(SAMPLE_LEAD.service);

    // /api/crm-lead: same data, forwarded as JSON (this is the boundary
    // ConsultationForm owns — what the route handler does with it once it
    // has the data is covered by tests/qa/crm-lead-route.test.mjs, and by
    // manual verification against a real local Twenty instance).
    await expect.poll(() => apiRequests.length).toBeGreaterThan(0);
    const apiRequest = apiRequests[0];
    expect(apiRequest.method()).toBe("POST");
    const body = apiRequest.postDataJSON();
    expect(body).toMatchObject({
      name: SAMPLE_LEAD.name,
      city: SAMPLE_LEAD.city,
      service: SAMPLE_LEAD.service,
      question: SAMPLE_LEAD.question,
      whatsappLine: "51910728575",
    });

    await expect(page.locator(".form-status")).toHaveText(
      "Tu mensaje fue preparado y enviado a WhatsApp.",
    );
  });

  test("selecting the secondary WhatsApp line routes both effects to that number", async ({
    page,
  }) => {
    await stubWindowOpen(page);
    await gotoAndWaitForHydration(page);
    await page.locator("#consulta").scrollIntoViewIfNeeded();

    await page.fill('input[name="name"]', SAMPLE_LEAD.name);
    await page.fill('input[name="city"]', SAMPLE_LEAD.city);
    await page.selectOption('select[name="service"]', {
      label: SAMPLE_LEAD.service,
    });
    await page.selectOption('select[name="whatsapp"]', "51987817100");
    await page.fill('textarea[name="question"]', SAMPLE_LEAD.question);

    const apiRequests = captureRequestsTo(page, "/api/crm-lead");
    await page.click('.consultation-form button[type="submit"]');

    await expect.poll(() => getOpenedUrls(page)).toHaveLength(1);
    const [openedUrl] = await getOpenedUrls(page);
    expect(openedUrl).toContain("wa.me/51987817100");

    await expect.poll(() => apiRequests.length).toBeGreaterThan(0);
    const body = apiRequests[0].postDataJSON();
    expect(body.whatsappLine).toBe("51987817100");
  });

  test("required fields block submission — no popup, no API call", async ({
    page,
  }) => {
    await stubWindowOpen(page);
    await gotoAndWaitForHydration(page);
    await page.locator("#consulta").scrollIntoViewIfNeeded();

    const apiRequests = captureRequestsTo(page, "/api/crm-lead");

    // Submit with every field left empty — native HTML5 required validation
    // must block it before the form's own JS handler ever runs.
    await page.click('.consultation-form button[type="submit"]');
    await page.waitForTimeout(300);

    expect(await getOpenedUrls(page)).toEqual([]);
    expect(apiRequests).toHaveLength(0);
    await expect(page.locator(".form-status")).toHaveText("");
  });
});
