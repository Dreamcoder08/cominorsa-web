// src/data/services-data.test.ts
//
// T6a: single source of truth for the service catalog. This module
// must be framework-free (no `next` runtime import) so both the Next
// app (`app/services-data.ts`, which re-exports from here) and the
// Bun-native static build (`src/build/`) can import the same array
// without the static build dragging in `next/headers` — see this
// module's own header comment for why the previous split (T3's
// `src/build/site-data.ts` hand-copying one entry) existed and why
// it's no longer necessary.

import { describe, expect, test } from "bun:test";
import { serviceGroups } from "./services-data";

describe("serviceGroups", () => {
  test("has all six services, in production menu order", () => {
    expect(serviceGroups.map((s) => s.slug)).toEqual([
      "igafom-reinfo",
      "gestion-ambiental-minera",
      "declaraciones-dac-estamin",
      "ingenieria-y-planes-de-minado",
      "seguridad-minera",
      "tramites-minem-ingemmet-drem",
    ]);
  });

  test("every service has the fields a page render needs", () => {
    for (const service of serviceGroups) {
      expect(service.pageTitle.length).toBeGreaterThan(0);
      expect(service.pageDescription.length).toBeGreaterThan(0);
      expect(service.intro.length).toBeGreaterThan(0);
      expect(service.items.length).toBeGreaterThan(0);
      expect(service.whatsappMessage.length).toBeGreaterThan(0);
    }
  });

  test("pins the seguridad-minera entry the build already ships, verbatim", () => {
    const seguridadMinera = serviceGroups.find((s) => s.slug === "seguridad-minera");
    expect(seguridadMinera?.pageTitle).toBe("Seguridad minera y consultoría mensual");
    expect(seguridadMinera?.number).toBe("05");
  });
});
