const WHATSAPP_NUMBER = "51910728575";

export function buildWhatsAppLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP_INFORMATION = buildWhatsAppLink(
  "Hola COMINORSA, deseo información sobre sus servicios.",
);
