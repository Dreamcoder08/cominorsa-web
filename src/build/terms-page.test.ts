// src/build/terms-page.test.ts
//
// Ported from `app/terminos/page.tsx`, verbatim markup and copy.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { TermsPage } from "./terms-page";

const html = render(TermsPage());

describe("TermsPage", () => {
  test("renders the page h1 and intro copy verbatim", () => {
    expect(html).toContain("<h1>Términos y Condiciones</h1>");
    expect(html).toContain("Última actualización: 2026.");
  });

  test("renders all seven numbered sections", () => {
    expect(html).toContain("<h2>1. Qué es este sitio</h2>");
    expect(html).toContain("<h2>2. Los servicios se contratan fuera del sitio</h2>");
    expect(html).toContain("<h2>3. Propiedad del contenido</h2>");
    expect(html).toContain("<h2>4. Enlaces a WhatsApp</h2>");
    expect(html).toContain("<h2>5. Sin garantía de disponibilidad continua</h2>");
    expect(html).toContain("<h2>6. Ley aplicable</h2>");
    expect(html).toContain("<h2>7. Contacto</h2>");
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
