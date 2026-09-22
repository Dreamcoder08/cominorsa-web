// src/build/routes.ts
//
// T6a: one explicit route table drives the static build. `build.ts`
// loops over `PAGE_ROUTES` to emit `<slug>.html` for each; T8's
// sitemap generator is meant to reuse this exact list instead of
// hand-listing routes a second time. The 6 service pages plus
// preguntas-frecuentes/privacidad/terminos land here; the 404 page is
// added by this task's next commit (it needs document.tsx's optional
// canonicalPath/robots support, since it has no single canonical URL
// and must be noindex).

import type { Child } from "../html/jsx-runtime";
import { FaqPage } from "./faq-page";
import { PrivacyPage } from "./privacy-page";
import { ServicePage } from "./service-page";
import { faqs, serviceGroups } from "./site-data";
import { TermsPage } from "./terms-page";

export type PageRoute = {
  /** URL slug, no leading/trailing slash. */
  slug: string;
  /** Page-specific portion of `<title>`; callers append " | COMINORSA" uniformly. */
  title: string;
  description: string;
  /** Absolute path with no trailing slash, e.g. "/privacidad". */
  canonicalPath: string;
  render: () => Child;
};

export const PAGE_ROUTES: PageRoute[] = [
  ...serviceGroups.map(
    (service): PageRoute => ({
      slug: service.slug,
      title: service.pageTitle,
      description: service.pageDescription,
      canonicalPath: `/${service.slug}`,
      render: () => ServicePage({ service }),
    }),
  ),
  {
    slug: "preguntas-frecuentes",
    title: "Preguntas frecuentes sobre minería",
    description:
      "Respuestas generales sobre IGAFOM, REINFO, DIA, PAMA, DAC, ESTAMIN, planes de minado y consultoría minera en Piura.",
    canonicalPath: "/preguntas-frecuentes",
    render: () => FaqPage({ faqs }),
  },
  {
    slug: "privacidad",
    title: "Política de Privacidad",
    description:
      "Cómo COMINORSA S.A.C. trata los datos personales que nos compartes, conforme a la Ley N.º 29733 de Protección de Datos Personales del Perú.",
    canonicalPath: "/privacidad",
    render: () => PrivacyPage(),
  },
  {
    slug: "terminos",
    title: "Términos y Condiciones",
    description:
      "Condiciones de uso del sitio web de COMINORSA S.A.C. y del contenido publicado en él.",
    canonicalPath: "/terminos",
    render: () => TermsPage(),
  },
];
