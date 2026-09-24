// src/data/faq.ts
//
// FAQ content's single source of truth (T6a). Moved here, verbatim,
// from a local const in `app/preguntas-frecuentes/page.tsx`, which now
// imports it from here — same principle as `src/data/services-data.ts`:
// one array, not a second hand-copied list for the static build to
// drift out of sync with.

export type FaqEntry = {
  question: string;
  answer: string;
};

export const faqs: FaqEntry[] = [
  {
    question: "¿Qué es el IGAFOM y para quién es?",
    answer:
      "El IGAFOM (Instrumento de Gestión Ambiental para la Formalización Minera) es el instrumento ambiental para quienes están formalizando su actividad como pequeña minería o minería artesanal. Tiene dos aspectos — Preventivo y Correctivo — y cuál corresponde depende de si tu operación ya viene desarrollando actividad o recién va a iniciarla. Las medidas de cierre y post-cierre se incluyen dentro del aspecto que corresponda, según tu caso.",
  },
  {
    question: "¿Qué es el REINFO?",
    answer:
      "El REINFO (Registro Integral de Formalización Minera) es el registro para quienes están en proceso de formalización minera. A través de él se actualizan datos como las coordenadas de la operación y se presentan las declaraciones semestrales correspondientes.",
  },
  {
    question: "¿Cuál es la diferencia entre la DIA y el PAMA?",
    answer:
      "En términos generales, la DIA (Declaración de Impacto Ambiental) se usa para proyectos nuevos con impactos ambientales leves, mientras que el PAMA (Programa de Adecuación y Manejo Ambiental) es para operaciones que ya están en marcha y necesitan adecuarse a los estándares ambientales vigentes. Cuál corresponde a tu caso depende de las características específicas de tu operación — lo revisamos contigo en la consulta inicial.",
  },
  {
    question: "¿Qué son la DAC y ESTAMIN, y quién debe presentarlas?",
    answer:
      "La DAC (Declaración Anual Consolidada) y el registro y las declaraciones en ESTAMIN son obligaciones de información para la actividad minera. Si tienes dudas sobre si te corresponde presentarlas o en qué plazo, conversemos por WhatsApp para revisar tu caso puntual.",
  },
  {
    question: "¿Qué incluye un Plan de Minado o un Expediente Técnico?",
    answer:
      "Un Plan de Minado y un Expediente Técnico son documentos de sustento técnico para tu operación: describen cómo se ejecuta el trabajo, qué método se usa y qué información técnica lo respalda. El contenido específico varía según el tipo de operación y lo que se requiera en tu caso.",
  },
  {
    question: "¿Qué incluye la consultoría mensual de COMINORSA?",
    answer:
      "Es un acompañamiento continuo, no una gestión puntual: supervisión y asistencia técnica minera de forma periódica, revisando el desempeño técnico y la gestión preventiva de tu operación. El alcance exacto se define según las necesidades de cada operación.",
  },
  {
    question: "¿Necesito estar en Piura para trabajar con COMINORSA?",
    answer:
      "Atendemos principalmente en Piura y el norte del Perú, pero la primera conversación es por WhatsApp — cuéntanos tu ubicación y evaluamos cómo podemos ayudarte.",
  },
  {
    question: "No sé qué servicio necesito, ¿cómo empiezo?",
    answer:
      "Escríbenos por WhatsApp y cuéntanos tu situación. Nuestro proceso siempre parte igual: entendemos el caso, evaluamos requisitos y riesgos, preparamos lo que corresponda y te acompañamos con seguimiento claro en cada avance.",
  },
];
