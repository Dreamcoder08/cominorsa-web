// src/client/lib/whatsapp-message.ts
//
// Pure WhatsApp-handoff logic for the consultation form, ported verbatim
// from `app/ConsultationForm.tsx`'s `handleSubmit` (T7). No DOM access —
// `src/client/consultation-form.ts` is the only caller, and it owns
// reading the form and opening the resulting URL.

import {
  PRIMARY_WHATSAPP_NUMBER,
  SECONDARY_WHATSAPP_NUMBER,
} from "../../../app/constants";

export type ConsultationMessageFields = {
  name: string;
  city: string;
  service: string;
  question: string;
};

/** Mirrors ConsultationForm.tsx: only the secondary number, selected
 * explicitly, routes there — anything else (including garbage/empty
 * values) falls back to the primary line. */
export function selectWhatsAppRecipient(selectedWhatsApp: string): string {
  return selectedWhatsApp === SECONDARY_WHATSAPP_NUMBER
    ? SECONDARY_WHATSAPP_NUMBER
    : PRIMARY_WHATSAPP_NUMBER;
}

export function buildConsultationMessage(
  fields: ConsultationMessageFields,
): string {
  return [
    "Hola COMINORSA, quiero realizar una consulta profesional.",
    "",
    `Nombre: ${fields.name}`,
    `Ciudad / Región: ${fields.city}`,
    `Servicio: ${fields.service}`,
    `Consulta: ${fields.question}`,
    "",
    "Deseo coordinar el pago y la atención por WhatsApp.",
  ].join("\n");
}

export function buildWhatsAppUrl(recipient: string, message: string): string {
  return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
}
