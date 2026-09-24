// src/build/service-page.test.ts
//
// Ported from `app/ServicePageLayout.tsx`, verbatim markup and copy.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { faqs, seguridadMinera, serviceGroups } from "./site-data";
import { ServicePage } from "./service-page";

const html = render(ServicePage({ service: seguridadMinera }));
/** Same escaping the runtime applies to a text child. */
const escapeText = (text: string) => render(text);

describe("ServicePage", () => {
  test("renders the page h1 and intro copy verbatim", () => {
    expect(html).toContain("<h1>Seguridad minera y consultoría mensual</h1>");
    expect(html).toContain(
      "Si necesitas fortalecer tu seguridad operativa, te asistimos en la gestión preventiva y el desempeño técnico",
    );
  });

  test("renders every service item", () => {
    expect(html).toContain("<li>Planes de Seguridad y Salud Ocupacional</li>");
    expect(html).toContain("<li>Supervisión y Asistencia Técnica Minera</li>");
    expect(html).toContain("<li>Consultoría mensual para operaciones mineras</li>");
  });

  test("renders the WhatsApp CTA with the service-specific message and analytics markers", () => {
    const match = html.match(/<a[^>]*class="button button-primary"[^>]*>/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('data-event="whatsapp_cta_click"');
    expect(match![0]).toContain('data-event-context="seguridad-minera"');
    expect(match![0]).toContain(
      encodeURIComponent(
        "Hola COMINORSA, quiero información sobre seguridad minera y consultoría mensual.",
      ),
    );
  });

  test("links back to the homepage service list", () => {
    expect(html).toContain('<a href="/#servicios">ver todos los servicios</a>');
  });

  test("renders the legal footer paragraph verbatim", () => {
    expect(html).toContain(
      "COMINORSA S.A.C. · RUC 20614147131 · Calle B N.º 12, Urb. Santa",
    );
  });

  test("includes the header and footer nav", () => {
    expect(html).toContain('<header class="site-header">');
    expect(html).toContain("<footer>");
  });
});

// P5 (audit P1-8): every service page cross-links the rest of the
// catalog, shows where it sits (Inicio › Servicios › <servicio>) and
// points to the FAQ entries that already talk about it. Only existing
// copy is reused — titles/descriptions come from services-data.ts.
describe("ServicePage navigation (P5)", () => {
  for (const service of serviceGroups) {
    const page = render(ServicePage({ service }));

    test(`${service.slug}: links to every other service page, with its existing title and description`, () => {
      const block = page.match(/<section[^>]*aria-labelledby="otros-servicios"[\s\S]*?<\/section>/);
      expect(block).not.toBeNull();
      expect(block![0]).toContain('<h2 id="otros-servicios">Otros servicios</h2>');
      const siblings = serviceGroups.filter((s) => s.slug !== service.slug);
      expect(siblings.length).toBe(5);
      for (const sibling of siblings) {
        expect(block![0]).toContain(`<a href="/${sibling.slug}">${escapeText(sibling.pageTitle)}</a>`);
        expect(block![0]).toContain(escapeText(sibling.description));
      }
      expect(block![0]).not.toContain(`href="/${service.slug}"`);
    });

    test(`${service.slug}: renders a visible breadcrumb Inicio › Servicios › <servicio>`, () => {
      const nav = page.match(/<nav class="breadcrumb" aria-label="Migas de pan">[\s\S]*?<\/nav>/);
      expect(nav).not.toBeNull();
      expect(nav![0]).toContain('<a href="/">Inicio</a>');
      expect(nav![0]).toContain('<a href="/#servicios">Servicios</a>');
      expect(nav![0]).toContain(`<li aria-current="page">${escapeText(service.pageTitle)}</li>`);
      // Before the h1: the trail frames the page, it doesn't follow it.
      expect(page.indexOf('aria-label="Migas de pan"')).toBeLessThan(page.indexOf("<h1>"));
    });

    const related = faqs.filter((faq) => faq.serviceSlug === service.slug);
    test(`${service.slug}: links its ${related.length} related FAQ entries by anchor`, () => {
      for (const faq of related) {
        expect(page).toContain(`<a href="/preguntas-frecuentes#${faq.id}">${escapeText(faq.question)}</a>`);
      }
      if (related.length === 0) expect(page).not.toContain('href="/preguntas-frecuentes#');
    });
  }

  test("every FAQ entry that names a service points to a real service slug", () => {
    const slugs = new Set(serviceGroups.map((s) => s.slug));
    for (const faq of faqs) {
      if (faq.serviceSlug !== undefined) expect(slugs.has(faq.serviceSlug)).toBe(true);
    }
  });
});
