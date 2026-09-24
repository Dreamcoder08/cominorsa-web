// src/build/home-page.test.ts
//
// T6b: ported from `app/page.tsx`, verbatim markup and copy.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { serviceGroups } from "../data/services-data";
import { HomePage } from "./home-page";

const html = render(HomePage({ serviceGroups }));

describe("HomePage", () => {
  test("renders the skip link and hero heading", () => {
    expect(html).toContain('<a class="skip-link" href="#contenido">Ir al contenido</a>');
    expect(html).toContain(
      '<span class="reveal-line">Técnica que impulsa.</span>',
    );
    expect(html).toContain(
      '<em class="reveal-line">Responsabilidad que permanece.</em>',
    );
  });

  test("includes the header and footer, anchored at the root (no basePath prefix)", () => {
    expect(html).toContain('<header class="site-header">');
    expect(html).toContain('<a href="#nosotros">Nosotros</a>');
    expect(html).not.toContain('<a href="/#nosotros">');
    expect(html).toContain("<footer>");
  });

  test("renders the hero WhatsApp CTA and phone numbers", () => {
    expect(html).toContain("Hablar por WhatsApp");
    expect(html).toContain('href="tel:+51910728575"');
    expect(html).toContain('href="tel:+51987817100"');
  });

  test("renders a detailed service card per service group, linking to its own page", () => {
    for (const service of serviceGroups) {
      expect(html).toContain(`href="/${service.slug}"`);
      expect(html).toContain(`<h3>${service.title}</h3>`);
    }
  });

  test("renders the 4-step method section", () => {
    expect(html).toContain("<h3>Entendemos el caso</h3>");
    expect(html).toContain("<h3>Evaluamos</h3>");
    expect(html).toContain("<h3>Preparamos</h3>");
    expect(html).toContain("<h3>Acompañamos</h3>");
  });

  test("embeds the consultation form inside the consulta section", () => {
    expect(html).toContain('id="consulta"');
    expect(html).toContain('<form class="consultation-form" id="consultation-form" method="post">');
  });

  test("renders the contact address and map link", () => {
    // The JSX text `&nbsp;` compiles to a literal U+00A0 character, not
    // the literal string "&nbsp;" — verified to match production's own
    // rendered output byte-for-byte (curl https://cominorsa.com/).
    expect(html).toContain("Calle B N.º 12, Urb. Santa Margarita");
    expect(html).toContain("Ver ubicación");
  });
});
