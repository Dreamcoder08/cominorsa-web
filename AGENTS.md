# AGENTS.md

Project-specific skills for AI coding agents working on this repo. Each
`SKILL.md` is the source of truth — this file only points to them.

## Skills (`.claude/skills/`)

- **cominorsa-run** — launch the dev server and verify a frontend change
  with a real screenshot before calling it done. Also has a WCAG contrast
  calculator (`assets/contrast-check.mjs`) — use it instead of eyeballing
  or trusting a pasted claim about contrast.
- **cominorsa-deploy** — this app deploys to Cloudflare Workers (not
  Pages) via `pnpm cf:deploy`, and CI never deploys on its own. Needs
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` — never fabricate these.
- **cominorsa-design-tokens** — every color/spacing/radius value used in
  `app/globals.css` comes from the token system in `:root`. No magic
  values, no off-palette colors, `border-radius: 0` everywhere except one
  documented exception.
- **twenty-crm-ops** — operate the Twenty CRM stack (local or production)
  in the right order: fields before import, clear-demo before import,
  `pnpm twenty:setup` instead of a raw `up -d` (cold start needs its full
  `start_period`).
- **vps-deploy** — deploy to the production VPS safely: `deploy@`, never
  `root@`; edit the repo's `docker-compose.yml`/`.env.example` and re-copy,
  never `sed` the host directly (already caused one real exposure
  regression); verify port 3000 is closed externally after every deploy.

## Stack notes

- Static site (zero runtime `dependencies`) built with Bun
  (`bun run src/build/build.ts` → `dist-static/`), served by Cloudflare
  Workers Static Assets + a small Worker for `/api/*`
  (`src/worker/index.ts`), not Vercel. No React, no Next.js, no vinext,
  no Tailwind — removed at the T11 cutover (`odd/tasks/bun-vanilla-migration.md`).
  Bun is build/dev/test tooling only; it never runs in production
  (Cloudflare Workers runs `workerd`).
- Rendering is a hand-written `~50`-line JSX runtime (`src/html/`)
  compiling JSX to escaped HTML strings at build time — no
  reconciliation, no hydration. Interactivity is 4 dependency-free ES
  modules (`src/client/`), progressive enhancement only.
- Package manager is still **pnpm** (lockfile, `allowBuilds` allowlist,
  pre-commit hook, CI all depend on it) — Bun is the build/test/dev
  runtime, not a package-manager replacement.
- Styling is hand-written CSS in `app/globals.css`, including Tailwind
  v4's Preflight reset ported in verbatim as plain CSS (no `@import
  "tailwindcss"` anymore — zero utility classes were ever used, verified
  by grep before removal).
- `pnpm test` runs the static build (`pnpm run build`) + the Node test
  files under `tests/qa/`. `bun test src/` covers the Bun-native modules
  separately. `pnpm test:e2e` is deterministic (Playwright's own
  `webServer` builds + serves via `wrangler dev`, no manual server step).
- Pre-commit hook runs `pnpm validate` (`scripts/validate-env.mjs`) —
  expect it on every `git commit`.
