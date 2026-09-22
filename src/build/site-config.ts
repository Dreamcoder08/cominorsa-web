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
