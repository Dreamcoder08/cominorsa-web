// src/build/privacy-page.tsx
//
// P1 (audit P0-1, P0-2): rewritten to describe only the processing that
// actually happens on this site:
//   - The consultation form POSTs every submission to `/api/crm-lead`
//     (`src/client/dom/consultation-form.ts`), which — when configured,
//     as it is in production — stores a Person in COMINORSA's Twenty CRM
//     (name, city, service, question, chosen WhatsApp line, lead origin)
//     and sends an internal email notification through Resend with the
//     name, city, service and question (`app/api/crm-lead/route.ts`).
//   - It also opens WhatsApp with a prefilled message the visitor sends
//     themself; that chat is governed by WhatsApp's own policy.
//   - Google Analytics 4 is described only when the build has a GA
//     measurement ID (`analyticsEnabled`, from `runStaticBuild`), and
//     then only as opt-in.
// Nothing here states a retention period or an email contact: both are
// pending confirmation by COMINORSA (see odd/tasks/landing-polish.md,
// "Needs the client").

import {
  PRIMARY_WHATSAPP_DISPLAY,
  SECONDARY_WHATSAPP_DISPLAY,
} from "../../app/constants";
import { SiteFooter, SiteHeader } from "./site-shell";

// Bump this date whenever the policy text changes (section 6 promises
// the date at the top reflects the latest version).
const PRIVACY_LAST_UPDATED = new Date(Date.UTC(2026, 8, 23));

export const PRIVACY_LAST_UPDATED_LABEL = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(PRIVACY_LAST_UPDATED);

export function PrivacyPage({ analyticsEnabled = false }: { analyticsEnabled?: boolean } = {}) {
  return (
    <main>
      <SiteHeader basePath="/" />

      <section className="legal-page">
        <div className="legal-page-header">
          <h1>Política de Privacidad</h1>
          <p>
            Última actualización: {PRIVACY_LAST_UPDATED_LABEL}. Aplica al sitio
            web de COMINORSA S.A.C. (RUC 20614147131) y a la información que
            nos compartes a través de él.
          </p>
        </div>

        <div className="legal-page-body">
          <section>
            <h2>1. Qué información recibimos</h2>
            <p>
              Cuando completas el formulario de consulta, recibimos los datos
              que escribes en él: nombre completo, ciudad o región, el
              servicio de tu interés, la línea de WhatsApp de COMINORSA que
              eliges y el texto de tu consulta. El formulario no te pide
              correo electrónico ni número de teléfono. Si nos escribes por
              WhatsApp, también recibimos tu número y lo que nos envíes en esa
              conversación.
            </p>
            <p>
              {analyticsEnabled
                ? "Además, solo si aceptas el aviso de cookies, recibimos datos de uso agregados a través de Google Analytics (ver sección 3)."
                : "Este sitio no usa herramientas de analítica ni de publicidad (ver sección 3)."}
            </p>
          </section>

          <section>
            <h2>2. Cómo funciona el formulario</h2>
            <p>Al enviar el formulario ocurren dos cosas:</p>
            <ul>
              <li>
                Tu navegador envía esos datos a nuestro servidor, que los
                registra en el sistema de gestión de clientes (CRM) de
                COMINORSA, basado en Twenty, y nos envía un aviso interno por
                correo electrónico con tu nombre, ciudad o región, servicio y
                consulta. Ese correo se envía a través de Resend, un
                proveedor externo de envío de correos. Este registro ocurre
                aunque luego decidas no enviar el mensaje de WhatsApp.
              </li>
              <li>
                Se abre WhatsApp con un mensaje ya preparado con tus datos,
                para que lo revises y lo envíes tú. A partir de ese momento, la
                conversación ocurre en WhatsApp y queda sujeta también a la{" "}
                <a
                  href="https://www.whatsapp.com/legal/privacy-policy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Política de Privacidad de WhatsApp
                </a>
                , que administra Meta y no controlamos nosotros.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Cookies y analítica</h2>
            {analyticsEnabled ? (
              <p>
                Usamos Google Analytics 4 para entender de forma agregada cómo
                se navega este sitio (páginas visitadas, tiempo de permanencia,
                origen de la visita). Esta herramienta solo se activa si
                aceptas el aviso de cookies que aparece al ingresar; si lo
                rechazas, no se carga ningún script de analítica y no se genera
                ninguna cookie de este tipo. Tu decisión se guarda en tu
                navegador y puedes cambiarla en cualquier momento desde
                &quot;Preferencias de cookies&quot;, en el pie de página. No
                usamos píxeles de publicidad de terceros ni construimos perfiles
                de navegación fuera de este sitio.
              </p>
            ) : (
              <p>
                Este sitio no usa herramientas de analítica ni píxeles de
                publicidad, y no instala cookies de rastreo. Si en el futuro
                incorporamos una herramienta de analítica, solo se activará si
                la aceptas expresamente y actualizaremos esta política.
              </p>
            )}
          </section>

          <section>
            <h2>4. Para qué usamos tu información</h2>
            <p>
              Usamos los datos que nos compartes por el formulario o por
              WhatsApp únicamente para responder tu consulta, coordinar el
              servicio que solicitas y dar seguimiento a la relación
              profesional, en caso de que decidas continuar con nosotros.
              {analyticsEnabled
                ? " Los datos de uso agregados de Google Analytics (cuando los aceptas) los usamos solo para entender qué páginas funcionan mejor y mejorar el sitio."
                : ""}{" "}
              No vendemos ni compartimos tu información con terceros para
              fines comerciales ajenos a tu consulta. Conservamos los datos
              solo el tiempo necesario para atender tu consulta y cumplir
              obligaciones legales.
            </p>
          </section>

          <section>
            <h2>5. Tus derechos (Ley N.º 29733)</h2>
            <p>
              Conforme a la Ley de Protección de Datos Personales del Perú,
              tienes derecho a acceder, rectificar, cancelar y oponerte al uso
              de tus datos personales (derechos ARCO). Para ejercerlos,
              escríbenos por WhatsApp al {PRIMARY_WHATSAPP_DISPLAY} o al{" "}
              {SECONDARY_WHATSAPP_DISPLAY}, o envíanos una solicitud escrita a
              nuestra sede (dirección al pie de esta página), indicando qué
              dato quieres revisar, corregir o eliminar de nuestros registros.
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

      <SiteFooter basePath="/" analyticsEnabled={analyticsEnabled} />
    </main>
  );
}
