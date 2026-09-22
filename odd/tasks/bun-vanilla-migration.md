# Bun + Vanilla Migration

## Objective

Rebuild the COMINORSA landing site as a static, dependency-free site
built with Bun tooling, served from Cloudflare Workers Static Assets,
with a single Worker for the two API routes.

## Problem

The site is a 10-page, near-static marketing site with 4 interactive
widgets. It currently ships Next.js 16 + React 19 + RSC + `vinext`
(`1.0.0-beta.9`, a beta framework runtime) to deliver that. Every page is
server-rendered for two incidental reasons, not because the content is
dynamic.

## Why

Stated product goal: Bun + its ecosystem, near-zero libraries, vanilla,
modern, performance-first, with software-engineering quality practices.

The site is already 90% vanilla: `app/globals.css` is 1,871 lines of
hand-written CSS, all 10 pages are static content, and total TS/TSX is
only ~2,267 lines. The framework layer is the part that does not pay for
itself.

## Exploration findings (verified 2026-09-22)

| Finding | Evidence |
|---|---|
| `drizzle-orm` + D1 are dead scaffolding | `db/schema.ts` is `export {}` with a comment saying it is intentionally empty; `getDb()` has zero callers across `app/`, `worker/`, `tests/`, `scripts/` |
| `app/api/crm-lead/route.ts` is already library-free | 333 lines, zero library imports — plain `fetch` to Twenty CRM + Resend |
| SSR is not required by the content | Only two causes: the per-request CSP nonce in `proxy.ts`, and `getBaseUrl()` reading the `host` header |
| A nonce is unnecessary once static | With no inline `<script>`, `script-src 'self'` is strictly stronger than `'nonce-...'` |
| `public/_headers` currently does nothing for pages | Its own comment documents this: Cloudflare only applies it to responses from the static-assets binding, and every page goes through `handler.fetch()` |
| Fonts are auto-self-hosted today | `next/font/google` handles Archivo, Newsreader, Geist Mono; a vanilla build must self-host woff2 + hand-written `@font-face` |
| Test suite is the migration safety net | 23 files in `tests/qa/` (`node --test`) asserting on built HTML, plus 3 Playwright e2e specs |

## Architecture

- **Render**: JSX compiled to HTML strings by a hand-written ~50-line
  `jsx-runtime`, wired via `tsconfig` `jsxImportSource`. Bun transpiles
  JSX natively. No React. Existing `.tsx` pages port near-verbatim once
  hooks are removed.
- **Build**: a `Bun.build`-driven script emits HTML per route, hashes and
  minifies CSS/JS, and generates `sitemap.xml`, `robots.txt`,
  `manifest.webmanifest` as static files.
- **Interactivity**: 4 progressive-enhancement ES modules, no framework.
- **Runtime**: Cloudflare Workers Static Assets + one Worker handling
  `/api/crm-lead` and `/api/next-business-day`.
- **Security headers**: move to `public/_headers`, which starts applying
  to pages once they are static assets. Drop the nonce.

## Constraints

- Cloudflare Workers runs `workerd`, not Bun. Bun is build/test/dev
  tooling only; it never runs in production.
- Production site for a real client. Next.js must keep serving until the
  final cutover task.
- No new runtime dependencies. Build-time/dev-time tooling must be Bun's
  own built-ins wherever Bun provides them.
- Every color/spacing/radius stays on the existing token system in
  `app/globals.css` `:root` (see `.claude/skills/cominorsa-design-tokens`).
- Rendered HTML must stay equivalent enough that `tests/qa/*` keeps
  passing; any intended change to output requires updating its test in
  the same commit.

## Resolved configuration

- **TDD mode**: **Strict TDD — ON**. Source: established project SDD
  convention, `openspec/changes/archive/2026-09-04-analytics-event-tracking/design.md`
  ("Strict TDD is active") and its `verify-report.md` RED/GREEN record.
  Observed RED is required before implementation on every task.
- **Test runners**: `node --test` for `tests/qa/*.test.mjs` (existing,
  unchanged); `bun test` for new Bun-native modules under `src/`;
  `playwright test` for e2e.
- **Delivery strategy**: `ask-on-risk`. Chain strategy: **PENDING** — ask
  before the first slice boundary.
- **Forecast**: ~2,400 authored changed lines → ~6 slices at the ~400-line
  delivery budget.
- **Skills resolved by registry** (`.atl/skill-registry.md`):
  `work-unit-commits`, `chained-pr`, `skill-creator`.

## Blocker

`main` carries ~613 insertions of uncommitted work (Resend email
notification, `app/api/next-business-day/`, typecheck tooling, provider
isolation e2e). It overlaps this migration in `db/index.ts`,
`app/ConsultationForm.tsx`, `app/api/crm-lead/route.ts`, `tsconfig.json`,
`package.json`, `vite.config.ts`. Carried onto this branch uncommitted by
`git checkout -b`. **T0 and T1 are blocked until the user decides its
fate.** Tasks touching only new paths may proceed.

## Tasks

- [ ] **T0** — Delete dead Drizzle/D1 scaffolding (`db/`, `drizzle/`,
      `drizzle.config.ts`, the `drizzle-orm` dep). *BLOCKED: `db/index.ts`
      has uncommitted changes.* Route: inline.
- [ ] **T1** — Adopt Bun toolchain (`bunfig.toml`, lockfile, scripts)
      without breaking `node --test` or the pre-commit `pnpm validate`
      hook. *BLOCKED: `package.json`/`tsconfig.json` have uncommitted
      changes.* Route: inline.
- [x] **T2** — Hand-written `jsx-runtime` rendering JSX to escaped HTML
      strings, with unit tests. Security-critical (XSS via attribute and
      text escaping). Route: delegated writer. **DONE** — `src/html/jsx-runtime.ts`
      (128 lines) + `src/html/jsx-runtime.test.ts` (35 tests / 49 assertions).
      Strict TDD observed: RED (`Cannot find module './jsx-runtime'`, 0 pass
      1 fail) → GREEN (35 pass, 0 fail). Parent spot check re-ran
      `bun test src/html/jsx-runtime.test.ts` → 35 pass.
      `bunx tsc --noEmit src/html/jsx-runtime.ts` → exit 0.
- [ ] **T3** — `Bun.build` pipeline emitting one page end-to-end
      (`seguridad-minera`, 13 lines) with hashed CSS, verified against the
      existing QA suite. Route: delegated writer.
- [ ] **T4** — Static `<head>`/metadata system replacing
      `generateMetadata`, `viewport`, and the JSON-LD block. Route:
      delegated writer.
- [ ] **T5** — Self-hosted woff2 fonts + hand-written `@font-face`,
      replacing `next/font/google`. Route: delegated writer.
- [ ] **T6** — Port the remaining 9 pages. Route: delegated writer.
- [ ] **T7** — Rewrite the 4 interactive widgets as vanilla ES modules
      with progressive enhancement. Route: delegated writer.
- [ ] **T8** — Build-time generators for `sitemap.xml`, `robots.txt`,
      `manifest.webmanifest`. Route: delegated writer.
- [ ] **T9** — Worker entry serving static assets + the 2 API handlers.
      Route: delegated writer.
- [ ] **T10** — Move security headers to `public/_headers`; drop the
      `proxy.ts` nonce. Route: inline.
- [ ] **T11** — Cutover: remove Next/React/vinext/Tailwind deps, update
      CI, deploy scripts, and affected tests. Route: delegated writer.
- [ ] **T12** — Create skills via `skill-creator` for the workflows this
      migration establishes, and automate anything done more than twice.
      Register in `AGENTS.md`. Route: delegated writer.

## Carried-forward gaps (found reviewing T2, to resolve in T3/T4)

- **G1 (T3)** — `jsxImportSource` also requires a `jsx-dev-runtime` entry
  point. Bun emits `jsxDEV` in development; only `jsx`/`jsxs` exist today,
  so dev builds will fail until `src/html/jsx-dev-runtime.ts` re-exports
  them. Not a T2 defect — T2 was explicitly scoped to direct calls.
- **G2 (T4)** — The JSON-LD block is the site's only raw-HTML site
  (`app/layout.tsx:117-128`, the one `dangerouslySetInnerHTML`). Passing it
  through `raw()` MUST keep the existing
  `JSON.stringify(jsonLd).replace(/</g, "\\u003c")` treatment: inside a
  `<script>`, HTML entities are not decoded, so `escapeText` would corrupt
  the JSON while `</script>` in a string value would break out of the
  element. `raw()` does no escaping by design — the caller owns this.
- Verified non-issues: zero `style={{...}}` object props and zero other
  `dangerouslySetInnerHTML` in `app/`, so the runtime needs neither a
  style-object serializer nor a second raw-HTML path.

## Acceptance criteria

- `pnpm test` equivalent passes: `next build` replacement + all
  `tests/qa/*.test.mjs`.
- Playwright e2e suite passes.
- Zero runtime `dependencies` in `package.json`.
- Rendered HTML keeps the same metadata, JSON-LD, and security headers
  observable from outside.
- Lighthouse/bundle budget no worse than the current baseline
  (`tests/qa/bundle-budget.test.mjs`, `tests/qa/performance.test.mjs`).

## Applicable checks per task

`bun test` (new modules) · `node --test tests/qa/*.test.mjs` ·
`pnpm typecheck` · `pnpm lint` · `playwright test` (T7, T11) ·
real screenshot via `.claude/skills/cominorsa-run` (T3, T6, T7)

## Progress

- Branch `feat/bun-vanilla-migration` created off `16ef17b`.
- Feature document created and mirrored to Engram
  (`odd/bun-vanilla-migration/tasks`).
- **T2 complete and verified.** ~384 authored lines. Running slice total:
  ~384 of the ~400-line delivery budget.
- T0 and T1 remain blocked on the uncommitted-work decision. Asked; no
  confirmed answer recorded yet, so nothing of the user's has been
  committed, stashed, or reverted.

## Next step

Get an explicit decision on the ~613 uncommitted lines. Then T0/T1. T3 is
the next unblocked task and will resolve gap G1.
