import type { Metadata } from "next";
import { headers } from "next/headers";

export type ServiceGroup = {
  number: string;
  slug: string;
  title: string;
  description: string;
  items: string[];
  pageTitle: string;
  pageDescription: string;
  intro: string;
  whatsappMessage: string;
};

export const serviceGroups: ServiceGroup[] = [
  {
    number: "01",
    slug: "igafom-reinfo",
    title: "¿Tu operación aún no está formalizada?",
    description:
      "Acompañamiento para regularizar y mantener en orden las obligaciones de la pequeña minería y minería artesanal.",
    items: [
      "IGAFOM Preventivo — Instrumento de Gestión Ambiental para la Formalización Minera",
      "IGAFOM Correctivo",
      "IGAFOM de Cierre",
      "Asesoría integral en formalización minera (REINFO — Registro Integral de Formalización Minera)",
      "Modificación de coordenadas para REINFO",
      "Declaraciones semestrales REINFO",
    ],
    pageTitle: "IGAFOM y REINFO — Formalización minera",
    pageDescription:
      "Asesoría en IGAFOM Preventivo, Correctivo y de Cierre, y en el proceso REINFO para la formalización de la pequeña minería y minería artesanal en Piura.",
    intro:
      "Si tu operación aún no está formalizada, te acompañamos en el Instrumento de Gestión Ambiental para la Formalización Minera (IGAFOM) según tu etapa, y en el Registro Integral de Formalización Minera (REINFO): modificación de coordenadas y declaraciones semestrales.",
    whatsappMessage:
      "Hola COMINORSA, quiero información sobre IGAFOM y REINFO para formalizar mi operación.",
  },
  {
    number: "02",
    slug: "gestion-ambiental-minera",
    title: "¿Necesitas cumplir con instrumentos de gestión ambiental?",
    description:
      "Instrumentos y estudios que conectan la operación minera con el cumplimiento y el cuidado del entorno, sea que estés iniciando un proyecto o ya tengas una operación en marcha.",
    items: [
      "DIA — Declaración de Impacto Ambiental",
      "PAMA — Programa de Adecuación y Manejo Ambiental",
      "Instrumentos de Gestión Ambiental",
    ],
    pageTitle: "Gestión ambiental minera — DIA y PAMA",
    pageDescription:
      "Elaboración de la Declaración de Impacto Ambiental (DIA), el Programa de Adecuación y Manejo Ambiental (PAMA) e instrumentos de gestión ambiental para operaciones mineras.",
    intro:
      "Preparamos los instrumentos que conectan tu operación con el cumplimiento ambiental: la Declaración de Impacto Ambiental (DIA) para proyectos nuevos de impacto leve, el Programa de Adecuación y Manejo Ambiental (PAMA) para operaciones que ya vienen funcionando, y otros instrumentos de gestión ambiental según tu caso.",
    whatsappMessage:
      "Hola COMINORSA, quiero información sobre DIA, PAMA e instrumentos de gestión ambiental.",
  },
  {
    number: "03",
    slug: "declaraciones-dac-estamin",
    title: "¿Necesitas presentar declaraciones y registros obligatorios?",
    description:
      "Preparación y presentación ordenada de información obligatoria para la actividad minera.",
    items: [
      "Declaración Anual Consolidada (DAC)",
      "Registro y declaraciones en ESTAMIN",
    ],
    pageTitle: "Declaraciones DAC y ESTAMIN",
    pageDescription:
      "Preparación y presentación de la Declaración Anual Consolidada (DAC) y el registro y declaraciones en ESTAMIN para operaciones mineras.",
    intro:
      "Si necesitas presentar declaraciones y registros obligatorios, te apoyamos en la preparación ordenada de la Declaración Anual Consolidada (DAC) y en el registro y las declaraciones en ESTAMIN.",
    whatsappMessage:
      "Hola COMINORSA, quiero información sobre declaraciones DAC y ESTAMIN.",
  },
  {
    number: "04",
    slug: "ingenieria-y-planes-de-minado",
    title: "¿Buscas sustento técnico para tu operación?",
    description:
      "Documentación técnica para planificar, sustentar y ejecutar operaciones con mayor claridad.",
    items: [
      "Informes Técnicos Mineros",
      "Expedientes Técnicos",
      "Planes de Minado",
      "Mapas y Planos Técnicos",
    ],
    pageTitle: "Planes de minado e ingeniería técnica",
    pageDescription:
      "Informes técnicos mineros, expedientes técnicos, planes de minado y mapas y planos técnicos para sustentar y planificar tu operación.",
    intro:
      "Si buscas sustento técnico para tu operación, elaboramos la documentación que planifica, sustenta y acompaña la ejecución: informes técnicos mineros, expedientes técnicos, planes de minado y mapas y planos técnicos.",
    whatsappMessage:
      "Hola COMINORSA, quiero información sobre planes de minado y expedientes técnicos.",
  },
  {
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
  },
  {
    number: "06",
    slug: "tramites-minem-ingemmet-drem",
    title: "¿Necesitas gestionar trámites ante el Estado?",
    description:
      "Orientación y gestión documental ante las principales autoridades del sector minero.",
    items: [
      "Trámites ante MINEM",
      "Trámites ante INGEMMET",
      "Trámites ante DREM",
    ],
    pageTitle: "Trámites ante MINEM, INGEMMET y DREM",
    pageDescription:
      "Orientación y gestión documental ante las principales autoridades del sector minero: MINEM, INGEMMET y DREM.",
    intro:
      "Si necesitas gestionar trámites ante el Estado, te orientamos y acompañamos en la gestión documental ante MINEM, INGEMMET y DREM.",
    whatsappMessage:
      "Hola COMINORSA, quiero información sobre trámites ante MINEM, INGEMMET o DREM.",
  },
];

export async function generateServiceMetadata(
  service: ServiceGroup,
): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("host") ?? "localhost:3000";
  const protocol =
    incomingHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  return {
    title: `${service.pageTitle} | COMINORSA`,
    description: service.pageDescription,
    alternates: { canonical: `${baseUrl}/${service.slug}` },
  };
}
