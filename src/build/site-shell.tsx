/** @jsxImportSource ../html */
// src/build/site-shell.tsx
//
// Ported from `app/SiteHeader.tsx` / `app/SiteFooter.tsx`. Markup and
// Spanish copy are kept verbatim; only the interactive `"use client"`
// widgets they render are simplified.
//
// T7 leftover: `MobileNavStatic` and `CookiePreferencesButtonStatic`
// render the same DOM as the closed/idle state of the real `app/`
// widgets (`MobileNav`, `CookiePreferencesButton`) but wire no
// behavior — no open/close, no keyboard trap, no clearing consent.
// That's progressive enhancement, T7's job; this static build has no
// script tags yet.

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
  return <button type="button">Preferencias de cookies</button>;
}

export function SiteHeader({ basePath = "" }: { basePath?: string }) {
  return (
    <header className="site-header">
      <div className="site-header-inner container">
        <a className="brand" href={`${basePath}#inicio`} aria-label="COMINORSA, inicio">
          <span className="brand-mark brand-logo-wrap" aria-hidden="true">
            <img src="/logo-44.png" alt="" width="44" height="44" />
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

export function SiteFooter({ basePath = "" }: { basePath?: string }) {
  return (
    <footer>
      <a className="brand footer-brand" href={`${basePath}#inicio`}>
        <span className="brand-mark brand-logo-wrap" aria-hidden="true">
          <img src="/logo-44.png" alt="" width="44" height="44" loading="lazy" />
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
        <CookiePreferencesButtonStatic />
      </div>

      <a className="back-to-top" href={`${basePath}#inicio`} aria-label="Volver al inicio">
        ↑
      </a>
    </footer>
  );
}
