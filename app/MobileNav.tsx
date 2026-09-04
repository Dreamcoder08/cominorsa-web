"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const links = [
  { href: "#nosotros", label: "Nosotros" },
  { href: "#servicios", label: "Servicios" },
  { href: "#consulta", label: "Consulta" },
  { href: "#contacto", label: "Contacto" },
];

export function MobileNav({
  whatsappHref,
  basePath = "",
}: {
  whatsappHref: string;
  basePath?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    firstLinkRef.current?.focus();

    // On platforms where the scrollbar reserves layout width (most desktop
    // browsers — not touch/overlay-scrollbar ones, which measure 0 here),
    // hiding it via overflow:hidden widens the viewport and shifts fixed
    // content sideways. Compensate with matching padding so nothing moves.
    // Real phones compute 0 and get no padding, so there's no cost there.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [open, close]);

  return (
    <div className="mobile-nav">
      <button
        ref={toggleRef}
        type="button"
        className="mobile-nav-toggle"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>
      </button>

      <nav
        id="mobile-nav-panel"
        ref={panelRef}
        className="mobile-nav-panel"
        aria-label="Navegación principal"
        data-open={open}
        inert={!open}
      >
        <div className="mobile-nav-panel-links">
          {links.map((link, index) => (
            <a
              key={link.href}
              href={`${basePath}${link.href}`}
              ref={index === 0 ? firstLinkRef : undefined}
              onClick={close}
            >
              {link.label}
            </a>
          ))}
        </div>
        <a
          className="button button-primary mobile-nav-panel-cta"
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          onClick={close}
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
