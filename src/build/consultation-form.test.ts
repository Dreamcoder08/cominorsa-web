// src/build/consultation-form.test.ts
//
// T6b: ported from `app/ConsultationForm.tsx`. This is the no-JS
// baseline markup — same fields, `name`s, `required`, and aria
// attributes as the real component's SSR output before hydration.
// Building the wa.me URL, the fire-and-forget POST to /api/crm-lead,
// and analytics events are T7's job (see this module's own header
// comment for the exact hooks left for that script).

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { consultationServiceOptions } from "../data/consultation-services";
import { ConsultationForm } from "./consultation-form";

const html = render(ConsultationForm());

describe("ConsultationForm", () => {
  test("renders a real <form> with the T7 hook id, no inline script and no onSubmit wiring", () => {
    expect(html).toContain('<form class="consultation-form" id="consultation-form">');
    expect(html).not.toContain("<script");
  });

  test("renders the name field", () => {
    expect(html).toContain(
      '<input type="text" name="name" autocomplete="name" maxlength="120" placeholder="Escribe tu nombre" required>',
    );
  });

  test("renders the city field", () => {
    expect(html).toContain(
      '<input type="text" name="city" autocomplete="address-level1" maxlength="120" placeholder="Ej. Piura" required>',
    );
  });

  test("renders every service option from the shared data module, with a disabled placeholder first", () => {
    expect(html).toContain('<option value="" disabled selected>');
    for (const option of consultationServiceOptions) {
      expect(html).toContain(`<option value="${option}">${option}</option>`);
    }
  });

  test("renders the WhatsApp line select with the primary number selected by default", () => {
    expect(html).toContain('<select name="whatsapp" required>');
    expect(html).toContain('<option value="51910728575" selected>910 728 575</option>');
    expect(html).toContain('<option value="51987817100">987 817 100</option>');
  });

  test("renders the question textarea", () => {
    expect(html).toContain(
      '<textarea name="question" rows="5" minlength="10" maxlength="2000" placeholder="Cuéntanos brevemente qué necesitas resolver" required></textarea>',
    );
  });

  test("submit button starts disabled (pre-hydration baseline) with the T7 hook id", () => {
    expect(html).toContain('<button type="submit" id="consultation-form-submit" disabled>');
    expect(html).toContain("Enviar por WhatsApp");
  });

  test("renders the disclaimer copy verbatim", () => {
    expect(html).toContain(
      "Al continuar se abrirá WhatsApp. El pago y el horario de atención se",
    );
  });

  test("status paragraph starts empty with the T7 hook id and aria-live", () => {
    expect(html).toContain(
      '<p class="form-status" id="consultation-form-status" aria-live="polite"></p>',
    );
  });
});

// P1 (audit P0-1): the form POSTs to /api/crm-lead (CRM + email
// notification), so the visitor is told before submitting and pointed
// at the privacy policy that describes it.
describe("ConsultationForm consent notice", () => {
  test("states the data use and links to /privacidad, after the submit button", () => {
    const notice = html.match(/<p class="form-disclaimer form-consent">[\s\S]*?<\/p>/);
    expect(notice).not.toBeNull();
    expect(notice![0]).toContain(
      "Al enviar, aceptas que COMINORSA use estos datos para responder tu consulta.",
    );
    expect(notice![0]).toContain('<a href="/privacidad">Ver Política de Privacidad</a>');
    expect(html.indexOf("form-consent")).toBeGreaterThan(html.indexOf("consultation-form-submit"));
  });

  test("P4: renders a honeypot `website` field hidden from assistive tech and the tab order", () => {
    const match = html.match(/<input[^>]*name="website"[^>]*>/);
    expect(match).not.toBeNull();
    const input = match![0];
    expect(input).toContain('type="text"');
    expect(input).toContain('tabindex="-1"');
    expect(input).toContain('autocomplete="off"');
    expect(input).toContain('aria-hidden="true"');
    expect(input).not.toContain("required");
    // Its wrapper is hidden from AT too, so its label text is never announced.
    expect(html).toMatch(/<div class="form-honeypot" aria-hidden="true">[\s\S]*name="website"/);
  });
});
