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
