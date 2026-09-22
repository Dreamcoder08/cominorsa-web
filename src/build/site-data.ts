// src/build/site-data.ts
//
// Ported from `app/services-data.ts`, for the single route T3 builds
// end-to-end (`seguridad-minera`). Only the *type* is imported from the
// original: importing its `serviceGroups` *value* would also pull in
// `getBaseUrl` -> `next/headers` at module-eval time (services-data.ts
// imports it for `generateServiceMetadata`), coupling this Next-free
// build to the Next runtime it's meant to replace. `import type` is
// erased at compile time, so it carries no such cost.
//
// T6 ports the remaining five entries alongside the rest of the pages.

import type { ServiceGroup } from "../../app/services-data";

export const seguridadMinera: ServiceGroup = {
  number: "05",
  slug: "seguridad-minera",
  title: "¿Necesitas fortalecer tu seguridad operativa?",
  description:
    "Asistencia para fortalecer la gestión preventiva y el desempeño técnico de la operación.",
  items: [
    "Planes de Seguridad y Salud Ocupacional",
    "Supervisión y Asistencia Técnica Minera",
    "Consultoría mensual para operaciones mineras",
  ],
  pageTitle: "Seguridad minera y consultoría mensual",
  pageDescription:
    "Planes de Seguridad y Salud Ocupacional, supervisión y asistencia técnica minera, y consultoría mensual para fortalecer la gestión preventiva de tu operación.",
  intro:
    "Si necesitas fortalecer tu seguridad operativa, te asistimos en la gestión preventiva y el desempeño técnico: planes de Seguridad y Salud Ocupacional, supervisión y asistencia técnica minera, y consultoría mensual para operaciones mineras.",
  whatsappMessage:
    "Hola COMINORSA, quiero información sobre seguridad minera y consultoría mensual.",
};
