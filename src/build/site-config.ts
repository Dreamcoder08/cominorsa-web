// src/build/site-config.ts
//
// Single source of truth for the site's production origin — used by
// document.tsx's canonical URL, og:url, og:image, and JSON-LD, and by
// the sitemap generator (T8).
//
// Verified directly against the LIVE site, not against
// `scripts/cloudflare-domain.sh` (stale — it targets `cominorsa.com.pe`,
// which does not even resolve: `curl https://cominorsa.com.pe/...` →
// no route to host). `COMINORSA-COM-DOMAIN-SETUP.md`'s own header
// confirms `cominorsa.com` (no `.pe`) is the real production domain,
// deployed as a Worker via `pnpm cf:deploy`. Confirmed:
// `curl -sL https://cominorsa.com/seguridad-minera` → 200, live
// `<link rel="canonical" href="https://cominorsa.com/seguridad-minera">`
// — no trailing slash. Every emitted URL must match that shape exactly
// (see src/build/build.ts's no-trailing-slash routing).
export const SITE_URL = "https://cominorsa.com";

// T8: sitemap.xml's `lastmod` value. A fixed constant, not `new Date()`
// at build time — see site-config.test.ts's "SITEMAP_LAST_MODIFIED"
// describe block for why a reproducible build requires this. Override
// per-build with the SITEMAP_LAST_MODIFIED env var (e.g. a CI step
// passing the commit date) without a source change; falls back to this
// constant otherwise. Bump the constant by hand on a deploy that
// meaningfully changes page content.
export const SITEMAP_LAST_MODIFIED: string =
  process.env.SITEMAP_LAST_MODIFIED ?? "2026-09-22T00:00:00.000Z";
