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

import { spawnSync } from "node:child_process";
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

// T8/T11: sitemap.xml needs a `lastmod` value. Production's
// app/sitemap.ts calls `new Date()` per request — fine for a live
// per-request handler, but calling it at *build* time would make every
// rebuild of the exact same content produce a different sitemap.xml,
// which fails the "reproducible build" bar this task requires.
// T8 shipped a hand-bumped fixed ISO-8601 constant; T11 replaces that
// with the current commit's own date (git `%cI`, which is ISO-8601 with
// a numeric UTC offset like "-05:00", not a "Z" suffix — the regex below
// was tightened to accept both, a real RED against the old Z-only regex
// before this widening). Still overridable per-build via the
// SITEMAP_LAST_MODIFIED env var without touching source, and still
// falls back to a fixed constant when no git metadata is available at
// all (see site-config.ts's readLastCommitDate).
describe("SITEMAP_LAST_MODIFIED", () => {
  test("is a valid ISO-8601 timestamp (deterministic — never new Date())", () => {
    expect(SITEMAP_LAST_MODIFIED).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    );
    expect(Number.isNaN(Date.parse(SITEMAP_LAST_MODIFIED))).toBe(false);
  });

  test("defaults to the current commit's own committer date when the env var is unset", () => {
    if (process.env.SITEMAP_LAST_MODIFIED) {
      return; // a caller pinned it explicitly — nothing to compare against.
    }
    const result = spawnSync("git", ["log", "-1", "--format=%cI"], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      return; // no git metadata in this environment either — fallback path.
    }
    expect(SITEMAP_LAST_MODIFIED).toBe(result.stdout.trim());
  });
});
