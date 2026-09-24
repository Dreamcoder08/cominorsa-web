// T11 cutover: this suite used to walk dist/client/_next/static/ (Next's
// framework JS/CSS chunks) and time a per-request Worker render. Bundle
// size budgets moved to tests/qa/bundle-budget.test.mjs (dist-static/assets/,
// gzip-based, tightened to match this site's real ~5 KB JS output — see
// that file's own header comment); this file keeps the checks that are
// still meaningful against a real static page: overall HTML weight, that
// the built module scripts are actually referenced, and that the built
// stylesheet is linked.
//
// Dropped, not translated (superseded elsewhere, listed here so the
// removal is traceable):
//   - "worker render completes in under 3s" — timed a per-request SSR
//     render; a static file read has no equivalent runtime cost to
//     measure (real page-load performance now belongs to a Lighthouse/
//     CDN-level check, out of this suite's scope).
//   - "critical JS chunks are referenced from HTML" — checked for
//     framework-*/vinext-*/index-*.js chunk names that no longer exist.
//     Replaced below by a check for the real mobile-nav/consent module
//     scripts, already covered at the bun-test layer too
//     (src/build/build.test.ts).
//   - "logo image is preload-hinted" — the static build never preloads
//     the logo (only the critical Archivo font, T5); already covered by
//     src/build/document.test.ts's "preloads only the critical font".
import assert from "node:assert/strict";
import test from "node:test";
import { fetchHtml } from "./helpers.mjs";

test("HTML response is under 100 KB", async () => {
  const { status, html } = await fetchHtml();
  assert.equal(status, 200);
  const kb = Math.round(html.length / 1024);
  console.log(`  HTML: ${kb} KB`);
  assert.ok(html.length < 100_000, `HTML too large: ${kb} KB`);
});

test("the mobile-nav and consent module scripts are referenced from every page", async () => {
  const { html } = await fetchHtml("/");
  assert.match(html, /<script type="module" src="\/assets\/mobile-nav-entry-[^"]+\.js" defer><\/script>/);
  assert.match(html, /<script type="module" src="\/assets\/consent-entry-[^"]+\.js" defer><\/script>/);
});

test("only the homepage additionally references the consultation-form module script", async () => {
  const [home, service] = await Promise.all([
    fetchHtml("/"),
    fetchHtml("/seguridad-minera"),
  ]);
  assert.match(home.html, /\/assets\/consultation-form-entry-[^"]+\.js/);
  assert.doesNotMatch(service.html, /\/assets\/consultation-form-entry-/);
});

test("CSS stylesheet is linked", async () => {
  const { html } = await fetchHtml();
  assert.match(
    html,
    /<link[^>]*\brel=["']stylesheet["'][^>]*\/assets\/globals-[^"']+\.css/,
  );
});
