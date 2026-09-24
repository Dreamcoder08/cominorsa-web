// src/build/sitemap.test.ts
//
// T8: `buildSitemapXml` reuses `routes.ts`'s `PAGE_ROUTES` table instead
// of hand-listing pages a second time. Fixture below matches the LIVE
// production sitemap byte-for-byte (verified 2026-09-22 via `curl -s
// https://cominorsa.com/sitemap.xml`), except `lastmod`: production
// calls `new Date()` per request (non-reproducible); this build takes a
// fixed ISO string parameter instead (see site-config.ts's
// `SITEMAP_LAST_MODIFIED` for the deterministic default and why).

import { describe, expect, test } from "bun:test";
import { buildSitemapXml } from "./sitemap";

const FIXED = "2026-09-22T00:00:00.000Z";

describe("buildSitemapXml", () => {
  test("matches the live production sitemap byte-for-byte except lastmod", () => {
    const xml = buildSitemapXml(FIXED);
    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        "<url>",
        "<loc>https://cominorsa.com/</loc>",
        '<xhtml:link rel="alternate" hreflang="es-PE" href="https://cominorsa.com/" />',
        `<lastmod>${FIXED}</lastmod>`,
        "<changefreq>monthly</changefreq>",
        "<priority>1</priority>",
        "</url>",
        "<url>",
        "<loc>https://cominorsa.com/igafom-reinfo</loc>",
        `<lastmod>${FIXED}</lastmod>`,
        "<changefreq>monthly</changefreq>",
        "<priority>0.8</priority>",
        "</url>",
        "<url>",
        "<loc>https://cominorsa.com/gestion-ambiental-minera</loc>",
        `<lastmod>${FIXED}</lastmod>`,
        "<changefreq>monthly</changefreq>",
        "<priority>0.8</priority>",
        "</url>",
        "<url>",
        "<loc>https://cominorsa.com/declaraciones-dac-estamin</loc>",
        `<lastmod>${FIXED}</lastmod>`,
        "<changefreq>monthly</changefreq>",
        "<priority>0.8</priority>",
        "</url>",
        "<url>",
        "<loc>https://cominorsa.com/ingenieria-y-planes-de-minado</loc>",
        `<lastmod>${FIXED}</lastmod>`,
        "<changefreq>monthly</changefreq>",
        "<priority>0.8</priority>",
        "</url>",
        "<url>",
        "<loc>https://cominorsa.com/seguridad-minera</loc>",
        `<lastmod>${FIXED}</lastmod>`,
        "<changefreq>monthly</changefreq>",
        "<priority>0.8</priority>",
        "</url>",
        "<url>",
        "<loc>https://cominorsa.com/tramites-minem-ingemmet-drem</loc>",
        `<lastmod>${FIXED}</lastmod>`,
        "<changefreq>monthly</changefreq>",
        "<priority>0.8</priority>",
        "</url>",
        "<url>",
        "<loc>https://cominorsa.com/preguntas-frecuentes</loc>",
        `<lastmod>${FIXED}</lastmod>`,
        "<changefreq>monthly</changefreq>",
        "<priority>0.6</priority>",
        "</url>",
        "<url>",
        "<loc>https://cominorsa.com/privacidad</loc>",
        `<lastmod>${FIXED}</lastmod>`,
        "<changefreq>yearly</changefreq>",
        "<priority>0.3</priority>",
        "</url>",
        "<url>",
        "<loc>https://cominorsa.com/terminos</loc>",
        `<lastmod>${FIXED}</lastmod>`,
        "<changefreq>yearly</changefreq>",
        "<priority>0.3</priority>",
        "</url>",
        "</urlset>",
        "",
      ].join("\n"),
    );
  });

  test("excludes the 404 route (noindex, no canonicalPath)", () => {
    const xml = buildSitemapXml(FIXED);
    expect(xml).not.toContain("404");
  });

  test("is deterministic: the same lastModified input always produces the same output", () => {
    expect(buildSitemapXml(FIXED)).toBe(buildSitemapXml(FIXED));
  });
});
