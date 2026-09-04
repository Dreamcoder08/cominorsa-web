import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { fetchHtml } from "./helpers.mjs";

// Security response headers (CSP, HSTS, X-Frame-Options, etc.) are set in
// proxy.ts, not public/_headers — Cloudflare only applies _headers to
// responses served directly from the static-assets binding, and this app is
// fully SSR'd (see proxy.ts's top comment and worker/index.ts). These tests
// invoke the real built worker, the same way production does, so they catch
// what a regex over the static file never could: whether the headers are
// actually attached to the page response.

test("document response carries the full security header set on the homepage", async () => {
  const { status, headers } = await fetchHtml("/");
  assert.equal(status, 200);
  assert.match(headers["content-security-policy"], /default-src 'self'/);
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(headers["strict-transport-security"], /max-age=63072000/);
  assert.match(headers["strict-transport-security"], /includeSubDomains/);
  assert.match(headers["strict-transport-security"], /preload/);
  assert.match(headers["permissions-policy"], /camera=\(\)/);
  assert.match(headers["permissions-policy"], /microphone=\(\)/);
  assert.match(headers["permissions-policy"], /geolocation=\(\)/);
});

test("document response carries the same security headers on a non-root route", async () => {
  // Regression check for the "/" vs "/*" path-matching bug this project
  // used to have in public/_headers — proxy.ts must protect every route
  // uniformly, not just the homepage.
  const { status, headers } = await fetchHtml("/privacidad");
  assert.equal(status, 200);
  assert.match(headers["content-security-policy"], /default-src 'self'/);
  assert.equal(headers["x-frame-options"], "DENY");
});

test("CSP allows WhatsApp as image/connect/form-action target", () => {
  return fetchHtml("/").then(({ headers }) => {
    const csp = headers["content-security-policy"];
    assert.match(csp, /img-src[^;]*https:\/\/wa\.me/);
    assert.match(csp, /connect-src[^;]*https:\/\/wa\.me/);
    assert.match(csp, /form-action[^;]*https:\/\/wa\.me/);
  });
});

test("CSP connect-src allows Google Analytics/Tag Manager beacon calls so consented GA4 actually works", () => {
  // script-src does NOT need googletagmanager.com allowlisted by hostname —
  // CookieConsent.tsx passes the request's CSP nonce to the GTM <Script>
  // tag (see the next test), which is a stricter mechanism than trusting
  // the whole origin. connect-src has no nonce equivalent, so gtag's own
  // fetch/beacon calls do need explicit origins here.
  return fetchHtml("/").then(({ headers }) => {
    const csp = headers["content-security-policy"];
    assert.match(csp, /connect-src[^;]*https:\/\/www\.google-analytics\.com/);
    assert.match(csp, /connect-src[^;]*https:\/\/www\.googletagmanager\.com/);
  });
});

test("CookieConsent passes the CSP nonce to both GA4 <Script> tags (source check — consent starts null in SSR, so the tags never render server-side to assert on directly)", async () => {
  const source = await readFile(
    resolve(
      fileURLToPath(new URL("../..", import.meta.url)),
      "app",
      "CookieConsent.tsx",
    ),
    "utf8",
  );
  const scriptTags = source.match(/<Script\b[^>]*\/?>/g) ?? [];
  assert.ok(scriptTags.length >= 2, "expected at least 2 <Script> tags");
  for (const tag of scriptTags) {
    assert.match(tag, /nonce=\{nonce\}/, `missing nonce prop: ${tag}`);
  }
});

test("CSP forbids framing (clickjacking protection)", () => {
  return fetchHtml("/").then(({ headers }) => {
    assert.match(headers["content-security-policy"], /frame-ancestors 'none'/);
  });
});

test("CSP script-src has no 'unsafe-inline' — every inline script is nonce-scoped instead", async () => {
  const { headers } = await fetchHtml("/");
  const csp = headers["content-security-policy"];
  const scriptSrc = csp.match(/script-src([^;]+)/)?.[1] ?? "";
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.match(scriptSrc, /'nonce-[a-f0-9]{32}'/);
});

test("the CSP nonce is a fresh, unpredictable value per request", async () => {
  const [first, second] = await Promise.all([fetchHtml("/"), fetchHtml("/")]);
  const nonceOf = (headers) =>
    headers["content-security-policy"].match(/'nonce-([a-f0-9]{32})'/)?.[1];
  const nonceA = nonceOf(first.headers);
  const nonceB = nonceOf(second.headers);
  assert.ok(nonceA);
  assert.notEqual(nonceA, nonceB);
});

test("every inline <script> tag in the HTML carries the CSP nonce from the response header", async () => {
  const { headers, html } = await fetchHtml("/");
  const nonce = headers["content-security-policy"].match(
    /'nonce-([a-f0-9]{32})'/,
  )?.[1];
  assert.ok(nonce, "no nonce found in CSP header");

  // The JSON-LD structured-data script is ours (app/layout.tsx) — assert it
  // specifically carries the header's nonce, proving the header/markup pair
  // actually match instead of just both existing independently.
  const jsonLdMatch = html.match(
    /<script type="application\/ld\+json" nonce="([^"]+)"/,
  );
  assert.ok(jsonLdMatch, "JSON-LD script tag not found or missing nonce");
  assert.equal(jsonLdMatch[1], nonce);
});

test("no overly permissive CSP directives (no unsafe-eval, no wildcard default-src)", async () => {
  const { headers } = await fetchHtml("/");
  const csp = headers["content-security-policy"];
  assert.doesNotMatch(csp, /'unsafe-eval'/);
  assert.doesNotMatch(csp, /default-src\s+\*/);
});

// public/_headers itself only governs genuine static-asset responses
// (env.ASSETS.fetch) — these checks stay scoped to what it actually does.
const HEADERS_FILE = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
  "public",
  "_headers",
);
const rawHeadersFile = await readFile(HEADERS_FILE, "utf8");

test("public/_headers exists and sets immutable caching for hashed static assets", () => {
  assert.ok(rawHeadersFile.length > 50, "public/_headers missing or too short");
  assert.match(rawHeadersFile, /\/_next\/static\/\*/);
  assert.match(
    rawHeadersFile,
    /Cache-Control:\s*public, max-age=31536000, immutable/,
  );
});

test("public/_headers does not redeclare CSP (it would be dead weight for HTML, and could conflict with proxy.ts's nonce-based policy on direct static-asset responses)", () => {
  assert.doesNotMatch(rawHeadersFile, /Content-Security-Policy/);
});
