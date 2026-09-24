// src/build/not-found-page.tsx
//
// Ported from `app/not-found.tsx`. The original renders with Tailwind
// utility classes (`bg-amber-600`, `rounded-md`, `text-slate-900`,
// ...); this static build's CSS pipeline does not run Tailwind's JIT
// content scanner — `build.ts`'s module comment (T3 finding) already
// established that Bun's CSS bundler passes `@import "tailwindcss";`
// through without generating any utility classes from template usage,
// so those classes would render completely unstyled here (no color,
// no radius, no spacing). Restyled instead with the same hand-written,
// token-based classes every other static page already uses
// (`.legal-page`/`.legal-page-header`/`.legal-page-body`,
// `.button`/`.button-primary`) — same copy, same two calls to action
// (home, WhatsApp), and already `border-radius: 0` by the design
// system's own rule (the ported page never actually needs the
// Tailwind `rounded-md` it's dropping). Layout stays a standalone full
// page with no SiteHeader/SiteFooter, matching today's structure.
//
// Cloudflare Workers Static Assets serves this file (`dist-static/404.html`)
// for unmatched paths once `not_found_handling: "404-page"` is
// configured in T9 — noted here per T6a's scope (metadata/markup only).

import { buildWhatsAppLink } from "../../app/constants";
import { SkipLink } from "./site-shell";

const WHATSAPP_HREF = buildWhatsAppLink("Hola, llegué a un enlace roto en su web");

export function NotFoundPage() {
  return (
    <>
      <SkipLink />
      <main id="contenido">
      <section className="legal-page">
        <div className="legal-page-header">
          <p>Error 404</p>
          <h1>Página no encontrada</h1>
          <p>
            La ruta que buscás no existe o fue movida. Si llegaste acá desde
            un enlace, avisanos para corregirlo.
          </p>
        </div>

        <div className="legal-page-body">
          <section>
            <a className="button button-primary" href="/">
              Volver al inicio
            </a>
            <p>
              <a href={WHATSAPP_HREF} target="_blank" rel="noopener">
                Avisar por WhatsApp
              </a>
            </p>
          </section>
        </div>
      </section>
      </main>
    </>
  );
}
