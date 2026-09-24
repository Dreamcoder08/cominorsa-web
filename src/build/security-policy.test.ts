// src/build/security-policy.test.ts
//
// T10: the static build's security header policy — CSP equivalent to
// `proxy.ts`'s (see that file's own comment for the SSR original),
// minus the per-request nonce a static build has no inline <script> to
// need. Single source of truth shared by `headers.ts` (writes
// dist-static/_headers) and `../worker/security-headers.ts` (wraps the
// two API responses, since Cloudflare's `_headers` file is never
// applied to a response the Worker script itself returns).
//
// GA4 hosts verified against Google's own CSP guidance
// (developers.google.com/tag-platform/security/guides/csp, fetched
// 2026-09-22): for a GA4-only setup with no advertising features, the
// minimum is `https://www.googletagmanager.com` in script-src, and
// `https://www.googletagmanager.com` + `https://*.google-analytics.com`
// in img-src/connect-src. `https://*.analytics.google.com` (GA4's
// region-specific collect endpoint) was already allow-listed in
// `proxy.ts`'s connect-src pre-migration and is kept for parity.

import { describe, expect, test } from "bun:test";
import { buildCsp, SECURITY_HEADERS } from "./security-policy";

describe("buildCsp", () => {
  const csp = buildCsp();
  const directive = (name: string) => csp.match(new RegExp(`${name}([^;]*)`))?.[1] ?? "";

  test("has no nonce anywhere (static build has no inline <script>)", () => {
    expect(csp).not.toMatch(/nonce-/);
  });

  test("script-src is 'self' plus exactly GA4's script host — no 'unsafe-inline', no 'unsafe-eval'", () => {
    const scriptSrc = directive("script-src");
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("https://www.googletagmanager.com");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    expect(scriptSrc).not.toContain("nonce-");
  });

  test("connect-src and img-src allow GA4's required hosts", () => {
    for (const dirName of ["connect-src", "img-src"]) {
      const value = directive(dirName);
      expect(value).toContain("https://www.googletagmanager.com");
      expect(value).toContain("https://*.google-analytics.com");
    }
    expect(directive("connect-src")).toContain("https://*.analytics.google.com");
  });

  // P11: Cloudflare Web Analytics, auto-injected by the edge into HTML
  // (developers.cloudflare.com/web-analytics/faq/#what-do-i-need-to-add-to-my-content-security-policy-csp).
  // The injected snippet carries `"version"` in data-cf-beacon, and the
  // beacon then reports to the same-origin `/cdn-cgi/rum` (only a manual
  // snippet reports to cloudflareinsights.com) — so connect-src needs
  // nothing beyond 'self'.
  test("P11: script-src allows the Cloudflare Web Analytics beacon host; its reports stay same-origin", () => {
    expect(directive("script-src").trim().split(/\s+/)).toEqual([
      "'self'",
      "https://www.googletagmanager.com",
      "https://static.cloudflareinsights.com",
    ]);
    expect(directive("connect-src")).toContain("'self'");
    expect(directive("connect-src")).not.toContain("cloudflareinsights");
  });

  test("keeps the WhatsApp allow-list untouched (img-src, connect-src, form-action)", () => {
    expect(directive("img-src")).toContain("https://wa.me");
    expect(directive("connect-src")).toContain("https://wa.me");
    expect(directive("form-action")).toContain("https://wa.me");
  });

  test("keeps default-src 'self', frame-ancestors 'none', base-uri 'self'", () => {
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/base-uri 'self'/);
  });

  // P9 (audit P2-11): the built HTML has no style="" attribute and no
  // <style> block (build.test.ts proves it); JS only writes CSSOM
  // (element.style), which CSP never blocks.
  test("style-src is 'self' only — no 'unsafe-inline'", () => {
    expect(directive("style-src").trim()).toBe("'self'");
    expect(csp).not.toContain("'unsafe-inline'");
  });

  // P11: the built stylesheet is inlined as one <style> element; the
  // build passes its sha256 so style-src allows exactly those bytes.
  test("P11: style-src adds exactly the given style hashes, still without 'unsafe-inline'", () => {
    const hashed = buildCsp({ styleHashes: ["sha256-AbC+/12=", "sha256-XyZ="] });
    const styleSrc = hashed.match(/style-src([^;]*)/)?.[1]?.trim();
    expect(styleSrc).toBe("'self' 'sha256-AbC+/12=' 'sha256-XyZ='");
    expect(hashed).not.toContain("'unsafe-inline'");
    // Every other directive is unchanged.
    expect(hashed.replace(/style-src[^;]*/, "")).toBe(csp.replace(/style-src[^;]*/, ""));
  });

  test("no wildcard default-src, no unsafe-eval anywhere", () => {
    expect(csp).not.toMatch(/default-src\s+\*/);
    expect(csp).not.toContain("unsafe-eval");
  });
});

describe("SECURITY_HEADERS", () => {
  test("matches proxy.ts's non-CSP headers exactly", () => {
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(SECURITY_HEADERS["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
    );
    expect(SECURITY_HEADERS["X-XSS-Protection"]).toBe("0");
  });
});
