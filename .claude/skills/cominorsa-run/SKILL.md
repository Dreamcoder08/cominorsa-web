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
- Always `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill` before relaunching — the wrapper script doesn't forward SIGTERM.
- Treat `db/index.ts`, `vite.config.ts`, `worker/index.ts` TS errors during `next build` as pre-existing/unrelated (Cloudflare D1/R2 binding types) — not a regression you introduced.

## Execution Steps

1. Build check: `npx next build 2>&1 | grep -E "Compiled|error TS"` — expect `Compiled successfully`.
2. Launch: `(npm run dev > /tmp/dev-server.log 2>&1 &)`, then poll `curl -sf http://localhost:3000` (don't `sleep` blindly — the first Vite/Next compile can take 10s+).
3. Screenshot with Playwright (no `chromium-cli` in this sandbox):
   - `npx playwright install chromium` once per environment (no `--with-deps` — `apt-get` isn't available here; the "OS not officially supported, downloading fallback build" warning is expected and fine).
   - In the scratchpad dir: `npm install --no-save --prefix "$SCRATCH" playwright` (**not** plain `npm install --no-save playwright` after just `cd`-ing there — this repo's npm config bleeds in the parent pnpm workspace and the install silently fails with `npm error Cannot read properties of null (reading 'isDescendantOf')`, leaving no `node_modules/playwright` and a confusing `ERR_MODULE_NOT_FOUND` on the next run. `--prefix` isolates it and installs cleanly in ~2s).
   - Run an ESM script (`import { chromium } from "playwright"`) that navigates, `scrollIntoViewIfNeeded()` on the section under review, and screenshots to `/tmp/`. See `assets/shot-template.mjs` (desktop) or `assets/mobile-shot-template.mjs` (mobile viewport + the fixed-overlay reachability check below).
   - Read the resulting PNG with the Read tool — don't skip this step.
4. Any `position: fixed` element (cookie/consent banners, sticky CTAs, toasts) needs an extra check beyond a normal screenshot: it doesn't grow document height, so on a short page it can permanently cover the last bit of content — e.g. footer legal links — with no room left to scroll past it, especially on mobile viewports. A `fullPage: true` screenshot is **not** reliable evidence either way for this (Chromium composites fixed elements at a fixed pixel offset in the stitched image, which can look like an overlap that isn't real, or hide one that is). Verify for real: scroll a normal (non-fullPage) viewport to `window.scrollTo(0, document.body.scrollHeight)`, confirm `window.scrollY === document.body.scrollHeight - window.innerHeight` (true max scroll), then screenshot and read it — don't trust `locator(...).boundingBox()` overlap math alone, it can report stale/misleading positions (seen with `.last()` on a page with only one match). See `assets/mobile-shot-template.mjs`.
5. Stop the server when done: `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`.

## Output Contract

State what the screenshot actually shows, not what the CSS is supposed to produce. If something looks broken, say so before moving on.

## References

- `assets/shot-template.mjs` — Playwright screenshot script skeleton (nav, scroll, screenshot, console-error check).
- `assets/mobile-shot-template.mjs` — mobile-viewport (390×844) variant, includes the max-scroll fixed-overlay reachability check from step 4.
- `assets/contrast-check.mjs` — WCAG contrast ratio calculator for verifying color-pair claims against `app/globals.css` tokens instead of eyeballing them.
