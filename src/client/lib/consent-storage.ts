// src/client/lib/consent-storage.ts
//
// Pure parsing of the cookie-consent value read from `localStorage`,
// ported from `app/CookieConsent.tsx`'s `getSnapshot` (T7). The storage
// key itself stays `app/constants.ts`'s `COOKIE_CONSENT_STORAGE_KEY` —
// not redeclared here — so returning visitors keep their pre-cutover
// choice with zero migration.

export type Consent = "granted" | "denied" | null;

export function parseConsent(value: string | null): Consent {
  return value === "granted" || value === "denied" ? value : null;
}
