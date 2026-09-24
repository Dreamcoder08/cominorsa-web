// src/build/sitemap.ts
//
// T8: builds `sitemap.xml` at build time from `routes.ts`'s `PAGE_ROUTES`
// table — the same single source of truth `build.ts` already uses to
// emit pages, instead of hand-listing routes a second time (per
// `routes.ts`'s own module comment).
//
// Byte-for-byte equivalent to the live production sitemap (verified
// 2026-09-22: `curl -s https://cominorsa.com/sitemap.xml`), except
// `lastmod`: production's `app/sitemap.ts` calls `new Date()` per
// request, which is not reproducible at build time. This module takes
// the ISO timestamp as a parameter instead — see `site-config.ts`'s
// `SITEMAP_LAST_MODIFIED` for the deterministic default this is called
// with, and why.
//
// Route selection: every route with a `canonicalPath` (every real page
// except 404) — the homepage (`slug === ""`, canonicalPath "/" since P2)
// keeps its own block with the hreflang alternate. The 404 route has no
// `canonicalPath`, so it is excluded automatically, with no separate
// exclusion list to keep in sync.
import { PAGE_ROUTES } from "./routes";
import { SITE_URL } from "./site-config";

// Priority/changefreq per non-service page, mirroring today's
// `app/sitemap.ts` exactly. Service pages (every route not listed here,
// other than the homepage) all get 0.8/monthly — the default below —
// so a newly added service in `routes.ts` is included automatically
// with no edit needed here.
const FIXED_ENTRY_META: Record<string, { priority: string; changefreq: string }> = {
  "preguntas-frecuentes": { priority: "0.6", changefreq: "monthly" },
  privacidad: { priority: "0.3", changefreq: "yearly" },
  terminos: { priority: "0.3", changefreq: "yearly" },
};
const DEFAULT_SERVICE_META = { priority: "0.8", changefreq: "monthly" } as const;

function homeUrlBlock(lastModifiedIso: string): string {
  return [
    "<url>",
    `<loc>${SITE_URL}/</loc>`,
    `<xhtml:link rel="alternate" hreflang="es-PE" href="${SITE_URL}/" />`,
    `<lastmod>${lastModifiedIso}</lastmod>`,
    "<changefreq>monthly</changefreq>",
    "<priority>1</priority>",
    "</url>",
  ].join("\n");
}

function pageUrlBlock(canonicalPath: string, slug: string, lastModifiedIso: string): string {
  const { priority, changefreq } = FIXED_ENTRY_META[slug] ?? DEFAULT_SERVICE_META;
  return [
    "<url>",
    `<loc>${SITE_URL}${canonicalPath}</loc>`,
    `<lastmod>${lastModifiedIso}</lastmod>`,
    `<changefreq>${changefreq}</changefreq>`,
    `<priority>${priority}</priority>`,
    "</url>",
  ].join("\n");
}

export function buildSitemapXml(lastModifiedIso: string): string {
  const blocks = PAGE_ROUTES.filter(
    (route) => route.slug === "" || route.canonicalPath !== undefined,
  ).map((route) =>
    route.slug === ""
      ? homeUrlBlock(lastModifiedIso)
      : pageUrlBlock(route.canonicalPath!, route.slug, lastModifiedIso),
  );

  return (
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      ...blocks,
      "</urlset>",
    ].join("\n") + "\n"
  );
}
