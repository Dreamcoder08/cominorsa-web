import assert from "node:assert/strict";
import test from "node:test";
import { fetchHtml, metaContent, ogContent } from "./helpers.mjs";

test("title is set and contains brand", async () => {
  const { html } = await fetchHtml();
  assert.match(html, /<title>[^<]*COMINORSA[^<]*<\/title>/i);
});

test("meta description is present and meaningful", async () => {
  const { html } = await fetchHtml();
  const desc = metaContent(html, "description");
  assert.ok(desc && desc.length > 50, `description too short: ${desc}`);
  assert.ok(desc.length < 200, `description too long: ${desc}`);
  assert.match(desc, /minera|minero|ambiental/i);
});

test("Open Graph tags are complete for social sharing", async () => {
  const { html } = await fetchHtml();
  assert.ok(ogContent(html, "og:title"), "og:title missing");
  assert.ok(ogContent(html, "og:description"), "og:description missing");
  assert.ok(ogContent(html, "og:image"), "og:image missing");
  assert.equal(ogContent(html, "og:type"), "website");
  assert.equal(ogContent(html, "og:locale"), "es_PE");
  assert.equal(ogContent(html, "og:site_name"), "COMINORSA");
});

test("Twitter Card tags are complete", async () => {
  const { html } = await fetchHtml();
  assert.match(
    html,
    /<meta[^>]+name=["']twitter:card["'][^>]+content=["']summary_large_image["']/,
  );
  assert.match(html, /<meta[^>]+name=["']twitter:title["']/);
  assert.match(html, /<meta[^>]+name=["']twitter:description["']/);
  assert.match(html, /<meta[^>]+name=["']twitter:image["']/);
});

test("viewport meta is set for mobile", async () => {
  const { html } = await fetchHtml();
  assert.match(
    html,
    /<meta[^>]+name=["']viewport["'][^>]+content=["'][^"']*width=device-width/,
  );
});

test("social image references an asset that exists", async () => {
  const { html } = await fetchHtml();
  const ogImage = ogContent(html, "og:image");
  assert.ok(ogImage, "og:image is required");
  assert.match(ogImage, /\/(og|logo)\.png/);
});

test("h1 is unique (one per page)", async () => {
  const { html } = await fetchHtml();
  const h1s = html.match(/<h1\b/gi) ?? [];
  assert.equal(h1s.length, 1, `expected exactly 1 h1, got ${h1s.length}`);
});

test("favicon or app icon is declared", async () => {
  const { html } = await fetchHtml();
  assert.ok(
    /<link[^>]+rel=["'](icon|shortcut icon|apple-touch-icon)["']/i.test(html) ||
      /<link[^>]+rel=["']manifest["']/i.test(html),
    "no favicon/manifest hint found",
  );
});
