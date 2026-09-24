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
// Tailwind `rounded-md` it's dropping). P8 (audit P2-1): rendered
// inside the full site shell (`SiteLayout`: skip link, header, main,
// footer) so a visitor on a broken link still has the navigation, and
// the copy uses tú instead of voseo. Still `noindex, follow` with no
// canonical (see routes.ts).
//
// Cloudflare Workers Static Assets serves this file (`dist-static/404.html`)
// for unmatched paths once `not_found_handling: "404-page"` is
// configured in T9 — noted here per T6a's scope (metadata/markup only).

import { buildWhatsAppLink } from "../../app/constants";
import { SiteLayout } from "./site-shell";

const WHATSAPP_HREF = buildWhatsAppLink("Hola, llegué a un enlace roto en su web");

export function NotFoundPage({ analyticsEnabled = false }: { analyticsEnabled?: boolean } = {}) {
  return (
    <SiteLayout basePath="/" analyticsEnabled={analyticsEnabled}>
      <section className="legal-page">
        <div className="legal-page-header">
          <p>Error 404</p>
          <h1>Página no encontrada</h1>
          <p>
            La ruta que buscas no existe o fue movida. Si llegaste aquí desde
            un enlace, avísanos para corregirlo.
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
    </SiteLayout>
  );
}
