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
- [x] **T7** — Rewrite the 4 interactive widgets as vanilla ES modules
      with progressive enhancement. Route: delegated writer. **DONE**
      — `4829da1` (pure logic + `src/build/js.ts`), `73a034a` (DOM
      wiring + document/build/site-shell integration), `4327b92`
      (e2e coverage).

      **Architecture**: `src/client/lib/` holds DOM-free pure logic
      (`whatsapp-message.ts`, `crm-lead-payload.ts`, `consent-storage.ts`,
      `focus-trap.ts`), each unit-tested with `bun test`.
      `src/client/dom/` holds DOM wiring (`mobile-nav.ts`,
      `consultation-form.ts`, `cookie-consent.ts`, `ga4.ts`), covered by
      Playwright e2e against the built static site instead (no DOM-free
      unit tests for these — that's the split the task asked for).
      `src/client/entries/` has one thin bundle entry per concern
      (`mobile-nav-entry.ts`, `consultation-form-entry.ts`,
      `consent-entry.ts`) that just calls its `init*()` — module scripts
      are deferred by the HTML spec, so no `DOMContentLoaded` wrapper is
      needed. `src/build/js.ts` wraps `Bun.build` the same way T5's
      `css.ts` does (`naming: "[name]-[hash].[ext]"` for a stable,
      content-sensitive hash), adding `format: "esm"`, `target:
      "browser"`, and a `define` option so `build.ts` can bake
      `NEXT_PUBLIC_GA_MEASUREMENT_ID` into the bundle at build time (a
      browser bundle has no `process.env` at runtime). `document.tsx`
      gained an optional `scriptSrcs` prop rendering one
      `<script type="module" src="..." defer></script>` per entry right
      before `</body>` — no inline `<script>` anywhere (T10's CSP will
      be `script-src 'self'` plus whatever GA4 needs, which a
      `src`-based module script satisfies with zero nonce/hash
      bookkeeping). Every route (all render `SiteHeader`/`SiteFooter`)
      links `mobile-nav` + `consent`; only the homepage additionally
      links `consultation-form` (only page with `#consultation-form`).

      **Consultation form** (`src/client/dom/consultation-form.ts`):
      ports `app/ConsultationForm.tsx`'s `handleSubmit` verbatim —
      builds the same message template and `wa.me` URL
      (`selectWhatsAppRecipient`/`buildConsultationMessage`/
      `buildWhatsAppUrl`), sets the same inert `dataset.event`/
      `dataset.eventContext` markers (openspec
      `analytics-event-attributes`: inert, never dispatched, same as
      today), calls `window.open` synchronously, then fires the
      non-blocking `POST /api/crm-lead` with `.catch(() => {})` — the
      WhatsApp open never awaits it. The static submit button starts
      `disabled` (T6b); this script enables it only once it has
      actually attached the submit listener, closing the same
      pre-hydration race `disabled={!mounted}` closes in the React
      version. Native HTML5 `required`/`minlength`/`maxlength` on the
      real `<form>` (T6b) blocks invalid submissions before this
      script's `submit` listener ever runs — verified in e2e, not
      assumed.

      **Mobile nav** (`src/client/dom/mobile-nav.ts` +
      `src/client/lib/focus-trap.ts`): ports `app/MobileNav.tsx`'s
      `useState`/`useEffect` pair — toggles `aria-expanded`/
      `aria-label`/`data-open`/`inert` on click, locks body scroll with
      the same scrollbar-width compensation, moves focus to the first
      panel link on open, Escape closes and refocuses the toggle, Tab
      traps forward/backward at the panel boundaries (index math in
      `computeFocusTrapTarget`, the one part worth a DOM-free unit
      test), and closes on nav-link click. Added one behavior beyond
      the React version, asked for by the task: closes on resize past
      the desktop breakpoint (`app/globals.css`'s `@media (max-width:
      820px)`, mirrored as `matchMedia("(min-width: 821px)")`) — a
      robustness improvement, not a regression, documented in the
      module's own header comment.

      **Cookie consent** (`src/client/dom/cookie-consent.ts` +
      `src/client/dom/ga4.ts` + `src/client/lib/consent-storage.ts`):
      reads/writes the exact same `localStorage` key and two string
      values (`app/constants.ts`'s `COOKIE_CONSENT_STORAGE_KEY`,
      `"granted"`/`"denied"`) as `app/CookieConsent.tsx`, so a
      returning visitor's pre-cutover choice keeps working with zero
      migration. **Design choice (justified per the task's own
      instruction)**: the banner is NOT server-rendered hidden markup —
      it's created and appended to `<body>` by this script, only when
      there's an actual undecided choice (`consent === null`). Without
      JS, no GA4 script can load at all, so there's nothing to consent
      to and no reason to ship banner markup (or the `has-cookie-banner`
      body-class toggle) to a no-JS visitor. GA4 loads only on an
      explicit "granted" decision — never eagerly, never on "denied" —
      via `ga4.ts`, gated behind the same env-derived
      `GA_MEASUREMENT_ID` the React version reads. The footer
      `#cookie-preferences-button` (new hook id on
      `site-shell.tsx`'s `CookiePreferencesButtonStatic`, `73a034a`)
      clears storage and reloads — identical to
      `app/CookiePreferencesButton.tsx` today, and the simplest way to
      fully reset (a GA4 script already loaded this page load can't be
      meaningfully "unloaded" without one).

      **Strict TDD, bun-test units (RED → GREEN, in commit order,**
      `4829da1`**)**:
      - `whatsapp-message`: RED `Cannot find module
        './whatsapp-message'` (0 pass / 1 fail) → GREEN (5 pass).
      - `crm-lead-payload`: RED `Cannot find module
        './crm-lead-payload'` (0 pass / 1 fail) → GREEN (2 pass).
      - `consent-storage`: RED `Cannot find module './consent-storage'`
        (0 pass / 1 fail) → GREEN (2 pass).
      - `focus-trap`: RED `Cannot find module './focus-trap'` (0 pass /
        1 fail) → GREEN (8 pass).
      - `js.ts` (the JS bundler, analogous to T5's `css.ts`): RED
        `Cannot find module './js'` (0 pass / 1 fail) → GREEN (6 pass).
      - Combined `bun test src/` after this commit: 176 pass, 0 fail
        (up from T6b's 153).

      **Strict TDD, integration units (RED → GREEN, in commit order,**
      `73a034a`**)**:
      - `site-shell.test.ts` `#cookie-preferences-button` hook: RED (6
        pass / 1 fail — button had no id) → GREEN (7 pass).
      - `document.test.ts` `scriptSrcs`: RED (28 pass / 1 fail — no
        `<script type="module" src=...>` emitted for a given
        `scriptSrcs` array) → GREEN (29 pass).
      - `build.test.ts` (3 new tests — mobile-nav/consent on every
        route, consultation-form homepage-only, zero inline scripts
        anywhere): RED (13 pass / 2 fail) → GREEN (15 pass).
      - Combined `bun test src/` after this commit: 182 pass, 0 fail.
      - No DOM-free `bun test` was written for `src/client/dom/*.ts` or
        `src/client/entries/*.ts` by design (task instruction: "DOM
        wiring tested with Playwright e2e"); consequently no separate
        RED/GREEN was captured for those files at the bun-test layer.
        **Honest disclosure**: e2e specs for these were written after
        the DOM-wiring implementation already existed (same commit as
        the wiring — `73a034a`/`4327b92` — not before it), so no
        genuine pre-implementation RED was observed for the e2e layer
        either. This is a deviation from strict TDD's letter for the
        DOM-wiring modules specifically (the pure-logic and
        build-pipeline units above do have real RED→GREEN evidence).

      **Verification (all observed)**: `bun test src/` → 182 pass, 0
      fail. `pnpm typecheck` → exit 0 (after fixing a real type error —
      see gotcha below). `pnpm lint` → 0 errors, 7 pre-existing
      warnings unchanged (one new `@next/next/no-sync-scripts` error on
      the `<script type="module">` tag was fixed by adding an explicit
      `defer` attribute — redundant on a module script per the HTML
      spec, but that ESLint rule doesn't special-case `type="module"`).
      **Second real defect found and fixed (parent verification, same
      slice)**: `pnpm lint`'s own script only ignored `dist`/`.next`,
      not `dist-static` — harmless before T7 (that directory held only
      `.html`/`.css`/font/image output, nothing ESLint parses as JS),
      but T7's minified `.js` bundles under `dist-static/assets/` are
      real JavaScript, so ESLint started linting the *minified build
      output* itself once it existed, surfacing 16 bogus warnings
      (single-letter minified variable names, comma-expression
      statements — meaningless in generated code). Fixed by adding
      `--ignore-pattern dist-static` to `package.json`'s `lint` script,
      the same treatment `dist` already gets. `pnpm test` → 193/193
      pass (Next build unaffected).
      `bun run build:static` → 11 pages, JS emitted:
      `mobile-nav-entry-*.js` 1428 B raw / 794 B gzip,
      `consultation-form-entry-*.js` 1570 B raw / 874 B gzip,
      `consent-entry-*.js` 1918 B raw / 955 B gzip — **4916 B raw / ~2.6
      KB gzip total across all 3** (homepage loads all 3 = 4916 B raw;
      every other page loads 2 = 3346 B raw), versus the Next build's
      600 KB JS budget (`tests/qa/bundle-budget.test.mjs`,
      `performance.test.mjs`) — roughly 3 orders of magnitude smaller.
      `grep -c "<script>" dist-static/*.html` → `0` on all 11 pages (no
      inline scripts); every page separately carries exactly one
      `<script type="application/ld+json">` (data, not code, reported
      separately per the task's own instruction).

      **Playwright e2e** (`4327b92`, `tests/e2e/static-{mobile-nav,
      cookie-consent,consultation-form}.spec.ts`, all importing
      `guarded-test.ts`): served `dist-static/` with a throwaway
      `Bun.serve` static file server on port 4317
      (content-type correctly inferred per extension — verified
      `text/javascript;charset=utf-8` for the `.js` bundles, required
      for the browser to execute them as modules) and ran
      `PLAYWRIGHT_BASE_URL=http://localhost:4317 pnpm exec playwright
      test`. **46/46 pass** across both configured projects (chromium +
      mobile-chromium), including the 3 new static-* spec files (16
      tests × single-project; 32 across both projects) AND the
      pre-existing `tests/e2e/consultation-form.spec.ts` and
      `provider-isolation.spec.ts` running unmodified against the
      static build — the same React-targeting assertions
      (`.consultation-form button[type="submit"]`, `a.header-cta`)
      pass identically against the vanilla output, real behavioral
      parity, not just matching markup.
      New coverage: mobile-nav open/focus, Escape+refocus, forward/
      backward Tab trap, link-click-closes, resize-to-desktop-closes
      (all at a 390px viewport); consent banner shown with zero GA4
      request before any decision, GA4 actually requested after
      "Aceptar" (captured via Playwright's `request` event — fires even
      for a request `guarded-test.ts`'s context route then aborts,
      since every non-loopback host is blocked there regardless of
      method, so this never lets a real request reach Google), zero
      GA4 request after "Rechazar", both decisions surviving a reload,
      and the footer preferences button clearing storage + reopening
      the banner. Ran the GA4-accept-path tests against a build made
      with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TESTID123 bun run
      build:static` (the repo's real `.env` value is invisible to this
      sandbox) — otherwise `GA_MEASUREMENT_ID` bakes to `""` and the
      "granted" branch never calls `loadGa4` at all, same as production
      with the variable unset; the final `dist-static/` left behind was
      rebuilt with the real (empty, in this sandbox) env afterward.

      Screenshots at 390px (real Playwright, not assumed) —
      `.claude/skills/cominorsa-run`'s pattern, saved to the session
      scratchpad's `t7/` folder: mobile nav open (shows the full-screen
      panel plus the consent banner, both widgets coexisting
      correctly), the consent banner alone (Aceptar/Rechazar, matches
      the React version's copy verbatim), and the consultation form
      after a blocked native-validation submit (browser auto-focused
      the first empty required field — proof the native `required`
      gate, not this script, is what blocks an empty submission).

      **Gotcha (real, not hypothetical)**: `worker-configuration.d.ts`
      (wrangler's generated Cloudflare Workers types, included
      project-wide by `tsconfig.json`) globally declares its own
      `interface Element` for the HTMLRewriter API
      (`append(content: string | ReadableStream | Response,
      options?)`), which TypeScript merges with — and effectively
      shadows — lib.dom's `ParentNode.append` on every DOM `Element` in
      the whole project, not just Worker code. `pnpm typecheck` caught
      3 real errors in `cookie-consent.ts`'s original `.append(...)`
      calls (`HTMLAnchorElement`/`HTMLButtonElement`/
      `HTMLParagraphElement` not assignable to `string | ReadableStream
      | Response`). Fixed by using `appendChild`/`createTextNode`
      instead, which aren't part of the merged interface. Worth
      remembering for any future DOM-building code in this repo.

      **Left for later tasks** (not T7's scope): T9 must route
      `/api/crm-lead` for the Worker to serve it (unchanged contract —
      same path, method, JSON body shape as today). T10 must set the
      final CSP (`script-src 'self'` plus GA4's required hosts,
      `https://www.googletagmanager.com` and
      `https://*.google-analytics.com` per GA4's own docs) — this task
      assumed but did not configure that CSP. No new e2e coverage was
      added for the WhatsApp CTA `data-event`/`data-event-context`
      markers' inertness beyond what already existed (openspec
      `analytics-event-attributes` already covers that they're
      inert; T7 doesn't change that contract, only the consultation
      form's own inert marker, which now has an e2e-observed source
      (this script) instead of only React's).
- [x] **T8** — Build-time generators for `sitemap.xml`, `robots.txt`,
      `manifest.webmanifest`. Route: delegated writer. **DONE** —
      `96f883b`. `src/build/sitemap.ts`/`robots.ts`/`webmanifest.ts`,
      each a pure function reused by `build.ts`'s `writeGeneratedFiles`,
      built from `routes.ts`'s `PAGE_ROUTES` (sitemap) or `site-config.ts`
      constants (robots/manifest) — no second hand-listed route table.
      `lastmod`: production's `app/sitemap.ts` calls `new Date()` per
      request; a build-time equivalent of that is non-reproducible, so
      `site-config.ts`'s new `SITEMAP_LAST_MODIFIED` is a fixed ISO
      constant instead (overridable via the `SITEMAP_LAST_MODIFIED` env
      var, e.g. for a CI step to pass a commit date, without touching
      source). Verified byte-for-byte against the live production
      responses (`curl -s https://cominorsa.com/{sitemap.xml,robots.txt,
      manifest.webmanifest}`, 2026-09-22): **zero differences** on
      `robots.txt` and `manifest.webmanifest`; `sitemap.xml` identical on
      every field except `lastmod` (documented, intentional). `robots.txt`
      keeps `Disallow: /_next/` for byte-for-byte parity even though this
      build has no such path — flagged below for T11 to drop once Next is
      actually gone.
      Strict TDD, in commit order: `sitemap.test.ts` RED (`Cannot find
      module './sitemap'`, 0 pass/1 fail) → GREEN (3 pass). `robots.test.ts`
      RED (same shape) → GREEN (1 pass). `webmanifest.test.ts` RED → GREEN
      (2 pass). `site-config.test.ts`'s new `SITEMAP_LAST_MODIFIED`
      describe block RED (`Export named 'SITEMAP_LAST_MODIFIED' not
      found`) → GREEN. `build.test.ts`'s 2 new wiring tests RED (15 pass/2
      fail — `ENOENT` on `sitemap.xml`; `_headers` picked up the stale
      copied `public/_headers` instead) → GREEN (17 pass) once `build.ts`
      wired `writeGeneratedFiles` in and `copyPublicAssets` stopped
      copying `public/_headers` into `dist-static/`.
- [x] **T9** — Worker entry serving static assets + the 2 API handlers.
      Route: delegated writer. **DONE** — `dd745d2`.
      `wrangler.static.jsonc` (Static Assets from `dist-static/`,
      `html_handling: "auto-trailing-slash"`, `not_found_handling:
      "404-page"`, `run_worker_first: ["/api/*"]`) + `src/worker/index.ts`.
      Deliberately a DISTINCT Worker name (`cominorsa-web-static`) and
      config file from production (`cominorsa-web` /
      `dist/server/wrangler.json`) so nothing on this branch can ever
      deploy over it; same `compatibility_date` (`2026-08-31`) as
      production's currently-generated config.
      Both API handlers (`app/api/crm-lead/route.ts`,
      `app/api/next-business-day/route.ts`) are imported and reused
      VERBATIM, not copied — confirmed by reading their source (zero
      imports in either file, plain `Request`/`Response` only) and by
      `tests/qa/crm-lead-route.test.mjs` already importing
      `app/api/crm-lead/route.ts` directly with no Next.js runtime
      involved. No move into `src/` was needed (the task's own fallback
      plan), since importing them dragged in nothing Next-specific — same
      env var names (`TWENTY_API_KEY`, `TWENTY_API_URL`,
      `RESEND_API_KEY`), read via `process.env`, available under this
      config's `nodejs_compat` flag same as production.
      `src/worker/security-headers.ts`'s `applySecurityHeaders` wraps
      both API responses with T10's policy (see T10 below) — Cloudflare's
      `_headers` file is never applied to a Worker-script response, so
      without this the 2 API routes would ship with zero security headers
      once `dist-static/_headers` is the only other source of them, a
      regression from today (`proxy.ts`'s matcher already covers `/api/*`).
      `Env.ASSETS` is typed narrowly (`{ fetch(request): Promise<Response>
      }`), not the ambient `Fetcher` interface — that one also requires an
      unused `connect()` TCP-socket method, which only complicated test
      mocking for no behavioral benefit.
      Strict TDD, in commit order: `security-headers.test.ts` RED
      (`Cannot find module './security-headers'`) → GREEN (3 pass).
      `index.test.ts` RED (`Cannot find module './index'`) → GREEN (5
      pass; 2 real `pnpm typecheck` errors found and fixed in the same
      slice — see gotcha below).
      **Gotcha (real, not hypothetical)**: this project's global
      `Response`/`Body` types (from `worker-configuration.d.ts` /
      `@types/bun`, both included project-wide) type `.json()` as
      returning `unknown`, not DOM's `Promise<any>` — `pnpm typecheck`
      caught 2 real errors on unchecked property access
      (`body.date`)/`toEqual` overload mismatches in the new tests. Fixed
      by casting the awaited `.json()` result to an explicit local type at
      each call site (`(await response.json()) as { date: string }`, one
      already-known-shape assertion, not an `any` escape hatch).
      Verification (all observed): `bun test src/` → 212 pass, 0 fail
      (from T8's 208 — the 4 new worker tests plus 3 from
      `security-headers.test.ts`, minus overlap already counted). `pnpm
      typecheck` → exit 0. `pnpm lint` → 0 errors, 7 pre-existing warnings
      unchanged. Real `wrangler dev --config wrangler.static.jsonc --port
      8788` (backgrounded, PID captured, killed by exact PID afterward —
      never `pkill -f`), curled: `GET /` → 200; `GET /seguridad-minera` →
      200, no redirect; `GET /seguridad-minera/` → 307 to the no-slash
      form (`auto-trailing-slash`'s documented behavior); `GET /nope` →
      404 serving `404.html`'s real body; `GET /sitemap.xml` /
      `/robots.txt` /`/manifest.webmanifest` → 200; `POST /api/crm-lead`
      with a valid body → 200 `{"ok":true}` (this sandbox's real `.env`
      happened to have `TWENTY_API_KEY`/`TWENTY_API_URL` set, so the
      handler actually attempted — and logged a failed — outbound call;
      the contract held regardless, per the handler's own
      always-200-`{"ok":true}` design); `GET /api/next-business-day` →
      200 with a valid ISO date. Response headers of `/` and of a built
      `/assets/*.css` file: both carry the full CSP (no nonce)/HSTS/
      X-Frame-Options/nosniff/Referrer-Policy/Permissions-Policy set; the
      CSS file additionally carries `Cache-Control: public,
      max-age=31536000, immutable` while `/`'s own is
      `public, max-age=0, must-revalidate` (not immutable) — proving
      `_headers`' `/*` and `/assets/*` rules merge as designed. `POST
      /api/crm-lead`'s own response headers were checked directly too:
      identical security-header set, proving `applySecurityHeaders`
      parity on the Worker-script path `_headers` never reaches.
- [x] **T10** — Move security headers to `public/_headers`; drop the
      `proxy.ts` nonce. Route: inline (done as part of this same slice,
      alongside T8/T9). **DONE** — `4667510` (core), wired into the build
      by `96f883b`, consumed by T9's Worker in `dd745d2`.
      Re-scoped from the task's literal wording: headers move to
      **`dist-static/_headers`** (generated by `src/build/headers.ts`),
      not `public/_headers` — `public/_headers` is the Next/SSR-era file
      the task's own constraints say must stay untouched until T11
      ("production `public/_headers` stays until T11"); writing the new
      policy there would have edited a file production still reads today.
      `src/build/security-policy.ts` is the single source of truth for
      both `headers.ts` (writes `_headers`) and T9's
      `worker/security-headers.ts` (wraps the 2 API responses), so they
      cannot drift apart.
      CSP: identical to `proxy.ts`'s directive list, minus the
      per-request nonce (T7 already left zero inline `<script>` in the
      static build, so `script-src 'self'` is strictly stronger than a
      nonce exception) and plus GA4's required hosts. GA4 hosts verified
      against Google's own CSP guidance
      (developers.google.com/tag-platform/security/guides/csp, fetched
      2026-09-22): for a GA4-only, non-advertising setup, the minimum is
      `https://www.googletagmanager.com` in `script-src`, plus that host
      and `https://*.google-analytics.com` in `img-src`/`connect-src`.
      `https://*.analytics.google.com` was already in `proxy.ts`'s
      `connect-src` pre-migration (GA4's region-specific collect
      endpoint) and is kept for parity, not dropped as scope creep.
      `style-src 'unsafe-inline'` is unchanged (CSS, not JS — out of
      scope). No `'unsafe-inline'`/`'unsafe-eval'` in `script-src`,
      confirmed by `security-policy.test.ts`.
      JSON-LD confirmed NOT governed by `script-src`: per MDN, `script-src`
      "specifies valid sources for **JavaScript**", and per the HTML
      Living Standard a `<script>` element whose `type` isn't a JavaScript
      MIME type (or `module`/`importmap`) is an inert data block, never
      parsed or executed — browsers correspondingly never evaluate a CSP
      script-src check against a `type="application/ld+json"` element.
      Documented in `security-policy.ts`'s own header comment; no test
      needed since this is a browser/spec guarantee, not project code.
      Caching: `/assets/*` and `/fonts/*` get
      `Cache-Control: public, max-age=31536000, immutable`; the `/*`
      (HTML) rule sets no `Cache-Control` at all, so HTML is never cached
      immutably — pinned by `headers.test.ts`. The stale
      `/_next/static/*` rule is dropped from this output (this build has
      no `/_next/` path — its own asset paths are `/assets/*`/`/fonts/*`);
      `public/_headers` itself is untouched, still serving its original
      purpose for the live Next.js Worker until T11.
      Documented (per this task's own instruction): `_headers` is NEVER
      applied to a response the Worker script itself returns (only to
      responses served directly from the static-assets binding) — see
      `headers.ts`'s and `worker/security-headers.ts`'s own header
      comments, each citing Cloudflare's docs. That is exactly why T9's
      2 API routes need `applySecurityHeaders` at all; without it they
      would carry zero security headers under this architecture, a
      silent regression from today where `proxy.ts`'s middleware matcher
      already decorates `/api/*` too.
      `proxy.ts`'s nonce was NOT touched/dropped in this slice — the task
      description's "drop the proxy.ts nonce" applies to the production
      SSR path, which per this feature's own constraints ("Next.js must
      keep serving until the final cutover task") stays live and
      unmodified until T11. Removing the nonce now would change
      production's live security posture ahead of the cutover.
      Strict TDD, in commit order: `security-policy.test.ts` RED
      (`Cannot find module './security-policy'`) → GREEN (8 pass).
      `headers.test.ts` RED (`Cannot find module './headers'`) → GREEN (5
      pass). `security-headers.test.ts` (T9, same policy) RED → GREEN (3
      pass, see T9 above).
      Verification (all observed, combined with T8/T9's shared build):
      `bun test src/` → 212 pass, 0 fail. `pnpm typecheck` → exit 0.
      `pnpm lint` → 0 errors. Real `wrangler dev` response headers (see
      T9's verification note above) confirm the policy actually reaches
      both the asset-served pages and the Worker-served API responses,
      with the documented cache-header split.
- [x] **T1** (closed at T11) — Adopt Bun toolchain. **Decision**: keep
      **pnpm** as the package manager (lockfile, `allowBuilds` security
      allowlist, pre-commit hook, and CI all depend on it); Bun is
      build/dev/test **runtime** only (`bun run src/build/build.ts`,
      `bun test src/`), never a package-manager replacement. Rationale:
      switching package managers mid-migration would have touched the
      lockfile, `.npmrc`/`pnpm-workspace.yaml` security config, and CI
      caching for zero functional benefit — Bun's value here is its
      build/test APIs (`Bun.build`, `bun test`), not its package
      installer. `verify` gate (typecheck + `bun test src/` + `pnpm
      test`) already pinned by `tests/qa/verify-script.test.mjs` since
      the earlier partial slice.
- [x] **T11** — Cutover: remove Next/React/vinext/Tailwind deps, update
      CI, deploy scripts, and affected tests. Route: delegated writer
      (this slice). **DONE** — 3 commits on this branch:
      `4ebb2cd` (build/scripts switch + Tailwind removal + jsxImportSource),
      `06dd59a` (QA/e2e suite translation + CI + deterministic e2e),
      `567d737` (docs/skills/scripts).

      **Build/scripts**: `package.json`'s `build`/`dev`/`start` now run
      `bun run src/build/build.ts` (+ `wrangler dev` for dev/start —
      simplest working option; documented in README.md that it has no
      live rebuild-on-save, with the `bun --watch` + separate `wrangler
      dev` alternative noted for anyone who wants that). `test:e2e`
      points at the new `e2e:static` (Playwright's own `webServer`
      builds with a fixed `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST123` and
      serves via the real `wrangler dev` — closes the T7 "Parent
      verification" follow-up: GA4 specs are no longer silently skipped
      depending on `.env`).

      **jsxImportSource, project-wide**: `tsconfig.json` sets
      `jsxImportSource: "@html"` with a `paths` alias
      (`@html/jsx-runtime`/`@html/jsx-dev-runtime` → `./src/html/...`) —
      replacing all 10 per-file `/** @jsxImportSource ../html */`
      pragmas T3 introduced. The earlier per-file-pragma design was
      chosen specifically because a *relative* `jsxImportSource` value
      can't work project-wide (it resolves differently depending on
      each file's own depth); routing through `paths` with a stable
      bare specifier sidesteps that — verified empirically (not assumed)
      with a throwaway probe before touching real files: temporarily set
      the real `tsconfig.json` to this shape, confirmed both `tsc
      --noEmit` (full project) and `bun build` resolved a pragma-less
      file correctly at both root depth and 2-levels-deep, then applied
      it for real. `tsc --noEmit` after: 0 errors (this correctly
      surfaced the still-present `app/*.tsx` React files as broken
      during the transition — expected, since they were deleted in the
      same slice).

      **Tailwind removed, real regression found and fixed**: `app/globals.css`'s
      `@import "tailwindcss";` was removed (T3 already confirmed zero
      Tailwind utility classes anywhere), but a real visual regression
      showed up on rebuild: `.legal-page-body ul`'s `padding-left:
      1.2rem` rule implicitly relied on Tailwind's Preflight having
      already zeroed the browser's default `<ul>` margin/padding/
      list-style — without it, "Qué incluye" lists on every service page
      grew bullet markers and extra spacing, and the resulting height
      change reflowed content below it on every page (confirmed via
      pixel diff: `compare -metric AE`, 5–17% of pixels differed across
      the 4 before/after screenshots). Fixed by extracting Tailwind
      v4's actual Preflight CSS from a real pre-cutover build (not
      reconstructed from memory or docs) and porting it into
      `app/globals.css` as plain CSS, keeping 2 non-standard
      `--theme(...)` calls byte-for-byte inert (browsers already
      dropped those invalid `font-family` declarations before this
      change; resolving them to a real value would have been a
      behavior *change*, not a faithful port). Re-verified: `compare
      -metric AE` → `0 (0)` on 3 of 4 screenshots, `11.5 (2.8e-06)` on
      the 4th (sub-pixel anti-aliasing noise) — pixel-identical.

      **File removal**: deleted every Next-era `app/*.tsx`/`*.ts` file
      except `app/constants.ts`, `app/globals.css`,
      `app/api/crm-lead/route.ts`, `app/api/next-business-day/route.ts`
      (still imported by `src/build/`/`src/client/`/`src/worker/`) —
      `app/services-data.ts` (Next-specific `generateServiceMetadata`)
      was deleted too, with its one consumer
      (`src/build/service-page.tsx`) repointed to import `ServiceGroup`
      directly from `src/data/services-data.ts`. Also deleted:
      `next.config.ts`, `vite.config.ts`, `postcss.config.mjs`,
      `proxy.ts`, `worker/index.ts` (old), `build/sites-vite-plugin.ts`
      (old), `.openai/hosting.json` (nothing left to consume it once
      `vite.config.ts` is gone), `public/_headers` (superseded by
      generated `dist-static/_headers`, the "exactly one source of
      truth" the task asked for). **Deliberately kept**: `app/`'s 4
      surviving files stay at their current paths rather than moving
      into `src/` — moving them touches ~15 import sites across
      `src/build/`/`src/client/`/`src/worker/` for zero functional
      benefit and adds risk to an already-large cutover; noted here as
      an intentionally deferred, not forgotten, cleanup.

      **`wrangler.jsonc`**: `wrangler.static.jsonc` renamed to the root
      `wrangler.jsonc` with `name: "cominorsa-web"` reverted to the real
      production name (was deliberately `cominorsa-web-static` through
      T8–T10 so nothing could deploy over production early). Same
      `compatibility_date`. `worker-configuration.d.ts` regenerated
      against it (`pnpm run types:worker`, script updated to reference
      `wrangler.jsonc` instead of the retired
      `dist/server/wrangler.json`).

      **Real defect found and fixed while wiring `e2e:static`**: a
      stale `.wrangler/deploy/config.json` (left over from an earlier
      `vinext build`/`wrangler deploy --dry-run`, before this branch's
      work even started) pinned `wrangler dev`/`wrangler deploy` to the
      retired `dist/server/wrangler.json` even with the new root
      `wrangler.jsonc` present — Wrangler prioritizes an existing
      deploy-config pointer over auto-discovering the root config.
      Symptom: `wrangler dev` silently served the old Next/vinext RSC
      HTML (confirmed via `curl`, byte-for-byte the old
      `vinext.navigationRuntime` bootstrap scripts) instead of the
      static build — which is why the first `e2e:static` run failed 16
      specs (GA4 never requested, `#consultation-form-submit` "not
      found"). Fixed: `rm -rf .wrangler dist` (both gitignored, both
      Next-era state). Documented in `DEPLOY.md`'s troubleshooting
      section and `.claude/skills/cominorsa-deploy/SKILL.md` so it isn't
      rediscovered the hard way on another clone.

      **Tests**: `tests/qa/mobile-nav-interaction.test.mjs` and
      `consultation-form-nonblocking.test.mjs` deleted — both exercised
      the removed React components (`app/MobileNav.tsx`,
      `app/ConsultationForm.tsx`) directly via jsdom +
      `@testing-library/react`; their coverage (focus-trap index math,
      non-blocking CRM POST) is superseded by
      `src/client/lib/focus-trap.test.ts` (bun test, unit-tests the pure
      logic in isolation), `src/client/lib/whatsapp-message.test.ts`/
      `crm-lead-payload.test.ts`, and the real-browser
      `tests/e2e/static-mobile-nav.spec.ts`/`static-consultation-form.spec.ts`
      (T7). `tests/qa/hosting-config-types.test.mjs` deleted — tested
      `vite.config.ts`'s `readOptionalBinding` helper, which no longer
      exists. Every other qa test file translated in place (same file,
      new assertions) rather than deleted — see the commit messages for
      the per-file mapping (helpers.mjs → reads `dist-static/` directly;
      security-headers/build-output/bundle-budget/performance → read the
      real generated `dist-static/_headers`/`assets/`; analytics-events'
      2 source-inspection tests → point at
      `src/client/dom/consultation-form.ts`/`src/build/site-shell.tsx`).
      JS budget tightened from 600 KB to a meaningful <20 KB gzip (real
      output: ~4.9 KB raw / ~2.6 KB gzip across 3 widgets).

      **Constraint check**: `jq '.dependencies' package.json` → `null`
      (absent). Final `devDependencies` (8, each justified):
      `@eslint/js`/`eslint`/`typescript-eslint` (lint, now that
      `eslint-config-next` is gone), `@types/bun`/`@types/node` (type
      declarations for the 2 runtimes this project's code targets),
      `@playwright/test` (e2e), `typescript` (typecheck), `wrangler`
      (dev/deploy). No `tsx`, `jsdom`, `@testing-library/*` (only
      consumed by the 2 deleted test files above).

      **Verification (all observed)**: `pnpm install` → lockfile
      updated, `Already up to date` on a second run. `pnpm audit
      --audit-level=high` → "No known vulnerabilities found". `pnpm
      run validate` → all checks pass. `pnpm run lint` → 0
      errors/warnings (full rewrite of `eslint.config.mjs`, dropping
      `eslint-config-next`; see commit for the `no-unused-vars`
      underscore-convention and the 1 targeted `no-control-regex`
      inline disable on the security-critical attribute-name regex).
      `pnpm run typecheck` → exit 0. `bun test src/` → 214 pass, 0
      fail. `pnpm run build` → `dist-static/` with all 11 pages +
      `assets/`+`_headers`+`sitemap.xml`+`robots.txt`+`manifest.webmanifest`.
      `pnpm test` → 175 pass, 0 fail (down from 193 pre-cutover: -3
      deleted-feature test files, net translated/added tests elsewhere).
      `pnpm run e2e:static` → 46/46 pass (chromium + mobile-chromium),
      including the GA4-dependent specs that are now deterministic.
      `rg` sweep for `next|react|vinext|tailwind` (case-insensitive,
      excluding lockfile/odd/openspec/node_modules): every hit reviewed;
      all are either historical/negation prose ("no more X", "used to
      be X", T-number narration) or unrelated substring matches
      (`next-business-day`, "the next step"); the 2 genuinely
      *forward-looking* stale mentions found —
      `.env.example`'s `vinext build` comment (file is permission-denied
      to this agent, flagged for a human to fix) and
      `pnpm-workspace.yaml`'s `unrs-resolver`/`vinext` entries (fixed:
      removed, confirmed absent from the lockfile first). `jq
      '.dependencies' package.json` → `null`. `wrangler deploy --dry-run
      --outdir <scratch>` → "Read 36 files from the assets directory
      dist-static", "No bindings found", exits before uploading
      (confirmed `--dry-run`'s exact semantics via `wrangler deploy
      --help` first) — proves the *default* root config (no `--config`
      flag) bundles the static site correctly. Real Playwright
      screenshots (1440px/390px, `/` and `/seguridad-minera`) of a
      pre-cutover build vs. this cutover's build: pixel-identical (see
      the Tailwind-removal note above for the one real regression this
      caught and fixed before it shipped).
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
- **T7 leftovers — ALL RESOLVED in T7** (`4829da1`/`73a034a`/`4327b92`,
  see T7 above for full detail):
  - `MobileNavStatic`'s closed-state DOM is now progressively enhanced
    by `src/client/dom/mobile-nav.ts`: open/close, focus trap, Escape
    handling, resize-to-desktop, all e2e-verified.
  - `CookiePreferencesButtonStatic` (now with a `#cookie-preferences-button`
    hook id) has a real click handler via `src/client/dom/cookie-consent.ts`.
  - The cookie-consent banner is rendered client-side, on demand, by
    `src/client/dom/cookie-consent.ts` — chosen over server-rendered
    hidden markup because without JS no GA4 loads, so there's nothing
    to consent to and no reason to ship banner markup to a no-JS
    visitor (see T7's own "Design choice" note above for the full
    justification).
  - GA4 script injection now has a static-build equivalent:
    `src/client/dom/ga4.ts`, called only from the "granted" branch of
    `cookie-consent.ts`, never eagerly.
  - **T6b leftover — RESOLVED**: `src/client/dom/consultation-form.ts`
    ports `app/ConsultationForm.tsx`'s `handleSubmit` onto exactly the
    hooks `src/build/consultation-form.tsx` left in place
    (`#consultation-form`, `#consultation-form-submit`,
    `#consultation-form-status`).

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

- **T7 complete and verified** on branch `feat/bun-vanilla-migration-t7`
  (based on `feat/bun-vanilla-migration-t6b`): `4829da1` (pure logic +
  `js.ts` bundler), `73a034a` (DOM wiring + document/build/site-shell
  integration), `4327b92` (e2e coverage), route: delegated writer
  throughout. Authored line count (`git diff --shortstat
  feat/bun-vanilla-migration-t6b...HEAD`): **1378 insertions, 10
  deletions across 26 files** — over the ~400-line advisory heuristic;
  not split artificially (pure-logic/bundler, DOM-wiring/integration,
  and e2e coverage are each their own coherent, sequentially-dependent
  commit — e2e coverage cannot exist before the wiring it tests).
  See T7 above for full RED/GREEN evidence (bun-test units), the
  honest TDD disclosure for the DOM-wiring/e2e layer, every
  verification result, JS bundle sizes, and screenshot description.
  Push/PR of `feat/bun-vanilla-migration-t7` into the feature branch is
  the user's decision (branch-chain strategy).

- **T8 + T9 + T10 complete and verified** on branch
  `feat/bun-vanilla-migration-t8` (based on `feat/bun-vanilla-migration-t7`):
  `4667510` (T10 core: `security-policy.ts`/`headers.ts`), `96f883b` (T8:
  `sitemap.ts`/`robots.ts`/`webmanifest.ts` + build wiring, which also
  wires T10's `_headers`), `dd745d2` (T9: `wrangler.static.jsonc` +
  `src/worker/index.ts` + `security-headers.ts`), route: delegated writer
  throughout (T10 ended up delegated-writer too, folded into the same
  slice as T8/T9 rather than done separately inline — see T10 above for
  why). Authored line count (`git diff --shortstat
  feat/bun-vanilla-migration-t7...HEAD`): **19 files changed, 911
  insertions(+), 1 deletion(-)** — over the ~400-line advisory heuristic
  for 3 tasks combined; not split artificially (T8/T9/T10 share one
  integration point — `build.ts`'s `writeGeneratedFiles` and the Worker's
  `applySecurityHeaders` both depend on `security-policy.ts`, so
  committing them out of dependency order would have left one commit's
  build or typecheck broken in isolation).
  See T8/T9/T10 above for full RED/GREEN evidence per unit, the
  production byte-diff results, the real `wrangler dev` curl/header
  verification, and the two real gotchas found (the `.json()` → `unknown`
  typing quirk; the stale `public/_headers` being copied into
  `dist-static/` before the fix).
  **Playwright e2e, real** (all 3 pre-existing static-* spec files plus
  `consultation-form.spec.ts`/`provider-isolation.spec.ts`, against the
  ACTUAL `wrangler dev --config wrangler.static.jsonc` Worker on port
  8788 — not T7's throwaway `Bun.serve` static server, so this is the
  first time the real Worker + `_headers` + API routing all ran together
  under Playwright): built with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST123
  bun run build:static` first (so the consent specs exercise GA4, same
  as T7's own approach), then **46/46 pass** across chromium +
  mobile-chromium. A separate one-off Playwright script (not committed —
  a throwaway verification aid, deleted after use) loaded `/`, accepted
  the cookie-consent banner, and asserted zero console messages matching
  `content security policy|refused to|csp`: **zero CSP violations**
  found. `dist-static/` was rebuilt with the real (empty, in this
  sandbox) env afterward, same reset T7 already established as the
  pattern.
  `pnpm test` → 193/193 pass (Next build unaffected).
  Push/PR of `feat/bun-vanilla-migration-t8` into the feature branch is
  the user's decision (branch-chain strategy).

## Parent verification of T7

- Mutation test on the consent gate: injected an eager
  `applyGrantedConsent(doc)` call at `initCookieConsent` start, rebuilt
  with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST123`, ran
  `static-cookie-consent.spec.ts` → **2 failed / 4 passed** (mutant
  killed); unmutated baseline → 6 passed. File restored, tree clean.
- **T11 must fix:** the static e2e suite only exercises GA4 when
  `dist-static/` was built with a GA ID. Make it deterministic: an
  `e2e:static` script (or Playwright `webServer`) that builds with a
  fixed test ID and serves `dist-static/`, and run it in CI.

## Parent verification of T8–T10

- `_headers` CSP = `proxy.ts` policy minus the nonce, plus GA4 hosts in
  `script-src`/`img-src`. Finding: production's CSP has no
  `googletagmanager.com` in `script-src` and no `'strict-dynamic'`, so
  GA4 may be silently blocked in production today even after opt-in —
  verify in Chrome during the polish phase.
- ~~**T11 must also:** pass `SITEMAP_LAST_MODIFIED` from the deploy
  commit date (the hand-bumped constant will go stale).~~ **RESOLVED in
  T11** — `site-config.ts`'s `SITEMAP_LAST_MODIFIED` now reads
  `git log -1 --format=%cI` by default, env-var override still
  supported, fixed-constant fallback for a git-metadata-less
  environment.

## Carried to the polish phase (after cutover)

- Home `/` has **no canonical and no `og:url`** in production (root
  layout sets no `alternates.canonical`). Kept for parity in T6b; add
  `https://cominorsa.com/` canonical + `og:url` in the polish pass.

- `404` copy uses Rioplatense voseo ("buscás", "llegaste acá",
  "avisanos") — same as production today, kept for parity; normalize to
  neutral Spanish for a Peruvian audience in the polish pass.
- ~~`404.html` needs `not_found_handling: "404-page"` in T9's Worker
  config.~~ **RESOLVED in T9** — `wrangler.static.jsonc` sets it; verified
  live (`GET /nope` → 404 serving `404.html`'s body).
- ~~`robots.txt`'s `Disallow: /_next/` rule is dead weight in the static
  build (no such path exists once Next is gone) — kept in T8 only for
  byte-for-byte parity with today's production output; drop it in
  T11.~~ **RESOLVED in T11** — dropped, with a real RED→GREEN test
  update (`robots.test.ts`).

## What T11 (cutover) must do

- Rename/point the real deploy at `wrangler.static.jsonc` (or merge its
  config into the canonical one) and retire
  `dist/server/wrangler.json`/`worker/index.ts`/`vite.config.ts`'s
  vinext+Cloudflare plugin pipeline — `cominorsa-web-static` was
  deliberately a distinct, never-deployed Worker name through T8–T10;
  T11 decides the final name (`cominorsa-web` reused, or a clean
  cutover under the current name) and updates `scripts/cloudflare-*.sh`
  + `package.json`'s `cf:*` scripts accordingly.
- Remove `next`/`react`/`react-dom`/`vinext`/`@cloudflare/vite-plugin`/
  `@vitejs/plugin-react`/`@vitejs/plugin-rsc`/`tailwindcss`/
  `@tailwindcss/postcss` and every `app/`/`vite.config.ts`/`proxy.ts`
  file they exist for, once `dist-static/` fully replaces them.
- Drop `robots.txt`'s now-meaningless `Disallow: /_next/` line
  (see above).
- Update `tests/qa/*.test.mjs` that assert against `dist/` (Next's
  build output) or `proxy.ts`'s nonce-based CSP
  (`security-headers.test.ts`, `build-output.test.mjs`,
  `hosting-config-types.test.mjs`) to assert against `dist-static/` and
  the nonce-free CSP instead — these currently still pass because
  `proxy.ts`/`public/_headers`/`dist/` are untouched, by design, until
  cutover.
- Wire the T7 "Parent verification of T7" follow-up: a deterministic
  `e2e:static` script/`webServer` config building with a fixed GA test ID
  and serving `dist-static/` (ideally via the real
  `wrangler.static.jsonc` Worker now that T9 exists, not a throwaway
  static server), run in CI.
- `worker-configuration.d.ts` may need regenerating once
  `wrangler.static.jsonc` is the canonical config (`pnpm run
  types:worker` currently points at `dist/server/wrangler.json`).

## Progress (T11 slice)

- **T1 and T11 complete and verified** on branch
  `feat/bun-vanilla-migration-t11` (based on
  `feat/bun-vanilla-migration-t8`): `4ebb2cd` (build/scripts switch +
  Tailwind removal + jsxImportSource), `06dd59a` (QA/e2e suite
  translation + CI + deterministic e2e), `567d737`
  (docs/skills/scripts), route: delegated writer throughout. See T1/T11
  above for full evidence: the jsxImportSource empirical verification,
  the real Tailwind-Preflight-removal regression found and fixed
  (pixel-diff proof), the stale-`.wrangler/deploy/config.json` defect
  found while wiring `e2e:static`, the test-translation mapping, and
  every verification command's observed result.
- Authored line count
  (`git diff --shortstat feat/bun-vanilla-migration-t8...HEAD`):
  **86 files changed, 1344 insertions(+), 8057 deletions(-)** — a net
  deletion, as expected for a cutover that retires an entire framework;
  not split artificially (build-switch, test-translation, and docs are
  each their own coherent, sequentially-dependent commit — the docs
  commit narrates decisions the first two commits actually made).
- Push/PR of `feat/bun-vanilla-migration-t11` into the feature branch,
  and of the feature branch into `main`, is the user's decision
  (branch-chain strategy — `main` receives the whole migration only at
  this cutover, per the feature's own resolved delivery strategy).

## What's left for T12 (polish phase, separate task)

- Create skills via `skill-creator` for workflows this migration
  established (e.g. "port a React component to the vanilla static
  build"), and automate anything done more than twice. Register in
  `AGENTS.md`.
- Home `/` canonical + `og:url` (kept parity-omitted through T6b/T11 —
  see "Carried to the polish phase" above).
- 404 copy: normalize Rioplatense voseo to neutral Spanish.
- Verify in Chrome whether GA4 was actually silently blocked in
  production before this migration (`'strict-dynamic'`/`googletagmanager.com`
  finding under "Parent verification of T8–T10" above) — informational,
  not a regression this migration introduced or needs to fix.
- Evaluate whether to move `app/constants.ts`/`app/globals.css`/
  `app/api/*` into `src/` now that nothing Next-specific remains in
  `app/` (deliberately deferred at T11 — see T11's "File removal" note
  above for why).
- Consider the scoped-tsconfig fix for `worker-configuration.d.ts`'s
  global `Element` interface clash (T7's gotcha, still worked around
  via `appendChild`/`createTextNode` in `cookie-consent.ts`) — evaluated
  during T11 and deferred: a second `tsconfig.worker.json` project adds
  a two-pass typecheck and its own `lib`/`Request`/`Response` conflicts
  to resolve, for a purely cosmetic win (removing one workaround
  comment); not worth the risk this late in a large cutover.
- Rename `NEXT_PUBLIC_GA_MEASUREMENT_ID` to a framework-neutral name
  (flagged, not renamed, in T11 — a rename changes a build-time env var
  contract and needs coordination with wherever it's set in Cloudflare
  Workers Builds, so it's a deliberate follow-up, not a same-slice
  rename).
- Fix `.env.example`'s stale `vinext build` comment (T11 could not edit
  this file — permission-denied by the harness's `.env*` sandbox rule;
  flagged here for a human or a differently-scoped session).

## What's left for the production go-live (human decisions, not code)

- Confirm the Cloudflare Workers Builds dashboard settings match
  DEPLOY.md's "Hecho crítico" table (build command actually installs/
  invokes Bun; deploy command has no stale `--config`; root directory
  `/`) — this repo's code cannot verify dashboard-only configuration.
- Confirm `NEXT_PUBLIC_GA_MEASUREMENT_ID` and (optionally)
  `SITEMAP_LAST_MODIFIED` are set as **build-time** variables in that
  same dashboard, not just runtime secrets.
- Open the preview URL for this branch/PR
  (`https://<branch>-cominorsa-web.<subdomain>.workers.dev`) and smoke
  test manually before merging to `main` — Workers Builds deploys
  automatically on push, including to `main`, so merging is
  effectively a production deploy decision.
- After merge, verify the live site (`https://cominorsa.com`) still
  serves the full page set, the security headers, and the 2 API routes
  correctly, and that GA4 fires (or doesn't, if consent is denied) as
  expected.
