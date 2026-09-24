// src/client/lib/consent-storage.test.ts
//
// Pure parsing of the cookie-consent value read from `localStorage`,
// ported from `app/CookieConsent.tsx`'s `getSnapshot`. Must accept
// exactly the same two stored strings ("granted"/"denied") so a
// returning visitor's choice, saved by the React widget before cutover,
// keeps working after it (same storage key too — see
// `app/constants.ts`'s `COOKIE_CONSENT_STORAGE_KEY`, reused as-is by
// `src/client/cookie-consent.ts`, not redeclared here).

import { describe, expect, test } from "bun:test";
import { parseConsent } from "./consent-storage";

describe("parseConsent", () => {
  test("recognizes the two valid stored values", () => {
    expect(parseConsent("granted")).toBe("granted");
    expect(parseConsent("denied")).toBe("denied");
  });

  test("treats anything else — including null, empty, and garbage — as no decision yet", () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("true")).toBeNull();
    expect(parseConsent("GRANTED")).toBeNull();
    expect(parseConsent("granted ")).toBeNull();
  });
});
