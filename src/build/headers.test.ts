// src/build/headers.test.ts
//
// T10: `buildHeadersFile` generates `dist-static/_headers`. Unlike
// `public/_headers` today (which Cloudflare never applies, since this
// SSR app never calls `env.ASSETS.fetch()` for a page — see that
// file's own comment), this one governs EVERY static-asset response
// once the site is served from Static Assets (T9/T11): `/*` sets the
// full security-header set (no nonce — see security-policy.ts),
// `/assets/*` and `/fonts/*` add immutable caching for hashed files.
// HTML gets no Cache-Control override, so it is never cached
// immutably. The stale `/_next/static/*` rule from `public/_headers`
// is dropped here on purpose — this build has no `/_next/` path at
// all (T9's asset paths are `/assets/*`/`/fonts/*`); `public/_headers`
// itself stays untouched until T11.

import { describe, expect, test } from "bun:test";
import { buildCsp, SECURITY_HEADERS } from "./security-policy";
import { buildHeadersFile } from "./headers";

describe("buildHeadersFile", () => {
  const file = buildHeadersFile();

  test("sets the full security header set on every path (/*)", () => {
    const csp = buildCsp();
    expect(file).toContain("/*\n");
    expect(file).toContain(`Content-Security-Policy: ${csp}`);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(file).toContain(`${name}: ${value}`);
    }
  });

  test("sets immutable caching for hashed /assets/* and /fonts/* files", () => {
    expect(file).toMatch(/\n\/assets\/\*\n\s*Cache-Control: public, max-age=31536000, immutable/);
    expect(file).toMatch(/\n\/fonts\/\*\n\s*Cache-Control: public, max-age=31536000, immutable/);
  });

  test("P6: caches the non-hashed images (OG, logo, favicons) for a day, not immutably", () => {
    for (const path of [
      "/og.jpg",
      "/logo-44.webp",
      "/favicon.ico",
      "/favicon-16x16.png",
      "/favicon-32x32.png",
      "/apple-touch-icon.png",
      "/piura-contours.svg",
    ]) {
      const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(file).toMatch(new RegExp(`\\n${escaped}\\n\\s*Cache-Control: public, max-age=86400\\n`));
    }
  });

  test("P11: no cache rule for the retired PNG logo", () => {
    expect(file).not.toContain("/logo-44.png");
  });

  test("never sets Cache-Control on the /* (HTML) rule — HTML must not be cached immutably", () => {
    const globalRuleBlock = file.split(/\n\/assets\/\*/)[0]!;
    expect(globalRuleBlock).not.toMatch(/Cache-Control/);
  });

  test("does not carry the stale /_next/static/* rule (no such path in this build)", () => {
    expect(file).not.toContain("/_next/");
  });

  test("P11: puts the inlined stylesheet's hash into the CSP's style-src", () => {
    const withHash = buildHeadersFile({ styleHashes: ["sha256-AbC="] });
    expect(withHash).toContain(`Content-Security-Policy: ${buildCsp({ styleHashes: ["sha256-AbC="] })}`);
    expect(withHash).toContain("style-src 'self' 'sha256-AbC='");
  });

  test("is deterministic across calls", () => {
    expect(buildHeadersFile()).toBe(buildHeadersFile());
  });
});
