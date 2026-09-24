// src/build/routes.ts
//
// One explicit route table drives the static build for every page,
// including the homepage (T6b). `build.ts` loops over `PAGE_ROUTES` to
// emit `<slug>.html` for each (the homepage's `slug: ""` maps to
// `index.html`); T8's sitemap generator is meant to reuse this exact
// list instead of hand-listing routes a second time.

import type { Child } from "../html/jsx-runtime";
import { FaqPage } from "./faq-page";
import { HomePage } from "./home-page";
import { NotFoundPage } from "./not-found-page";
import { PrivacyPage } from "./privacy-page";
import { ServicePage } from "./service-page";
import { faqs, serviceGroups } from "./site-data";
import { breadcrumbJsonLd, serviceBreadcrumbTrail, serviceJsonLd } from "./structured-data";
import { TermsPage } from "./terms-page";

// Root layout's description (`app/layout.tsx`'s `generateMetadata`) —
// the 404 page has no page-specific `description` override today
// (verified against the live 404 response: its `<meta
// name="description">` is this exact root string, not a custom one).
const ROOT_DESCRIPTION =
  "Formalización minera, instrumentos ambientales, ingeniería y asistencia técnica desde Piura, Perú.";

/** Build-wide facts every page render may depend on (P1). */
export type RenderContext = {
  /** True when the build bakes in a GA measurement ID (see build.ts). */
  analyticsEnabled: boolean;
};

const NO_ANALYTICS: RenderContext = { analyticsEnabled: false };

export type PageRoute = {
  /** URL slug, no leading/trailing slash. "" emits `index.html` (the homepage); "404" emits `404.html` (see build.ts). */
  slug: string;
  /** Page-specific portion of `<title>`; callers append " | COMINORSA" uniformly. Ignored when `fullTitle` is set. */
  title: string;
  description: string;
  /**
   * Overrides `title` with a verbatim `<title>` value, skipping the
   * " | COMINORSA" suffix every other route gets. Only the homepage
   * needs this: production's real title is brand-first
   * ("COMINORSA | Consultoría minera y ambiental"), from the root
   * layout's own `generateMetadata` — not the "<page> | COMINORSA"
   * pattern `generateServiceMetadata` uses for every other page.
   */
  fullTitle?: string;
  /** Absolute path with no trailing slash, e.g. "/privacidad", or "/" for the homepage (P2). Omit only for the 404 page, which has no canonical URL. */
  canonicalPath?: string;
  /** e.g. "noindex, follow" — only the 404 route sets this today. */
  robots?: string;
  render: (ctx?: RenderContext) => Child;
  /** Page-specific JSON-LD objects (P5), emitted after the site-wide organization. */
  jsonLd?: readonly unknown[];
};

export const PAGE_ROUTES: PageRoute[] = [
  {
    slug: "",
    title: "Inicio",
    fullTitle: "COMINORSA | Consultoría minera y ambiental",
    description: ROOT_DESCRIPTION,
    canonicalPath: "/",
    render: (ctx = NO_ANALYTICS) => HomePage({ serviceGroups, ...ctx }),
  },
  ...serviceGroups.map(
    (service): PageRoute => ({
      slug: service.slug,
      title: service.pageTitle,
      description: service.pageDescription,
      canonicalPath: `/${service.slug}`,
      render: (ctx = NO_ANALYTICS) => ServicePage({ service, ...ctx }),
      jsonLd: [serviceJsonLd(service), breadcrumbJsonLd(serviceBreadcrumbTrail(service))],
    }),
  ),
  {
    slug: "preguntas-frecuentes",
    title: "Preguntas frecuentes sobre minería",
    description:
      "Respuestas generales sobre IGAFOM, REINFO, DIA, PAMA, DAC, ESTAMIN, planes de minado y consultoría minera en Piura.",
    canonicalPath: "/preguntas-frecuentes",
    render: (ctx = NO_ANALYTICS) => FaqPage({ faqs, ...ctx }),
  },
  {
    slug: "privacidad",
    title: "Política de Privacidad",
    description:
      "Cómo COMINORSA S.A.C. trata los datos personales que nos compartes, conforme a la Ley N.º 29733 de Protección de Datos Personales del Perú.",
    canonicalPath: "/privacidad",
    render: (ctx = NO_ANALYTICS) => PrivacyPage(ctx),
  },
  {
    slug: "terminos",
    title: "Términos y Condiciones",
    description:
      "Condiciones de uso del sitio web de COMINORSA S.A.C. y del contenido publicado en él.",
    canonicalPath: "/terminos",
    render: (ctx = NO_ANALYTICS) => TermsPage(ctx),
  },
  {
    slug: "404",
    title: "Página no encontrada",
    description: ROOT_DESCRIPTION,
    robots: "noindex, follow",
    render: (ctx = NO_ANALYTICS) => NotFoundPage(ctx),
  },
];
