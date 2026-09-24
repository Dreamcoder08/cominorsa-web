// src/build/service-page.tsx
//
// Ported from `app/ServicePageLayout.tsx`, verbatim markup and copy.
// P5 (audit P1-8): breadcrumb, related FAQ entries and the rest of the
// catalog, all built from existing data (services-data.ts, faq.ts) — no
// new claims.

import { buildWhatsAppLink } from "../../app/constants";
import { faqs } from "../data/faq";
import { serviceGroups, type ServiceGroup } from "../data/services-data";
import { SiteLayout } from "./site-shell";
import { serviceBreadcrumbTrail } from "./structured-data";

export function ServicePage({
  service,
  analyticsEnabled = false,
}: {
  service: ServiceGroup;
  analyticsEnabled?: boolean;
}) {
  const whatsappHref = buildWhatsAppLink(service.whatsappMessage);
  const trail = serviceBreadcrumbTrail(service);
  const relatedFaqs = faqs.filter((faq) => faq.serviceSlug === service.slug);
  const otherServices = serviceGroups.filter((other) => other.slug !== service.slug);

  return (
    <SiteLayout basePath="/" analyticsEnabled={analyticsEnabled}>
      <section className="legal-page">
        <nav className="breadcrumb" aria-label="Migas de pan">
          <ol>
            {trail.slice(0, -1).map((step) => (
              <li>
                <a href={step.path}>{step.name}</a>
              </li>
            ))}
            <li aria-current="page">{trail.at(-1)!.name}</li>
          </ol>
        </nav>

        <div className="legal-page-header">
          <h1>{service.pageTitle}</h1>
          <p>{service.intro}</p>
        </div>

        <div className="legal-page-body">
          <section>
            <h2>Qué incluye</h2>
            <ul>
              {service.items.map((item) => (
                <li>{item}</li>
              ))}
            </ul>
          </section>

          {relatedFaqs.length > 0 ? (
            <section aria-labelledby="preguntas-relacionadas">
              <h2 id="preguntas-relacionadas">Preguntas frecuentes</h2>
              <ul>
                {relatedFaqs.map((faq) => (
                  <li>
                    <a href={`/preguntas-frecuentes#${faq.id}`}>{faq.question}</a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2>Conversemos por WhatsApp</h2>
            <p>
              Escríbenos y cuéntanos tu caso para coordinar la atención. También puedes{" "}
              <a href="/#servicios">ver todos los servicios</a>.
            </p>
            <a
              className="button button-primary"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              data-event="whatsapp_cta_click"
              data-event-context={service.slug}
            >
              Hablar por WhatsApp
              <span aria-hidden="true">↗</span>
            </a>
          </section>

          <section aria-labelledby="otros-servicios">
            <h2 id="otros-servicios">Otros servicios</h2>
            <ul className="related-services">
              {otherServices.map((other) => (
                <li>
                  <a href={`/${other.slug}`}>{other.pageTitle}</a>
                  <p>{other.description}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p className="legal-page-footer">
          COMINORSA S.A.C. · RUC 20614147131 · Calle B N.º 12, Urb. Santa Margarita, Veintiséis de
          Octubre, Piura, Perú.
        </p>
      </section>

    </SiteLayout>
  );
}
