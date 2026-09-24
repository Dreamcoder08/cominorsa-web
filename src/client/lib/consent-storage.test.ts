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
import { clearConsent, parseConsent, readConsent, writeConsent } from "./consent-storage";

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

// P1 (audit P2-7): `localStorage` can throw — Safari private mode,
// blocked site data, a sandboxed iframe — either on the `localStorage`
// getter itself or on each call. The consent wiring must survive that:
// a blocked storage reads as "no decision yet" and writes are dropped.
describe("safe consent storage access", () => {
  const KEY = "cominorsa-consent";

  function throwingGetterWindow(): { localStorage: Storage } {
    return {
      get localStorage(): Storage {
        throw new DOMException("blocked", "SecurityError");
      },
    };
  }

  function throwingCallsWindow(): { localStorage: Storage } {
    const fail = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    return {
      localStorage: { getItem: fail, setItem: fail, removeItem: fail } as unknown as Storage,
    };
  }

  function memoryWindow(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    return {
      data,
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
      } as unknown as Storage,
    };
  }

  test("readConsent returns the stored decision when storage works", () => {
    expect(readConsent(memoryWindow({ [KEY]: "granted" }), KEY)).toBe("granted");
    expect(readConsent(memoryWindow(), KEY)).toBeNull();
  });

  test("readConsent returns null instead of throwing when storage is blocked", () => {
    expect(readConsent(throwingGetterWindow(), KEY)).toBeNull();
    expect(readConsent(throwingCallsWindow(), KEY)).toBeNull();
  });

  test("writeConsent and clearConsent persist when storage works", () => {
    const win = memoryWindow();
    writeConsent(win, KEY, "denied");
    expect(win.data.get(KEY)).toBe("denied");
    clearConsent(win, KEY);
    expect(win.data.has(KEY)).toBe(false);
  });

  test("writeConsent and clearConsent never throw when storage is blocked", () => {
    for (const win of [throwingGetterWindow(), throwingCallsWindow()]) {
      expect(() => writeConsent(win, KEY, "granted")).not.toThrow();
      expect(() => clearConsent(win, KEY)).not.toThrow();
    }
  });
});
