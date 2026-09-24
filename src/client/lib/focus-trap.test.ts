// src/client/lib/focus-trap.test.ts
//
// Pure index arithmetic behind the mobile-nav focus trap, ported from
// `app/MobileNav.tsx`'s keydown handler. Operates on plain
// (activeIndex, count, shiftKey) — no DOM, no real focusable elements —
// so `src/client/mobile-nav.ts` only has to map the returned index back
// onto its own `focusable` NodeList. DOM behavior (does Tab actually
// move focus, does Escape return it to the toggle) is Playwright e2e's
// job, not this file's.

import { describe, expect, test } from "bun:test";
import { buildFocusCycle, computeFocusTrapTarget } from "./focus-trap";

describe("computeFocusTrapTarget", () => {
  test("Shift+Tab on the first element wraps to the last", () => {
    expect(computeFocusTrapTarget(0, 5, true)).toBe(4);
  });

  test("Tab on the last element wraps to the first", () => {
    expect(computeFocusTrapTarget(4, 5, false)).toBe(0);
  });

  test("Tab in the middle does nothing (native browser behavior applies)", () => {
    expect(computeFocusTrapTarget(2, 5, false)).toBeNull();
    expect(computeFocusTrapTarget(2, 5, true)).toBeNull();
  });

  test("Tab on the last element (not the first) does nothing", () => {
    expect(computeFocusTrapTarget(4, 5, true)).toBeNull();
  });

  test("Shift+Tab on the first element (not the last) does nothing", () => {
    expect(computeFocusTrapTarget(0, 5, false)).toBeNull();
  });

  test("a single focusable element wraps to itself in either direction", () => {
    expect(computeFocusTrapTarget(0, 1, false)).toBe(0);
    expect(computeFocusTrapTarget(0, 1, true)).toBe(0);
  });

  test("zero focusable elements never wraps", () => {
    expect(computeFocusTrapTarget(0, 0, false)).toBeNull();
    expect(computeFocusTrapTarget(0, 0, true)).toBeNull();
  });

  test("an out-of-range active index (nothing in the panel focused) does nothing", () => {
    expect(computeFocusTrapTarget(-1, 5, false)).toBeNull();
    expect(computeFocusTrapTarget(-1, 5, true)).toBeNull();
  });
});

// P3 (audit P2-5): the open panel's trap must include the toggle (the
// "Cerrar menú" button), or keyboard users can never Tab back to it.
describe("buildFocusCycle", () => {
  test("puts the toggle first, then the panel's focusables in DOM order", () => {
    expect(buildFocusCycle("toggle", ["a", "b", "cta"])).toEqual(["toggle", "a", "b", "cta"]);
  });

  test("Tab on the panel's last element wraps to the toggle", () => {
    const cycle = buildFocusCycle("toggle", ["a", "b", "cta"]);
    const target = computeFocusTrapTarget(cycle.indexOf("cta"), cycle.length, false);
    expect(cycle[target!]).toBe("toggle");
  });

  test("Shift+Tab on the toggle wraps to the panel's last element", () => {
    const cycle = buildFocusCycle("toggle", ["a", "b", "cta"]);
    const target = computeFocusTrapTarget(cycle.indexOf("toggle"), cycle.length, true);
    expect(cycle[target!]).toBe("cta");
  });

  test("with an empty panel the toggle alone is the cycle", () => {
    expect(buildFocusCycle("toggle", [])).toEqual(["toggle"]);
  });
});
