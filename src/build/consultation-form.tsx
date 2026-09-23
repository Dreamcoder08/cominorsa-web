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
//   - `#consultation-form-submit`  — the submit <button>; starts
//     `disabled`, matching the real component's pre-hydration
//     `disabled={!mounted}` state exactly. T7 removes `disabled` once
//     it has attached its submit handler, the same moment React's own
//     hydration does today.
//   - `#consultation-form-status`  — the `aria-live="polite"` status
//     paragraph; starts empty, T7 fills it with the "WhatsApp opened"
//     message after building the wa.me link.
// Field `name`s (`name`, `city`, `service`, `whatsapp`, `question`)
// match `app/ConsultationForm.tsx`'s `FormData` keys exactly, so T7 can
// reuse the same `new FormData(form)` reading code verbatim.

import {
  PRIMARY_WHATSAPP_NUMBER,
  SECONDARY_WHATSAPP_NUMBER,
} from "../../app/constants";
import { consultationServiceOptions } from "../data/consultation-services";

export function ConsultationForm() {
  return (
    <form className="consultation-form" id="consultation-form">
      <div className="form-row">
        <label>
          <span>Nombre completo</span>
          <input
            type="text"
            name="name"
            autocomplete="name"
            maxlength={120}
            placeholder="Escribe tu nombre"
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
            placeholder="Ej. Piura"
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
          placeholder="Cuéntanos brevemente qué necesitas resolver"
          required
        />
      </label>

      <div className="form-submit">
        <div>
          <strong>Consulta profesional</strong>
          <span>Te respondemos por WhatsApp</span>
        </div>
        <button type="submit" id="consultation-form-submit" disabled>
          Enviar por WhatsApp
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      <p className="form-disclaimer">
        Al continuar se abrirá WhatsApp. El pago y el horario de atención se
        coordinan directamente con COMINORSA.
      </p>
      <p className="form-status" id="consultation-form-status" aria-live="polite" />
    </form>
  );
}
