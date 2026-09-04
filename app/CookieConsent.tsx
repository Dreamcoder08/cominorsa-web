"use client";

import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import { COOKIE_CONSENT_STORAGE_KEY, GA_MEASUREMENT_ID } from "./constants";

type Consent = "granted" | "denied" | null;

const CHANGE_EVENT = "cominorsa-consent-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): Consent {
  const value = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

function getServerSnapshot(): Consent {
  return null;
}

export function CookieConsent({ nonce }: { nonce?: string }) {
  const consent = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  function decide(value: "granted" | "denied") {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  // The banner is `position: fixed`, so it can permanently cover the last
  // bit of a short page (e.g. the footer's legal links) with no way to
  // scroll past it. Reserve room for it at the end of the document instead.
  useEffect(() => {
    document.body.classList.toggle("has-cookie-banner", consent === null);
  }, [consent]);

  return (
    <>
      {consent === "granted" && GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
            nonce={nonce}
          />
          <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `}
          </Script>
        </>
      )}

      {consent === null && (
        <div
          className="cookie-consent"
          role="dialog"
          aria-live="polite"
          aria-label="Aviso de cookies"
        >
          <p>
            Usamos Google Analytics para entender cómo se usa este sitio.
            Puedes aceptar o rechazar. Más información en la{" "}
            <a href="/privacidad">Política de Privacidad</a>.
          </p>
          <div className="cookie-consent-actions">
            <button
              type="button"
              className="button button-quiet"
              onClick={() => decide("denied")}
            >
              Rechazar
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => decide("granted")}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
