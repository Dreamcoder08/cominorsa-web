"use client";

import { COOKIE_CONSENT_STORAGE_KEY } from "./constants";

export function CookiePreferencesButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
        window.location.reload();
      }}
    >
      Preferencias de cookies
    </button>
  );
}
