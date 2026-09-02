import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const HEADERS_FILE = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
  "public",
  "_headers",
);

const raw = await readFile(HEADERS_FILE, "utf8");

test("_headers file exists in public/ and is non-empty", () => {
  assert.ok(raw.length > 100, "public/_headers missing or too short");
});

test("CSP sets a strict default-src 'self'", () => {
  assert.match(raw, /Content-Security-Policy:.*default-src 'self'/);
});

test("CSP allows WhatsApp as image/connect/form-action target", () => {
  // wa.me images, CDN de WhatsApp, y la app necesita conectar a wa.me al abrir el form.
  const csp = raw.match(/Content-Security-Policy:\s*(.+)/)?.[1] ?? "";
  assert.match(csp, /img-src[^;]*https:\/\/wa\.me/);
  assert.match(csp, /connect-src[^;]*https:\/\/wa\.me/);
  assert.match(csp, /form-action[^;]*https:\/\/wa\.me/);
});

test("CSP forbids framing (clickjacking protection)", () => {
  const csp = raw.match(/Content-Security-Policy:\s*(.+)/)?.[1] ?? "";
  assert.match(csp, /frame-ancestors 'none'/);
});

test("X-Frame-Options is set to DENY", () => {
  assert.match(raw, /X-Frame-Options:\s*DENY/);
});

test("X-Content-Type-Options prevents MIME sniffing", () => {
  assert.match(raw, /X-Content-Type-Options:\s*nosniff/);
});

test("Referrer-Policy limits referrer leakage", () => {
  assert.match(raw, /Referrer-Policy:\s*strict-origin-when-cross-origin/);
});

test("Permissions-Policy disables unused powerful APIs", () => {
  const pp = raw.match(/Permissions-Policy:\s*(.+)/)?.[1] ?? "";
  assert.match(pp, /camera=\(\)/);
  assert.match(pp, /microphone=\(\)/);
  assert.match(pp, /geolocation=\(\)/);
});

test("HSTS enforces HTTPS for 2 years with subdomains", () => {
  const hsts = raw.match(/Strict-Transport-Security:\s*(.+)/)?.[1] ?? "";
  assert.match(hsts, /max-age=63072000/);
  assert.match(hsts, /includeSubDomains/);
  assert.match(hsts, /preload/);
});

test("static assets are cached for 1 year (immutable)", () => {
  assert.match(raw, /\/_next\/static\/\*/);
  assert.match(raw, /Cache-Control:\s*public, max-age=31536000, immutable/);
});

test("no overly permissive headers (no unsafe-eval, no *, etc.)", () => {
  const csp = raw.match(/Content-Security-Policy:\s*(.+)/)?.[1] ?? "";
  assert.doesNotMatch(csp, /'unsafe-eval'/);
  // default-src 'self' should NOT be overridden to '*' anywhere
  assert.doesNotMatch(csp, /default-src\s+\*/);
});
