// src/build/document.tsx
//
// Full `<head>` document shell for the static build (T4), replacing
// `app/layout.tsx`'s `generateMetadata`/`viewport` and its root
// `dangerouslySetInnerHTML` JSON-LD block. Verified for parity against a
// real `pnpm build` + in-process worker render of `/seguridad-minera`
// (see odd/tasks/bun-vanilla-migration.md, T4 verification notes, for
// the diff and the documented, intentional differences).
//
// Design: `title`, `description` and `canonicalPath` vary by page, and
// the OG/Twitter title+description are derived from them (P2, audit
// P1-2 — the Next-era root layout shared one OG/Twitter copy across every
// route, so every share preview looked identical). Image, icons,
// theme-color, applicationName and JSON-LD stay site-wide.

import { raw, render, type Child, type Html } from "../html/jsx-runtime";
import { PAGE_BACKGROUND_COLOR, SITE_URL } from "./site-config";
import { organizationJsonLd } from "./structured-data";

const SITE_NAME = "COMINORSA";
// P6 (audit P1-3): JPEG, <= 200 KB — WhatsApp link previews (the main
// share channel) are unreliable with the old 715 KB PNG.
const SOCIAL_IMAGE = `${SITE_URL}/og.jpg`;
const SOCIAL_IMAGE_TYPE = "image/jpeg";
const SOCIAL_IMAGE_ALT = "COMINORSA — Consultoría minera y soluciones ambientales";


// G2: the JSON-LD block is the site's one raw-HTML sink. `raw()` applies
// no escaping by design (see jsx-runtime.ts) — the caller owns it, same
// treatment `app/layout.tsx` uses: `JSON.stringify` is a lossless,
// JSON-valid serialization, and replacing every `<` with its JSON
// unicode escape `<` means a `</script>` inside a string value
// round-trips back to the exact original string on `JSON.parse` (a JSON
// string parser resolves `<` to `<`) while the literal byte
// sequence `</script` never appears in the emitted HTML, so it cannot
// close the element early. A plain HTML text-escaper (`escapeText`)
// would instead corrupt the JSON (e.g. turning `"` into `&quot;`) —
// that's why this is a dedicated helper, not a call to `escapeText`.
// Exported so document.test.ts can prove both properties directly.
export function jsonLdScript(data: unknown): Html {
  return raw(JSON.stringify(data).replace(/</g, "\\u003c"));
}

// Fonts to preload (P9): Archivo, the `body` font, on every page; the
// homepage adds Newsreader italic, which its above-the-fold h1 <em>
// uses. Geist Mono only renders small labels. Hrefs are passed in
// because the build content-hashes font file names (P6).

export type DocumentProps = {
  title: string;
  description: string;
  /**
   * Absolute path from the site root, NO trailing slash (e.g.
   * "/seguridad-minera"), except the root itself ("/") — matches
   * production's real URL shape exactly (verified against the live
   * site) and the no-redirect routing `build.ts` emits under
   * Cloudflare's default `html_handling: "auto-trailing-slash"`.
   *
   * Omit for a page with no single canonical URL to advertise (the 404
   * page, T6a) — no `<link rel="canonical">` or `og:url` meta is
   * emitted in that case, matching the live site (confirmed:
   * `curl -sL https://cominorsa.com/<broken-path>` returns 404 with no
   * canonical link and no `og:url` meta at all).
   */
  canonicalPath?: string;
  /**
   * e.g. "noindex, follow" — only the 404 page sets this today
   * (`app/not-found.tsx`'s `robots: { index: false, follow: true }`,
   * which Next serializes to exactly that string; verified against the
   * live 404 response). Omitted entirely (no `<meta name="robots">`
   * tag) on every other page, matching current production behavior.
   */
  robots?: string;
  /** Absolute path to the built, hashed stylesheet (globals.css with the @font-face rules bundled in), e.g. "/assets/globals-abc123.css". */
  cssHref: string;
  /** Content-hashed woff2 hrefs to preload, in order, e.g. ["/fonts/archivo-latin-variable-0123abcd.woff2"]. */
  preloadFontHrefs: readonly string[];
  /**
   * Absolute paths to built, hashed, minified ES modules (T7,
   * `src/build/js.ts`), rendered as `<script type="module" src="...">`
   * right before `</body>`, in the given order. No inline `<script>` is
   * ever emitted here — T10's CSP is `script-src 'self'` plus whatever
   * GA4 needs, which a `src`-based module script satisfies with zero
   * nonce/hash bookkeeping. Module scripts are deferred by the HTML spec
   * on their own, so placement doesn't need `defer`/`async`. Omit for a
   * page with no widgets to enhance (none today — every route renders
   * `SiteHeader`/`SiteFooter`, so every route gets at least the
   * mobile-nav and consent scripts; see `src/build/routes.ts`).
   */
  scriptSrcs?: string[];
  /**
   * Page-specific schema.org objects (P5: a service page's `Service` and
   * `BreadcrumbList`), each emitted as its own JSON-LD block after the
   * site-wide organization (`structured-data.ts`).
   */
  jsonLd?: readonly unknown[];
  children: Child;
};

function Document({
  title,
  description,
  canonicalPath,
  robots,
  cssHref,
  preloadFontHrefs,
  scriptSrcs,
  jsonLd,
  children,
}: DocumentProps) {
  const canonicalUrl = canonicalPath !== undefined ? `${SITE_URL}${canonicalPath}` : undefined;

  return (
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="application-name" content={SITE_NAME} />
        {robots ? <meta name="robots" content={robots} /> : null}
        {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}

        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_PE" />
        <meta property="og:site_name" content={SITE_NAME} />
        {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={SOCIAL_IMAGE} />
        <meta property="og:image:type" content={SOCIAL_IMAGE_TYPE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={SOCIAL_IMAGE_ALT} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={SOCIAL_IMAGE} />

        <meta name="theme-color" content={PAGE_BACKGROUND_COLOR} />

        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />

        {preloadFontHrefs.map((href) => (
          <link rel="preload" href={href} as="font" type="font/woff2" crossorigin={true} />
        ))}
        <link rel="stylesheet" href={cssHref} />

        {[organizationJsonLd, ...(jsonLd ?? [])].map((data) => (
          <script type="application/ld+json">{jsonLdScript(data)}</script>
        ))}
      </head>
      <body>
        {children}
        {(scriptSrcs ?? []).map((src) => (
          // `defer` is redundant on a `type="module"` script (the HTML
          // spec already defers module scripts) but keeps
          // `@next/next/no-sync-scripts` — which doesn't special-case
          // `type="module"` — from flagging it as a blocking script.
          <script type="module" src={src} defer={true} />
        ))}
      </body>
    </html>
  );
}

export function renderDocument(props: DocumentProps): string {
  return `<!doctype html>${render(<Document {...props} />)}`;
}
