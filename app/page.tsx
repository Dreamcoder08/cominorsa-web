import { ConsultationForm } from "./ConsultationForm";
import { MobileNav } from "./MobileNav";

const serviceGroups = [
  {
    number: "01",
    title: "Formalización minera",
    description:
      "Acompañamiento para regularizar y mantener en orden las obligaciones de la pequeña minería y minería artesanal.",
    items: [
      "IGAFOM Preventivo",
      "IGAFOM Correctivo",
      "IGAFOM de Cierre",
      "Asesoría integral en formalización minera (REINFO)",
      "Modificación de coordenadas para REINFO",
      "Declaraciones semestrales REINFO",
    ],
  },
  {
    number: "02",
    title: "Gestión ambiental",
    description:
      "Instrumentos y estudios que conectan la operación minera con el cumplimiento y el cuidado del entorno.",
    items: [
      "DIA — Declaración de Impacto Ambiental",
      "PAMA — Programa de Adecuación y Manejo Ambiental",
      "Instrumentos de Gestión Ambiental",
    ],
  },
  {
    number: "03",
    title: "Declaraciones y registros",
    description:
      "Preparación y presentación ordenada de información obligatoria para la actividad minera.",
    items: [
      "Declaración Anual Consolidada (DAC)",
      "Registro y declaraciones en ESTAMIN",
    ],
  },
  {
    number: "04",
    title: "Ingeniería y planeamiento",
    description:
      "Documentación técnica para planificar, sustentar y ejecutar operaciones con mayor claridad.",
    items: [
      "Informes Técnicos Mineros",
      "Expedientes Técnicos",
      "Planes de Minado",
      "Mapas y Planos Técnicos",
    ],
  },
  {
    number: "05",
    title: "Seguridad y operación",
    description:
      "Asistencia para fortalecer la gestión preventiva y el desempeño técnico de la operación.",
    items: [
      "Planes de Seguridad y Salud Ocupacional",
      "Supervisión y Asistencia Técnica Minera",
      "Consultoría mensual para operaciones mineras",
    ],
  },
  {
    number: "06",
    title: "Trámites institucionales",
    description:
      "Orientación y gestión documental ante las principales autoridades del sector minero.",
    items: [
      "Trámites ante MINEM",
      "Trámites ante INGEMMET",
      "Trámites ante DREM",
    ],
  },
];

const steps = [
  {
    number: "01",
    title: "Entendemos el caso",
    text: "Revisamos tu necesidad, ubicación, etapa y documentación disponible.",
  },
  {
    number: "02",
    title: "Evaluamos",
    text: "Identificamos requisitos, riesgos y la ruta técnica más conveniente.",
  },
  {
    number: "03",
    title: "Preparamos",
    text: "Desarrollamos el instrumento, expediente o gestión requerida.",
  },
  {
    number: "04",
    title: "Acompañamos",
    text: "Damos seguimiento y comunicamos cada avance con claridad.",
  },
];

const whatsappInformation =
  "https://wa.me/51910728575?text=Hola%20COMINORSA%2C%20deseo%20informaci%C3%B3n%20sobre%20sus%20servicios.";
const whatsappSecondary =
  "https://wa.me/51987817100?text=Hola%20COMINORSA%2C%20deseo%20informaci%C3%B3n%20sobre%20sus%20servicios.";

export default function Home() {
  return (
    <main>
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="COMINORSA, inicio">
          <span className="brand-mark brand-logo-wrap" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width="44" height="44" />
          </span>
          <span className="brand-copy">
            <strong>COMINORSA</strong>
            <small>Consultoría minera y ambiental</small>
          </span>
        </a>

        <nav className="nav-links" aria-label="Navegación principal">
          <a href="#nosotros">Nosotros</a>
          <a href="#servicios">Servicios</a>
          <a href="#consulta">Consulta</a>
          <a href="#contacto">Contacto</a>
        </nav>

        <a
          className="header-cta"
          href={whatsappInformation}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
          <span aria-hidden="true">↗</span>
        </a>

        <MobileNav />
      </header>

      <section className="hero" id="inicio">
        <div className="hero-contours" aria-hidden="true" />
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span />
              Piura · Norte del Perú
            </p>
            <h1>
              <span className="reveal-line">Técnica que impulsa.</span>
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
                href={whatsappInformation}
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

          <aside className="hero-card" aria-label="Enfoque de COMINORSA">
            <div className="hero-card-top">
              <span>Atención directa</span>
            </div>
            <div className="hero-card-copy">
              <span className="card-index">WhatsApp</span>
              <h2>Atención directa por WhatsApp.</h2>
              <p>
                Resolvemos dudas sobre formalización minera, gestión ambiental
                y asistencia técnica.
              </p>
              <div className="hero-card-numbers">
                <a
                  href="tel:+51910728575"
                  className="inline-phone"
                  aria-label="Llamar al +51 910 728 575"
                >
                  +51 910 728 575
                </a>
                <a
                  href="tel:+51987817100"
                  className="inline-phone"
                  aria-label="Llamar al +51 987 817 100"
                >
                  +51 987 817 100
                </a>
              </div>
            </div>
          </aside>
        </div>

        <div className="hero-footer">
          <span className="hero-footer-label">Especialidades</span>
          <span>IGAFOM</span>
          <span>REINFO</span>
          <span>Gestión ambiental</span>
          <span>Asistencia técnica</span>
        </div>
      </section>

      <div id="contenido">
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
              <article className="detailed-service-card" key={service.number}>
                <div className="detailed-service-head">
                  <span>{service.number}</span>
                  <i aria-hidden="true">↗</i>
                </div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <ul>
                  {service.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section method" id="metodo">
          <div className="method-intro">
            <div className="section-kicker">
              <span>03</span>
              <p>Cómo trabajamos</p>
            </div>
            <h2 className="section-title">Del caso a una ruta clara.</h2>
            <p>
              Cada servicio comienza escuchando tu situación y revisando la
              información necesaria.
            </p>
          </div>

          <div className="steps">
            {steps.map((step) => (
              <article className="step" key={step.number}>
                <span>{step.number}</span>
                <div className="step-node" aria-hidden="true" />
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section consultation" id="consulta">
          <div className="consultation-intro">
            <div className="section-kicker consultation-kicker">
              <span>04</span>
              <p>Consulta profesional</p>
            </div>
            <h2>
              Ingresa tu consulta.
              <em>Recibe atención por WhatsApp.</em>
            </h2>
            <p>
              Describe tu caso y selecciona el servicio relacionado. El mensaje
              llegará directamente a COMINORSA para coordinar la atención.
            </p>
          </div>

          <ConsultationForm />
        </section>

        <section className="section impact">
          <div className="impact-panel">
            <div>
              <p className="eyebrow impact-eyebrow">
                <span />
                Nuestro compromiso
              </p>
              <h2>
                Formalización, seguridad y cuidado del ambiente en una misma
                dirección.
              </h2>
            </div>
            <blockquote>
              “Soluciones técnicas para una minería formal, segura y
              sostenible.”
            </blockquote>
          </div>
        </section>

        <section className="contact" id="contacto">
          <div className="contact-top">
            <p className="eyebrow contact-eyebrow">
              <span />
              Atención directa
            </p>
            <h2>
              Hablemos de tu proyecto
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
                  href="tel:+51910728575"
                  aria-label="Llamar al +51 910 728 575"
                >
                  +51 910 728 575
                </a>
                <a
                  className="phone-link"
                  href="tel:+51987817100"
                  aria-label="Llamar al +51 987 817 100"
                >
                  +51 987 817 100
                </a>
                <a
                  className="whatsapp-link"
                  href={whatsappInformation}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp 910 728 575
                  <span aria-hidden="true">↗</span>
                </a>
                <a
                  className="whatsapp-link"
                  href={whatsappSecondary}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp 987 817 100
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
            <address>
              <span>Sede registrada</span>
              <strong>
                Calle B N.º 12, Urb. Santa Margarita
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
      </div>

      <footer>
        <a className="brand footer-brand" href="#inicio">
          <span className="brand-mark brand-logo-wrap" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width="44" height="44" />
          </span>
          <span className="brand-copy">
            <strong>COMINORSA</strong>
            <small>Consultoría minera y soluciones ambientales</small>
          </span>
        </a>

        <div className="footer-meta">
          <span className="footer-ruc">RUC 20614147131</span>
          <a href="tel:+51910728575" aria-label="Llamar al +51 910 728 575">
            +51 910 728 575
          </a>
          <a href="tel:+51987817100" aria-label="Llamar al +51 987 817 100">
            +51 987 817 100
          </a>
          <span>Piura · Perú</span>
        </div>

        <a className="back-to-top" href="#inicio" aria-label="Volver al inicio">
          ↑
        </a>
      </footer>
    </main>
  );
}
