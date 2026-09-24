// src/build/security-policy.ts
//
// T10: the static build's security header policy. Single source of
// truth shared by:
// - `headers.ts` — writes `dist-static/_headers`, applied by Cloudflare
//   to every response served from the static-assets binding.
// - `../worker/security-headers.ts` — wraps the 2 API responses
//   (T9's Worker), since Cloudflare never applies `_headers` to a
//   response the Worker script itself returns (see that file's own
//   comment for the citation).
//
// CSP: equivalent to `proxy.ts`'s (the current Next.js SSR policy),
// minus the per-request nonce. With no inline <script> anywhere in the
// static build (T7 already made every widget a `<script type="module"
// src="...">`), `script-src 'self'` is strictly stronger than
// `'nonce-...'` — a nonce only exists to allow specific inline scripts
// through; a build with none doesn't need the exception at all.
//
// GA4 hosts (script-src/connect-src/img-src) verified against Google's
// own CSP guidance (developers.google.com/tag-platform/security/guides/csp,
// fetched 2026-09-22): a GA4-only setup with no advertising features
// needs `https://www.googletagmanager.com` in script-src, plus that
// same host and `https://*.google-analytics.com` in img-src/connect-src.
// `https://*.analytics.google.com` (GA4's region-specific collect
// endpoint) was already allow-listed in `proxy.ts`'s connect-src before
// this migration and is kept here for parity — dropping it would be a
// scope-creep regression, not a cleanup, since GA4 can route collect
// calls through either google-analytics.com or analytics.google.com
// depending on account configuration.
//
// `'unsafe-inline'` in `script-src` is never used, nor was it before.
// `style-src 'unsafe-inline'` is unchanged from `proxy.ts` — this
// project has always used inline `style` attributes/`<style>` blocks for
// CSS, which is a separate, much lower-severity risk class than inline
// script, and out of this task's scope to remove.
export const CSP_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "img-src 'self' data: https://wa.me https://*.whatsapp.net https://*.fbcdn.net https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "script-src 'self' https://www.googletagmanager.com",
  "connect-src 'self' https://wa.me https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://wa.me",
];

export function buildCsp(): string {
  return CSP_DIRECTIVES.join("; ");
}

// Verbatim from `proxy.ts`, minus the CSP (built separately above) and
// minus `Content-Security-Policy` itself, which callers set from
// `buildCsp()`.
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-XSS-Protection": "0",
};
