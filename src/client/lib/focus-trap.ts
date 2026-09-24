// src/client/lib/focus-trap.ts
//
// Pure index arithmetic behind the mobile-nav focus trap, ported from
// `app/MobileNav.tsx`'s keydown handler:
//
//   if (event.shiftKey && document.activeElement === first) { ...last }
//   else if (!event.shiftKey && document.activeElement === last) { ...first }
//
// Reframed as index math so it's testable without any real DOM/focus
// machinery. `src/client/mobile-nav.ts` calls this with the active
// element's index inside its own `focusable` list and, on a non-null
// result, calls `preventDefault()` and focuses that index — same as the
// two branches above, nothing else.

/**
 * Returns the index to move focus to when Tab/Shift+Tab is pressed at
 * one of the trap's boundaries, or `null` when the browser's own
 * default Tab behavior should apply untouched (anywhere else in the
 * panel, or when there are no focusable elements at all).
 */
export function computeFocusTrapTarget(
  activeIndex: number,
  count: number,
  shiftKey: boolean,
): number | null {
  if (count <= 0 || activeIndex < 0 || activeIndex >= count) return null;

  if (shiftKey && activeIndex === 0) return count - 1;
  if (!shiftKey && activeIndex === count - 1) return 0;
  return null;
}

/**
 * P3 (audit P2-5): the ordered list of elements the open mobile-nav
 * trap cycles through — the toggle (which reads "Cerrar menú" while
 * open) first, matching its DOM position right before the panel, then
 * the panel's own focusables. Without the toggle in the cycle a
 * keyboard user could never Tab back to the close control.
 */
export function buildFocusCycle<T>(toggle: T, panelFocusables: readonly T[]): T[] {
  return [toggle, ...panelFocusables];
}
