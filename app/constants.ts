export const PRIMARY_WHATSAPP_NUMBER = "51910728575";
export const SECONDARY_WHATSAPP_NUMBER = "51987817100";

export const PRIMARY_WHATSAPP_DISPLAY = "+51 910 728 575";
export const SECONDARY_WHATSAPP_DISPLAY = "+51 987 817 100";

export function telLink(number: string) {
  return `tel:+${number}`;
}

export function buildWhatsAppLink(
  message: string,
  number: string = PRIMARY_WHATSAPP_NUMBER,
) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP_INFORMATION = buildWhatsAppLink(
  "Hola COMINORSA, deseo información sobre sus servicios.",
);

export const WHATSAPP_CTA_EVENT = "whatsapp_cta_click";

export const CONTACT_SUBMIT_EVENT = "contact_submit_attempt";

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const COOKIE_CONSENT_STORAGE_KEY = "cominorsa-consent";
