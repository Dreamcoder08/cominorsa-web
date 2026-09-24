// Helper compartido para los tests QA de COMINORSA-web.
//
// T11 cutover: no more Next/vinext worker to render through — every page
// is a real static file under dist-static/, written once by `bun run
// build:static` (this test file's caller, `pnpm test`, always runs
// `pnpm run build` first). `fetchHtml`/`render` now just read that file
// directly, the same bytes Cloudflare Static Assets would serve for that
// path. Response headers (CSP, HSTS, etc.) are NOT reproduced here —
// those come from `dist-static/_headers`, applied by the Cloudflare
// platform itself, never by application code per request; see
// `tests/qa/security-headers.test.mjs`, which reads that generated file
// directly instead of faking a header pipeline here.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const DIST_STATIC = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
  "dist-static",
);

/** Maps a URL pathname to its built file under dist-static/ (see build.ts's own module comment for the flat-file routing shape: "/" -> index.html, "/foo" -> foo.html). */
function fileForPathname(pathname) {
  const slug = pathname === "/" || pathname === "" ? "index" : pathname.replace(/^\/+|\/+$/g, "");
  return resolve(DIST_STATIC, `${slug}.html`);
}

/**
 * Read the built static page for `pathname` and return a Response-shaped
 * object, the same shape `render()`'s old Worker-fetch call used to
 * return (`status`/`headers`/`text()`), so nothing downstream needs to
 * change: `fetchHtml`, most of this project's other QA tests. Falls back
 * to `404.html` (status 404) for a path with no matching build output,
 * matching Cloudflare Static Assets' own `not_found_handling: "404-page"`
 * behavior (wrangler.jsonc).
 * @param {string} pathname
 */
export async function render(pathname = "/") {
  let html;
  let status = 200;
  try {
    html = await readFile(fileForPathname(pathname), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    html = await readFile(resolve(DIST_STATIC, "404.html"), "utf8");
    status = 404;
  }
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  return new Response(html, { status, headers });
}

/**
 * Render and return the response + parsed HTML body.
 * @param {string} [pathname]
 */
export async function fetchHtml(pathname = "/") {
  const response = await render(pathname);
  const status = response.status;
  const headers = Object.fromEntries(response.headers.entries());
  // Always return the body; tests can assert on error pages too.
  const html = await response.text();
  return { status, headers, html };
}

/**
 * Extract the content of <meta name="..."> tags.
 * @param {string} html
 * @param {string} name
 */
export function metaContent(html, name) {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

/**
 * Extract <meta property="og:..."> content.
 * @param {string} html
 * @param {string} property
 */
export function ogContent(html, property) {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const m = html.match(re);
  return m ? m[1] : null;
}
