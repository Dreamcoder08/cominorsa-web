import assert from "node:assert/strict";
import test from "node:test";
import { fetchHtml } from "./helpers.mjs";

// Patterns we never want to see in rendered HTML.
const SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key
  /\bAIza[0-9A-Za-z_-]{35}\b/, // GCP API key
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/, // PEM private key
  /\bghp_[A-Za-z0-9]{36}\b/, // GitHub PAT
  /\bsk-[A-Za-z0-9]{20,}\b/, // OpenAI / generic sk- key
  /\bxox[abp]-[A-Za-z0-9-]+\b/, // Slack tokens
];

test("HTML does not leak common secret patterns", async () => {
  const { html } = await fetchHtml();
  for (const pat of SECRET_PATTERNS) {
    assert.doesNotMatch(
      html,
      pat,
      `HTML contains suspicious secret pattern ${pat}`,
    );
  }
});

test("HTML does not expose server-internal stack info", async () => {
  const { html } = await fetchHtml();
  // No accidental exposure of internal error templates or stack markers.
  assert.doesNotMatch(html, /at Object\.<anonymous>/);
  assert.doesNotMatch(html, /at async \w+ \(/);
  assert.doesNotMatch(html, /node_modules\/[^\s"']+/);
});

test("WhatsApp link contains expected phone numbers", async () => {
  const { html } = await fetchHtml();
  // Only the primary number has a static wa.me anchor now — the contact
  // section used to have one WhatsApp button per number (redundant with
  // the tel: link right above each), collapsed to a single CTA. The
  // secondary number is still reachable via WhatsApp through the
  // consultation form's line selector (ConsultationForm.tsx), which
  // builds that wa.me URL client-side on submit, so it won't appear in
  // server-rendered HTML — the next test covers its tel: link instead.
  assert.match(html, /wa\.me\/51910728575/);
});

test("tel: links use the same business numbers", async () => {
  const { html } = await fetchHtml();
  assert.match(html, /href="tel:\+51987817100"/);
  assert.match(html, /href="tel:\+51910728575"/);
});

test("RUC is present in footer (transparency for Peruvian company)", async () => {
  const { html } = await fetchHtml();
  assert.match(html, /\bRUC\s*20614147131\b/);
});

test("no mixed-content risks: all URLs are https or protocol-relative", async () => {
  const { html } = await fetchHtml();
  // Find any http:// (not https://) in the HTML
  const unsafe = html.match(/href=["']http:\/\/[^"']+["']/g) ?? [];
  // The test environment uses http://localhost; production uses https.
  for (const u of unsafe) {
    assert.match(u, /localhost/, `non-https link in production: ${u}`);
  }
});

test("page is a Workers-compatible response (text/html, charset)", async () => {
  const { headers, html } = await fetchHtml();
  const ct = headers["content-type"] ?? "";
  assert.match(ct, /text\/html/i);
  // charset is set either via Content-Type header or via <meta charset>
  const hasCharsetHeader = /charset=/i.test(ct);
  const hasMetaCharset = /<meta[^>]*\bcharset=/i.test(html);
  assert.ok(hasCharsetHeader || hasMetaCharset, "charset not declared");
});
