// src/build/routes.test.ts
//
// T6a: one explicit route table drives the static build for every page
// except the homepage (T6b, tracked separately). `build.ts` loops over
// `PAGE_ROUTES` to emit `<slug>.html` for each; T8's sitemap generator
// reuses the same list instead of hand-listing routes a second time.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { PAGE_ROUTES } from "./routes";
import { serviceGroups } from "./site-data";

describe("PAGE_ROUTES", () => {
  test("has one entry per service, plus the homepage/preguntas-frecuentes/privacidad/terminos/404", () => {
    const slugs = PAGE_ROUTES.map((r) => r.slug);
    for (const service of serviceGroups) {
      expect(slugs).toContain(service.slug);
    }
    expect(slugs).toContain("");
    expect(slugs).toContain("preguntas-frecuentes");
    expect(slugs).toContain("privacidad");
    expect(slugs).toContain("terminos");
    expect(slugs).toContain("404");
    expect(slugs.length).toBe(serviceGroups.length + 5);
  });

  test("every route has a unique slug", () => {
    const slugs = PAGE_ROUTES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every route except the homepage and 404 sets a canonicalPath matching its slug", () => {
    for (const route of PAGE_ROUTES) {
      if (route.slug === "404" || route.slug === "") continue;
      expect(route.canonicalPath).toBe(`/${route.slug}`);
    }
  });

  test("the 404 route sets no canonicalPath and is noindex", () => {
    const notFound = PAGE_ROUTES.find((r) => r.slug === "404");
    expect(notFound?.canonicalPath).toBeUndefined();
    expect(notFound?.robots).toBe("noindex, follow");
  });

  // Verified against the live site (curl -sL https://cominorsa.com/):
  // the root layout's generateMetadata sets no `alternates.canonical`
  // and app/page.tsx exports no generateMetadata of its own, so
  // production emits NO <link rel="canonical"> and NO og:url meta at
  // all for "/" — unlike every service page, which does set one via
  // generateServiceMetadata. Matching that exactly means omitting
  // canonicalPath here too, the same way the 404 route already does.
  test("the homepage route sets no canonicalPath (matches production, which emits none for '/')", () => {
    const home = PAGE_ROUTES.find((r) => r.slug === "");
    expect(home?.canonicalPath).toBeUndefined();
    expect(home?.robots).toBeUndefined();
  });

  test("the homepage route uses its exact brand-first production title via fullTitle, not the site-wide suffix pattern", () => {
    const home = PAGE_ROUTES.find((r) => r.slug === "");
    expect(home?.fullTitle).toBe("COMINORSA | Consultoría minera y ambiental");
  });

  test("no non-404 route sets robots", () => {
    for (const route of PAGE_ROUTES) {
      if (route.slug === "404") continue;
      expect(route.robots).toBeUndefined();
    }
  });

  test("every route has a non-empty title/description and renders non-empty HTML", () => {
    for (const route of PAGE_ROUTES) {
      expect(route.title.length).toBeGreaterThan(0);
      expect(route.description.length).toBeGreaterThan(0);
      const html = render(route.render());
      expect(html.length).toBeGreaterThan(0);
    }
  });

  test("the homepage route renders the hero heading and the consultation form", () => {
    const home = PAGE_ROUTES.find((r) => r.slug === "")!;
    const html = render(home.render());
    expect(html).toContain('<span class="reveal-line">Técnica que impulsa.</span>');
    expect(html).toContain('<form class="consultation-form" id="consultation-form">');
  });

  test("the seguridad-minera route renders its known h1 (parity with the pre-route-table build)", () => {
    const route = PAGE_ROUTES.find((r) => r.slug === "seguridad-minera")!;
    const html = render(route.render());
    expect(html).toContain("<h1>Seguridad minera y consultoría mensual</h1>");
  });
});
