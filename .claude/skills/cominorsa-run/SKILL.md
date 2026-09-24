---
name: cominorsa-run
description: "Trigger: run the app, dev server, screenshot, preview a change, verify UI, check contrast, visual QA on cominorsa-web. Launch the dev server and verify frontend changes visually before claiming them done."
license: Apache-2.0
metadata:
  author: "dreamcoder08"
  version: "1.0"
---

## Activation Contract

Use before claiming any CSS/layout/component change is done on this repo. A build passing is not proof a UI change looks right — only a screenshot is.

## Hard Rules

- Never claim a visual/CSS change works without a screenshot from this flow.
- This is a static site (T11 cutover) built with Bun and served by
  `wrangler dev` — no Next.js, no Vite dev server, no hot module reload.
  A source edit needs a rebuild (`bun run src/build/build.ts`) before
  the server reflects it; `wrangler dev`'s asset watcher only reloads
  the browser once `dist-static/` actually changes on disk.
- Kill the server by **exact PID** (`kill <pid>`, captured when you
  launched it), never by port-matching pattern — `wrangler dev` spawns
  a child `workerd` process that can outlive a parent `kill` if you
  only killed the wrapper. Verify with `lsof -ti:<port> -sTCP:LISTEN`
  and `pgrep -fa workerd` before declaring the port free; a stale
  `.wrangler/deploy/config.json` from an old `wrangler deploy --dry-run`
  can also make Wrangler silently pick up the wrong config (`rm -rf
  .wrangler` if a rebuilt site doesn't show up).

## Execution Steps

1. Build check: `bun run src/build/build.ts` — expect `Built dist-static/ (11 pages)` with no errors.
2. Launch: `(pnpm exec wrangler dev --port 8788 > /tmp/dev-server.log 2>&1 &)`, capture the PID, then poll `curl -sf http://localhost:8788` (don't `sleep` blindly — the first `workerd` boot can take a few seconds).
3. Screenshot with `pnpm shots <baseUrl> <outDir> <paths…>` (`scripts/screenshots.mjs`): full-page PNGs of every path at 1440 and 390 px, named `home-1440.png`, `seguridad-minera-390.png`, … It reuses the repo's `@playwright/test` (no scratch install). Example: `pnpm shots http://localhost:8788 "$SCRATCH/shots" / /seguridad-minera`.
   - Shots render with `reducedMotion: "reduce"`: full-page capture never scrolls, so scroll-driven reveals would otherwise stay hidden and sections look blank. To see the motion itself, scroll a normal viewport (adapt `assets/shot-template.mjs`).
   - `outDir` must be outside `test-results/` — every `pnpm test:e2e` run wipes that folder (the script refuses it).
   - Chromium missing? `pnpm exec playwright install chromium` once per environment (no `--with-deps` — `apt-get` isn't available here; the "OS not officially supported, downloading fallback build" warning is expected and fine).
   - For a section-level or interaction shot (scroll to a section, fill a form, focus state), adapt `assets/shot-template.mjs` / `assets/mobile-shot-template.mjs`; run it from the repo root so `@playwright/test` resolves.
   - Read the resulting PNGs with the Read tool — don't skip this step.
4. Any `position: fixed` element (cookie/consent banners, sticky CTAs, toasts) needs an extra check beyond a normal screenshot: it doesn't grow document height, so on a short page it can permanently cover the last bit of content — e.g. footer legal links — with no room left to scroll past it, especially on mobile viewports. A `fullPage: true` screenshot is **not** reliable evidence either way for this (Chromium composites fixed elements at a fixed pixel offset in the stitched image, which can look like an overlap that isn't real, or hide one that is). Verify for real: scroll a normal (non-fullPage) viewport to `window.scrollTo(0, document.body.scrollHeight)`, confirm `window.scrollY === document.body.scrollHeight - window.innerHeight` (true max scroll), then screenshot and read it — don't trust `locator(...).boundingBox()` overlap math alone, it can report stale/misleading positions (seen with `.last()` on a page with only one match). See `assets/mobile-shot-template.mjs`.
5. Stop the server when done: kill the exact PID captured in step 2 (`kill <pid>`); confirm with `lsof -ti:8788 -sTCP:LISTEN` that nothing is left listening.

## Output Contract

State what the screenshot actually shows, not what the CSS is supposed to produce. If something looks broken, say so before moving on.

## References

- `assets/shot-template.mjs` — Playwright screenshot script skeleton (nav, scroll, screenshot, console-error check).
- `assets/mobile-shot-template.mjs` — mobile-viewport (390×844) variant, includes the max-scroll fixed-overlay reachability check from step 4.
- `assets/contrast-check.mjs` — WCAG contrast ratio calculator for verifying color-pair claims against `app/globals.css` tokens instead of eyeballing them.
