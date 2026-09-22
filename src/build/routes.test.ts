// src/build/routes.test.ts
//
// T6a: one explicit route table drives the static build. `build.ts`
// loops over `PAGE_ROUTES` to emit `<slug>.html` for each; T8's
// sitemap generator reuses the same list instead of hand-listing
// routes a second time. This commit's table holds only the 6 service
// pages; later commits in the same task add
// preguntas-frecuentes/privacidad/terminos and the 404 page.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { PAGE_ROUTES } from "./routes";
import { serviceGroups } from "./site-data";

describe("PAGE_ROUTES", () => {
  test("has exactly one entry per service", () => {
    const slugs = PAGE_ROUTES.map((r) => r.slug);
    expect(slugs.length).toBe(serviceGroups.length);
    for (const service of serviceGroups) {
      expect(slugs).toContain(service.slug);
    }
  });

  test("every route has a unique slug", () => {
    const slugs = PAGE_ROUTES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every route sets a canonicalPath matching its slug", () => {
    for (const route of PAGE_ROUTES) {
      expect(route.canonicalPath).toBe(`/${route.slug}`);
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

  test("the seguridad-minera route renders its known h1 (parity with the pre-route-table build)", () => {
    const route = PAGE_ROUTES.find((r) => r.slug === "seguridad-minera")!;
    const html = render(route.render());
    expect(html).toContain("<h1>Seguridad minera y consultoría mensual</h1>");
  });
});
