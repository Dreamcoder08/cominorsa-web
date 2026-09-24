// src/client/dom/mobile-nav.ts
//
// Progressive enhancement for the mobile-nav markup rendered by
// `src/build/site-shell.tsx`'s `MobileNavStatic` (T3, static/closed
// state only). Ported from `app/MobileNav.tsx`'s `useState`/`useEffect`
// pair: same aria-expanded/aria-controls/data-open/inert toggling, same
// scrollbar-width body-scroll lock, same Escape-closes-and-refocuses and
// Tab focus trap (index math delegated to `../lib/focus-trap.ts`, which
// is the part actually worth unit-testing). No DOM-free unit tests here
// by design — see odd/tasks/bun-vanilla-migration.md, T7: DOM wiring is
// covered by Playwright e2e against the built static site instead.
//
// One addition beyond the React version: closing on resize back to the
// desktop breakpoint (`app/globals.css`'s `@media (max-width: 820px)` is
// where `.mobile-nav` becomes visible at all) so a panel left open on a
// phone doesn't stay "open" in the DOM after rotating to a wide viewport
// where it's invisible anyway — a robustness improvement the task asked
// for, not a behavior this is trying to hide a regression in.

import { computeFocusTrapTarget } from "../lib/focus-trap";

const DESKTOP_QUERY = "(min-width: 821px)";
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])';

export function initMobileNav(doc: Document = document): void {
  const toggle = doc.querySelector<HTMLButtonElement>(".mobile-nav-toggle");
  const panel = doc.getElementById("mobile-nav-panel");
  if (!toggle || !panel) return;

  let open = false;
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  function getFocusable(): HTMLElement[] {
    return Array.from(panel!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  function lockScroll() {
    const scrollbarWidth = window.innerWidth - doc.documentElement.clientWidth;
    doc.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) doc.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  function unlockScroll() {
    doc.body.style.overflow = "";
    doc.body.style.paddingRight = "";
  }

  function setOpen(value: boolean) {
    open = value;
    toggle!.setAttribute("aria-expanded", String(open));
    toggle!.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    const icon = toggle!.querySelector('span[aria-hidden="true"]');
    if (icon) icon.textContent = open ? "✕" : "☰";
    panel!.dataset.open = String(open);
    if (open) panel!.removeAttribute("inert");
    else panel!.setAttribute("inert", "");

    if (open) {
      lockScroll();
      getFocusable()[0]?.focus();
      keydownHandler = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          close();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = getFocusable();
        const activeIndex = focusable.indexOf(doc.activeElement as HTMLElement);
        const target = computeFocusTrapTarget(activeIndex, focusable.length, event.shiftKey);
        if (target === null) return;
        event.preventDefault();
        focusable[target]?.focus();
      };
      doc.addEventListener("keydown", keydownHandler);
    } else {
      unlockScroll();
      if (keydownHandler) {
        doc.removeEventListener("keydown", keydownHandler);
        keydownHandler = null;
      }
    }
  }

  function close() {
    setOpen(false);
    toggle!.focus();
  }

  toggle.addEventListener("click", () => setOpen(!open));

  for (const link of panel.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    link.addEventListener("click", () => close());
  }

  if (typeof window.matchMedia === "function") {
    const desktopQuery = window.matchMedia(DESKTOP_QUERY);
    desktopQuery.addEventListener("change", (event) => {
      if (event.matches && open) setOpen(false);
    });
  }
}
