// src/build/site-data.ts
//
// Build-facing re-export of the site's data modules (T6a). The actual
// data now lives in `src/data/` (`services-data.ts`) — a pure,
// framework-free module shared with the Next app (`app/services-data.ts`
// re-exports it too), so there is exactly one copy of the service
// catalog. This file just re-exports it for `src/build/` callers
// (`routes.ts`, tests), plus `seguridadMinera` as a convenience alias
// for the single-service tests written before the route table existed
// (T3's `service-page.test.ts`).

export type { ServiceGroup } from "../data/services-data";
export { serviceGroups } from "../data/services-data";

import { serviceGroups } from "../data/services-data";

export const seguridadMinera = serviceGroups.find(
  (s) => s.slug === "seguridad-minera",
)!;
