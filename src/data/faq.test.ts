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
});
