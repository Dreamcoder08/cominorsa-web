// src/build/privacy-page.test.ts
//
// P1 (audit P0-1, P0-2): the policy must describe the processing that
// actually happens. The form POSTs every submission to `/api/crm-lead`
// (`app/api/crm-lead/route.ts`), which stores a Person in the Twenty CRM
// and emails the team through Resend — so the old "no envía tu
// información a ningún servidor" claim was false. Google Analytics is
// described only when the build actually has a GA measurement ID.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { PRIVACY_LAST_UPDATED_LABEL, PrivacyPage } from "./privacy-page";

const html = render(PrivacyPage());
const htmlWithAnalytics = render(PrivacyPage({ analyticsEnabled: true }));

describe("PrivacyPage", () => {
  test("renders the page h1 and a real, Spanish-formatted update date", () => {
    expect(html).toContain("<h1>Política de Privacidad</h1>");
    // CLDR's es-PE month name is "setiembre" (the usual Peruvian
    // spelling, also RAE-accepted) — identical under Bun (JSC) and Node.
    expect(PRIVACY_LAST_UPDATED_LABEL).toBe("23 de setiembre de 2026");
    expect(html).toContain("Última actualización: 23 de setiembre de 2026.");
    expect(html).not.toContain("Última actualización: 2026.");
  });

  test("renders all six numbered sections", () => {
    expect(html).toContain("<h2>1. Qué información recibimos</h2>");
    expect(html).toContain("<h2>2. Cómo funciona el formulario</h2>");
    expect(html).toContain("<h2>3. Cookies y analítica</h2>");
    expect(html).toContain("<h2>4. Para qué usamos tu información</h2>");
    expect(html).toContain("<h2>5. Tus derechos (Ley N.º 29733)</h2>");
    expect(html).toContain("<h2>6. Cambios a esta política</h2>");
  });

  test("no longer claims the form sends nothing to a server", () => {
    expect(html).not.toContain("no envía tu");
    expect(html).not.toContain("ningún servidor");
  });

  test("lists exactly the fields the form sends (name, city, service, WhatsApp line, question)", () => {
    expect(html).toContain("nombre completo");
    expect(html).toContain("ciudad o región");
    expect(html).toContain("servicio de tu interés");
    expect(html).toContain("línea de WhatsApp de COMINORSA");
    expect(html).toContain("texto de tu consulta");
  });

  test("discloses CRM storage (Twenty) and the internal email notification (Resend)", () => {
    expect(html).toContain("CRM");
    expect(html).toContain("Twenty");
    expect(html).toContain("correo electrónico");
    expect(html).toContain("Resend");
  });

  test("explains the WhatsApp handoff and links to WhatsApp's own policy", () => {
    expect(html).toContain(
      '<a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noreferrer">',
    );
  });

  test("states a neutral retention commitment without inventing a period", () => {
    expect(html).toContain(
      "Conservamos los datos solo el tiempo necesario para atender tu consulta y cumplir obligaciones legales.",
    );
  });

  test("routes data-rights requests to the site's existing contact channels", () => {
    expect(html).toContain("+51 910 728 575");
    expect(html).toContain("+51 987 817 100");
    expect(html).toContain("Calle B N.º 12");
    expect(html).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
  });

  test("without a GA ID: states no analytics is used and mentions no cookie preferences control", () => {
    expect(html).not.toContain("Google Analytics");
    expect(html).not.toContain("Preferencias de cookies");
    expect(html).toContain("no usa herramientas de analítica");
  });

  test("with a GA ID: describes GA4 as opt-in and points to the preferences control", () => {
    expect(htmlWithAnalytics).toContain("Google Analytics 4");
    expect(htmlWithAnalytics).toContain("solo se activa si aceptas");
    expect(htmlWithAnalytics).toContain("Preferencias de cookies");
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
