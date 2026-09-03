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
   - In the scratchpad dir: `npm install --no-save playwright`, then run an ESM script (`import { chromium } from "playwright"`) that navigates, `scrollIntoViewIfNeeded()` on the section under review, and screenshots to `/tmp/`. See `assets/shot-template.mjs`.
   - Read the resulting PNG with the Read tool — don't skip this step.
4. Stop the server when done: `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`.

## Output Contract

State what the screenshot actually shows, not what the CSS is supposed to produce. If something looks broken, say so before moving on.

## References

- `assets/shot-template.mjs` — Playwright screenshot script skeleton (nav, scroll, screenshot, console-error check).
- `assets/contrast-check.mjs` — WCAG contrast ratio calculator for verifying color-pair claims against `app/globals.css` tokens instead of eyeballing them.
