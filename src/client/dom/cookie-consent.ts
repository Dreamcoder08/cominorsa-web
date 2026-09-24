// src/client/dom/cookie-consent.ts
//
// Progressive enhancement replacing `app/CookieConsent.tsx` /
// `app/CookiePreferencesButton.tsx` for the static build (T7). Reads the
// same `localStorage` key with the same two string values
// (`app/constants.ts`'s `COOKIE_CONSENT_STORAGE_KEY`, parsed by
// `../lib/consent-storage.ts`), so a choice a visitor made before
// cutover keeps working after it with zero migration.
//
// Design choice (documented per the task's own instruction to justify
// it): the banner is NOT server-rendered in the static HTML. Without
// JS, no GA4 script can load at all, so there is nothing to consent to
// and no reason to ship banner markup (or its CSS class toggle) to a
// no-JS visitor. This module creates the banner element itself, only
// when there's an actual undecided choice to present, and appends it to
// `<body>` — one fewer thing for `src/build/site-shell.tsx`/
// `document.tsx` to render unconditionally on every page.
//
// GA4 loads only on an explicit "granted" decision — never eagerly,
// never on "denied" — via `./ga4.ts`, gated behind the same
// `GA_MEASUREMENT_ID` env-derived constant the React version reads
// (`app/constants.ts`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`), inlined at
// build time by `src/build/js.ts`'s `define` option since a browser
// bundle has no `process.env` at runtime.
//
// The cookie-preferences button (`#cookie-preferences-button`,
// `src/build/site-shell.tsx`) reopens the choice by clearing storage and
// reloading — identical to `app/CookiePreferencesButton.tsx` today, and
// the simplest way to fully reset (a GA4 script already loaded this page
// load can't be meaningfully "unloaded" without one).

import { COOKIE_CONSENT_STORAGE_KEY, GA_MEASUREMENT_ID } from "../../../app/constants";
import { clearConsent, readConsent, writeConsent, type Consent } from "../lib/consent-storage";
import { loadGa4 } from "./ga4";

const BANNER_CLASS = "cookie-consent";
const BODY_BANNER_CLASS = "has-cookie-banner";
const PREFERENCES_BUTTON_ID = "cookie-preferences-button";

function createBanner(
  doc: Document,
  onDecide: (value: "granted" | "denied") => void,
): HTMLElement {
  const banner = doc.createElement("div");
  banner.className = BANNER_CLASS;
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-live", "polite");
  banner.setAttribute("aria-label", "Aviso de cookies");

  // `appendChild`, not `append`: `worker-configuration.d.ts` (wrangler's
  // generated Cloudflare Workers types, included project-wide by
  // tsconfig for the API worker) globally declares its own
  // `interface Element` for the HTMLRewriter API, whose `append(content:
  // string | ReadableStream | Response, options?)` merges with — and
  // shadows — lib.dom's `ParentNode.append` on every `Element` in the
  // whole project. `appendChild`/`createTextNode` aren't part of that
  // merged interface, so they type-check correctly here.
  const message = doc.createElement("p");
  message.appendChild(
    doc.createTextNode(
      "Usamos Google Analytics para entender cómo se usa este sitio. Puedes aceptar o rechazar. Más información en la ",
    ),
  );
  const privacyLink = doc.createElement("a");
  privacyLink.href = "/privacidad";
  privacyLink.textContent = "Política de Privacidad";
  message.appendChild(privacyLink);
  message.appendChild(doc.createTextNode("."));

  const actions = doc.createElement("div");
  actions.className = "cookie-consent-actions";

  const reject = doc.createElement("button");
  reject.type = "button";
  reject.className = "button button-quiet";
  reject.textContent = "Rechazar";
  reject.addEventListener("click", () => onDecide("denied"));

  const accept = doc.createElement("button");
  accept.type = "button";
  accept.className = "button button-primary";
  accept.textContent = "Aceptar";
  accept.addEventListener("click", () => onDecide("granted"));

  actions.appendChild(reject);
  actions.appendChild(accept);
  banner.appendChild(message);
  banner.appendChild(actions);
  return banner;
}

export function initCookieConsent(
  doc: Document = document,
  win: Window = window,
  measurementId: string = GA_MEASUREMENT_ID ?? "",
): void {
  const preferencesButton = doc.getElementById(PREFERENCES_BUTTON_ID);

  // P1 (audit P0-2): no GA ID baked into this build means no tracker can
  // ever load, so there is nothing to consent to — no banner, and no
  // "Preferencias de cookies" control. The build already omits that
  // button when it has no ID (`SiteFooter`'s `analyticsEnabled`, fed by
  // the same env var); removing a stray one here is only a safety net.
  if (!measurementId) {
    preferencesButton?.remove();
    return;
  }

  const applyGrantedConsent = () => loadGa4(measurementId, doc);
  const consent: Consent = readConsent(win, COOKIE_CONSENT_STORAGE_KEY);

  if (consent === "granted") {
    applyGrantedConsent();
  } else if (consent === null) {
    doc.body.classList.add(BODY_BANNER_CLASS);
    const banner = createBanner(doc, (value) => {
      writeConsent(win, COOKIE_CONSENT_STORAGE_KEY, value);
      banner.remove();
      doc.body.classList.remove(BODY_BANNER_CLASS);
      if (value === "granted") applyGrantedConsent();
    });
    doc.body.appendChild(banner);
  }
  // consent === "denied": nothing further to render or load.

  preferencesButton?.addEventListener("click", () => {
    clearConsent(win, COOKIE_CONSENT_STORAGE_KEY);
    win.location.reload();
  });
}
