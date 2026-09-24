// src/build/structured-data.ts
//
// schema.org data for the static build (P5, audit P1-8/P1-10). Every
// value here is already visible on the site: name/RUC/address from the
// footer, both WhatsApp lines from the contact section, "Piura · Norte
// del Perú" from the hero eyebrow and FAQ, service names/descriptions
// from `src/data/services-data.ts`. Deliberately absent because the site
// doesn't show them (client-data gaps, see odd/tasks/landing-polish.md):
// `geo`, opening hours, `email`, `sameAs` social profiles.
//
// Serialized by `document.tsx` through `jsonLdScript` (`</`-escaped).

import { PRIMARY_WHATSAPP_NUMBER, SECONDARY_WHATSAPP_NUMBER } from "../../app/constants";
import type { ServiceGroup } from "../data/services-data";
import { SITE_URL } from "./site-config";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

const AREA_SERVED = [
  { "@type": "AdministrativeArea", name: "Piura, Perú" },
  { "@type": "Place", name: "Norte del Perú" },
];

function contactPoint(number: string) {
  return {
    "@type": "ContactPoint",
    telephone: `+${number}`,
    contactType: "customer service",
    availableLanguage: "es",
  };
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": ORGANIZATION_ID,
  name: "COMINORSA S.A.C.",
  alternateName: "COMINORSA",
  description:
    "Consultoría minera y ambiental: formalización minera (IGAFOM, REINFO), instrumentos ambientales, ingeniería y asistencia técnica desde Piura, Perú.",
  url: SITE_URL,
  // The logo mark (180×180; the header's logo-44.png is only 88×85).
  logo: `${SITE_URL}/apple-touch-icon.png`,
  image: `${SITE_URL}/og.jpg`,
  telephone: `+${PRIMARY_WHATSAPP_NUMBER}`,
  contactPoint: [contactPoint(PRIMARY_WHATSAPP_NUMBER), contactPoint(SECONDARY_WHATSAPP_NUMBER)],
  taxID: "20614147131",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Calle B N.º 12, Urb. Santa Margarita",
    addressLocality: "Veintiséis de Octubre",
    addressRegion: "Piura",
    addressCountry: "PE",
  },
  areaServed: AREA_SERVED,
};

export type BreadcrumbStep = { name: string; path: string };

/** Inicio › Servicios › <servicio> — shared by the visible nav and the JSON-LD. */
export function serviceBreadcrumbTrail(service: ServiceGroup): BreadcrumbStep[] {
  return [
    { name: "Inicio", path: "/" },
    { name: "Servicios", path: "/#servicios" },
    { name: service.pageTitle, path: `/${service.slug}` },
  ];
}

export function breadcrumbJsonLd(trail: BreadcrumbStep[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: `${SITE_URL}${step.path}`,
    })),
  };
}

export function serviceJsonLd(service: ServiceGroup) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.pageTitle,
    description: service.pageDescription,
    url: `${SITE_URL}/${service.slug}`,
    provider: { "@id": ORGANIZATION_ID },
    areaServed: AREA_SERVED,
  };
}
