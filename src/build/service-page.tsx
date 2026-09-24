// src/build/service-page.tsx
//
// Ported from `app/ServicePageLayout.tsx`, verbatim markup and copy.

import { buildWhatsAppLink } from "../../app/constants";
import type { ServiceGroup } from "../data/services-data";
import { SiteLayout } from "./site-shell";

export function ServicePage({
  service,
  analyticsEnabled = false,
}: {
  service: ServiceGroup;
  analyticsEnabled?: boolean;
}) {
  const whatsappHref = buildWhatsAppLink(service.whatsappMessage);

  return (
    <SiteLayout basePath="/" analyticsEnabled={analyticsEnabled}>
      <section className="legal-page">
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
        </div>

        <p className="legal-page-footer">
          COMINORSA S.A.C. · RUC 20614147131 · Calle B N.º 12, Urb. Santa Margarita, Veintiséis de
          Octubre, Piura, Perú.
        </p>
      </section>

    </SiteLayout>
  );
}
