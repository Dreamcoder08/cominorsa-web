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

// P1 (audit P2-7): every `localStorage` touch goes through these three
// helpers. Storage can throw on the `localStorage` getter itself or on
// each call (Safari private mode, blocked site data, sandboxed frames);
// a blocked storage must read as "no decision yet" and silently drop
// writes, never break the page's other wiring.
type StorageWindow = { readonly localStorage: Storage };

export function readConsent(win: StorageWindow, key: string): Consent {
  try {
    return parseConsent(win.localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function writeConsent(win: StorageWindow, key: string, value: "granted" | "denied"): void {
  try {
    win.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the decision still applies for this page view.
  }
}

export function clearConsent(win: StorageWindow, key: string): void {
  try {
    win.localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing was persisted to clear.
  }
}
