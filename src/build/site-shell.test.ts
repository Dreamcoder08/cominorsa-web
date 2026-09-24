// src/build/site-shell.test.ts
//
// Ported from `app/SiteHeader.tsx` / `app/SiteFooter.tsx`. The mobile
// nav toggle and the cookie-preferences button are T7 leftovers: their
// `app/` originals are `"use client"` widgets (`MobileNav`,
// `CookiePreferencesButton`) with no server-rendered behavior of their
// own — this ports their static, JS-less markup only. Progressive
// enhancement (open/close, keyboard trap, clearing consent) is T7's job.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { SiteFooter, SiteHeader } from "./site-shell";

describe("SiteHeader", () => {
  const html = render(SiteHeader({ basePath: "/" }));

  test("carries the four primary nav links, anchored to the homepage", () => {
    expect(html).toContain('<a href="/#nosotros">Nosotros</a>');
    expect(html).toContain('<a href="/#servicios">Servicios</a>');
    expect(html).toContain('<a href="/#consulta">Consulta</a>');
    expect(html).toContain('<a href="/#contacto">Contacto</a>');
  });

  test("carries the header WhatsApp CTA with its analytics markers", () => {
    const match = html.match(/<a[^>]*class="header-cta"[^>]*>/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('data-event="whatsapp_cta_click"');
    expect(match![0]).toContain('data-event-context="header"');
    expect(match![0]).toContain("https://wa.me/51910728575");
  });

  test("carries the brand mark and name", () => {
    expect(html).toContain("COMINORSA");
    expect(html).toContain('aria-label="COMINORSA, inicio"');
  });

  test("mobile nav toggle renders inert/closed static markup (T7 leftover)", () => {
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-open="false"');
    expect(html).toContain("inert");
  });
});

describe("SiteFooter", () => {
  const html = render(SiteFooter({ basePath: "/" }));

  test("carries the RUC and legal links", () => {
    expect(html).toContain("RUC 20614147131");
    expect(html).toContain('<a href="/preguntas-frecuentes">FAQ</a>');
    expect(html).toContain('<a href="/privacidad">Privacidad</a>');
    expect(html).toContain('<a href="/terminos">Términos</a>');
  });

  test("carries both phone numbers as tel: links", () => {
    expect(html).toContain('href="tel:+51910728575"');
    expect(html).toContain('href="tel:+51987817100"');
  });

  // P1 (audit P0-2): the button only exists when the build has a GA ID
  // — with no tracker there is no consent choice to reopen.
  test("renders no cookie-preferences button by default (build without a GA ID)", () => {
    expect(html).not.toContain("cookie-preferences-button");
    expect(html).not.toContain("Preferencias de cookies");
  });

  test("renders the #cookie-preferences-button hook when analytics is enabled", () => {
    const withAnalytics = render(SiteFooter({ basePath: "/", analyticsEnabled: true }));
    expect(withAnalytics).toContain(
      '<button type="button" id="cookie-preferences-button">Preferencias de cookies</button>',
    );
  });
});
