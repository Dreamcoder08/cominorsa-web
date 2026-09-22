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
import { SITE_URL } from "./site-config";

describe("SITE_URL", () => {
  test("is the real production origin, verified against the live site", () => {
    expect(SITE_URL).toBe("https://cominorsa.com");
  });

  test("never resolves to the stale, non-resolving .com.pe domain", () => {
    expect(SITE_URL).not.toContain(".com.pe");
  });
});
