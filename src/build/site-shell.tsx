// src/build/site-shell.tsx
//
// Ported from `app/SiteHeader.tsx` / `app/SiteFooter.tsx`. Markup and
// Spanish copy are kept verbatim; only the interactive `"use client"`
// widgets they render are simplified.
//
// `MobileNavStatic` and `CookiePreferencesButtonStatic` render the same
// DOM as the closed/idle state of the real `app/` widgets (`MobileNav`,
// `CookiePreferencesButton`) — no-JS baseline markup only. T7's
// `src/client/dom/mobile-nav.ts` and `src/client/dom/cookie-consent.ts`
// progressively enhance this exact markup at runtime (open/close,
// keyboard trap, clearing consent), loaded via `document.tsx`'s
// `scriptSrcs` on every route (`src/build/routes.ts`). The
// `#cookie-preferences-button` id is that script's hook.

import type { Child } from "../html/jsx-runtime";
import { WHATSAPP_INFORMATION } from "../../app/constants";
import {
  PRIMARY_WHATSAPP_DISPLAY,
  PRIMARY_WHATSAPP_NUMBER,
  SECONDARY_WHATSAPP_DISPLAY,
  SECONDARY_WHATSAPP_NUMBER,
  telLink,
} from "../../app/constants";

const NAV_LINKS = [
  { href: "#nosotros", label: "Nosotros" },
  { href: "#servicios", label: "Servicios" },
  { href: "#consulta", label: "Consulta" },
  { href: "#contacto", label: "Contacto" },
];

function MobileNavStatic({ basePath = "" }: { basePath?: string }) {
  return (
    <div className="mobile-nav">
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-label="Abrir menú"
        aria-expanded="false"
        aria-controls="mobile-nav-panel"
      >
        <span aria-hidden="true">☰</span>
      </button>

      <nav
        id="mobile-nav-panel"
        className="mobile-nav-panel"
        aria-label="Navegación principal"
        data-open="false"
        inert={true}
      >
        <div className="mobile-nav-panel-links">
          {NAV_LINKS.map((link) => (
            <a href={`${basePath}${link.href}`}>{link.label}</a>
          ))}
        </div>
        <a
          className="button button-primary mobile-nav-panel-cta"
          href={WHATSAPP_INFORMATION}
          target="_blank"
          rel="noreferrer"
          data-event="whatsapp_cta_click"
          data-event-context="mobile-nav"
        >
          Hablar por WhatsApp
          <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </div>
  );
}

function CookiePreferencesButtonStatic() {
  return (
    <button type="button" id="cookie-preferences-button">
      Preferencias de cookies
    </button>
  );
}

export function SiteHeader({ basePath = "" }: { basePath?: string }) {
  return (
    <header className="site-header">
      <div className="site-header-inner container">
        <a className="brand" href={`${basePath}#inicio`} aria-label="COMINORSA, inicio">
          {/* P11: WebP (2.1 KB, q90, from the fully opaque 88×85 PNG,
              13.3 KB) — Lighthouse modern-image-formats. */}
          <span className="brand-mark brand-logo-wrap" aria-hidden="true">
            <img src="/logo-44.webp" alt="" width="44" height="44" />
          </span>
          <span className="brand-copy">
            <strong translate="no">COMINORSA</strong>
            <small>Consultoría minera y ambiental</small>
          </span>
        </a>

        <nav className="nav-links" aria-label="Navegación principal">
          {NAV_LINKS.map((link) => (
            <a href={`${basePath}${link.href}`}>{link.label}</a>
          ))}
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

        <MobileNavStatic basePath={basePath} />
      </div>
    </header>
  );
}

export type SiteFooterProps = {
  basePath?: string;
  /**
   * P1 (audit P0-2): true only when the build has a GA measurement ID
   * (`runStaticBuild`'s `gaMeasurementId`). Without one no tracker can
   * load, so there is no consent choice to reopen and the button is not
   * rendered. Defaults to false: a missing flag hides the control rather
   * than advertising a choice that does not exist.
   */
  analyticsEnabled?: boolean;
};

export function SiteFooter({ basePath = "", analyticsEnabled = false }: SiteFooterProps) {
  return (
    <footer>
      <a className="brand footer-brand" href={`${basePath}#inicio`}>
        <span className="brand-mark brand-logo-wrap" aria-hidden="true">
          <img src="/logo-44.webp" alt="" width="44" height="44" loading="lazy" />
        </span>
        <span className="brand-copy">
          <strong translate="no">COMINORSA</strong>
          <small>Consultoría minera y soluciones ambientales</small>
        </span>
      </a>

      <div className="footer-meta">
        <span className="footer-ruc">RUC 20614147131</span>
        <a href={telLink(PRIMARY_WHATSAPP_NUMBER)} aria-label={`Llamar al ${PRIMARY_WHATSAPP_DISPLAY}`}>
          {PRIMARY_WHATSAPP_DISPLAY}
        </a>
        <a href={telLink(SECONDARY_WHATSAPP_NUMBER)} aria-label={`Llamar al ${SECONDARY_WHATSAPP_DISPLAY}`}>
          {SECONDARY_WHATSAPP_DISPLAY}
        </a>
        <span>Piura · Perú</span>
        <a href="/preguntas-frecuentes">FAQ</a>
        <a href="/privacidad">Privacidad</a>
        <a href="/terminos">Términos</a>
        {analyticsEnabled ? <CookiePreferencesButtonStatic /> : null}
      </div>

      <a className="back-to-top" href={`${basePath}#inicio`} aria-label="Volver al inicio">
        ↑
      </a>
    </footer>
  );
}

/**
 * P3 (audit P1-4, P1-5): the one skip link on every page. It must be the
 * first focusable element in `<body>` and target `<main id="contenido">`.
 */
export function SkipLink() {
  return (
    <a className="skip-link" href="#contenido">
      Ir al contenido
    </a>
  );
}

/**
 * P3: the page frame every site-chrome page renders — skip link, then
 * the `<header>` landmark, then `<main id="contenido">` holding only the
 * page's own content, then the `<footer>` landmark. Header and footer
 * sit OUTSIDE `<main>` so assistive tech exposes banner/contentinfo
 * landmarks and "skip to content" lands past the navigation.
 */
export function SiteLayout({
  basePath = "",
  analyticsEnabled = false,
  children,
}: {
  basePath?: string;
  analyticsEnabled?: boolean;
  children?: Child;
}) {
  return (
    <>
      <SkipLink />
      <SiteHeader basePath={basePath} />
      <main id="contenido">{children}</main>
      <SiteFooter basePath={basePath} analyticsEnabled={analyticsEnabled} />
    </>
  );
}
