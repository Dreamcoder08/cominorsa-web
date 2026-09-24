// src/build/consultation-form.tsx
//
// Static server markup for the homepage consultation form, ported from
// `app/ConsultationForm.tsx` (T6b). This is the no-JS baseline: same
// fields, `name`s, `required`, and aria attributes as the real
// component's own SSR output before hydration — no `onSubmit`, no
// inline `<script>` (the static build's CSP will be `script-src
// 'self'`, T10). Building the `wa.me` URL, the fire-and-forget POST to
// `/api/crm-lead`, and analytics events are all client-side behavior —
// T7's job, tracked in odd/tasks/bun-vanilla-migration.md.
//
// T7 hooks (documented here so the enhancement script has a stable
// contract instead of guessing selectors):
//   - `#consultation-form`         — the <form> element to bind to.
//   - `#consultation-form-submit`  — the submit <button>. P7 (audit
//     P2-6): renders enabled (it used to start `disabled` until the
//     script ran, so without JS the form was dead). The form is
//     `method="post"` with no action: a submit that lands before the
//     script attaches (or with JS off) never puts the visitor's data in
//     a URL, browser history or access log — the static host answers
//     405 and nothing is stored. With JS off, the <noscript> line
//     offers the direct WhatsApp link instead.
//   - `#consultation-form-status`  — the `aria-live="polite"` status
//     paragraph; starts empty, T7 fills it after building the wa.me
//     link, plus a fallback link to that URL (P7: a popup blocker can
//     stop `window.open` and the page can't tell).
// Field `name`s (`name`, `city`, `service`, `whatsapp`, `question`)
// match `app/ConsultationForm.tsx`'s `FormData` keys exactly, so T7 can
// reuse the same `new FormData(form)` reading code verbatim.
//
// P4 (audit P1-7): `website` is a honeypot. Its wrapper is visually
// hidden (`.form-honeypot`) and `aria-hidden`, and the input is out of
// the tab order (`tabindex="-1"`) with autofill off, so people and
// assistive tech never reach it; naive bots that fill every field do.
// `/api/crm-lead` silently drops any submission where it is non-empty.
// It is not read by the WhatsApp message builder.

import {
  PRIMARY_WHATSAPP_NUMBER,
  SECONDARY_WHATSAPP_NUMBER,
  WHATSAPP_INFORMATION,
} from "../../app/constants";
import { consultationServiceOptions } from "../data/consultation-services";

export function ConsultationForm() {
  return (
    <form className="consultation-form" id="consultation-form" method="post">
      <div className="form-row">
        <label>
          <span>Nombre completo</span>
          <input
            type="text"
            name="name"
            autocomplete="name"
            maxlength={120}
            placeholder="Escribe tu nombre…"
            required
          />
        </label>
        <label>
          <span>Ciudad o región</span>
          <input
            type="text"
            name="city"
            autocomplete="address-level1"
            maxlength={120}
            placeholder="Ej. Piura…"
            required
          />
        </label>
      </div>

      <label>
        <span>Servicio de interés</span>
        <select name="service" required>
          <option value="" disabled selected>
            Selecciona un servicio
          </option>
          {consultationServiceOptions.map((service) => (
            <option value={service}>{service}</option>
          ))}
        </select>
      </label>

      <label>
        <span>Línea de WhatsApp</span>
        <select name="whatsapp" required>
          <option value={PRIMARY_WHATSAPP_NUMBER} selected>
            910 728 575
          </option>
          <option value={SECONDARY_WHATSAPP_NUMBER}>987 817 100</option>
        </select>
      </label>

      <label>
        <span>Escribe tu consulta</span>
        <textarea
          name="question"
          rows={5}
          minlength={10}
          maxlength={2000}
          placeholder="Cuéntanos brevemente qué necesitas resolver…"
          required
        />
      </label>

      <div className="form-honeypot" aria-hidden="true">
        <label>
          <span>Sitio web</span>
          <input
            type="text"
            name="website"
            tabindex={-1}
            autocomplete="off"
            aria-hidden="true"
          />
        </label>
      </div>

      <div className="form-submit">
        <div>
          <strong>Consulta profesional</strong>
          <span>Te respondemos por WhatsApp</span>
        </div>
        <button type="submit" id="consultation-form-submit">
          Enviar por WhatsApp
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      <noscript>
        <p className="form-noscript">
          Este formulario necesita JavaScript para preparar tu mensaje.{" "}
          <a href={WHATSAPP_INFORMATION} target="_blank" rel="noreferrer">
            Escríbenos directamente por WhatsApp
          </a>
          .
        </p>
      </noscript>

      <p className="form-disclaimer form-consent">
        Al enviar, aceptas que COMINORSA use estos datos para responder tu
        consulta. <a href="/privacidad">Ver Política de Privacidad</a>.
      </p>
      <p className="form-disclaimer">
        Al continuar se abrirá WhatsApp. El pago y el horario de atención se
        coordinan directamente con COMINORSA.
      </p>
      <p className="form-status" id="consultation-form-status" aria-live="polite" />
    </form>
  );
}
