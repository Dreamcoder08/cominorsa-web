// src/build/faq-page.test.ts
//
// Ported from `app/preguntas-frecuentes/page.tsx`, verbatim markup and
// copy. FAQ content itself lives in `src/data/faq.ts` (T6a).

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { faqs } from "../data/faq";
import { FaqPage } from "./faq-page";

const html = render(FaqPage({ faqs }));

describe("FaqPage", () => {
  test("renders the page h1 and intro copy verbatim", () => {
    expect(html).toContain("<h1>Preguntas frecuentes</h1>");
    expect(html).toContain(
      "Respuestas generales sobre formalización minera, instrumentos",
    );
  });

  test("renders every FAQ question and answer", () => {
    for (const faq of faqs) {
      expect(html).toContain(`<h2>${faq.question}</h2>`);
    }
    expect(html).toContain("<p>El IGAFOM (Instrumento de Gestión Ambiental");
  });

  test("renders the closing WhatsApp CTA", () => {
    const match = html.match(/<a[^>]*class="button button-primary"[^>]*>/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain(
      encodeURIComponent(
        "Hola COMINORSA, tengo una consulta que no encontré en las preguntas frecuentes.",
      ),
    );
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
