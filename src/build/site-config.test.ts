// src/build/site-config.test.ts
//
// Pins the single source of truth for the site's production origin.
// Fixing a real defect (found by parent verification against the LIVE
// site, not a script): `document.tsx` (T4/T5) hardcoded
// "https://cominorsa.com.pe", copied from `scripts/cloudflare-domain.sh`
// without checking whether that domain is actually live. It is not —
// `curl https://cominorsa.com.pe/seguridad-minera` does not resolve.
// `curl -sL https://cominorsa.com/seguridad-minera` returns 200 with a
// live `<link rel="canonical" href="https://cominorsa.com/seguridad-minera">`
// (no trailing slash) — that is the real production origin and URL
// shape, confirmed directly against the live site.

import { describe, expect, test } from "bun:test";
import { SITE_URL, SITEMAP_LAST_MODIFIED } from "./site-config";

describe("SITE_URL", () => {
  test("is the real production origin, verified against the live site", () => {
    expect(SITE_URL).toBe("https://cominorsa.com");
  });

  test("never resolves to the stale, non-resolving .com.pe domain", () => {
    expect(SITE_URL).not.toContain(".com.pe");
  });
});

// T8: sitemap.xml needs a `lastmod` value. Production's app/sitemap.ts
// calls `new Date()` per request — fine for a live per-request handler,
// but calling it at *build* time would make every rebuild of the
// exact same content produce a different sitemap.xml, which fails the
// "reproducible build" bar this task requires. SITEMAP_LAST_MODIFIED is
// a fixed ISO-8601 string instead: bump it by hand whenever a deploy
// meaningfully changes page content, or override per-build via the
// SITEMAP_LAST_MODIFIED env var (e.g. a CI step could pass the commit
// date) without touching source.
describe("SITEMAP_LAST_MODIFIED", () => {
  test("is a fixed, valid ISO-8601 timestamp (deterministic — never new Date())", () => {
    expect(SITEMAP_LAST_MODIFIED).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    );
    expect(Number.isNaN(Date.parse(SITEMAP_LAST_MODIFIED))).toBe(false);
  });
});
