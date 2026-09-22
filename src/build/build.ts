/** @jsxImportSource ../html */
// src/build/build.ts
//
// The static build pipeline: bundles+minifies+hashes `app/globals.css`
// and `fonts.css` via `Bun.build`, copies `public/` assets, and renders
// every route in `routes.ts`'s `PAGE_ROUTES` table (T6a) into a flat
// `<slug>.html` file. Run with `bun run build:static` (`package.json`);
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
// redirects. The root page stays `index.html` (unaffected either way;
// the homepage itself is T6b, not yet in `PAGE_ROUTES`).

import { Glob } from "bun";
import { join, relative } from "node:path";
import { buildCss } from "./css";
import { renderDocument } from "./document";
import { PAGE_ROUTES } from "./routes";

const ROOT = join(import.meta.dirname, "..", "..");
const CSS_ENTRY = join(ROOT, "app", "globals.css");
const FONTS_CSS_ENTRY = join(import.meta.dirname, "fonts.css");
const PUBLIC_DIR = join(ROOT, "public");
const ASSETS_DIR_NAME = "assets";
const SITE_SUFFIX = " | COMINORSA";

async function copyPublicAssets(outDir: string): Promise<void> {
  const glob = new Glob("**/*");
  for await (const relativePath of glob.scan({ cwd: PUBLIC_DIR, dot: false })) {
    const source = Bun.file(join(PUBLIC_DIR, relativePath));
    await Bun.write(join(outDir, relativePath), source);
  }
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

export async function runStaticBuild(
  outDir: string,
): Promise<{ cssFileName: string; fontsCssFileName: string }> {
  const { fileName: cssFileName } = await buildCss(CSS_ENTRY, join(outDir, ASSETS_DIR_NAME));
  const cssHref = `/${ASSETS_DIR_NAME}/${cssFileName}`;

  const { fileName: fontsCssFileName } = await buildCss(
    FONTS_CSS_ENTRY,
    join(outDir, ASSETS_DIR_NAME),
    // The woff2 files fonts.css references live under public/fonts/,
    // copied verbatim by copyPublicAssets below — not local files
    // relative to this CSS entry, so Bun's bundler must not try to
    // resolve/inline them.
    { external: ["/fonts/*"] },
  );
  const fontsCssHref = `/${ASSETS_DIR_NAME}/${fontsCssFileName}`;

  await copyPublicAssets(outDir);

  for (const route of PAGE_ROUTES) {
    const html = renderDocument({
      title: `${route.title}${SITE_SUFFIX}`,
      description: route.description,
      canonicalPath: route.canonicalPath,
      cssHref,
      fontsCssHref,
      children: route.render(),
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
