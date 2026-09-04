import type { Metadata } from "next";
import { getBaseUrl } from "../base-url";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getBaseUrl();

  return {
    title: "Términos y Condiciones | COMINORSA",
    description:
      "Condiciones de uso del sitio web de COMINORSA S.A.C. y del contenido publicado en él.",
    alternates: { canonical: `${baseUrl}/terminos` },
  };
}

export default function TerminosPage() {
  return (
    <main>
      <SiteHeader basePath="/" />

      <section className="legal-page">
        <div className="legal-page-header">
          <h1>Términos y Condiciones</h1>
          <p>
            Última actualización: 2026. Al usar este sitio web, aceptas las
            condiciones descritas aquí.
          </p>
        </div>

        <div className="legal-page-body">
          <section>
            <h2>1. Qué es este sitio</h2>
            <p>
              Este sitio web presenta los servicios de consultoría minera y
              ambiental de COMINORSA S.A.C. (RUC 20614147131) y facilita el
              contacto directo con nosotros por WhatsApp o mediante el
              formulario de consulta. La información publicada aquí es de
              carácter general e informativo; no constituye asesoría legal,
              técnica o ambiental por sí sola.
            </p>
          </section>

          <section>
            <h2>2. Los servicios se contratan fuera del sitio</h2>
            <p>
              Enviar una consulta a través de este sitio no genera por sí
              mismo una relación de servicio ni una obligación contractual.
              El alcance, plazo y condiciones de cada servicio (IGAFOM,
              REINFO, instrumentos ambientales, ingeniería, trámites u otros)
              se acuerdan directamente con COMINORSA una vez iniciada la
              conversación, fuera de esta página web.
            </p>
          </section>

          <section>
            <h2>3. Propiedad del contenido</h2>
            <p>
              Los textos, el logotipo y el diseño de este sitio pertenecen a
              COMINORSA S.A.C. No está permitido reproducirlos con fines
              comerciales sin autorización previa.
            </p>
          </section>

          <section>
            <h2>4. Enlaces a WhatsApp</h2>
            <p>
              Este sitio usa enlaces directos a WhatsApp para facilitar el
              contacto. WhatsApp es un servicio de Meta Platforms, ajeno a
              COMINORSA, y su uso está sujeto a los términos y política de
              privacidad propios de WhatsApp.
            </p>
          </section>

          <section>
            <h2>5. Sin garantía de disponibilidad continua</h2>
            <p>
              Hacemos un esfuerzo razonable para mantener este sitio
              disponible y actualizado, pero no garantizamos que esté libre
              de interrupciones o errores en todo momento.
            </p>
          </section>

          <section>
            <h2>6. Ley aplicable</h2>
            <p>
              Estos términos se rigen por las leyes de la República del
              Perú. Cualquier controversia relacionada con el uso de este
              sitio se resolverá conforme a la legislación peruana vigente.
            </p>
          </section>

          <section>
            <h2>7. Contacto</h2>
            <p>
              Si tienes preguntas sobre estos términos, escríbenos por
              WhatsApp.
            </p>
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
