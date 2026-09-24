// src/build/document.test.ts
//
// T4: full `<head>` metadata parity with `app/layout.tsx`
// (`generateMetadata`, `viewport`, the root JSON-LD block) and
// `app/services-data.ts`'s `generateServiceMetadata`. Verified against a
// real `pnpm build` + in-process worker render of `/seguridad-minera`
// (see odd/tasks/bun-vanilla-migration.md, T4 verification notes).

import { describe, expect, test } from "bun:test";
import { jsonLdScript, renderDocument } from "./document";
import { raw, render } from "../html/jsx-runtime";

const html = renderDocument({
  title: "Seguridad minera y consultoría mensual | COMINORSA",
  description: "Planes de Seguridad y Salud Ocupacional.",
  canonicalPath: "/seguridad-minera",
  cssHref: "/assets/globals-abc123.css",
  preloadFontHrefs: ["/fonts/archivo-latin-variable-0123abcd.woff2"],
  children: raw("<main><p>body</p></main>"),
});

describe("renderDocument", () => {
  test("starts with a doctype and the Spanish lang attribute", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="es">');
  });

  test("declares utf-8 charset before any other head content", () => {
    const headStart = html.indexOf("<head>");
    const charsetIndex = html.indexOf('<meta charset="utf-8">');
    expect(charsetIndex).toBeGreaterThan(headStart);
    expect(charsetIndex).toBeLessThan(html.indexOf("<title>"));
  });

  test("declares a responsive viewport", () => {
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
    );
  });

  test("sets the exact page title", () => {
    expect(html).toContain(
      "<title>Seguridad minera y consultoría mensual | COMINORSA</title>",
    );
  });

  test("sets the meta description, escaped", () => {
    expect(html).toContain(
      '<meta name="description" content="Planes de Seguridad y Salud Ocupacional.">',
    );
  });

  test("sets an absolute canonical URL under the production domain, no trailing slash", () => {
    expect(html).toContain(
      '<link rel="canonical" href="https://cominorsa.com/seguridad-minera">',
    );
  });

  test("never emits a URL on the stale, non-resolving .com.pe domain", () => {
    expect(html).not.toContain(".com.pe");
  });

  test("links the hashed stylesheet passed in", () => {
    expect(html).toContain(
      '<link rel="stylesheet" href="/assets/globals-abc123.css">',
    );
  });

  // P9: @font-face rules ship inside the one stylesheet — one
  // render-blocking request instead of two.
  test("links exactly one stylesheet", () => {
    expect([...html.matchAll(/rel="stylesheet"/g)].length).toBe(1);
  });

  test("preloads only the critical font (Archivo, the body/heading font), at the hashed href passed in", () => {
    expect(html).toContain(
      '<link rel="preload" href="/fonts/archivo-latin-variable-0123abcd.woff2" as="font" type="font/woff2" crossorigin>',
    );
    // Not preloaded: Newsreader (italic accent font) and Geist Mono
    // (small labels) are lower-priority than the body/heading font.
    expect(html).not.toContain("newsreader-italic-latin-variable.woff2");
    expect(html).not.toContain("geist-mono-latin.woff2");
  });

  test("renders children inside body, unescaped when passed as raw()", () => {
    expect(html).toContain("<body><main><p>body</p></main></body>");
  });

  test("sets applicationName", () => {
    expect(html).toContain('<meta name="application-name" content="COMINORSA">');
  });

  // P9 (audit P2-13): was #fbf8ef (--white), but the header and body
  // paint --paper.
  test("sets theme-color to the --paper token the page actually paints", async () => {
    const css = await Bun.file("app/globals.css").text();
    const paper = css.match(/--paper:\s*(#[0-9a-f]{6});/i)![1];
    expect(html).toContain(`<meta name="theme-color" content="${paper}">`);
  });

  test("preloads every font href passed in, in order", () => {
    const withTwo = renderDocument({
      title: "x",
      description: "y",
      cssHref: "/a.css",
      preloadFontHrefs: [
        "/fonts/archivo-latin-variable-0123abcd.woff2",
        "/fonts/newsreader-italic-latin-variable-4567cdef.woff2",
      ],
      children: raw("<main></main>"),
    });
    const preloads = [...withTwo.matchAll(/<link rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin>/g)].map(
      (m) => m[1],
    );
    expect(preloads).toEqual([
      "/fonts/archivo-latin-variable-0123abcd.woff2",
      "/fonts/newsreader-italic-latin-variable-4567cdef.woff2",
    ]);
  });

  // P2 (audit P1-2): OG/Twitter title+description are per page, derived
  // from the page's own <title>/description — no longer one site-wide
  // copy shared by every route.
  test("sets complete Open Graph tags, with per-page title and description", () => {
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta property="og:locale" content="es_PE">');
    expect(html).toContain('<meta property="og:site_name" content="COMINORSA">');
    expect(html).toContain(
      '<meta property="og:url" content="https://cominorsa.com/seguridad-minera">',
    );
    expect(html).toContain(
      '<meta property="og:title" content="Seguridad minera y consultoría mensual | COMINORSA">',
    );
    expect(html).toContain(
      '<meta property="og:description" content="Planes de Seguridad y Salud Ocupacional.">',
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://cominorsa.com/og.jpg">',
    );
    expect(html).toContain('<meta property="og:image:type" content="image/jpeg">');
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
    expect(html).toContain(
      '<meta property="og:image:alt" content="COMINORSA — Consultoría minera y soluciones ambientales">',
    );
  });

  test("sets complete Twitter card tags, with per-page title and description", () => {
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain(
      '<meta name="twitter:title" content="Seguridad minera y consultoría mensual | COMINORSA">',
    );
    expect(html).toContain(
      '<meta name="twitter:description" content="Planes de Seguridad y Salud Ocupacional.">',
    );
    expect(html).toContain(
      '<meta name="twitter:image" content="https://cominorsa.com/og.jpg">',
    );
  });

  test("declares favicons, apple-touch-icon, and the manifest link", () => {
    expect(html).toContain('<link rel="shortcut icon" href="/favicon.ico">');
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="any">');
    expect(html).toContain(
      '<link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16">',
    );
    expect(html).toContain(
      '<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">',
    );
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png">');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest">');
  });

  test("embeds the ProfessionalService JSON-LD block via a script tag", () => {
    const match = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed["@type"]).toBe("ProfessionalService");
    expect(parsed.name).toBe("COMINORSA S.A.C.");
    expect(parsed.url).toBe("https://cominorsa.com");
    expect(parsed.telephone).toBe("+51910728575");
    expect(parsed.address.addressRegion).toBe("Piura");
  });

  test("does not emit a robots meta tag when none is requested", () => {
    expect(html).not.toContain('name="robots"');
  });

  test("escapes an unsafe title instead of injecting markup", () => {
    const unsafe = renderDocument({
      title: '</title><script>alert(1)</script>',
      description: "d",
      canonicalPath: "/x",
      cssHref: "/assets/x.css",
      preloadFontHrefs: ["/fonts/archivo-latin-variable-0123abcd.woff2"],
      children: raw("<p></p>"),
    });
    expect(unsafe).not.toContain("<script>alert(1)</script>");
    expect(unsafe).toContain(
      "&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });
});

// T6a: the 404 page has no canonical URL (there's no single "real" page
// it represents) and must be noindex — `canonicalPath` is optional, and
// an explicit `robots` prop renders a `<meta name="robots">` tag.
// Verified against the live site: `curl -sL
// https://cominorsa.com/<random-broken-path>` returns 404 with `<meta
// name="robots" content="noindex, follow">` and no `<link rel="canonical">`
// at all (matching `app/not-found.tsx`'s own `robots: { index: false,
// follow: true }` metadata, which Next serializes as "noindex, follow").
describe("renderDocument for the site root", () => {
  const homeHtml = renderDocument({
    title: "COMINORSA | Consultoría minera y ambiental",
    description: "Formalización minera.",
    canonicalPath: "/",
    cssHref: "/assets/globals-abc123.css",
    preloadFontHrefs: ["/fonts/archivo-latin-variable-0123abcd.woff2"],
    children: raw("<main></main>"),
  });

  test("the root canonical and og:url keep their single trailing slash", () => {
    expect(homeHtml).toContain('<link rel="canonical" href="https://cominorsa.com/">');
    expect(homeHtml).toContain('<meta property="og:url" content="https://cominorsa.com/">');
  });
});

describe("renderDocument without canonicalPath (404 page)", () => {
  const notFoundHtml = renderDocument({
    title: "Página no encontrada",
    description: "Formalización minera, instrumentos ambientales, ingeniería y asistencia técnica desde Piura, Perú.",
    robots: "noindex, follow",
    cssHref: "/assets/globals-abc123.css",
    preloadFontHrefs: ["/fonts/archivo-latin-variable-0123abcd.woff2"],
    children: raw("<main><p>404</p></main>"),
  });

  test("emits no canonical link", () => {
    expect(notFoundHtml).not.toContain('rel="canonical"');
  });

  test("emits no og:url meta (there is no canonical URL to advertise)", () => {
    expect(notFoundHtml).not.toContain('property="og:url"');
  });

  test("emits the requested robots meta tag", () => {
    expect(notFoundHtml).toContain('<meta name="robots" content="noindex, follow">');
  });

  test("still emits the rest of the head (title, description, OG defaults)", () => {
    expect(notFoundHtml).toContain("<title>Página no encontrada</title>");
    expect(notFoundHtml).toContain('<meta property="og:site_name" content="COMINORSA">');
  });
});

// T7: the site's 4 progressive-enhancement widgets load as
// `<script type="module" src="...">` — no inline `<script>` at all (T10's
// CSP will be `script-src 'self'` plus whatever GA4 needs), and no bare
// specifiers or nonce/defer/async attributes to manage: module scripts
// are deferred by the HTML spec on their own.
describe("renderDocument scriptSrcs (T7)", () => {
  test("emits no <script type=module> tags when scriptSrcs is omitted", () => {
    expect(html).not.toContain('<script type="module"');
  });

  test("emits one <script type=module src=...> per entry, before </body>, in order", () => {
    const withScripts = renderDocument({
      title: "Seguridad minera y consultoría mensual | COMINORSA",
      description: "Planes de Seguridad y Salud Ocupacional.",
      canonicalPath: "/seguridad-minera",
      cssHref: "/assets/globals-abc123.css",
      preloadFontHrefs: ["/fonts/archivo-latin-variable-0123abcd.woff2"],
      scriptSrcs: ["/assets/mobile-nav-aaa111.js", "/assets/consent-bbb222.js"],
      children: raw("<main><p>body</p></main>"),
    });

    expect(withScripts).toContain(
      '<script type="module" src="/assets/mobile-nav-aaa111.js" defer></script>',
    );
    expect(withScripts).toContain(
      '<script type="module" src="/assets/consent-bbb222.js" defer></script>',
    );
    const firstIndex = withScripts.indexOf("mobile-nav-aaa111.js");
    const secondIndex = withScripts.indexOf("consent-bbb222.js");
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(withScripts.indexOf("</body>")).toBeGreaterThan(secondIndex);
  });

  test("never emits an inline <script> body (only src-based module scripts, plus the JSON-LD data block)", () => {
    const withScripts = renderDocument({
      title: "x",
      description: "y",
      cssHref: "/a.css",
      preloadFontHrefs: ["/fonts/archivo-latin-variable-0123abcd.woff2"],
      scriptSrcs: ["/assets/consent-bbb222.js"],
      children: raw("<main></main>"),
    });

    // Every <script> tag must either be the JSON-LD data block or a
    // src-based module script — never carry an inline JS body.
    const scriptTags = [...withScripts.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
    expect(scriptTags.length).toBeGreaterThan(0);
    for (const [tag, body] of scriptTags) {
      const isJsonLd = tag.includes('type="application/ld+json"');
      const isModule = tag.includes('type="module"') && tag.includes("src=");
      expect(isJsonLd || isModule).toBe(true);
      if (isModule) expect(body).toBe("");
    }
  });
});

// G2: the JSON-LD block is the site's one raw-HTML sink. `raw()` applies
// no escaping — the caller (`jsonLdScript`) owns keeping it both valid
// JSON and safe to embed inside a <script> element.
describe("jsonLdScript (G2)", () => {
  test("a </script> inside a string value cannot break out of the element", () => {
    const malicious = {
      description: '</script><script>alert("pwned")</script>',
    };
    const htmlOut = render(jsonLdScript(malicious));

    // The literal byte sequence "</script" must never appear — that's
    // the actual injection vector an HTML parser looks for.
    expect(htmlOut.toLowerCase()).not.toContain("</script");
  });

  test("round-trips through JSON.parse back to the exact original string", () => {
    const malicious = {
      description: '</script><script>alert("pwned")</script>',
    };
    const htmlOut = render(jsonLdScript(malicious));

    // Proves the escaping is JSON-safe, not just HTML-safe: a plain
    // HTML/XML text-escaper (e.g. `escapeText`) would corrupt the JSON
    // by turning `"` into `&quot;`; this treatment must not.
    const parsed = JSON.parse(htmlOut);
    expect(parsed.description).toBe(malicious.description);
  });

  test("does not otherwise alter the serialized JSON", () => {
    const data = { a: 1, b: "plain text", c: [1, 2, 3] };
    const htmlOut = render(jsonLdScript(data));

    expect(JSON.parse(htmlOut)).toEqual(data);
  });
});
