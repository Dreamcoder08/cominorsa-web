import { test, expect, type Page, type Request } from "@playwright/test";

/**
 * `context.waitForEvent("page")` (real popup tracking) and
 * `page.waitForRequest()` both proved unreliable against this exact form —
 * ConsultationForm.tsx fires `window.open` then `fetch` synchronously in
 * one submit handler, and under `@playwright/test`'s harness in this
 * environment both promises hung past a 30s timeout even though the app
 * itself behaved correctly (confirmed independently: a plain
 * `page.on("request")` listener saw the POST, and the dev server's own
 * access log recorded it). Stubbing `window.open` at the page level and
 * recording its arguments — rather than tracking a real new tab — is the
 * standard, deterministic way to test this interaction; it needs no
 * browser-level popup/tab machinery at all.
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

/** Same reasoning as stubWindowOpen's doc comment: a manually-collected
 * listener, armed before the click, is what reliably sees the fetch that
 * `page.waitForRequest()` missed. */
function captureRequestsTo(page: Page, urlSubstring: string) {
  const requests: Request[] = [];
  page.on("request", (req) => {
    if (req.url().includes(urlSubstring)) requests.push(req);
  });
  return requests;
}

// Errors we know about and don't own here — asserting "zero console
// errors" would otherwise make every run fail on a pre-existing issue
// instead of whatever this suite is meant to catch.
//
// The CSP nonce hydration mismatch on the JSON-LD <script> tag (server
// renders a real per-request nonce, client re-render computes "") is
// pre-existing and independent of any change in this session — but it is
// NOT cosmetic: root-caused here while building this suite, it correlates
// with a real race where a very fast click (exactly what automated
// clicking does, and what a real user piling in immediately after paint
// could also do) lands before React finishes hydrating and attaching
// ConsultationForm's onSubmit — the browser then runs the form's *native*
// default submission (GET, every field appended to the URL as a query
// string) since no JS handler was listening yet. `waitForHydration` below
// is this suite's guard against that exact race; the underlying nonce bug
// is unfixed and worth its own follow-up.
const KNOWN_UNRELATED_ERROR_SUBSTRINGS = ["hydration-mismatch"];

function isKnownUnrelatedError(text: string) {
  return KNOWN_UNRELATED_ERROR_SUBSTRINGS.some((s) => text.includes(s));
}

/** See the comment above KNOWN_UNRELATED_ERROR_SUBSTRINGS: interacting
 * with the form before React has hydrated it makes the browser fall back
 * to native form submission. `networkidle` (used in `page.goto`) tracks
 * network activity, not hydration/interactivity, so it does not by itself
 * guarantee this is safe. This is a genuine race, not a fixed delay — 1.5s
 * measurably reduced but did not eliminate it (still saw one flake at that
 * margin), so this is a fixed-timeout mitigation for test stability, not a
 * real fix; a hydration-readiness signal from the app would be the actual
 * fix (see the follow-up this comment recommends filing). */
async function gotoAndWaitForHydration(page: Page, path = "/") {
  await page.goto(path);
  await page.waitForTimeout(2500);
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
