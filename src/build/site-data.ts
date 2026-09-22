// src/build/site-data.ts
//
// Build-facing re-export of the site's data modules (T6a). The actual
// data now lives in `src/data/` (`services-data.ts`, `faq.ts`) — pure,
// framework-free modules shared with the Next app (`app/services-data.ts`,
// `app/preguntas-frecuentes/page.tsx` both import from there too, so
// there is exactly one copy of each list). This file just re-exports
// them for `src/build/` callers (`routes.ts`, tests), plus `seguridadMinera`
// as a convenience alias for the single-service tests written before
// the route table existed (T3's `service-page.test.ts`).

export type { ServiceGroup } from "../data/services-data";
export { serviceGroups } from "../data/services-data";
export type { FaqEntry } from "../data/faq";
export { faqs } from "../data/faq";

import { serviceGroups } from "../data/services-data";

export const seguridadMinera = serviceGroups.find(
  (s) => s.slug === "seguridad-minera",
)!;
