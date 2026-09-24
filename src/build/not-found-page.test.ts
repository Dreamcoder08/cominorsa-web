// src/build/not-found-page.test.ts
//
// Ported from `app/not-found.tsx`. See not-found-page.tsx's header
// comment for why this is restyled with the site's token-based
// `.legal-page`/`.button` classes instead of the original's Tailwind
// utility classes (which this static build's CSS pipeline cannot
// generate — no Tailwind JIT/content scanning, see build.ts). Copy and
// the two calls to action are otherwise verbatim.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { NotFoundPage } from "./not-found-page";

const html = render(NotFoundPage());

describe("NotFoundPage", () => {
  test("renders the error label and heading verbatim", () => {
    expect(html).toContain("Error 404");
    expect(html).toContain("<h1>Página no encontrada</h1>");
  });

  test("renders the intro paragraph in neutral Spanish (tú, no voseo)", () => {
    expect(html).toContain(
      "La ruta que buscas no existe o fue movida. Si llegaste aquí desde un enlace, avísanos para corregirlo.",
    );
  });

  test("P8: renders inside the full site shell — skip link, header, main, footer", () => {
    expect(html.startsWith('<a class="skip-link" href="#contenido">')).toBe(true);
    expect(html).toContain('<header class="site-header">');
    expect(html).toContain('<main id="contenido">');
    expect(html).toContain("<footer>");
    // Brand/nav links point back to the homepage sections from this non-home page.
    expect(html).toContain('href="/#inicio"');
  });

  test("links back to the homepage as the primary CTA", () => {
    expect(html).toContain('<a class="button button-primary" href="/">');
    expect(html).toContain("Volver al inicio");
  });

  test("links to WhatsApp to report the broken link", () => {
    // The shell has its own WhatsApp CTAs; this is the page's "report it" link.
    const match = html.match(/<a[^>]*href="https:\/\/wa\.me\/[^"]*enlace%20roto[^"]*"[^>]*>/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('target="_blank"');
    expect(match![0]).toContain('rel="noopener"');
    expect(html).toContain(
      encodeURIComponent("Hola, llegué a un enlace roto en su web"),
    );
    expect(html).toContain("Avisar por WhatsApp");
  });

  test("uses no Tailwind utility classes (they render unstyled in this pipeline)", () => {
    expect(html).not.toContain("bg-amber");
    expect(html).not.toContain("rounded-md");
  });
});
