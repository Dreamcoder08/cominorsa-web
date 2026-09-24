// src/client/entries/consent-entry.ts
//
// Bundle entry point for `src/build/js.ts`. Loaded on every route: every
// page needs the cookie-consent decision (and its footer "Preferencias
// de cookies" reopen hook), not just the homepage.
import { initCookieConsent } from "../dom/cookie-consent";

initCookieConsent();
