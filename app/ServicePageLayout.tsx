import Link from "next/link";
import { buildWhatsAppLink } from "./constants";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import type { ServiceGroup } from "./services-data";

export function ServicePageLayout({ service }: { service: ServiceGroup }) {
  const whatsappHref = buildWhatsAppLink(service.whatsappMessage);

  return (
    <main>
      <SiteHeader basePath="/" />

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
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Conversemos por WhatsApp</h2>
            <p>
              Escríbenos y cuéntanos tu caso para coordinar la atención.
              También puedes{" "}
              <Link href="/#servicios">ver todos los servicios</Link>.
            </p>
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
