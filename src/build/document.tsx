/** @jsxImportSource ../html */
// src/build/document.tsx
//
// Full `<head>` document shell for the static build (T4), replacing
// `app/layout.tsx`'s `generateMetadata`/`viewport` and its root
// `dangerouslySetInnerHTML` JSON-LD block. Verified for parity against a
// real `pnpm build` + in-process worker render of `/seguridad-minera`
// (see odd/tasks/bun-vanilla-migration.md, T4 verification notes, for
// the diff and the documented, intentional differences).
//
// Design: only `title`, `description`, and `canonicalPath` vary by page
// today — mirroring `app/services-data.ts`'s `generateServiceMetadata`,
// which only overrides those three on top of the root layout's
// `generateMetadata` (Next deep-merges child metadata over the parent's,
// so OG/Twitter/icons/theme-color/applicationName/JSON-LD are identical
// on every route right now, defined once at the root and never
// overridden per page — confirmed by diffing the built `/` and
// `/seguridad-minera` heads). So they're hardcoded here rather than
// threaded through `DocumentProps` for every future page (T6); if a
// future page ever needs a per-page OG image or JSON-LD type, that's a
// `DocumentProps` extension for that task, not a speculative one now.

import { raw, render, type Child, type Html } from "../html/jsx-runtime";
import { PRIMARY_WHATSAPP_NUMBER } from "../../app/constants";
import { SITE_URL } from "./site-config";

const SITE_NAME = "COMINORSA";
const SOCIAL_IMAGE = `${SITE_URL}/og.png`;
const SOCIAL_IMAGE_ALT = "COMINORSA — Consultoría minera y soluciones ambientales";
// Root layout's OG/Twitter title+description are their own copy,
// distinct from the per-page <title>/description — that's the real
// current behavior (verified against the built Next output), not an
// oversight here.
const OG_TITLE = "COMINORSA | Técnica que impulsa";
const OG_DESCRIPTION =
  "Formalización minera y soluciones ambientales para una minería segura y sostenible.";
const TWITTER_TITLE = "COMINORSA | Consultoría minera y ambiental";
const TWITTER_DESCRIPTION = "Formalización, gestión ambiental y asistencia técnica minera.";
const THEME_COLOR = "#fbf8ef";

// Verbatim from `app/layout.tsx`'s `jsonLd`, minus the per-request
// `getBaseUrl()` call: the static build has no request to read a `host`
// header from, so `url` is the same static SITE_URL used everywhere
// else on this page.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "COMINORSA S.A.C.",
  alternateName: "COMINORSA",
  description:
    "Consultoría minera y ambiental: formalización minera (IGAFOM, REINFO), instrumentos ambientales, ingeniería y asistencia técnica desde Piura, Perú.",
  url: SITE_URL,
  telephone: `+${PRIMARY_WHATSAPP_NUMBER}`,
  taxID: "20614147131",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Calle B N.º 12, Urb. Santa Margarita",
    addressLocality: "Veintiséis de Octubre",
    addressRegion: "Piura",
    addressCountry: "PE",
  },
  areaServed: {
    "@type": "AdministrativeArea",
    name: "Piura, Perú",
  },
} as const;

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

// The only font actually critical to preload: Archivo is the `body`
// font (see app/globals.css), so it's on the critical rendering path for
// every page. Newsreader is an italic accent font used on a handful of
// headings, and Geist Mono only renders small labels/kickers — neither
// blocks first paint of the bulk of the page's text the way the body
// font does, so preloading them too would spend early-load bandwidth on
// lower-priority requests (T5's "preload only the critical font(s)").
const CRITICAL_FONT_HREF = "/fonts/archivo-latin-variable.woff2";

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
  /** Absolute path to the built, hashed stylesheet, e.g. "/assets/globals-abc123.css". */
  cssHref: string;
  /** Absolute path to the built, hashed fonts stylesheet (src/build/fonts.css). */
  fontsCssHref: string;
  children: Child;
};

function Document({
  title,
  description,
  canonicalPath,
  robots,
  cssHref,
  fontsCssHref,
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
        <meta property="og:title" content={OG_TITLE} />
        <meta property="og:description" content={OG_DESCRIPTION} />
        <meta property="og:image" content={SOCIAL_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={SOCIAL_IMAGE_ALT} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TWITTER_TITLE} />
        <meta name="twitter:description" content={TWITTER_DESCRIPTION} />
        <meta name="twitter:image" content={SOCIAL_IMAGE} />

        <meta name="theme-color" content={THEME_COLOR} />

        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />

        <link rel="preload" href={CRITICAL_FONT_HREF} as="font" type="font/woff2" crossorigin={true} />
        <link rel="stylesheet" href={cssHref} />
        <link rel="stylesheet" href={fontsCssHref} />

        <script type="application/ld+json">{jsonLdScript(JSON_LD)}</script>
      </head>
      <body>{children}</body>
    </html>
  );
}

export function renderDocument(props: DocumentProps): string {
  return `<!doctype html>${render(<Document {...props} />)}`;
}
