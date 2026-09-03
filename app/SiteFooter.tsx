import { CookiePreferencesButton } from "./CookiePreferencesButton";

export function SiteFooter({ basePath = "" }: { basePath?: string }) {
  return (
    <footer>
      <a className="brand footer-brand" href={`${basePath}#inicio`}>
        <span className="brand-mark brand-logo-wrap" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            width="44"
            height="44"
            loading="lazy"
          />
        </span>
        <span className="brand-copy">
          <strong translate="no">COMINORSA</strong>
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
        <a href="/preguntas-frecuentes">FAQ</a>
        <a href="/privacidad">Privacidad</a>
        <a href="/terminos">Términos</a>
        <CookiePreferencesButton />
      </div>

      <a className="back-to-top" href={`${basePath}#inicio`} aria-label="Volver al inicio">
        ↑
      </a>
    </footer>
  );
}
