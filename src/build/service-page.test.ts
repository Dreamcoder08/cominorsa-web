// src/build/service-page.test.ts
//
// Ported from `app/ServicePageLayout.tsx`, verbatim markup and copy.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { seguridadMinera } from "./site-data";
import { ServicePage } from "./service-page";

const html = render(ServicePage({ service: seguridadMinera }));

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
