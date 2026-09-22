// src/build/routes.ts
//
// T6a: one explicit route table drives the static build for every page
// except the homepage (T6b, tracked separately in
// odd/tasks/bun-vanilla-migration.md). `build.ts` loops over
// `PAGE_ROUTES` to emit `<slug>.html` for each; T8's sitemap generator
// is meant to reuse this exact list instead of hand-listing routes a
// second time.

import type { Child } from "../html/jsx-runtime";
import { FaqPage } from "./faq-page";
import { NotFoundPage } from "./not-found-page";
import { PrivacyPage } from "./privacy-page";
import { ServicePage } from "./service-page";
import { faqs, serviceGroups } from "./site-data";
import { TermsPage } from "./terms-page";

// Root layout's description (`app/layout.tsx`'s `generateMetadata`) —
// the 404 page has no page-specific `description` override today
// (verified against the live 404 response: its `<meta
// name="description">` is this exact root string, not a custom one).
const ROOT_DESCRIPTION =
  "Formalización minera, instrumentos ambientales, ingeniería y asistencia técnica desde Piura, Perú.";

export type PageRoute = {
  /** URL slug, no leading/trailing slash. "404" emits `404.html` (see build.ts). */
  slug: string;
  /** Page-specific portion of `<title>`; callers append " | COMINORSA" uniformly. */
  title: string;
  description: string;
  /** Absolute path with no trailing slash, e.g. "/privacidad". Omit for the 404 page (no single canonical URL). */
  canonicalPath?: string;
  /** e.g. "noindex, follow" — only the 404 route sets this today. */
  robots?: string;
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
  {
    slug: "404",
    title: "Página no encontrada",
    description: ROOT_DESCRIPTION,
    robots: "noindex, follow",
    render: () => NotFoundPage(),
  },
];
