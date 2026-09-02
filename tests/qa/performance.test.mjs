import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import { extname } from "node:path";
import test from "node:test";
import { fetchHtml } from "./helpers.mjs";

const CHUNKS_DIR = new URL(
  "../../dist/client/_next/static/chunks/",
  import.meta.url,
);
const CSS_DIR = new URL("../../dist/client/_next/static/css/", import.meta.url);

async function totalBytes(dirUrl, ext) {
  const dir = new URL(dirUrl);
  let total = 0;
  let count = 0;
  for (const entry of await readdir(dir)) {
    if (ext && extname(entry) !== ext) continue;
    const s = await stat(new URL(entry, dir));
    total += s.size;
    count++;
  }
  return { total, count };
}

test("total JS bundle is under 600 KB", async () => {
  const { total, count } = await totalBytes(CHUNKS_DIR, ".js");
  const kb = Math.round(total / 1024);
  console.log(`  JS: ${count} files, ${kb} KB total`);
  assert.ok(total > 0, "should have JS chunks");
  assert.ok(total < 600_000, `JS bundle too large: ${kb} KB`);
});

test("total CSS is under 50 KB", async () => {
  const { total, count } = await totalBytes(CSS_DIR, ".css");
  const kb = Math.round(total / 1024);
  console.log(`  CSS: ${count} files, ${kb} KB total`);
  assert.ok(total > 0, "should have CSS");
  assert.ok(total < 50_000, `CSS too large: ${kb} KB`);
});

test("no single JS chunk exceeds 250 KB", async () => {
  const dir = new URL(CHUNKS_DIR);
  for (const entry of await readdir(dir)) {
    if (extname(entry) !== ".js") continue;
    const s = await stat(new URL(entry, dir));
    const kb = Math.round(s.size / 1024);
    assert.ok(
      s.size < 250_000,
      `chunk ${entry} is ${kb} KB - consider splitting`,
    );
  }
});

test("worker render completes in under 3s", async () => {
  const t0 = performance.now();
  const { status } = await fetchHtml();
  const ms = performance.now() - t0;
  console.log(`  Render: ${ms.toFixed(0)} ms (status ${status})`);
  assert.equal(status, 200);
  assert.ok(ms < 3000, `render took ${ms.toFixed(0)} ms`);
});

test("HTML response is under 100 KB", async () => {
  const { status, html } = await fetchHtml();
  assert.equal(status, 200);
  const kb = Math.round(html.length / 1024);
  console.log(`  HTML: ${kb} KB`);
  assert.ok(html.length < 100_000, `HTML too large: ${kb} KB`);
});

test("critical JS chunks are referenced from HTML", async () => {
  const { html } = await fetchHtml();
  assert.match(html, /\/chunks\/index-[^"]+\.js/);
  assert.match(html, /\/chunks\/framework-[^"]+\.js/);
  assert.match(html, /\/chunks\/vinext-[^"]+\.js/);
});

test("logo image is preload-hinted", async () => {
  const { html } = await fetchHtml();
  // Allow attribute order to vary; use a flexible pattern.
  assert.match(
    html,
    /<link[^>]*\bhref=["']\/logo\.png["'][^>]*\bas=["']image["']/,
  );
});

test("CSS stylesheet is linked", async () => {
  const { html } = await fetchHtml();
  assert.match(
    html,
    /<link[^>]*\brel=["']stylesheet["'][^>]*\/_next\/static\/css\//,
  );
});
