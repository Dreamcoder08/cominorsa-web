import assert from "node:assert/strict";
import test from "node:test";
import { fetchHtml } from "./helpers.mjs";

// Strip <script> and <style> blocks so we only inspect structural HTML.
function stripScripts(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

test("html has lang attribute on the root element", async () => {
  const { html } = await fetchHtml();
  assert.match(html, /<html[^>]*\blang=["'][^"']+["']/i);
  assert.match(html, /<html[^>]*\blang=["']es["']/i);
});

test("skip-link to main content is present and functional", async () => {
  const { html } = await fetchHtml();
  assert.match(html, /class="skip-link"/);
  assert.match(html, /href="#contenido"/);
  assert.match(html, /id="contenido"/);
});

test("all anchor links have an href", async () => {
  const { html } = await fetchHtml();
  const visible = stripScripts(html);
  const anchors = visible.match(/<a\b[^>]*>/g) ?? [];
  assert.ok(anchors.length > 0, "should have anchor tags");
  for (const tag of anchors) {
    assert.match(
      tag,
      /href=["'][^"']+["']/i,
      `anchor missing href: ${tag.slice(0, 120)}`,
    );
  }
});

test("external links set rel for safety", async () => {
  const { html } = await fetchHtml();
  const visible = stripScripts(html);
  const external =
    visible.match(/<a\b[^>]*\btarget=["']_blank["'][^>]*>/g) ?? [];
  assert.ok(external.length > 0, "WhatsApp links should open externally");
  for (const tag of external) {
    assert.match(
      tag,
      /\brel=["'][^"']*\bnoreferrer\b[^"']*["']/i,
      `external link missing rel="noreferrer": ${tag.slice(0, 120)}`,
    );
  }
});

test("navigation landmarks are present", async () => {
  const { html } = await fetchHtml();
  assert.match(html, /<header\b/i);
  assert.match(html, /<\/header>/i);
  assert.match(html, /<main\b/i);
  assert.match(html, /<\/main>/i);
  assert.match(html, /<footer\b/i);
  assert.match(html, /<\/footer>/i);
  assert.match(html, /<nav[^>]*aria-label=["']Navegación principal["']/i);
});

test("heading hierarchy is monotonic (no level skips)", async () => {
  const { html } = await fetchHtml();
  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  assert.ok(headings.length > 0, "page should have headings");
  assert.equal(headings[0], 1, "first heading must be h1");
  for (let i = 1; i < headings.length; i++) {
    const diff = headings[i] - headings[i - 1];
    assert.ok(
      diff <= 1,
      `heading jump from h${headings[i - 1]} to h${headings[i]} is not allowed`,
    );
  }
});

test("images have alt attributes", async () => {
  const { html } = await fetchHtml();
  const imgs = html.match(/<img\b[^>]*>/g) ?? [];
  assert.ok(imgs.length > 0, "logo images should exist");
  for (const tag of imgs) {
    assert.match(
      tag,
      /\balt=["'][^"']*["']/i,
      `img missing alt: ${tag.slice(0, 120)}`,
    );
  }
});

test("form controls have name or aria-label", async () => {
  const { html } = await fetchHtml();
  const inputs = html.match(/<(input|select|textarea)\b[^>]*>/g) ?? [];
  assert.ok(inputs.length > 0, "form should have inputs");
  for (const tag of inputs) {
    const hasAriaLabel = /\baria-label=["'][^"']+["']/i.test(tag);
    const hasName = /\bname=["'][^"']+["']/i.test(tag);
    assert.ok(
      hasName || hasAriaLabel,
      `form control missing name/aria-label: ${tag.slice(0, 120)}`,
    );
  }
});

test("decorative content is hidden from assistive tech", async () => {
  const { html } = await fetchHtml();
  assert.match(html, /class="hero-contours"[^>]*aria-hidden="true"/);
});

test("page is in Spanish", async () => {
  const { html } = await fetchHtml();
  assert.match(html, /<html[^>]*\blang=["']es["']/i);
  assert.match(html, /Ir al contenido/);
  assert.match(html, /Navegación principal|Nuestros servicios/);
});
