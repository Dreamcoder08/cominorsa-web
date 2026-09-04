import type { Metadata } from "next";
import { getBaseUrl } from "../base-url";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getBaseUrl();

  return {
    title: "Política de Privacidad | COMINORSA",
    description:
      "Cómo COMINORSA S.A.C. trata los datos personales que nos compartes, conforme a la Ley N.º 29733 de Protección de Datos Personales del Perú.",
    alternates: { canonical: `${baseUrl}/privacidad` },
  };
}

export default function PrivacidadPage() {
  return (
    <main>
      <SiteHeader basePath="/" />

      <section className="legal-page">
        <div className="legal-page-header">
          <h1>Política de Privacidad</h1>
          <p>
            Última actualización: 2026. Aplica al sitio web de COMINORSA
            S.A.C. (RUC 20614147131) y a la información que nos compartes a
            través de él.
          </p>
        </div>

        <div className="legal-page-body">
          <section>
            <h2>1. Qué información recibimos</h2>
            <p>
              Cuando escribes por WhatsApp o completas el formulario de
              consulta, nos compartes directamente: nombre, ciudad o región,
              el servicio de tu interés, el número de WhatsApp por el que
              prefieres que te contactemos, y el contenido de tu consulta. Eso
              es todo lo que recopilamos de forma directa — solo lo que tú
              mismo escribes. Aparte de eso, si aceptas el aviso de cookies,
              también recibimos datos de uso agregados y anónimos a través de
              Google Analytics (ver sección 3).
            </p>
          </section>

          <section>
            <h2>2. Cómo funciona el formulario</h2>
            <p>
              El formulario de consulta de este sitio no envía tu
              información a ningún servidor ni base de datos nuestra. Al
              enviarlo, tu navegador arma un mensaje de WhatsApp con los
              datos que ingresaste y abre WhatsApp directamente para que lo
              envíes tú mismo. A partir de ese momento, la conversación
              ocurre en WhatsApp y queda sujeta también a la{" "}
              <a
                href="https://www.whatsapp.com/legal/privacy-policy"
                target="_blank"
                rel="noreferrer"
              >
                Política de Privacidad de WhatsApp
              </a>
              , que administra Meta y no controlamos nosotros.
            </p>
          </section>

          <section>
            <h2>3. Cookies y rastreo</h2>
            <p>
              Usamos Google Analytics 4 para entender de forma agregada cómo
              se navega este sitio (páginas visitadas, tiempo de permanencia,
              origen de la visita). Esta herramienta solo se activa si aceptas
              el aviso de cookies que aparece al ingresar; si lo rechazas, no
              se carga ningún script de analítica y no se genera ninguna
              cookie de este tipo. Puedes cambiar tu decisión en cualquier
              momento desde &quot;Preferencias de cookies&quot;, en el pie de
              página. No usamos píxeles de publicidad de terceros ni
              construimos perfiles de navegación fuera de este sitio.
            </p>
          </section>

          <section>
            <h2>4. Para qué usamos tu información</h2>
            <p>
              Usamos los datos que nos compartes por WhatsApp o el formulario
              únicamente para responder tu consulta, coordinar el servicio
              que solicitas y dar seguimiento a la relación profesional, en
              caso de que decidas continuar con nosotros. Los datos de uso
              agregados de Google Analytics (cuando los aceptas) los usamos
              solo para entender qué páginas funcionan mejor y mejorar el
              sitio. No vendemos ni compartimos tu información con terceros
              para fines comerciales ajenos a tu consulta.
            </p>
          </section>

          <section>
            <h2>5. Tus derechos (Ley N.º 29733)</h2>
            <p>
              Conforme a la Ley de Protección de Datos Personales del Perú,
              tienes derecho a acceder, rectificar, cancelar y oponerte al
              uso de tus datos personales (derechos ARCO). Para ejercerlos,
              escríbenos por WhatsApp indicando qué dato quieres revisar,
              corregir o eliminar de nuestros registros.
            </p>
          </section>

          <section>
            <h2>6. Cambios a esta política</h2>
            <p>
              Si actualizamos esta política, publicaremos la nueva versión
              en esta misma página con la fecha de actualización al
              inicio.
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
