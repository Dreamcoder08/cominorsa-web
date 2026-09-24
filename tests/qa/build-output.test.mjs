// T11 cutover: this suite used to assert on dist/ (Next/vinext's
// client+server split build, dist/server/wrangler.json, RSC build ids,
// _next/static chunk naming). The static build has none of that — one
// flat dist-static/ directory of prerendered HTML plus a hashed
// assets/ folder — and the canonical wrangler config moved to the repo
// root (wrangler.jsonc). Favicon/OG asset-integrity checks are unrelated
// to the framework and are kept unchanged.
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DIST_STATIC = join(ROOT, "dist-static");
const ASSETS = join(DIST_STATIC, "assets");

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

test("dist-static/ has the expected pages, including the homepage and 404", async () => {
  for (const f of ["index.html", "404.html", "seguridad-minera.html", "preguntas-frecuentes.html"]) {
    assert.ok(await exists(join(DIST_STATIC, f)), `${f} missing from dist-static/`);
  }
});

test("dist-static/assets has the hashed JS bundles and no CSS file", async () => {
  const entries = await readdir(ASSETS);
  // P11: the one stylesheet (P9: @font-face bundled in) is inlined into
  // every page, so no CSS file ships.
  assert.ok(!entries.some((f) => f.endsWith(".css")), `stray CSS file (should be inlined): ${entries}`);
  assert.ok(entries.some((f) => /^mobile-nav-entry-.+\.js$/.test(f)), "mobile-nav-entry-*.js missing");
  assert.ok(entries.some((f) => /^consent-entry-.+\.js$/.test(f)), "consent-entry-*.js missing");
  assert.ok(entries.some((f) => /^consultation-form-entry-.+\.js$/.test(f)), "consultation-form-entry-*.js missing");
});

test("dist-static/_headers declares immutable caching for hashed assets", async () => {
  const raw = await readFile(join(DIST_STATIC, "_headers"), "utf8");
  assert.match(raw, /\/assets\/\*/);
  assert.match(raw, /\/fonts\/\*/);
  assert.match(raw, /immutable/i);
  assert.match(raw, /max-age=\d+/i);
});

test("wrangler.jsonc is the canonical config: name cominorsa-web, serving dist-static/", async () => {
  const raw = await readFile(join(ROOT, "wrangler.jsonc"), "utf8");
  // wrangler.jsonc allows // comments — strip them before JSON.parse.
  const json = raw.replace(/^\s*\/\/.*$/gm, "");
  const cfg = JSON.parse(json);
  assert.equal(cfg.name, "cominorsa-web");
  assert.ok(cfg.compatibility_flags?.includes("nodejs_compat"));
  assert.equal(cfg.main, "src/worker/index.ts");
  assert.equal(cfg.assets?.directory, "dist-static");
  assert.deepEqual(cfg.assets?.run_worker_first, ["/api/*"]);
});

test("wrangler.jsonc keeps dashboard-managed vars on deploy", async () => {
  // The CRM route reads TWENTY_API_URL (plain var) next to its secrets.
  // Without keep_vars, `wrangler deploy` replaces the Worker's plain-text
  // vars with the (empty) set declared here and silently turns lead
  // forwarding into a no-op. Secrets survive either way; vars do not.
  const raw = await readFile(join(ROOT, "wrangler.jsonc"), "utf8");
  const cfg = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ""));
  assert.equal(cfg.keep_vars, true);
});

test("public/ has copied favicons and images into dist-static (public assets are copied verbatim)", async () => {
  for (const f of ["favicon.ico", "apple-touch-icon.png", "og.jpg", "logo-44.png"]) {
    assert.ok(await exists(join(DIST_STATIC, f)), `${f} missing from dist-static/`);
  }
});

// --- Asset integrity (favicon, OG, apple-touch-icon) — unrelated to the
// build framework, unchanged from before the cutover. ---

const PUBLIC = join(ROOT, "public");

/** Reads width/height from a PNG file header (IHDR chunk). */
async function readPngDimensions(filePath) {
  const buf = await readFile(filePath);
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${filePath} is not a PNG`);
  }
  // IHDR is the first chunk: 4 bytes length, 4 bytes "IHDR", 4 width, 4 height
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

test("public/ has favicon.ico (multi-resolution)", async () => {
  const p = join(PUBLIC, "favicon.ico");
  assert.ok(await exists(p), "public/favicon.ico missing");
  const buf = await readFile(p);
  // ICO header: 6 bytes (reserved=0, type=1, count)
  const count = buf.readUInt16LE(4);
  assert.ok(count >= 2, `favicon.ico should have >= 2 sub-icons, got ${count}`);
});

test("public/ has apple-touch-icon.png at 180x180", async () => {
  const p = join(PUBLIC, "apple-touch-icon.png");
  assert.ok(await exists(p), "public/apple-touch-icon.png missing");
  const { width, height } = await readPngDimensions(p);
  assert.equal(
    width,
    180,
    `apple-touch-icon width should be 180, got ${width}`,
  );
  assert.equal(
    height,
    180,
    `apple-touch-icon height should be 180, got ${height}`,
  );
});

/** Reads width/height from a JPEG's first SOFn (start-of-frame) segment. */
async function readJpegDimensions(filePath) {
  const buf = await readFile(filePath);
  if (buf.readUInt16BE(0) !== 0xffd8) throw new Error(`${filePath} is not a JPEG`);
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) throw new Error(`${filePath}: bad JPEG marker at ${offset}`);
    const marker = buf[offset + 1];
    const length = buf.readUInt16BE(offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error(`${filePath}: no SOF segment found`);
}

// P6 (audit P1-3): WhatsApp link previews — the site's main share
// channel — are unreliable for heavy images. JPEG at <= 200 KB is the
// safe OG format for WhatsApp/Facebook.
test("public/og.jpg is a 1200x630 JPEG (Open Graph spec)", async () => {
  const p = join(PUBLIC, "og.jpg");
  assert.ok(await exists(p), "public/og.jpg missing");
  const { width, height } = await readJpegDimensions(p);
  assert.equal(width, 1200, `og.jpg width should be 1200, got ${width}`);
  assert.equal(height, 630, `og.jpg height should be 630, got ${height}`);
});

test("public/og.jpg weighs at most 200 KB", async () => {
  const s = await stat(join(PUBLIC, "og.jpg"));
  assert.ok(s.size <= 200 * 1024, `og.jpg too heavy: ${s.size} bytes`);
});

test("no stale og.png ships alongside og.jpg", async () => {
  assert.equal(await exists(join(PUBLIC, "og.png")), false);
});

// P6 (audit P2-10): only files the site actually serves ship at the
// dist-static/ root — no leftover scaffold SVGs, unused logos or docs.
test("dist-static/ root holds only pages, generated files, and referenced assets", async () => {
  const expected = new Set([
    "_headers",
    "sitemap.xml",
    "robots.txt",
    "manifest.webmanifest",
    "favicon.ico",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "apple-touch-icon.png",
    "og.jpg",
    "logo-44.png",
    "assets",
    "fonts",
  ]);
  const unexpected = (await readdir(DIST_STATIC)).filter(
    (entry) => !entry.endsWith(".html") && !expected.has(entry),
  );
  assert.deepEqual(unexpected, []);
  const fonts = await readdir(join(DIST_STATIC, "fonts"));
  assert.ok(fonts.every((f) => f.endsWith(".woff2")), `non-font file in fonts/: ${fonts}`);
});

// Every root-relative (or own-origin absolute) URL a built page points
// at — links, scripts, stylesheets, preloads, icons, og:image — must
// resolve to a file in dist-static/ (a page route resolves to its
// flat `<slug>.html`, see src/build/build.ts).
test("every same-site URL referenced by the built HTML and CSS resolves to a shipped file", async () => {
  const resolvesTo = async (pathname) => {
    const clean = decodeURIComponent(pathname);
    if (clean === "/") return exists(join(DIST_STATIC, "index.html"));
    return (await exists(join(DIST_STATIC, clean))) || exists(join(DIST_STATIC, `${clean}.html`));
  };

  const pages = (await readdir(DIST_STATIC)).filter((f) => f.endsWith(".html"));
  const missing = [];

  for (const page of pages) {
    const html = await readFile(join(DIST_STATIC, page), "utf8");
    // P11: CSS is inlined — check its url()s (fonts) per page.
    for (const [, css] of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
      for (const [, url] of css.matchAll(/url\(["']?(\/[^"')]+)["']?\)/g)) {
        if (!(await resolvesTo(url))) missing.push(`${page} <style>: ${url}`);
      }
    }
    for (const [, url] of html.matchAll(/(?:href|src|content)="([^"]+)"/g)) {
      let pathname;
      if (url.startsWith("https://cominorsa.com/")) pathname = new URL(url).pathname;
      else if (url.startsWith("/") && !url.startsWith("//")) pathname = url.split(/[?#]/)[0];
      else continue;
      if (pathname === "" || !(await resolvesTo(pathname))) missing.push(`${page}: ${url}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("the built homepage declares the full favicon set", async () => {
  const raw = await readFile(join(DIST_STATIC, "index.html"), "utf8");
  assert.match(raw, /favicon\.ico/);
  assert.match(raw, /apple-touch-icon\.png/);
  assert.match(raw, /favicon-32x32\.png/);
});
