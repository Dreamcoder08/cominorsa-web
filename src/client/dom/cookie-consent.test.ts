// src/client/dom/cookie-consent.test.ts
//
// P1 (audit P0-2, P2-7): DOM-free unit coverage for the two decisions
// `initCookieConsent` makes before any real browser is involved:
//   1. With no GA measurement ID baked into the build there is nothing to
//      consent to, so no banner is created and no "Preferencias de
//      cookies" control is left on the page.
//   2. A blocked `localStorage` never throws out of init.
// The rendering/click/GA-loading behavior itself stays covered by
// Playwright (`tests/e2e/static-cookie-consent.spec.ts`) against the
// real build. The fakes below implement only the DOM surface this module
// touches, so an unexpected call fails loudly instead of passing.

import { describe, expect, test } from "bun:test";
import { initCookieConsent } from "./cookie-consent";

type FakeElement = {
  tagName: string;
  className: string;
  textContent: string;
  href: string;
  type: string;
  children: FakeElement[];
  attributes: Record<string, string>;
  removed: boolean;
  setAttribute(name: string, value: string): void;
  appendChild(child: FakeElement): FakeElement;
  addEventListener(type: string, handler: () => void): void;
  remove(): void;
};

function fakeElement(tagName: string): FakeElement {
  return {
    tagName,
    className: "",
    textContent: "",
    href: "",
    type: "",
    children: [],
    attributes: {},
    removed: false,
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener() {},
    remove() {
      this.removed = true;
    },
  };
}

function fakeDocument(options: { preferencesButton?: boolean } = {}) {
  const created: FakeElement[] = [];
  const body = fakeElement("body");
  const bodyClasses = new Set<string>();
  const preferencesButton = options.preferencesButton ? fakeElement("button") : null;
  const doc = {
    body: Object.assign(body, {
      classList: {
        add: (name: string) => void bodyClasses.add(name),
        remove: (name: string) => void bodyClasses.delete(name),
      },
    }),
    head: fakeElement("head"),
    createElement(tagName: string) {
      const element = fakeElement(tagName);
      created.push(element);
      return element;
    },
    createTextNode(text: string) {
      return Object.assign(fakeElement("#text"), { textContent: text });
    },
    getElementById(id: string) {
      return id === "cookie-preferences-button" ? preferencesButton : null;
    },
  };
  return { doc: doc as unknown as Document, created, body, bodyClasses, preferencesButton };
}

function blockedStorageWindow(): Window {
  return {
    get localStorage(): Storage {
      throw new DOMException("blocked", "SecurityError");
    },
    location: { reload() {} },
  } as unknown as Window;
}

function emptyStorageWindow(): Window {
  return {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    location: { reload() {} },
  } as unknown as Window;
}

describe("initCookieConsent without a GA measurement ID", () => {
  test("creates no banner and adds no body class", () => {
    const { doc, created, body, bodyClasses } = fakeDocument();
    initCookieConsent(doc, emptyStorageWindow(), "");
    expect(created).toEqual([]);
    expect(body.children).toEqual([]);
    expect(bodyClasses.size).toBe(0);
  });

  test("removes a stale preferences button instead of wiring it", () => {
    const { doc, preferencesButton } = fakeDocument({ preferencesButton: true });
    initCookieConsent(doc, emptyStorageWindow(), "");
    expect(preferencesButton!.removed).toBe(true);
  });

  test("never touches storage (a blocked storage is irrelevant)", () => {
    const { doc } = fakeDocument();
    expect(() => initCookieConsent(doc, blockedStorageWindow(), "")).not.toThrow();
  });
});

describe("initCookieConsent with a GA measurement ID", () => {
  test("shows the banner when no decision is stored", () => {
    const { doc, body, bodyClasses } = fakeDocument();
    initCookieConsent(doc, emptyStorageWindow(), "G-TEST123");
    expect(body.children.map((child) => child.className)).toEqual(["cookie-consent"]);
    expect(bodyClasses.has("has-cookie-banner")).toBe(true);
  });

  test("does not throw when localStorage is blocked, and still offers the choice", () => {
    const { doc, body } = fakeDocument({ preferencesButton: true });
    expect(() => initCookieConsent(doc, blockedStorageWindow(), "G-TEST123")).not.toThrow();
    expect(body.children.map((child) => child.className)).toEqual(["cookie-consent"]);
  });
});
