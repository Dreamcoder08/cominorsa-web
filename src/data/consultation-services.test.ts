// src/data/consultation-services.test.ts
//
// T6b: the consultation form's "Servicio de interés" options, moved
// here from a local const in `app/ConsultationForm.tsx` — single
// source of truth shared with the static build's server-rendered form
// (`src/build/consultation-form.tsx`), same principle as
// `src/data/services-data.ts` and `src/data/faq.ts` (T6a).

import { describe, expect, test } from "bun:test";
import { consultationServiceOptions } from "./consultation-services";

describe("consultationServiceOptions", () => {
  test("has the 9 service categories the consultation form offers", () => {
    expect(consultationServiceOptions.length).toBe(9);
  });

  test("every option is unique", () => {
    expect(new Set(consultationServiceOptions).size).toBe(
      consultationServiceOptions.length,
    );
  });

  test("starts with the formalization category and ends with the open-ended fallback", () => {
    expect(consultationServiceOptions[0]).toBe(
      "Formalización minera e IGAFOM",
    );
    expect(consultationServiceOptions.at(-1)).toBe(
      "Otra consulta minera o ambiental",
    );
  });

  test("includes every category referenced across the site's service pages", () => {
    expect(consultationServiceOptions).toContain("REINFO");
    expect(consultationServiceOptions).toContain(
      "DIA, PAMA e instrumentos ambientales",
    );
    expect(consultationServiceOptions).toContain("DAC y ESTAMIN");
    expect(consultationServiceOptions).toContain(
      "Seguridad y salud ocupacional",
    );
    expect(consultationServiceOptions).toContain(
      "Trámites ante MINEM, INGEMMET o DREM",
    );
  });
});
