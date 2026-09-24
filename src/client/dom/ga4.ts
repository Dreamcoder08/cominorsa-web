// src/client/dom/ga4.ts
//
// Loads the GA4 vendor script and issues the standard `gtag('js', ...)` /
// `gtag('config', ...)` bootstrap, ported from `app/CookieConsent.tsx`'s
// two `<Script>` tags. The CSP nonce those used
// (`strategy="afterInteractive"`, `nonce={nonce}`) doesn't apply here:
// T7's static build has no inline `<script>` at all, and T10's CSP is
// `script-src 'self'` plus whatever GA4 itself needs (its own docs
// require allow-listing `https://www.googletagmanager.com` and
// `https://*.google-analytics.com`, not a nonce) — this file is the
// caller `../dom/cookie-consent.ts` gates behind an explicit "granted"
// decision; it is never imported or invoked before that.

type DataLayerWindow = Window & { dataLayer?: unknown[] };

export function loadGa4(measurementId: string, doc: Document = document): void {
  const script = doc.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  doc.head.appendChild(script);

  const win = (doc.defaultView ?? window) as DataLayerWindow;
  win.dataLayer = win.dataLayer || [];
  const gtag = (...args: unknown[]) => {
    win.dataLayer!.push(args);
  };
  gtag("js", new Date());
  gtag("config", measurementId);
}
