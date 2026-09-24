// src/build/build.ts
//
// The static build pipeline: bundles+minifies+hashes `app/globals.css`
// and `fonts.css` via `Bun.build`, copies `public/` assets, and renders
// every route in `routes.ts`'s `PAGE_ROUTES` table (including the
// homepage, T6b) into a flat `<slug>.html` file. Run with `bun run
// build:static` (`package.json`);
// output goes to `dist-static/` — a new directory, gitignored, that
// never collides with the Next/vinext `dist/`.
//
// Pages are emitted as flat `<slug>.html` files, NOT `<slug>/index.html`
// folders: Cloudflare Workers Static Assets' default `html_handling:
// "auto-trailing-slash"` serves a file like `foo.html` directly at
// `/foo` with zero redirects, but a folder index `foo/index.html` only
// at `/foo/`, 307-redirecting the no-slash form (confirmed against
// Cloudflare's own docs — developers.cloudflare.com/workers/
// static-assets/routing/advanced/html-handling). Production's real URL
// shape has no trailing slash (confirmed against the live site's own
// canonical tag), so this is the only shape that matches it with zero
// redirects. The root page stays `index.html` either way (`writePage`
// below maps `slug === ""` to that exact file name).
//
// The 404 route emits `404.html`: Cloudflare Workers Static Assets
// serves it for unmatched paths once `not_found_handling: "404-page"`
// is configured (T9) — out of this task's scope, noted here only so
// the file's purpose is clear before that config lands.

import { Glob } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { buildCss } from "./css";
import { renderDocument } from "./document";
import { buildHeadersFile } from "./headers";
import { buildJs } from "./js";
import { PAGE_ROUTES, type RenderContext } from "./routes";
import { buildRobotsTxt } from "./robots";
import { buildSitemapXml } from "./sitemap";
import { SITEMAP_LAST_MODIFIED } from "./site-config";
import { buildWebManifest } from "./webmanifest";

const ROOT = join(import.meta.dirname, "..", "..");
const CSS_ENTRY = join(ROOT, "app", "globals.css");
const FONTS_CSS_ENTRY = join(import.meta.dirname, "fonts.css");
const PUBLIC_DIR = join(ROOT, "public");
const FONTS_DIR_NAME = "fonts";
const CRITICAL_FONT_SOURCE = "archivo-latin-variable.woff2";
const ASSETS_DIR_NAME = "assets";
const SITE_SUFFIX = " | COMINORSA";

// T7: the 4 progressive-enhancement widgets. Every route renders
// SiteHeader/SiteFooter (mobile nav + the cookie-preferences button), so
// every route gets `mobile-nav` and `consent`; only the homepage has a
// `#consultation-form` to wire (`consultationForm` stays optional per
// route, added below for slug === "").
const CLIENT_ENTRIES_DIR = join(import.meta.dirname, "..", "client", "entries");
const MOBILE_NAV_JS_ENTRY = join(CLIENT_ENTRIES_DIR, "mobile-nav-entry.ts");
const CONSENT_JS_ENTRY = join(CLIENT_ENTRIES_DIR, "consent-entry.ts");
const CONSULTATION_FORM_JS_ENTRY = join(CLIENT_ENTRIES_DIR, "consultation-form-entry.ts");

async function buildClientScripts(
  outDir: string,
  gaMeasurementId: string,
): Promise<{ mobileNavHref: string; consentHref: string; consultationFormHref: string }> {
  // Bakes the GA measurement ID in at build time (the same value the
  // page render uses for `analyticsEnabled`, see runStaticBuild) — a
  // browser bundle has no `process.env` at runtime.
  const define = {
    "process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID": JSON.stringify(gaMeasurementId),
  };
  const jsOutDir = join(outDir, ASSETS_DIR_NAME);
  const [mobileNav, consent, consultationForm] = await Promise.all([
    buildJs(MOBILE_NAV_JS_ENTRY, jsOutDir, { define }),
    buildJs(CONSENT_JS_ENTRY, jsOutDir, { define }),
    buildJs(CONSULTATION_FORM_JS_ENTRY, jsOutDir, { define }),
  ]);
  return {
    mobileNavHref: `/${ASSETS_DIR_NAME}/${mobileNav.fileName}`,
    consentHref: `/${ASSETS_DIR_NAME}/${consent.fileName}`,
    consultationFormHref: `/${ASSETS_DIR_NAME}/${consultationForm.fileName}`,
  };
}

async function copyPublicAssets(outDir: string): Promise<void> {
  // T11: the old SSR-era public/_headers (which documented its own
  // comment that Cloudflare never even applied it) was deleted at the
  // cutover — dist-static/_headers (written below by writeGeneratedFiles)
  // is the one and only source of truth now, so there's no longer a
  // stale file under public/ to skip copying.
  const glob = new Glob("**/*");
  for await (const relativePath of glob.scan({ cwd: PUBLIC_DIR, dot: false })) {
    // Fonts ship under content-hashed names instead (buildFonts, P6).
    if (relativePath.startsWith(`${FONTS_DIR_NAME}/`)) continue;
    const source = Bun.file(join(PUBLIC_DIR, relativePath));
    await Bun.write(join(outDir, relativePath), source);
  }
}

/**
 * P6 (audit P2-12): copies every `public/fonts/*.woff2` to
 * `<outDir>/fonts/<name>-<hash>.woff2` (first 8 hex chars of the
 * SHA-256 of its bytes) so `/fonts/*` can keep its one-year `immutable`
 * cache: a changed font gets a new URL. Returns source file name ->
 * hashed public href, used to rewrite `fonts.css` and the preload link.
 */
async function buildFonts(outDir: string): Promise<Map<string, string>> {
  const hrefs = new Map<string, string>();
  const glob = new Glob("*.woff2");
  for await (const fileName of glob.scan({ cwd: join(PUBLIC_DIR, FONTS_DIR_NAME) })) {
    const bytes = await Bun.file(join(PUBLIC_DIR, FONTS_DIR_NAME, fileName)).bytes();
    const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex").slice(0, 8);
    const hashedName = fileName.replace(/\.woff2$/, `-${hash}.woff2`);
    await Bun.write(join(outDir, FONTS_DIR_NAME, hashedName), bytes);
    hrefs.set(fileName, `/${FONTS_DIR_NAME}/${hashedName}`);
  }
  return hrefs;
}

/**
 * Bundles `fonts.css` with every `/fonts/<name>.woff2` URL rewritten to
 * its hashed href. Bun.build needs an entry file on disk, so the
 * rewritten source goes to a throwaway temp dir (same `fonts.css` base
 * name, so the output stays `fonts-<hash>.css`).
 */
async function buildFontsCss(outDir: string, fontHrefs: Map<string, string>) {
  const source = await Bun.file(FONTS_CSS_ENTRY).text();
  const rewritten = source.replace(/\/fonts\/([a-z0-9-]+\.woff2)/g, (match, fileName: string) => {
    const href = fontHrefs.get(fileName);
    if (!href) throw new Error(`fonts.css references a missing font: ${match}`);
    return href;
  });

  const tempDir = await mkdtemp(join(tmpdir(), "cominorsa-fonts-"));
  try {
    const entry = join(tempDir, basename(FONTS_CSS_ENTRY));
    await Bun.write(entry, rewritten);
    // The woff2 URLs are root-relative public paths, not local files —
    // Bun's bundler must pass them through, not resolve/inline them.
    return await buildCss(entry, join(outDir, ASSETS_DIR_NAME), {
      external: [`/${FONTS_DIR_NAME}/*`],
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * T8/T10: sitemap.xml, robots.txt, manifest.webmanifest, and _headers —
 * none of these vary per page, so they're written once at the output
 * root rather than looped per route like writePage.
 */
async function writeGeneratedFiles(outDir: string): Promise<void> {
  await Promise.all([
    Bun.write(join(outDir, "sitemap.xml"), buildSitemapXml(SITEMAP_LAST_MODIFIED)),
    Bun.write(join(outDir, "robots.txt"), buildRobotsTxt()),
    Bun.write(join(outDir, "manifest.webmanifest"), buildWebManifest()),
    Bun.write(join(outDir, "_headers"), buildHeadersFile()),
  ]);
}

/**
 * Writes a rendered page as a flat `<slug>.html` file (or `index.html`
 * for the root route, `slug === ""`) — see the module comment above for
 * why this shape, not a `<slug>/index.html` folder, is required.
 */
async function writePage(outDir: string, slug: string, html: string): Promise<void> {
  const fileName = slug === "" ? "index.html" : `${slug}.html`;
  await Bun.write(join(outDir, fileName), html);
}

export type StaticBuildOptions = {
  /**
   * P1: the single source of truth for analytics in a build. Defaults to
   * `NEXT_PUBLIC_GA_MEASUREMENT_ID` (empty when unset). It is baked into
   * the consent bundle AND decides whether pages render the
   * "Preferencias de cookies" button and the GA4 paragraph of the
   * privacy policy — so markup and behavior can never disagree.
   */
  gaMeasurementId?: string;
};

export async function runStaticBuild(
  outDir: string,
  options: StaticBuildOptions = {},
): Promise<{ cssFileName: string; fontsCssFileName: string }> {
  const gaMeasurementId = (
    options.gaMeasurementId ?? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? ""
  ).trim();
  const renderContext: RenderContext = { analyticsEnabled: gaMeasurementId !== "" };

  const { fileName: cssFileName } = await buildCss(CSS_ENTRY, join(outDir, ASSETS_DIR_NAME));
  const cssHref = `/${ASSETS_DIR_NAME}/${cssFileName}`;

  const fontHrefs = await buildFonts(outDir);
  const criticalFontHref = fontHrefs.get(CRITICAL_FONT_SOURCE);
  if (!criticalFontHref) throw new Error(`critical font missing: public/fonts/${CRITICAL_FONT_SOURCE}`);
  const { fileName: fontsCssFileName } = await buildFontsCss(outDir, fontHrefs);
  const fontsCssHref = `/${ASSETS_DIR_NAME}/${fontsCssFileName}`;

  await copyPublicAssets(outDir);
  await writeGeneratedFiles(outDir);

  const { mobileNavHref, consentHref, consultationFormHref } = await buildClientScripts(
    outDir,
    gaMeasurementId,
  );

  for (const route of PAGE_ROUTES) {
    const scriptSrcs =
      route.slug === ""
        ? [mobileNavHref, consentHref, consultationFormHref]
        : [mobileNavHref, consentHref];

    const html = renderDocument({
      title: route.fullTitle ?? `${route.title}${SITE_SUFFIX}`,
      description: route.description,
      canonicalPath: route.canonicalPath,
      robots: route.robots,
      cssHref,
      fontsCssHref,
      criticalFontHref,
      scriptSrcs,
      jsonLd: route.jsonLd,
      children: route.render(renderContext),
    });

    await writePage(outDir, route.slug, html);
  }

  return { cssFileName, fontsCssFileName };
}

if (import.meta.main) {
  const outDir = join(ROOT, "dist-static");
  await Bun.$`rm -rf ${outDir}`.quiet();
  const { cssFileName, fontsCssFileName } = await runStaticBuild(outDir);
  console.log(`Built ${relative(ROOT, outDir)}/ (${PAGE_ROUTES.length} pages)`);
  console.log(`CSS: ${ASSETS_DIR_NAME}/${cssFileName}`);
  console.log(`Fonts CSS: ${ASSETS_DIR_NAME}/${fontsCssFileName}`);
}
