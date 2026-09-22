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
  canonicalPath: "/seguridad-minera/",
  cssHref: "/assets/globals-abc123.css",
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

  test("sets an absolute canonical URL under the production domain", () => {
    expect(html).toContain(
      '<link rel="canonical" href="https://cominorsa.com.pe/seguridad-minera/">',
    );
  });

  test("links the hashed stylesheet passed in", () => {
    expect(html).toContain(
      '<link rel="stylesheet" href="/assets/globals-abc123.css">',
    );
  });

  test("renders children inside body, unescaped when passed as raw()", () => {
    expect(html).toContain("<body><main><p>body</p></main></body>");
  });

  test("sets applicationName", () => {
    expect(html).toContain('<meta name="application-name" content="COMINORSA">');
  });

  test("sets the theme-color from the current viewport export", () => {
    expect(html).toContain('<meta name="theme-color" content="#fbf8ef">');
  });

  test("sets complete Open Graph tags, site-wide (not per-page) as today", () => {
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta property="og:locale" content="es_PE">');
    expect(html).toContain('<meta property="og:site_name" content="COMINORSA">');
    expect(html).toContain(
      '<meta property="og:url" content="https://cominorsa.com.pe/seguridad-minera/">',
    );
    expect(html).toContain('<meta property="og:title" content="COMINORSA | Técnica que impulsa">');
    expect(html).toContain(
      '<meta property="og:description" content="Formalización minera y soluciones ambientales para una minería segura y sostenible.">',
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://cominorsa.com.pe/og.png">',
    );
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
    expect(html).toContain(
      '<meta property="og:image:alt" content="COMINORSA — Consultoría minera y soluciones ambientales">',
    );
  });

  test("sets complete Twitter card tags", () => {
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain(
      '<meta name="twitter:title" content="COMINORSA | Consultoría minera y ambiental">',
    );
    expect(html).toContain(
      '<meta name="twitter:description" content="Formalización, gestión ambiental y asistencia técnica minera.">',
    );
    expect(html).toContain(
      '<meta name="twitter:image" content="https://cominorsa.com.pe/og.png">',
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
    expect(parsed.url).toBe("https://cominorsa.com.pe");
    expect(parsed.telephone).toBe("+51910728575");
    expect(parsed.address.addressRegion).toBe("Piura");
  });

  test("escapes an unsafe title instead of injecting markup", () => {
    const unsafe = renderDocument({
      title: '</title><script>alert(1)</script>',
      description: "d",
      canonicalPath: "/x/",
      cssHref: "/assets/x.css",
      children: raw("<p></p>"),
    });
    expect(unsafe).not.toContain("<script>alert(1)</script>");
    expect(unsafe).toContain(
      "&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;",
    );
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
