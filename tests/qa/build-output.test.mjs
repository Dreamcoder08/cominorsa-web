import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DIST = join(ROOT, "dist");
const SERVER = join(DIST, "server");
const CLIENT = join(DIST, "client");
const STATIC = join(CLIENT, "_next", "static");

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

test("dist/ has both client and server output", async () => {
  assert.ok(await exists(CLIENT), "client/ missing");
  assert.ok(await exists(SERVER), "server/ missing");
});

test("dist/server has the worker entry point (index.js)", async () => {
  const p = join(SERVER, "index.js");
  assert.ok(await exists(p), "server/index.js missing");
  const s = await stat(p);
  assert.ok(
    s.size > 1000,
    `server/index.js suspiciously small: ${s.size} bytes`,
  );
});

test("dist/server has wrangler.json generated for Cloudflare", async () => {
  const p = join(SERVER, "wrangler.json");
  assert.ok(await exists(p), "wrangler.json missing");
  const cfg = JSON.parse(await readFile(p, "utf8"));
  assert.equal(cfg.name, "cominorsa-web");
  assert.ok(cfg.compatibility_flags?.includes("nodejs_compat"));
  assert.equal(cfg.main, "index.js");
  assert.equal(cfg.assets?.directory, "../client");
});

test("dist/client has the static assets bundle", async () => {
  assert.ok(await exists(join(CLIENT, "og.png")), "og.png missing");
  assert.ok(await exists(join(CLIENT, "logo.png")), "logo.png missing");
  const staticEntries = await readdir(STATIC);
  assert.ok(
    staticEntries.includes("chunks"),
    "chunks/ missing under _next/static",
  );
  assert.ok(staticEntries.includes("css"), "css/ missing under _next/static");
});

test("_next/static/chunks has JS bundles", async () => {
  const chunksDir = join(STATIC, "chunks");
  const files = await readdir(chunksDir);
  const jsFiles = files.filter((f) => f.endsWith(".js"));
  assert.ok(
    jsFiles.length >= 3,
    `expected >= 3 JS chunks, got ${jsFiles.length}`,
  );
  assert.ok(
    files.some((f) => f.startsWith("framework-")),
    "framework chunk missing",
  );
  assert.ok(
    files.some((f) => f.startsWith("vinext-")),
    "vinext chunk missing",
  );
  assert.ok(
    files.some((f) => f.startsWith("index-")),
    "index chunk missing",
  );
});

test("_headers config sets immutable caching for static assets", async () => {
  const raw = await readFile(join(CLIENT, "_headers"), "utf8");
  assert.match(raw, /\/_next\/static\/\*/);
  assert.match(raw, /immutable/i);
  assert.match(raw, /max-age=\d+/i);
});

test("server manifest files exist (vinext internals)", async () => {
  const required = [
    "vinext-externals.json",
    "vinext-server.json",
    "vinext-client-assets.js",
  ];
  for (const f of required) {
    assert.ok(await exists(join(SERVER, f)), `${f} missing from server/`);
  }
});

test("RSC build id is set", async () => {
  assert.ok(await exists(join(SERVER, "RSC_BUILD_ID")));
  assert.ok(await exists(join(SERVER, "BUILD_ID")));
});

// --- Asset integrity (favicon, OG, apple-touch-icon) ---

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

test("public/og.png is 1200x630 (Open Graph spec)", async () => {
  const p = join(PUBLIC, "og.png");
  assert.ok(await exists(p), "public/og.png missing");
  const { width, height } = await readPngDimensions(p);
  assert.equal(width, 1200, `og.png width should be 1200, got ${width}`);
  assert.equal(height, 630, `og.png height should be 630, got ${height}`);
});

test("public/og.png size is under 1 MB", async () => {
  const p = join(PUBLIC, "og.png");
  const s = await stat(p);
  assert.ok(s.size < 1024 * 1024, `og.png too heavy: ${s.size} bytes`);
});

test("metadata declares the new favicon set", async () => {
  const layoutPath = join(ROOT, "app", "layout.tsx");
  const raw = await readFile(layoutPath, "utf8");
  assert.match(raw, /favicon\.ico/);
  assert.match(raw, /apple-touch-icon\.png/);
  assert.match(raw, /favicon-32x32\.png/);
});
