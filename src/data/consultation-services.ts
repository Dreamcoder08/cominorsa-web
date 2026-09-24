// src/data/consultation-services.ts
//
// Service-of-interest options for the homepage consultation form
// (T6b). Single source of truth for both the Next client component
// (`app/ConsultationForm.tsx`) and the static build's server-rendered
// form (`src/build/consultation-form.tsx`) — same principle as
// `src/data/services-data.ts` and `src/data/faq.ts` (T6a): one array,
// not a second hand-copied list to drift out of sync.

export const consultationServiceOptions: readonly string[] = [
  "Formalización minera e IGAFOM",
  "REINFO",
  "DIA, PAMA e instrumentos ambientales",
  "DAC y ESTAMIN",
  "Informes y expedientes técnicos",
  "Planes de minado, mapas y planos",
  "Seguridad y salud ocupacional",
  "Trámites ante MINEM, INGEMMET o DREM",
  "Otra consulta minera o ambiental",
];
