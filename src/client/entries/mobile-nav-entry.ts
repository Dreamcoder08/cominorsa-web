// src/client/entries/mobile-nav-entry.ts
//
// Bundle entry point for `src/build/js.ts`. A `<script type="module">`
// is deferred by the HTML spec (parsed and executed after the document,
// before DOMContentLoaded), so by the time this runs the header/panel
// markup it queries already exists — no DOMContentLoaded wrapper needed.
import { initMobileNav } from "../dom/mobile-nav";

initMobileNav();
