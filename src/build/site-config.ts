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
import { spawnSync } from "node:child_process";

export const SITE_URL = "https://cominorsa.com";

// T11: reads the current HEAD commit's committer date (`%cI`, ISO 8601)
// via a plain `git log -1` — no dependency, works under both `bun run`
// and `node`. Returns null (never throws) when git itself can't answer:
// no `git` binary on PATH, or a checkout with no `.git` directory at all
// (e.g. a tarball export). A *shallow* CI clone (`actions/checkout` with
// `fetch-depth: 1`, this repo's default) still has full metadata for its
// one commit, so `git log -1` works there too — verified by running this
// exact command against a fresh `git clone --depth 1` of this repo.
function readLastCommitDate(): string | null {
  const result = spawnSync("git", ["log", "-1", "--format=%cI"], {
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) return null;
  const value = result.stdout.trim();
  return value.length > 0 ? value : null;
}

// T8/T11: sitemap.xml's `lastmod` value. Not `new Date()` at build time
// (see site-config.test.ts's "SITEMAP_LAST_MODIFIED" describe block for
// why a reproducible build requires this) — instead, in priority order:
// (1) the `SITEMAP_LAST_MODIFIED` env var, for a caller that wants to
// pin an exact value without touching source; (2) the current commit's
// own date, read from git (T11 — replaces the T8 hand-bumped constant,
// which would otherwise go stale on every content-changing deploy that
// forgot to bump it by hand); (3) a fixed fallback constant for the rare
// environment with no git metadata at all, so the build never throws.
const FALLBACK_SITEMAP_LAST_MODIFIED = "2026-09-22T00:00:00.000Z";

export const SITEMAP_LAST_MODIFIED: string =
  process.env.SITEMAP_LAST_MODIFIED ??
  readLastCommitDate() ??
  FALLBACK_SITEMAP_LAST_MODIFIED;
