import { MobileNav } from "./MobileNav";
import { WHATSAPP_INFORMATION } from "./constants";

/**
 * basePath: "" on the homepage (bare #anchor scrolls in place), "/" on any
 * other route (so the same nav links land on the homepage's sections
 * instead of trying to scroll to an id that doesn't exist on that page).
 */
export function SiteHeader({ basePath = "" }: { basePath?: string }) {
  return (
    <header className="site-header">
      <a
        className="brand"
        href={`${basePath}#inicio`}
        aria-label="COMINORSA, inicio"
      >
        <span className="brand-mark brand-logo-wrap" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-44.png" alt="" width="44" height="44" />
        </span>
        <span className="brand-copy">
          <strong translate="no">COMINORSA</strong>
          <small>Consultoría minera y ambiental</small>
        </span>
      </a>

      <nav className="nav-links" aria-label="Navegación principal">
        <a href={`${basePath}#nosotros`}>Nosotros</a>
        <a href={`${basePath}#servicios`}>Servicios</a>
        <a href={`${basePath}#consulta`}>Consulta</a>
        <a href={`${basePath}#contacto`}>Contacto</a>
      </nav>

      <a
        className="header-cta"
        href={WHATSAPP_INFORMATION}
        target="_blank"
        rel="noreferrer"
        data-event="whatsapp_cta_click"
        data-event-context="header"
      >
        WhatsApp
        <span aria-hidden="true">↗</span>
      </a>

      <MobileNav whatsappHref={WHATSAPP_INFORMATION} basePath={basePath} />
    </header>
  );
}
