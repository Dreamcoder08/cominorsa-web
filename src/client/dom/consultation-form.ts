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
// P7: the submit button renders enabled (no JS → still clickable, and
// the form's `method="post"` keeps a pre-script submit's data out of
// URLs); this module only intercepts the submit. `window.open` with
// `noopener` always returns null, so a blocked popup is undetectable —
// the status always carries a link to the same prepared URL.

import { CONTACT_SUBMIT_EVENT } from "../../../app/constants";
import { buildCrmLeadPayload } from "../lib/crm-lead-payload";
import {
  buildConsultationMessage,
  buildWhatsAppUrl,
  selectWhatsAppRecipient,
} from "../lib/whatsapp-message";

const WHATSAPP_OPENED_STATUS =
  "Preparamos tu mensaje en WhatsApp. Revísalo y envíalo para completar tu consulta. ";
const WHATSAPP_FALLBACK_LABEL = "Si WhatsApp no se abrió, toca aquí";

function renderStatus(status: HTMLElement, url: string): void {
  const link = status.ownerDocument.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = WHATSAPP_FALLBACK_LABEL;
  status.replaceChildren(WHATSAPP_OPENED_STATUS, link);
}

export function initConsultationForm(doc: Document = document): void {
  const form = doc.getElementById("consultation-form") as HTMLFormElement | null;
  const status = doc.getElementById("consultation-form-status");
  if (!form || !status) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const city = String(data.get("city") ?? "").trim();
    const service = String(data.get("service") ?? "").trim();
    const question = String(data.get("question") ?? "").trim();
    const website = String(data.get("website") ?? "");
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
    renderStatus(status, url);

    const payload = buildCrmLeadPayload(
      { name, city, service, question, website },
      recipient,
    );
    fetch("/api/crm-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  });

  // Readiness marker for e2e (the button no longer flips from disabled).
  form.dataset.enhanced = "true";
}
