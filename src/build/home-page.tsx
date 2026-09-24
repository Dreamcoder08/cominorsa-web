// src/build/home-page.tsx
//
// Ported from `app/page.tsx` (T6b), verbatim markup and copy. Takes
// `serviceGroups` as a parameter (same convention as `FaqPage`/
// `ServicePage`) so `routes.ts` is the single place that wires data to
// pages. The consultation form's client behavior (building the wa.me
// URL, the fire-and-forget POST to /api/crm-lead, analytics events) is
// T7 — see `src/build/consultation-form.tsx`'s header for the exact
// hooks left for that script.

import {
  PRIMARY_WHATSAPP_DISPLAY,
  PRIMARY_WHATSAPP_NUMBER,
  SECONDARY_WHATSAPP_DISPLAY,
  SECONDARY_WHATSAPP_NUMBER,
  telLink,
  WHATSAPP_INFORMATION,
} from "../../app/constants";
import type { ServiceGroup } from "../data/services-data";
import { ConsultationForm } from "./consultation-form";
import { SiteLayout } from "./site-shell";
import { Strata } from "./strata";

// Formalization route (landing-craft T3). Sourced from MINEM's
// "Proceso de Formalización Minera" (gob.pe/101185) — see
// `odd/research/formalization-route.md`. The order is a presentation
// choice; the official page lists the requirements unordered.
// REVIEW: client — COMINORSA must validate this copy before production.
const steps = [
  {
    number: "01",
    title: "Revisamos tu situación en el REINFO",
    text: "Verificamos tu inscripción y lo que te falta para avanzar en la formalización.",
  },
  {
    number: "02",
    title: "Acreditamos la concesión",
    text: "Reunimos la titularidad o el contrato que te permite trabajar la concesión minera.",
  },
  {
    number: "03",
    title: "Aseguramos el terreno superficial",
    text: "Gestionamos la autorización de uso del terreno donde operas.",
  },
  {
    number: "04",
    title: "Preparamos el IGAFOM",
    text: "Elaboramos tu instrumento de gestión ambiental y lo acompañamos hasta su aprobación.",
  },
  {
    number: "05",
    title: "Armamos el expediente técnico",
    text: "Integramos el expediente y la declaración jurada de inexistencia de restos arqueológicos.",
  },
  {
    number: "06",
    title: "Solicitamos el inicio de actividades",
    text: "Presentamos tu solicitud de inicio o reinicio por la Ventanilla Única del MINEM.",
  },
];

const FORMALIZATION_SOURCE_URL =
  "https://www.gob.pe/101185-proceso-de-formalizacion-minera";

export function HomePage({
  serviceGroups,
  analyticsEnabled = false,
}: {
  serviceGroups: readonly ServiceGroup[];
  analyticsEnabled?: boolean;
}) {
  return (
    <SiteLayout analyticsEnabled={analyticsEnabled}>
      <section className="hero" id="inicio">
        <div className="hero-contours" aria-hidden="true" />
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span />
              Piura · Norte del Perú
            </p>
            <h1>
              <span className="reveal-line">Técnica que impulsa.</span>{" "}
              <em className="reveal-line">Responsabilidad que permanece.</em>
            </h1>
            <p className="hero-intro">
              Formalización minera, instrumentos ambientales, ingeniería y
              asistencia técnica para una minería segura, responsable y
              sostenible.
            </p>
            <div className="hero-actions">
              <a
                className="button button-primary"
                href={WHATSAPP_INFORMATION}
                target="_blank"
                rel="noreferrer"
              >
                Hablar por WhatsApp
                <span aria-hidden="true">↗</span>
              </a>
              <a className="button button-quiet" href="#servicios">
                Ver servicios
              </a>
            </div>
          </div>

          {/* landing-craft T1: the card routes to a service instead of
              repeating the phones (they live once, in #contacto). It also
              replaces the old "Especialidades" strip. */}
          <aside className="hero-card" aria-label="Servicios de COMINORSA">
            <div className="hero-card-top">
              <span>Por dónde empezar</span>
            </div>
            <div className="hero-card-copy">
              <h2>¿Qué necesitas?</h2>
              <ul className="hero-card-routes">
                {serviceGroups.map((service) => (
                  <li>
                    <a href={`/${service.slug}`}>
                      <span aria-hidden="true">{service.number}</span>
                      {service.pageTitle}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <Strata to="paper" />

      <section className="section about" id="nosotros">
        <div className="section-kicker">
          <span>01</span>
          <p>Quiénes somos</p>
        </div>

        <div className="about-grid">
          <div>
            <h2 className="section-title">
              Soluciones integrales para una minería formal, segura y
              sostenible.
            </h2>
          </div>
          <div className="about-copy">
            <p className="lead">
              COMINORSA S.A.C. brinda consultoría minera y soluciones
              ambientales desde Piura.
            </p>
            <p>
              Acompañamos a nuestros clientes en la formalización, elaboración
              de instrumentos, planeamiento técnico y trámites, con atención
              cercana y responsabilidad profesional.
            </p>
            <div className="principles">
              <div>
                <span aria-hidden="true">01</span>
                <strong>Seguridad</strong>
                <p>Orientación técnica para operar con mayor prevención.</p>
              </div>
              <div>
                <span aria-hidden="true">02</span>
                <strong>Compromiso ambiental</strong>
                <p>Soluciones que consideran el entorno desde el inicio.</p>
              </div>
              <div>
                <span aria-hidden="true">03</span>
                <strong>Confianza</strong>
                <p>Acompañamiento directo y comunicación transparente.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Strata to="ink" />

      <section className="section services" id="servicios">
        <div className="section-heading">
          <div className="section-kicker light">
            <span>02</span>
            <p>Nuestros servicios</p>
          </div>
          <h2 className="section-title light-title">
            Gestión minera y ambiental, de principio a fin.
          </h2>
          <p>
            Servicios especializados para formalización, cumplimiento,
            planeamiento y operación minera.
          </p>
        </div>

        <div className="detailed-services-grid">
          {serviceGroups.map((service) => (
            <a className="detailed-service-card" href={`/${service.slug}`}>
              <div className="detailed-service-head">
                <span>{service.number}</span>
                <i aria-hidden="true">↗</i>
              </div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <ul>
                {service.items.map((item) => (
                  <li>{item}</li>
                ))}
              </ul>
            </a>
          ))}
        </div>
      </section>

      <Strata to="cream" />

      <section className="section method" id="metodo">
        <div className="method-intro">
          <div className="section-kicker">
            <span>03</span>
            <p>Ruta de formalización</p>
          </div>
          <h2 className="section-title">Tu ruta hacia la formalización.</h2>
          <p>
            Te acompañamos en cada requisito del proceso de formalización
            minera, desde el REINFO hasta el inicio de actividades.
          </p>
        </div>

        <ol className="steps route" aria-label="Ruta de formalización minera">
          {steps.map((step) => (
            <li className="step">
              <span>{step.number}</span>
              <div className="step-node" aria-hidden="true" />
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>

        <p className="method-source">
          Requisitos según el{" "}
          <a href={FORMALIZATION_SOURCE_URL} rel="noopener">
            proceso de formalización minera del MINEM
          </a>
          .
        </p>
      </section>

      <Strata to="deep" />

      <section className="section consultation" id="consulta">
        <div className="consultation-intro">
          <div className="section-kicker consultation-kicker">
            <span>04</span>
            <p>Consulta profesional</p>
          </div>
          <h2>
            Ingresa tu consulta.{" "}
            <em>Recibe atención por WhatsApp.</em>
          </h2>
          <p>
            Describe tu caso y selecciona el servicio relacionado. El mensaje
            llegará directamente a COMINORSA para coordinar la atención.
          </p>
        </div>

        <ConsultationForm />
      </section>

      <Strata to="sand" />

      <section className="contact" id="contacto">
        <div className="contact-top">
          <p className="eyebrow contact-eyebrow">
            <span />
            Coordinemos
          </p>
          <h2>
            Hablemos de tu proyecto{" "}
            <em>por WhatsApp.</em>
          </h2>
        </div>

        <div className="contact-grid">
          <div className="contact-note">
            <div className="section-kicker">
              <span>05</span>
              <p>Contacto</p>
            </div>
            <div className="contact-note-body">
              <p>
                Escríbenos para solicitar información, coordinar una consulta
                o conversar sobre el servicio que necesitas.
              </p>
              <a
                className="phone-link"
                href={telLink(PRIMARY_WHATSAPP_NUMBER)}
                aria-label={`Llamar al ${PRIMARY_WHATSAPP_DISPLAY}`}
              >
                {PRIMARY_WHATSAPP_DISPLAY}
              </a>
              <a
                className="phone-link"
                href={telLink(SECONDARY_WHATSAPP_NUMBER)}
                aria-label={`Llamar al ${SECONDARY_WHATSAPP_DISPLAY}`}
              >
                {SECONDARY_WHATSAPP_DISPLAY}
              </a>
              <a
                className="whatsapp-link"
                href={WHATSAPP_INFORMATION}
                target="_blank"
                rel="noreferrer"
              >
                Escríbenos por WhatsApp
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <address>
            <span>Sede registrada</span>
            <strong>
              Calle B N.º&nbsp;12, Urb. Santa Margarita
              <br />
              Veintiséis de Octubre, Piura · Perú
            </strong>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Calle+B+12+Urbanizacion+Santa+Margarita+Veintiseis+de+Octubre+Piura+Peru"
              target="_blank"
              rel="noreferrer"
            >
              Ver ubicación
              <span aria-hidden="true">↗</span>
            </a>
          </address>
        </div>
      </section>
    </SiteLayout>
  );
}
