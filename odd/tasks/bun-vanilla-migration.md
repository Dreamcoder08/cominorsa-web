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
- **Delivery strategy**: `ask-on-risk`. Chain strategy:
  **`feature-branch-chain`** (user choice, 2026-09-22) — every slice PR
  targets `feat/bun-vanilla-migration`; `main` receives the whole
  migration only at the T11 cutover, so Next.js keeps serving until then.
- **Forecast**: ~2,400 authored changed lines → ~6 slices at the ~400-line
  delivery budget.
- **Skills resolved by registry** (`.atl/skill-registry.md`):
  `work-unit-commits`, `chained-pr`, `skill-creator`.

## Blocker (resolved)

The ~613 uncommitted lines on `main` were committed there (`519e8fb`..
`e4e18bb`) and merged into this branch before T0. No longer blocking.

## Tasks

- [x] **T0** — Delete dead Drizzle/D1 scaffolding (`db/`, `drizzle/`,
      `drizzle.config.ts`, the `drizzle-orm` dep). Route: inline. **DONE**
      — commit `36060e7`.
- [ ] **T1** — Adopt Bun toolchain (`bunfig.toml`, lockfile, scripts)
      without breaking `node --test` or the pre-commit `pnpm validate`
      hook. Route: inline. Partial: `pnpm verify` gate (typecheck +
      `bun test src/` + `pnpm test`) pinned by
      `tests/qa/verify-script.test.mjs` (3 pass).
- [x] **T2** — Hand-written `jsx-runtime` rendering JSX to escaped HTML
      strings, with unit tests. Security-critical (XSS via attribute and
      text escaping). Route: delegated writer. **DONE** — `src/html/jsx-runtime.ts`
      (128 lines) + `src/html/jsx-runtime.test.ts` (35 tests / 49 assertions).
      Strict TDD observed: RED (`Cannot find module './jsx-runtime'`, 0 pass
      1 fail) → GREEN (35 pass, 0 fail). Parent spot check re-ran
      `bun test src/html/jsx-runtime.test.ts` → 35 pass.
      `bunx tsc --noEmit src/html/jsx-runtime.ts` → exit 0.
- [x] **T3** — `Bun.build` pipeline emitting one page end-to-end
      (`seguridad-minera`, 13 lines) with hashed CSS, verified against the
      existing QA suite. Route: delegated writer. **DONE** —
      `src/build/{build,css,document,service-page,site-shell,site-data}.{ts,tsx}`
      + matching `*.test.ts` (34 new tests / 55 assertions across 6 files) +
      `src/html/jsx-dev-runtime.ts` resolving G1. Output: `dist-static/`
      (new, gitignored, no collision with Next's `dist/`).
      Commits: `9fe50b1` (G1) and `b9a1ff1` (T3 pipeline).
      Strict TDD observed per unit — RED then GREEN, in commit order:
      G1 (`jsx-dev-runtime`): RED `Cannot find module
      './jsx-dev-runtime' ... 0 pass 1 fail` → GREEN 5 pass. `document`:
      RED `Cannot find module './document' ... 0 pass 1 fail` → GREEN 9
      pass. `site-shell`: RED `Cannot find module './site-shell' ... 0
      pass 1 fail` → GREEN 7 pass. `service-page`: RED `Cannot find
      module './service-page' ... 0 pass 1 fail` → GREEN 6 pass. `css`:
      RED `Cannot find module './css' ... 0 pass 1 fail` → GREEN 4 pass.
      `build`: RED `Cannot find module './build' ... 0 pass 1 fail` →
      GREEN 4 pass. Combined `bun test src/`: 70 pass, 0 fail (includes
      T2's 35 + G1's 5 + T3's 30).
      Design choice (JSX coexistence): no scoped tsconfig. Every new
      `.tsx` under `src/` carries a per-file
      `/** @jsxImportSource ../html */` pragma; root `tsconfig.json`
      keeps `jsx: "react-jsx"` for Next unchanged. Empirically verified
      with a throwaway probe file against the real project tsconfig
      (`bunx tsc --noEmit -p <probe extending tsconfig.json>` → exit 0)
      before writing any page code — TS's react-jsx mode natively
      supports per-file import-source overrides via this pragma, so no
      new tsconfig, no build-config duplication.
      CSS hashing: `Bun.build({ naming: "[name]-[hash].[ext]" })`'s own
      content hash, not a separate `Bun.CryptoHasher` pass — empirically
      verified deterministic (same content → same hash across runs,
      hash unaffected by comment-only edits since minify strips
      comments before hashing) and content-sensitive (a real value
      change → a different hash).
      `app/globals.css`'s `@import "tailwindcss";` still resolves
      through Bun's bundler (inlines the Tailwind package's own
      preflight/theme CSS) but Bun's CSS parser doesn't understand
      Tailwind v4's `@theme`/`@tailwind` at-rules — non-fatal warnings,
      passed through verbatim in the output. Not a regression (no
      Tailwind utility classes are used anywhere in this page's
      component tree — verified by grep); full removal is T11.
      Verification: `bun test src/` 70/70 pass · `pnpm typecheck` exit 0
      · `pnpm lint` 1 pre-existing error unchanged from baseline HEAD
      (T2's `namespace JSX`, confirmed via `git stash` diff — not
      introduced here) · `pnpm run build:static` produces
      `dist-static/seguridad-minera/index.html` + hashed CSS + copied
      `public/` assets · `pnpm test` 184/184 pass (Next build
      unaffected) · real Playwright screenshot of the served
      `dist-static/` output, compared side-by-side against the current
      Next page: layout/spacing/colors/copy match; the only differences
      are the documented T5 (fallback serif/sans instead of self-hosted
      Archivo/Newsreader) and T7 (no cookie-consent banner yet) gaps.
      Route confirmed: delegated writer.
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

- **G1 (T3) — RESOLVED.** `jsxImportSource` also requires a
  `jsx-dev-runtime` entry point. Bun emits `jsxDEV` in development; only
  `jsx`/`jsxs` existed after T2, so dev builds would have failed until
  `src/html/jsx-dev-runtime.ts` re-exported them. Fixed in T3:
  `jsxDEV(type, props, key, isStaticChildren, source, self)` delegates
  to `jsx(type, props, key)`, discarding the three dev-only debug
  params the same way `jsx`/`jsxs` already discard `key`. RED → GREEN
  evidence under T3 above.
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

## Carried-forward gaps (found in T3, to resolve in T4/T5/T7/T11)

- **T4 leftover** — `src/build/document.tsx`'s `<head>` is deliberately
  minimal (charset, viewport, title, description, canonical,
  stylesheet). Still missing, and needed for parity with
  `app/layout.tsx`'s `generateMetadata`: OG/Twitter tags, favicon/icon
  links, `theme-color`, `applicationName`, and the JSON-LD block (G2,
  needs `raw()` with the exact escaping treatment above).
- **T5 leftover** — No self-hosted fonts yet. The static page falls
  back to the browser's default serif/sans stack instead of
  Archivo/Newsreader/Geist Mono; confirmed visually in the T3
  screenshot comparison (headings render in a generic serif, not
  Newsreader italic).
- **T7 leftovers, all confirmed present in `src/build/site-shell.tsx`**:
  - `MobileNavStatic` renders the closed-state DOM of `app/MobileNav.tsx`
    (`aria-expanded="false"`, `data-open="false"`, `inert`) with no
    open/close behavior, no focus trap, no Escape handling.
  - `CookiePreferencesButtonStatic` renders the button with no
    click handler (would need `window.localStorage` + reload).
  - The cookie-consent banner itself (`app/CookieConsent.tsx`,
    rendered by `app/layout.tsx` as a sibling of `<main>`, not by
    `ServicePageLayout`) is not rendered at all yet in the static
    build — confirmed by the T3 screenshot diff (Next shows the
    Aceptar/Rechazar banner; the static build doesn't). It's
    `useSyncExternalStore`-driven and meaningless without JS, so this
    was scoped out of T3 rather than ported as dead markup; T7 needs to
    decide whether it becomes inline-visible-by-default markup or a
    template injected by the widget's own script.
  - GA4 script injection (also in `CookieConsent.tsx`, gated on
    `consent === "granted"`) has no static-build equivalent yet —
    expected, since it's conditional client behavior.

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
- T0 done (`36060e7`); blocker resolved.
- Slice 1 = T0 + T2 + `verify` gate → PR into the feature branch.
- **T3 complete and verified**, resolving G1. ~846 authored lines
  (`git diff --stat feat/bun-vanilla-migration..HEAD`) — over the
  ~400-line advisory heuristic; not split artificially, since it's one
  coherent unit (build pipeline + ported components + G1 + full
  strict-TDD coverage for a page the QA suite doesn't otherwise touch).
  Running slice total: ~384 (T2) + ~846 (T3) ≈ 1,230 of the ~2,400-line
  forecast. Branch `feat/bun-vanilla-migration-t3` carries commits for
  G1, the T3 build pipeline, and this doc update — not yet merged into
  `feat/bun-vanilla-migration` (that merge/PR decision belongs to the
  orchestrator/user per `feature-branch-chain`).

- Parent review of T3: spot check `bun test src/` → 70 pass, 0 fail;
  screenshot of `dist-static/seguridad-minera/` matches the Next page
  except fonts (T5) and the cookie banner (T7). Fixed the one lint
  error T2 left (`no-namespace` on the `JSX` namespace that
  `jsxImportSource` requires) in `26d6261`; `pnpm lint` → 0 errors.
- Slice 2 (`feat/bun-vanilla-migration-t3`) = T3 + G1, ~846 authored
  lines — over the ~400 advisory budget as one coherent unit. RDD is off
  for this clone, so no native review. Push/PR into the feature branch
  is the user's decision.

## Next step

T4 (static `<head>`/metadata system: OG/Twitter tags, favicon/icon
links, `theme-color`, `applicationName`, and the JSON-LD block per gap
G2's exact escaping requirement) — see "Carried-forward gaps (found in
T3...)" above for the full list this leaves open, including the T5
font gap and the T7 widget/cookie-banner gaps confirmed by the T3
screenshot comparison.
