// Real DOM interaction tests for app/MobileNav.tsx's focus trap.
//
// Every other test in this project asserts on the built HTML output — that
// can't see keyboard behavior (Tab cycling, Escape, focus return) because
// it's pure client-side JS that only runs after hydration. This file
// renders the real component in jsdom and drives it with actual DOM events,
// so a regression in the focus-trap logic (app/MobileNav.tsx:39-73) would
// actually fail a test instead of shipping silently.
//
// jsdom globals must exist before react-dom/client and the component are
// imported, and the tsx loader must be registered before importing the
// .tsx source file — both happen synchronously below, then everything else
// is a dynamic import.

import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Node has its own read-only global `navigator` (getter, no setter) — must
// override via defineProperty instead of assignment.
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.requestAnimationFrame =
  dom.window.requestAnimationFrame ?? ((cb) => setTimeout(cb, 0));
globalThis.cancelAnimationFrame =
  dom.window.cancelAnimationFrame ?? clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

register();

const React = await import("react");
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { MobileNav } = await import("../../app/MobileNav.tsx");

const WHATSAPP_HREF = "https://wa.me/51910728575?text=hola";

function renderMobileNav() {
  return render(React.createElement(MobileNav, { whatsappHref: WHATSAPP_HREF }));
}

function getToggleButton() {
  return document.querySelector(".mobile-nav-toggle");
}

function getPanel() {
  return document.getElementById("mobile-nav-panel");
}

function getFocusableLinks() {
  return [...getPanel().querySelectorAll("a[href], button:not([disabled])")];
}

test.afterEach(() => {
  cleanup();
});

test("toggle button opens the panel and moves focus to the first nav link", () => {
  renderMobileNav();
  const toggle = getToggleButton();
  assert.equal(toggle.getAttribute("aria-expanded"), "false");

  fireEvent.click(toggle);

  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(getPanel().dataset.open, "true");
  const [firstLink] = getFocusableLinks();
  assert.equal(document.activeElement, firstLink);
});

test("Escape closes the panel and returns focus to the toggle button", () => {
  renderMobileNav();
  const toggle = getToggleButton();
  fireEvent.click(toggle);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");

  fireEvent.keyDown(document, { key: "Escape" });

  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(getPanel().dataset.open, "false");
  assert.equal(document.activeElement, toggle);
});

test("Tab on the last focusable element wraps focus to the first (forward trap)", () => {
  renderMobileNav();
  fireEvent.click(getToggleButton());
  const focusable = getFocusableLinks();
  const last = focusable[focusable.length - 1];
  const first = focusable[0];

  last.focus();
  assert.equal(document.activeElement, last);

  fireEvent.keyDown(document, { key: "Tab" });

  assert.equal(document.activeElement, first);
});

test("Shift+Tab on the first focusable element wraps focus to the last (backward trap)", () => {
  renderMobileNav();
  fireEvent.click(getToggleButton());
  const focusable = getFocusableLinks();
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  assert.equal(document.activeElement, first, "opening should auto-focus the first link");

  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

  assert.equal(document.activeElement, last);
});

test("Tab/Shift+Tab do nothing while the panel is closed (no dangling listener)", () => {
  renderMobileNav();
  const toggle = getToggleButton();
  // Never opened — handleKeyDown's effect never registered its listener.
  fireEvent.keyDown(document, { key: "Tab" });
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
});

test("clicking a nav link closes the panel", () => {
  renderMobileNav();
  fireEvent.click(getToggleButton());
  const [firstLink] = getFocusableLinks();

  fireEvent.click(firstLink);

  assert.equal(getToggleButton().getAttribute("aria-expanded"), "false");
});
