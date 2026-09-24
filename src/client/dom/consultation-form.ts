// src/client/dom/consultation-form.ts
//
// Progressive enhancement for the consultation form rendered by
// `src/build/consultation-form.tsx` (T6b): binds the hooks documented in
// that module's header (`#consultation-form`, `#consultation-form-submit`,
// `#consultation-form-status`), ported from `app/ConsultationForm.tsx`'s
// `handleSubmit`. WhatsApp-URL building and CRM-lead payload shaping are
// delegated to `../lib/whatsapp-message.ts` / `../lib/crm-lead-payload.ts`
// (unit-tested with `bun test`); this file only reads the form, opens
// WhatsApp, and fires the non-blocking CRM POST — covered by Playwright
// e2e against the built static site, not a DOM-free unit test.
//
// The submit button starts `disabled` in the static markup, matching the
// real component's own pre-hydration `disabled={!mounted}` state
// (`handleSubmit` is a React prop, not an HTML attribute, so a click
// landing before hydration would otherwise fall through to a native GET
// with the fields in the URL). Enabling it here, at the moment this
// module actually attaches the submit listener, closes that same race
// for the vanilla build.

import { CONTACT_SUBMIT_EVENT } from "../../../app/constants";
import { buildCrmLeadPayload } from "../lib/crm-lead-payload";
import {
  buildConsultationMessage,
  buildWhatsAppUrl,
  selectWhatsAppRecipient,
} from "../lib/whatsapp-message";

const WHATSAPP_OPENED_STATUS =
  "Se abrió WhatsApp con tu mensaje preparado. Revísalo y envíalo para completar tu consulta.";

export function initConsultationForm(doc: Document = document): void {
  const form = doc.getElementById("consultation-form") as HTMLFormElement | null;
  const submitButton = doc.getElementById(
    "consultation-form-submit",
  ) as HTMLButtonElement | null;
  const status = doc.getElementById("consultation-form-status");
  if (!form || !submitButton || !status) return;

  submitButton.disabled = false;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const city = String(data.get("city") ?? "").trim();
    const service = String(data.get("service") ?? "").trim();
    const question = String(data.get("question") ?? "").trim();
    const selectedWhatsApp = String(data.get("whatsapp") ?? "");
    const recipient = selectWhatsAppRecipient(selectedWhatsApp);

    const message = buildConsultationMessage({ name, city, service, question });
    const url = buildWhatsAppUrl(recipient, message);

    // Inert markers only (openspec analytics-event-attributes): no script
    // reads or dispatches these, same as the React version's dataset
    // assignment in ConsultationForm.tsx.
    form.dataset.event = CONTACT_SUBMIT_EVENT;
    form.dataset.eventContext = service;

    window.open(url, "_blank", "noopener,noreferrer");
    status.textContent = WHATSAPP_OPENED_STATUS;

    const payload = buildCrmLeadPayload({ name, city, service, question }, recipient);
    fetch("/api/crm-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  });
}
