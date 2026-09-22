// src/build/routes.ts
//
// T6a: one explicit route table drives the static build. `build.ts`
// loops over `PAGE_ROUTES` to emit `<slug>.html` for each; T8's
// sitemap generator is meant to reuse this exact list instead of
// hand-listing routes a second time. Starts with the 6 service pages
// (the same generic `ServicePage` component T3 built for
// `seguridad-minera`); preguntas-frecuentes/privacidad/terminos and
// the 404 page are added to this table in the same task's later
// commits.

import type { Child } from "../html/jsx-runtime";
import { ServicePage } from "./service-page";
import { serviceGroups } from "./site-data";

export type PageRoute = {
  /** URL slug, no leading/trailing slash. */
  slug: string;
  /** Page-specific portion of `<title>`; callers append " | COMINORSA" uniformly. */
  title: string;
  description: string;
  /** Absolute path with no trailing slash, e.g. "/seguridad-minera". */
  canonicalPath: string;
  render: () => Child;
};

export const PAGE_ROUTES: PageRoute[] = serviceGroups.map(
  (service): PageRoute => ({
    slug: service.slug,
    title: service.pageTitle,
    description: service.pageDescription,
    canonicalPath: `/${service.slug}`,
    render: () => ServicePage({ service }),
  }),
);
