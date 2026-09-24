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

  test("renders the intro paragraph verbatim", () => {
    expect(html).toContain(
      "La ruta que buscás no existe o fue movida. Si llegaste acá desde un enlace, avisanos para corregirlo.",
    );
  });

  test("links back to the homepage as the primary CTA", () => {
    expect(html).toContain('<a class="button button-primary" href="/">');
    expect(html).toContain("Volver al inicio");
  });

  test("links to WhatsApp to report the broken link", () => {
    const match = html.match(/<a[^>]*href="https:\/\/wa\.me\/[^"]*"[^>]*>/);
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
