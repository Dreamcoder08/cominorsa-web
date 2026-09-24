// src/build/faq-page.tsx
//
// Ported from `app/preguntas-frecuentes/page.tsx`, verbatim markup and
// copy. FAQ content lives in `src/data/faq.ts` (T6a), imported by both
// this static build and the Next page — single source of truth.

import { buildWhatsAppLink } from "../../app/constants";
import type { FaqEntry } from "../data/faq";
import { SiteFooter, SiteHeader } from "./site-shell";

export function FaqPage({ faqs }: { faqs: readonly FaqEntry[] }) {
  const whatsappHref = buildWhatsAppLink(
    "Hola COMINORSA, tengo una consulta que no encontré en las preguntas frecuentes.",
  );

  return (
    <main>
      <SiteHeader basePath="/" />

      <section className="legal-page">
        <div className="legal-page-header">
          <h1>Preguntas frecuentes</h1>
          <p>
            Respuestas generales sobre formalización minera, instrumentos
            ambientales y asistencia técnica. Cada caso es distinto — esto es
            un punto de partida, no un reemplazo de la evaluación de tu
            situación específica.
          </p>
        </div>

        <div className="legal-page-body">
          {faqs.map((faq) => (
            <section>
              <h2>{faq.question}</h2>
              <p>{faq.answer}</p>
            </section>
          ))}

          <section>
            <h2>¿Tu pregunta no está aquí?</h2>
            <p>Escríbenos por WhatsApp y revisamos tu caso directamente.</p>
            <a
              className="button button-primary"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
            >
              Hablar por WhatsApp
              <span aria-hidden="true">↗</span>
            </a>
          </section>
        </div>

        <p className="legal-page-footer">
          COMINORSA S.A.C. · RUC 20614147131 · Calle B N.º 12, Urb. Santa
          Margarita, Veintiséis de Octubre, Piura, Perú.
        </p>
      </section>

      <SiteFooter basePath="/" />
    </main>
  );
}
