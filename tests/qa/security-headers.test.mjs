import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// T11 cutover: security response headers (CSP, HSTS, X-Frame-Options,
// etc.) used to be set per-request by proxy.ts (Next SSR middleware).
// The static build has no per-request middleware at all — Cloudflare
// applies `dist-static/_headers` (generated at build time by
// src/build/headers.ts, from the single-source-of-truth
// src/build/security-policy.ts) directly at the edge to every response
// served from the static-assets binding. These tests read that real,
// built file — the actual bytes Cloudflare would apply — instead of
// performing a live request against a per-request handler that no
// longer exists. See src/worker/security-headers.test.ts for the
// separate proof that the 2 API routes (which Cloudflare does NOT apply
// `_headers` to — see that file's own header comment) carry the same
// policy.

const HEADERS_FILE = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
  "dist-static",
  "_headers",
);

const rawHeadersFile = await readFile(HEADERS_FILE, "utf8");

test("dist-static/_headers exists and is non-trivial", () => {
  assert.ok(rawHeadersFile.length > 50, "dist-static/_headers missing or too short");
});

test("the /* rule (every page) carries the full security header set", () => {
  const rootBlock = rawHeadersFile.match(/^\/\*\n([\s\S]*?)(?=\n\/|\n*$)/)?.[1] ?? "";
  assert.match(rootBlock, /Content-Security-Policy:\s*default-src 'self'/);
  assert.match(rootBlock, /X-Frame-Options:\s*DENY/);
  assert.match(rootBlock, /X-Content-Type-Options:\s*nosniff/);
  assert.match(rootBlock, /Referrer-Policy:\s*strict-origin-when-cross-origin/);
  assert.match(rootBlock, /Strict-Transport-Security:[^\n]*max-age=63072000/);
  assert.match(rootBlock, /Strict-Transport-Security:[^\n]*includeSubDomains/);
  assert.match(rootBlock, /Strict-Transport-Security:[^\n]*preload/);
  assert.match(rootBlock, /Permissions-Policy:[^\n]*camera=\(\)/);
  assert.match(rootBlock, /Permissions-Policy:[^\n]*microphone=\(\)/);
  assert.match(rootBlock, /Permissions-Policy:[^\n]*geolocation=\(\)/);
});

test("CSP allows WhatsApp as image/connect/form-action target", () => {
  assert.match(rawHeadersFile, /img-src[^\n]*https:\/\/wa\.me/);
  assert.match(rawHeadersFile, /connect-src[^\n]*https:\/\/wa\.me/);
  assert.match(rawHeadersFile, /form-action[^\n]*https:\/\/wa\.me/);
});

test("CSP allows the GA4 hosts this site actually needs (script-src, connect-src, img-src)", () => {
  assert.match(rawHeadersFile, /script-src[^\n]*https:\/\/www\.googletagmanager\.com/);
  assert.match(rawHeadersFile, /connect-src[^\n]*https:\/\/www\.google-analytics\.com/);
  assert.match(rawHeadersFile, /connect-src[^\n]*https:\/\/www\.googletagmanager\.com/);
});

test("CSP forbids framing (clickjacking protection)", () => {
  assert.match(rawHeadersFile, /frame-ancestors 'none'/);
});

test("CSP script-src has no nonce, no 'unsafe-inline', no 'unsafe-eval' — the static build ships zero inline scripts", () => {
  const scriptSrc = rawHeadersFile.match(/script-src([^\n;]+)/)?.[1] ?? "";
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.doesNotMatch(scriptSrc, /'nonce-/);
  assert.match(scriptSrc, /'self'/);
});

test("no overly permissive CSP directives (no unsafe-eval, no wildcard default-src)", () => {
  assert.doesNotMatch(rawHeadersFile, /'unsafe-eval'/);
  assert.doesNotMatch(rawHeadersFile, /default-src\s+\*/);
});

test("/assets/* and /fonts/* get immutable caching; the page rule (/*) does not", () => {
  const assetsBlock = rawHeadersFile.match(/\/assets\/\*\n([\s\S]*?)(?=\n\/|\n*$)/)?.[1] ?? "";
  const fontsBlock = rawHeadersFile.match(/\/fonts\/\*\n([\s\S]*?)(?=\n\/|\n*$)/)?.[1] ?? "";
  assert.match(assetsBlock, /Cache-Control:\s*public, max-age=31536000, immutable/);
  assert.match(fontsBlock, /Cache-Control:\s*public, max-age=31536000, immutable/);

  const rootBlock = rawHeadersFile.match(/^\/\*\n([\s\S]*?)(?=\n\/|\n*$)/)?.[1] ?? "";
  assert.doesNotMatch(rootBlock, /Cache-Control/);
});
