// src/build/privacy-page.test.ts
//
// Ported from `app/privacidad/page.tsx`, verbatim markup and copy.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { PrivacyPage } from "./privacy-page";

const html = render(PrivacyPage());

describe("PrivacyPage", () => {
  test("renders the page h1 and intro copy verbatim", () => {
    expect(html).toContain("<h1>Política de Privacidad</h1>");
    expect(html).toContain("Última actualización: 2026.");
  });

  test("renders all six numbered sections", () => {
    expect(html).toContain("<h2>1. Qué información recibimos</h2>");
    expect(html).toContain("<h2>2. Cómo funciona el formulario</h2>");
    expect(html).toContain("<h2>3. Cookies y rastreo</h2>");
    expect(html).toContain("<h2>4. Para qué usamos tu información</h2>");
    expect(html).toContain("<h2>5. Tus derechos (Ley N.º 29733)</h2>");
    expect(html).toContain("<h2>6. Cambios a esta política</h2>");
  });

  test("links to the WhatsApp privacy policy", () => {
    expect(html).toContain(
      '<a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noreferrer">',
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
