// src/client/lib/crm-lead-payload.ts
//
// Pure payload-shaping for the fire-and-forget `POST /api/crm-lead` call
// (T7), ported from `app/ConsultationForm.tsx`'s `handleSubmit`. Kept
// separate from `whatsapp-message.ts` even though both read the same
// form fields: message-building and payload-building are two different
// concerns with two different consumers (WhatsApp vs. the CRM route).

export type CrmLeadFields = {
  name: string;
  city: string;
  service: string;
  question: string;
};

export type CrmLeadPayload = CrmLeadFields & { whatsappLine: string };

export function buildCrmLeadPayload(
  fields: CrmLeadFields,
  whatsappLine: string,
): CrmLeadPayload {
  return {
    name: fields.name,
    city: fields.city,
    service: fields.service,
    question: fields.question,
    whatsappLine,
  };
}
