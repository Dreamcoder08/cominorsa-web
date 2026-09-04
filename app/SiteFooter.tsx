import { CookiePreferencesButton } from "./CookiePreferencesButton";
import {
  PRIMARY_WHATSAPP_DISPLAY,
  PRIMARY_WHATSAPP_NUMBER,
  SECONDARY_WHATSAPP_DISPLAY,
  SECONDARY_WHATSAPP_NUMBER,
  telLink,
} from "./constants";

export function SiteFooter({ basePath = "" }: { basePath?: string }) {
  return (
    <footer>
      <a className="brand footer-brand" href={`${basePath}#inicio`}>
        <span className="brand-mark brand-logo-wrap" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-44.png"
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
        <a
          href={telLink(PRIMARY_WHATSAPP_NUMBER)}
          aria-label={`Llamar al ${PRIMARY_WHATSAPP_DISPLAY}`}
        >
          {PRIMARY_WHATSAPP_DISPLAY}
        </a>
        <a
          href={telLink(SECONDARY_WHATSAPP_NUMBER)}
          aria-label={`Llamar al ${SECONDARY_WHATSAPP_DISPLAY}`}
        >
          {SECONDARY_WHATSAPP_DISPLAY}
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
