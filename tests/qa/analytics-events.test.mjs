import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { fetchHtml } from "./helpers.mjs";

// Vendor-neutral `data-event`/`data-event-context` markup convention for the
// site's WhatsApp conversion touchpoints and the contact form's submission
// attempt. These attributes are inert: no script reads or dispatches them
// yet (see openspec/changes/analytics-event-tracking).

function readAppSource(relativePath) {
  return readFileSync(
    fileURLToPath(new URL(`../../app/${relativePath}`, import.meta.url)),
    "utf8",
  );
}

test("header CTA carries whatsapp_cta_click event with header context", async () => {
  const { html } = await fetchHtml("/");
  const match = html.match(/<a[^>]*class="header-cta"[^>]*>/);
  assert.ok(match, "header CTA anchor not found in rendered HTML");
  assert.match(match[0], /data-event="whatsapp_cta_click"/);
  assert.match(match[0], /data-event-context="header"/);
});

test("mobile-nav panel CTA carries whatsapp_cta_click event with mobile-nav context", async () => {
  const { html } = await fetchHtml("/");
  const match = html.match(
    /<a[^>]*class="button button-primary mobile-nav-panel-cta"[^>]*>/,
  );
  assert.ok(match, "mobile-nav panel CTA anchor not found in rendered HTML");
  assert.match(match[0], /data-event="whatsapp_cta_click"/);
  assert.match(match[0], /data-event-context="mobile-nav"/);
});

test("service page CTAs carry distinct data-event-context values matching their own slug", async () => {
  const [igafom, seguridad] = await Promise.all([
    fetchHtml("/igafom-reinfo"),
    fetchHtml("/seguridad-minera"),
  ]);

  const igafomMatch = igafom.html.match(
    /<a[^>]*class="button button-primary"[^>]*>/,
  );
  const seguridadMatch = seguridad.html.match(
    /<a[^>]*class="button button-primary"[^>]*>/,
  );

  assert.ok(igafomMatch, "igafom-reinfo service CTA anchor not found");
  assert.ok(seguridadMatch, "seguridad-minera service CTA anchor not found");

  assert.match(igafomMatch[0], /data-event="whatsapp_cta_click"/);
  assert.match(igafomMatch[0], /data-event-context="igafom-reinfo"/);

  assert.match(seguridadMatch[0], /data-event="whatsapp_cta_click"/);
  assert.match(seguridadMatch[0], /data-event-context="seguridad-minera"/);

  const igafomContext = igafomMatch[0].match(/data-event-context="([^"]+)"/)[1];
  const seguridadContext = seguridadMatch[0].match(
    /data-event-context="([^"]+)"/,
  )[1];
  assert.notEqual(
    igafomContext,
    seguridadContext,
    "service pages must carry different data-event-context values",
  );
});

test("home page initial markup has no contact-submit attempt marker (submit-time-only)", async () => {
  const { html } = await fetchHtml("/");
  assert.doesNotMatch(html, /data-event="contact_submit_attempt"/);
});

test("ConsultationForm handleSubmit sets dataset event attributes before window.open", () => {
  const source = readAppSource("ConsultationForm.tsx");

  const eventIndex = source.indexOf("dataset.event = CONTACT_SUBMIT_EVENT");
  const contextIndex = source.indexOf("dataset.eventContext = service");
  const windowOpenIndex = source.indexOf("window.open(");

  assert.notEqual(
    eventIndex,
    -1,
    "handleSubmit does not set event.currentTarget.dataset.event",
  );
  assert.notEqual(
    contextIndex,
    -1,
    "handleSubmit does not set event.currentTarget.dataset.eventContext",
  );
  assert.notEqual(windowOpenIndex, -1, "window.open call not found");
  assert.ok(
    eventIndex < windowOpenIndex,
    "dataset.event must be set before window.open",
  );
  assert.ok(
    contextIndex < windowOpenIndex,
    "dataset.eventContext must be set before window.open",
  );
});

test("SiteHeader.tsx has no locally declared WHATSAPP_INFORMATION constant", () => {
  const source = readAppSource("SiteHeader.tsx");

  assert.doesNotMatch(source, /const WHATSAPP_INFORMATION\s*=/);
  assert.match(
    source,
    /import\s*\{[^}]*WHATSAPP_INFORMATION[^}]*\}\s*from\s*"\.\/constants"/,
  );
});
