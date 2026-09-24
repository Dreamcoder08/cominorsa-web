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

  test("separates every section with geological strata toward the next surface (landing-craft T5)", () => {
    const order = [...html.matchAll(/strata strata--to-([a-z]+)"|<section class="([^"]+)"/g)].map(
      (m) => (m[1] ? `strata:${m[1]}` : m[2]),
    );
    expect(order).toEqual([
      "hero",
      "strata:paper",
      "section about",
      "strata:ink",
      "section services",
      "strata:cream",
      "section method",
      "strata:deep",
      "section consultation",
      "strata:sand",
      "contact",
    ]);
  });

  describe("formalization route (landing-craft T3)", () => {
    const method = html.slice(
      html.indexOf('id="metodo"'),
      html.indexOf('id="consulta"'),
    );
    const routeTitles = [
      "Revisamos tu situación en el REINFO",
      "Acreditamos la concesión",
      "Aseguramos el terreno superficial",
      "Preparamos el IGAFOM",
      "Armamos el expediente técnico",
      "Solicitamos el inicio de actividades",
    ];

    test("renders the six researched steps as an ordered route, in order", () => {
      expect(method).toContain('<ol class="steps route"');
      const positions = routeTitles.map((title) =>
        method.indexOf(`<h3>${title}</h3>`),
      );
      for (const position of positions) expect(position).toBeGreaterThan(-1);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      expect(method.split('<li class="step">').length - 1).toBe(6);
    });

    test("drops the generic 4-step copy", () => {
      expect(method).not.toContain("Entendemos el caso");
      expect(method).not.toContain("<h3>Evaluamos</h3>");
    });

    test("cites the official MINEM source", () => {
      expect(method).toContain(
        'href="https://www.gob.pe/101185-proceso-de-formalizacion-minera"',
      );
    });
  });

  test("embeds the consultation form inside the consulta section", () => {
    expect(html).toContain('id="consulta"');
    expect(html).toContain('<form class="consultation-form" id="consultation-form" method="post">');
  });

  describe("says each thing once (landing-craft T1)", () => {
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    const count = (haystack: string, needle: string) =>
      haystack.split(needle).length - 1;

    test("each phone tel: link appears exactly once inside <main>", () => {
      expect(count(main, 'href="tel:+51910728575"')).toBe(1);
      expect(count(main, 'href="tel:+51987817100"')).toBe(1);
    });

    test("both phones live in the #contacto block", () => {
      const contact = main.slice(main.indexOf('id="contacto"'));
      expect(contact).toContain('href="tel:+51910728575"');
      expect(contact).toContain('href="tel:+51987817100"');
    });

    test("has no impact section and no hero-footer strip", () => {
      expect(html).not.toContain('class="section impact"');
      expect(html).not.toContain("impact-panel");
      expect(html).not.toContain("hero-footer");
    });

    test("the hero card routes to every service page", () => {
      const start = html.indexOf('<aside class="hero-card"');
      const card = html.slice(start, html.indexOf("</aside>", start));
      expect(start).toBeGreaterThan(-1);
      expect(card).toContain("¿Qué necesitas?");
      for (const service of serviceGroups) {
        expect(card).toContain(`href="/${service.slug}"`);
      }
      expect(card).not.toContain("tel:");
    });
  });

  test("renders the contact address and map link", () => {
    // The JSX text `&nbsp;` compiles to a literal U+00A0 character, not
    // the literal string "&nbsp;" — verified to match production's own
    // rendered output byte-for-byte (curl https://cominorsa.com/).
    expect(html).toContain("Calle B N.º 12, Urb. Santa Margarita");
    expect(html).toContain("Ver ubicación");
  });
});
