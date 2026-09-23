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
- URL shape and origin must equal production (`https://cominorsa.com`,
  no trailing slash) — verify against the live site, not scripts.

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
      **CI part done in slice 3** (commit `e113ead`, route: delegated
      writer): `.github/workflows/ci.yml` now also triggers on
      `pull_request` targeting `feat/bun-vanilla-migration**` (kept
      `main`), installs Bun via `oven-sh/setup-bun@v2` (pinned major
      version), and runs `bun test src/` + `bun run build:static` after
      the existing Node test step. Pinned by new
      `tests/qa/ci-workflow.test.mjs` (6 tests). Strict TDD: RED (2
      pass / 4 fail — trigger glob, setup-bun step, and both Bun steps
      missing) → GREEN (6 pass, 0 fail). T1 itself stays open: the
      Bun toolchain adoption (`bunfig.toml`, lockfile) is still
      outstanding.
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
- [x] **T4** — Static `<head>`/metadata system replacing
      `generateMetadata`, `viewport`, and the JSON-LD block. Route:
      delegated writer. **DONE** — commit `4369132`.
      `src/build/document.tsx` now emits full parity with
      `app/layout.tsx`'s `generateMetadata`/`viewport` and
      `app/services-data.ts`'s `generateServiceMetadata`:
      `applicationName`, `theme-color`, complete Open Graph (type,
      url, title, description, image+width+height+alt, locale,
      site_name), Twitter card, favicon/apple-touch-icon/manifest
      links, and the JSON-LD block.
      Verified against the real merged head, not assumed: built Next
      (`pnpm build`) and rendered `/seguridad-minera` in-process via
      `tests/qa/helpers.mjs`'s `render()`. Discovered Next's
      out-of-order streaming metadata renders `<title>`/meta tags into
      a hidden `<div hidden><!--$--><div hidden>` in `<body>` that a
      client script moves into `<head>` at hydration — the naive
      `<head>` of that raw HTML response is incomplete; the real
      merged metadata is inside that hidden div. That diff confirmed:
      only `title`, `description`, and `alternates.canonical` are
      page-specific (per `generateServiceMetadata`); OG/Twitter/icons/
      theme-color/JSON-LD are identical on every route today (defined
      once at the root, never overridden per page) — so they're
      hardcoded constants in `document.tsx` rather than new
      `DocumentProps` fields.
      **G2 resolved**: new exported `jsonLdScript()` helper in
      `document.tsx` applies the exact
      `JSON.stringify(data).replace(/</g, "\\u003c")` treatment via
      `raw()`. Three new tests in `document.test.ts` prove a
      `</script>` inside a string value (a) never appears as the
      literal byte sequence `</script` in the output and (b)
      round-trips exactly through `JSON.parse` (proving the escaping
      is JSON-safe, not just HTML-safe — a plain text-escaper would
      corrupt the JSON).
      Strict TDD: RED (`bun test src/build/document.test.ts` →
      `Export named 'jsonLdScript' not found`, 0 pass / 1 fail) →
      GREEN (18 pass, 0 fail; 79 pass / 0 fail for full `bun test
      src/`).
      **Documented differences vs. the real Next output** (all
      intentional, not regressions):
      - Added `og:url` (the canonical URL) even though the current
        Next output omits it entirely — the task's own spec asks for
        it, it's a low-risk best-practice addition, and using the
        already-computed canonical URL costs nothing.
      - No `robots` meta tag: confirmed via grep that the current
        service pages set no `robots` field (only `app/not-found.tsx`
        does, out of scope here), so there's nothing to port.
      - `<link rel="manifest" href="/manifest.webmanifest">` is
        emitted, but the file itself doesn't exist in `dist-static/`
        yet (Next currently generates it at request time from
        `app/manifest.ts`) — that's T8's job. Until T8 ships, this
        link 404s in the static build; acceptable for a head/metadata
        task per the task's own scope.

      **Defect found and fixed (parent verification, same slice):**
      T4 originally hardcoded `SITE_URL = "https://cominorsa.com.pe"`
      in `document.tsx`, with a trailing-slash canonical
      (`/seguridad-minera/`). Root cause: that value was copied from
      `scripts/cloudflare-domain.sh` and from T3's pre-existing
      constant, neither of which was checked against the live site —
      `scripts/cloudflare-domain.sh` is stale. Parent verification
      caught it with live evidence: `curl
      https://cominorsa.com.pe/seguridad-minera` does not resolve
      (000/no route to host), while `curl -sL
      https://cominorsa.com/seguridad-minera` returns 200 with a live
      `<link rel="canonical" href="https://cominorsa.com/seguridad-minera">`
      (no trailing slash) — independently reproduced from this
      environment, and corroborated by `COMINORSA-COM-DOMAIN-SETUP.md`'s
      own header ("`cominorsa.com` SÍ está en producción... deployed
      as a Worker"). Fixed same-slice (commit `1e5632f`): extracted the
      origin into a single exported constant,
      `src/build/site-config.ts`'s `SITE_URL = "https://cominorsa.com"`,
      consumed by `document.tsx` (canonical, og:url, og:image,
      JSON-LD) and pinned by `site-config.test.ts` plus a
      `document.test.ts`/`build.test.ts` assertion that no emitted
      HTML ever contains `.com.pe`. Canonical/og:url paths dropped the
      trailing slash (`/seguridad-minera`, matching the live site
      exactly); `build.ts` now emits pages as flat `<slug>.html` files
      (e.g. `seguridad-minera.html`, not `seguridad-minera/index.html`)
      so Cloudflare's default `html_handling: "auto-trailing-slash"`
      serves the no-slash URL at 200 with zero redirects (verified
      against Cloudflare's own docs, not assumed — see `build.ts`'s
      module comment for the exact routing table). **Lesson**: a
      deploy/ops script is not production evidence; the live site is.
- [x] **T5** — Self-hosted woff2 fonts + hand-written `@font-face`,
      replacing `next/font/google`. Route: delegated writer. **DONE**
      — commit `03f8ba1`. New `src/build/fonts.css` self-hosts
      Archivo, Newsreader (italic), and Geist Mono, resolving the same
      `--font-display`/`--font-editorial`/`--font-mono` custom
      properties `app/globals.css` already consumes — zero CSS/token
      changes needed there, per the constraint.
      The three `.woff2` files under `public/fonts/` (with a README
      documenting source + OFL-1.1 license) are the exact "latin"
      subset `next/font/google` already downloads for this project —
      extracted from a real `pnpm build` run
      (`.vinext/fonts/*/*.woff2`), no network fetch needed. Only the
      Latin subset ships (dropped `vietnamese`/`latin-ext`/
      `cyrillic*`/`symbols2`, which next/font also ships but this
      100%-Spanish site would never select) — confirmed by diffing
      next/font's own generated `unicode-range` values against every
      character actually used.
      Discovery: Archivo and Newsreader are variable fonts — every
      weight next/font requests for a given subset points at the
      *identical* file (verified by diffing next/font's generated
      `style.css`), so one `font-weight: <min> <max>` range per
      family/style replaces next/font's five duplicate declarations of
      the same `src`. Geist Mono keeps a fixed weight (400 — the only
      one this site requests). Metric-matched `*-Fallback` @font-face
      rules (ascent/descent/line-gap/size-adjust) are copied verbatim
      from next/font's own generated CSS, preserving its
      swap-without-layout-shift behavior.
      `css.ts` gained an `external` build option
      (`buildCss(entry, outDir, { external: [...] })`): Bun's CSS
      bundler otherwise treats `url()` as a local-file import and
      fails to resolve a root-relative runtime path like
      `/fonts/x.woff2`; `fonts.css`'s build passes
      `external: ["/fonts/*"]` to leave those references untouched.
      `document.tsx` now requires `fontsCssHref`, links the built
      fonts stylesheet, and preloads only Archivo (the `body` font on
      every route, per T5's "preload only the critical font(s)")
      rather than all three the way next/font's default does —
      Newsreader is an italic accent font and Geist Mono only renders
      small labels, neither on the critical rendering path.
      Strict TDD, in commit order: `document.test.ts` fonts-link/
      preload tests RED (2 fail: no fonts stylesheet link, no preload
      found) → GREEN (20 pass). `css.test.ts` `external` option RED
      (`Could not resolve: "/fonts/x.woff2"`, 5 pass / 1 fail) → GREEN
      (6 pass). `build.test.ts` fonts-stylesheet-in-output RED
      (`fontsHref` undefined, 5 pass / 1 fail) → GREEN (7 pass; full
      `bun test src/`: 85 pass, 0 fail).
      Verification: real Playwright screenshots of the served
      `dist-static/` output (`Bun.serve` static server) at 1440px and
      390px against the live Next page (`vinext start`) — typography
      now matches exactly (Archivo headings/body, same weights/
      tracking); the only visible difference is Next's cookie-consent
      banner overlay (T7 leftover, unrelated, already documented).
- [x] **T6a** — Port the 5 remaining service pages, `/preguntas-frecuentes`,
      `/privacidad`, `/terminos` and `404.html`. Route: delegated writer
      (terminated by an API session limit after its code commits; parent
      finished verification and this doc update). **DONE** — `53a0a38`
      (shared route table + service data moved to `src/data/`, re-exported
      by `app/services-data.ts` so Next keeps working), `7404b8c`
      (FAQ/privacy/terms), `222eab4` (404, `noindex, follow`, no canonical).
      Parent verification: `bun test src/` → 129 pass, 0 fail;
      `pnpm typecheck` → 0; `pnpm lint` → 0 errors; `pnpm test` → 193/193;
      title/canonical/description/JSON-LD of all 9 pages identical to
      `https://cominorsa.com` (scripted diff, zero differences); only
      `https://cominorsa.com` URLs emitted; Playwright screenshots at
      1440/390 of FAQ, privacy, a service page and 404 (served with status
      404) render correctly. RED evidence for these units was not reported
      before the writer was cut off — recorded honestly as *not observed by
      the parent*.
- [x] **T6b** — Port the home page `/` (`app/page.tsx`, 335 lines,
      contains the consultation form). Route: delegated writer. **DONE**
      — `b0a75af` (shared consultation-form options), `4337d65` (static
      consultation form), `2234686` (home page + route wiring).
      Home page registered in `PAGE_ROUTES` with `slug: ""` (already
      mapped to `index.html` by `build.ts`'s `writePage`, since T4).
      Added `PageRoute.fullTitle` so the homepage keeps its real,
      brand-first production title
      (`"COMINORSA | Consultoría minera y ambiental"`) instead of every
      other route's `"<page> | COMINORSA"` suffix pattern — verified
      via `curl -sL https://cominorsa.com/` before writing any code:
      the root layout's `generateMetadata` sets no `alternates.canonical`
      and `app/page.tsx` exports no `generateMetadata` of its own, so
      production emits **no** `<link rel="canonical">` and **no**
      `og:url` for `/` at all (unlike every service page, which does
      set one via `generateServiceMetadata`). Matched exactly by
      omitting `canonicalPath` on the homepage route, the same way the
      404 route already does — confirmed both in the raw curl response
      and by checking where Next streams metadata into `<body>` (the
      `data-vinext-streamed-icon` block): the service-page fetch has a
      literal `<link rel="canonical">` right there; the homepage fetch
      goes straight from the manifest link to the relocator `<script>`
      with nothing in between.

      **Consultation form**: ported as a real, no-JS-baseline `<form>`
      (`src/build/consultation-form.tsx`) — same `name`s
      (`name`/`city`/`service`/`whatsapp`/`question`), `required`,
      `autocomplete`, `maxlength`/`minlength`, and the submit button
      starting `disabled` (matching the real component's own
      pre-hydration `disabled={!mounted}` state, not just a T7
      convenience). Service-of-interest options moved to
      `src/data/consultation-services.ts` (single source of truth;
      `app/ConsultationForm.tsx` now imports the same array instead of
      its own hand-copied list — same principle as T6a's
      `services-data.ts`/`faq.ts`). No inline `<script>`, no
      `onSubmit` — matches the T10 CSP plan (`script-src 'self'`).
      **T7 hooks left, documented in the module's own header comment**:
      `#consultation-form` (the `<form>` to bind to),
      `#consultation-form-submit` (submit button; T7 removes its
      `disabled` attribute once it attaches the submit handler),
      `#consultation-form-status` (the `aria-live="polite"` status
      paragraph T7 fills after building the wa.me link). Field `name`s
      match `app/ConsultationForm.tsx`'s `FormData` keys exactly so
      T7's submit handler can be ported near-verbatim.

      One JSX-runtime gotcha discovered while porting the address block:
      JSX text `&nbsp;` compiles to a literal U+00A0 character (not the
      string `"&nbsp;"`) under this runtime, same as under React/JSX in
      general — confirmed byte-for-byte identical to production's own
      output via `curl -sL https://cominorsa.com/` (two of four
      `"N.º"` occurrences in the raw HTML are U+00A0, matching our
      output; the other two, in the JSON-LD and legal-footer copy, use
      a plain space in both — same source, same output). Not a defect;
      the test's own initial expectation (literal `"&nbsp;"`) was wrong
      and was corrected to match.

      Strict TDD, in commit order:
      - `consultation-services` (`b0a75af`): RED
        `Cannot find module './consultation-services'` (0 pass / 1
        fail) → GREEN (4 pass).
      - `consultation-form` (`4337d65`): RED
        `Cannot find module './consultation-form'` (0 pass / 1 fail) →
        GREEN (9 pass).
      - `home-page` (`2234686`): RED
        `Cannot find module './home-page'` (0 pass / 1 fail) → GREEN
        (7 pass, after fixing the test's own `&nbsp;` assumption above).
      - `routes.ts` home-route wiring (`2234686`): RED — 3 failures
        (missing `""` slug, missing `fullTitle`, `route.render is not a
        function`) / 7 pass → GREEN (10 pass).
      - `build.ts` `fullTitle` support (`2234686`): RED reproduced
        *retroactively* (see note below) — reverting the `fullTitle ??`
        line and re-running `bun test src/build/build.test.ts` gave 11
        pass / 1 fail (`<title>Inicio | COMINORSA</title>` instead of
        the expected brand-first title) → re-applying the fix gave 12
        pass, 0 fail.
      - Combined `bun test src/`: **153 pass, 0 fail** (up from T6a's
        129).
      - **Process note (honest disclosure)**: the `build.ts`
        `fullTitle` line and the corresponding `build.test.ts`
        assertions were written in the wrong order — the source fix
        landed before the new test, so the first run was already
        green. Caught during this same task before commit: reverted
        the fix, reran to capture a genuine RED, then re-applied it.
        Recorded here so the RED/GREEN trail for that one unit is
        accurate rather than retrofitted after the fact.

      Verification (all observed): `bun test src/` → 153 pass, 0 fail.
      `pnpm typecheck` → exit 0. `pnpm lint` → 0 errors (7 pre-existing
      warnings, unchanged). `bun run build:static` → 11 files in
      `dist-static/*.html` including `index.html` and `404.html`.
      Scripted metadata diff (`title`, meta description, canonical,
      every `og:*`/`twitter:*`, `robots`, `application-name`,
      `theme-color`, and the full JSON-LD object) between
      `dist-static/index.html` and `https://cominorsa.com/`: **zero
      differences** on every field, including the JSON-LD object
      comparing deep-equal. `pnpm test` → 193/193 pass (Next build
      unaffected). Real Playwright screenshots of the served
      `dist-static/` homepage vs. the live site at 1440px and 390px:
      layout, spacing, colors, typography, and copy all match; the only
      difference is the live site's cookie-consent banner overlay (T7
      leftover, already documented, unrelated to this task).
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
- **G2 (T4) — RESOLVED.** The JSON-LD block is the site's only raw-HTML
  site (`app/layout.tsx:117-128`, the one `dangerouslySetInnerHTML`).
  Passing it through `raw()` keeps the existing
  `JSON.stringify(jsonLd).replace(/</g, "\\u003c")` treatment: inside a
  `<script>`, HTML entities are not decoded, so `escapeText` would corrupt
  the JSON while `</script>` in a string value would break out of the
  element. `raw()` does no escaping by design — the caller owns this.
  Fixed in T4 (commit `4369132`): `src/build/document.tsx` exports
  `jsonLdScript(data)`, applying exactly that treatment. Three dedicated
  tests prove a `</script>` inside a string value neither breaks out of
  the element nor corrupts the JSON (round-trips through `JSON.parse`).
- Verified non-issues: zero `style={{...}}` object props and zero other
  `dangerouslySetInnerHTML` in `app/`, so the runtime needs neither a
  style-object serializer nor a second raw-HTML path.

## Carried-forward gaps (found in T3, to resolve in T4/T5/T7/T11)

- **T4 leftover — RESOLVED in slice 3** (commit `4369132`). Full
  `<head>` parity now shipped; see T4 above for detail and documented
  differences.
- **T5 leftover — RESOLVED in slice 3** (commit `03f8ba1`).
  Self-hosted Archivo/Newsreader/Geist Mono now ship; see T5 above for
  detail.
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
  - **T6b leftover**: `src/build/consultation-form.tsx` (the homepage
    consultation form) has no submit behavior — it's real,
    server-rendered `<form>` markup only, matching the real component's
    own pre-hydration state (submit button starts `disabled`). T7 needs
    to port `app/ConsultationForm.tsx`'s `handleSubmit`: build the
    `wa.me` URL from `FormData`, fire-and-forget `POST /api/crm-lead`,
    and enable the submit button + fill the status paragraph once
    bound. Hooks already in place (documented in that module's header
    comment): `#consultation-form`, `#consultation-form-submit`,
    `#consultation-form-status`; field `name`s match
    `app/ConsultationForm.tsx`'s `FormData` keys exactly.

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

- **Slice 3 complete** on branch `feat/bun-vanilla-migration-t4`
  (based on `feat/bun-vanilla-migration-t3`): T1's CI part, T4, and T5,
  each its own work-unit commit, route: delegated writer throughout.
  - `e113ead` — ci: run on migration-chain PRs and add Bun test/build
    steps.
  - `4369132` — feat(static-build): full `<head>` metadata parity,
    resolving G2.
  - `03f8ba1` — feat(static-build): self-host Archivo/Newsreader/Geist
    Mono, drop next/font.
  - `1e5632f` — fix(static-build): correct production origin and URL
    shape (defect found by parent verification against the live site;
    see T4's "Defect found and fixed" note above for detail).
  - Authored line count (`git diff --stat
    feat/bun-vanilla-migration-t3..HEAD`, font binaries excluded):
    863 insertions + 66 deletions = **929 lines** across 13 files
    (182+/24- of which is this feature document; code+tests alone are
    ~681+/42-) — over the ~400-line advisory heuristic; not split
    artificially, kept as four commits (CI / metadata / fonts / origin
    fix) that are each independently coherent and already the
    smallest reviewable units.
  - Verification (all observed, not assumed), after the fix: `bun
    test src/` → 89 pass, 0 fail. `pnpm typecheck` → exit 0. `pnpm
    lint` → 0 errors (7 pre-existing warnings, unchanged). `bun run
    build:static` → `dist-static/seguridad-minera.html` (flat file,
    no trailing-slash folder) + hashed `assets/globals-*.css` +
    `assets/fonts-*.css` + copied `public/fonts/*.woff2` + rest of
    `public/`. `grep -o 'https://[^"]*' dist-static/seguridad-minera.html
    | sort -u` → only `cominorsa.com`/`cominorsa.com/og.png`/
    `cominorsa.com/seguridad-minera` (+ `schema.org`, `wa.me/...`) —
    zero `.com.pe`. `pnpm test` → 190/190 pass (includes the new
    `tests/qa/ci-workflow.test.mjs`). Real Playwright screenshots of
    the served `dist-static/` output (a throwaway `Bun.serve` static
    server, pre-fix trailing-slash mapping) at 1440px and 390px
    against the live Next page (`vinext start`): layout, spacing,
    colors, and typography all match; documented remaining
    differences are T7's cookie-consent banner/widget gaps (unrelated
    to this slice) and the manifest-file gap (T8) noted under T4
    above. Screenshots were taken before the origin/URL-shape fix and
    not re-captured after it (the fix is metadata/routing-only, not
    visual — nothing in the rendered page's visible content changed).
  - Running slice total: ~384 (T2) + ~846 (T3) + 929 (slice 3,
    including this doc) ≈ 2,159 of the ~2,400-line forecast.
  - Push/PR of `feat/bun-vanilla-migration-t4` into the feature branch
    is the user's decision (branch-chain strategy).

- **T6b complete and verified** on branch `feat/bun-vanilla-migration-t6b`
  (based on `feat/bun-vanilla-migration-t6a`): `b0a75af` (shared
  consultation-form data), `4337d65` (static consultation form),
  `2234686` (home page + route/build wiring), route: delegated writer
  throughout. Authored line count
  (`git diff --shortstat feat/bun-vanilla-migration-t6a...HEAD`):
  **746 insertions, 32 deletions across 11 files** — over the
  ~400-line advisory heuristic; not split artificially (the
  consultation-form data move, the static form, and the home page are
  each their own commit, but the home page and the form it embeds are
  one coherent, mutually-dependent unit, and the metadata/route-table
  wiring is inseparable from registering the page itself). See T6b
  above for full RED/GREEN evidence, the metadata-parity diff (zero
  differences vs. production), and screenshot comparison.

- Push/PR of `feat/bun-vanilla-migration-t6b` into the feature branch
  is the user's decision (branch-chain strategy).

## Carried to the polish phase (after cutover)

- Home `/` has **no canonical and no `og:url`** in production (root
  layout sets no `alternates.canonical`). Kept for parity in T6b; add
  `https://cominorsa.com/` canonical + `og:url` in the polish pass.

- `404` copy uses Rioplatense voseo ("buscás", "llegaste acá",
  "avisanos") — same as production today, kept for parity; normalize to
  neutral Spanish for a Peruvian audience in the polish pass.
- `404.html` needs `not_found_handling: "404-page"` in T9's Worker config.

## Next step

T7 (rewrite the 4 interactive widgets as vanilla ES modules —
including the consultation form's submit behavior, see the T6b
leftover note above).
