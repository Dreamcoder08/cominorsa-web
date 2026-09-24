// src/data/faq.test.ts
//
// T6a: single source of truth for the FAQ content, previously a local
// const inside `app/preguntas-frecuentes/page.tsx`. Moved here so both
// that Next page and the Bun-native static build's FAQ page render the
// exact same list.

import { describe, expect, test } from "bun:test";
import { faqs } from "./faq";

describe("faqs", () => {
  test("has all eight production questions, in order", () => {
    expect(faqs.length).toBe(8);
    expect(faqs[0]?.question).toBe("¿Qué es el IGAFOM y para quién es?");
    expect(faqs.at(-1)?.question).toBe(
      "No sé qué servicio necesito, ¿cómo empiezo?",
    );
  });

  test("every entry has a non-empty question and answer", () => {
    for (const faq of faqs) {
      expect(faq.question.length).toBeGreaterThan(0);
      expect(faq.answer.length).toBeGreaterThan(0);
    }
  });

  // P5: stable anchors so service pages can deep-link their FAQ entries.
  test("every entry has a unique, URL-safe anchor id", () => {
    const ids = faqs.map((faq) => faq.id);
    expect(new Set(ids).size).toBe(faqs.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  // P5: the mapping follows the existing question text only — each
  // question that names a service's own subject points to that service.
  test("service-specific questions map to the service they talk about", () => {
    const bySlug = Object.fromEntries(faqs.map((faq) => [faq.id, faq.serviceSlug]));
    expect(bySlug).toEqual({
      igafom: "igafom-reinfo",
      reinfo: "igafom-reinfo",
      "dia-pama": "gestion-ambiental-minera",
      "dac-estamin": "declaraciones-dac-estamin",
      "plan-de-minado": "ingenieria-y-planes-de-minado",
      "consultoria-mensual": "seguridad-minera",
      ubicacion: undefined,
      "como-empezar": undefined,
    });
  });
});
