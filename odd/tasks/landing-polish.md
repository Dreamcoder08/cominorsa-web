# Landing Polish — Professional Quality

## Objective

Take https://cominorsa.com from "migrated and equivalent" to professional
quality: truthful legal/consent surface, complete SEO, accessible
structure, hardened lead endpoint, lighter assets, and polished copy — each
change verified in Chrome/Playwright against the real build.

## Problem

A read-only audit (2026-09-23, parent-verified on the key items) found a
false privacy statement, a consent banner for a tracker that never loads,
duplicate social metadata on every page, a broken landmark structure,
run-together heading text, and an unprotected lead endpoint, plus polish
issues.

## Why

The site is the client's main B2B acquisition channel (WhatsApp + form).
Legal accuracy (Ley 29733), search visibility and trust drive leads.

## Constraints

- Production origin `https://cominorsa.com`, no trailing slash; verify
  against the live site.
- Zero runtime dependencies. Tokens only in `app/globals.css`
  (`cominorsa-design-tokens`). Copy in neutral Peruvian Spanish (tú, no
  voseo). Code/tests/commits in English.
- Never invent business facts (years, clients, team, CIP numbers, hours,
  response time, retention period, GA4 ID). Legal copy describes only
  verified processing; items needing the client are marked for review.
- Every push to `main` deploys production (Workers Builds). Work happens
  on `feat/landing-polish*`; `main` only after CI + preview check.

## Resolved configuration

- **TDD**: Strict TDD ON (project convention, same source as
  `odd/archive/2026-09-23-bun-vanilla-migration.md`). Runners: `bun test
  src/`, `node --test tests/qa/*.test.mjs` (via `pnpm test`), `pnpm
  test:e2e` (Playwright + real `wrangler dev`).
- **Delivery**: `ask-on-risk`; chain strategy cached from the previous
  feature: **feature-branch-chain** (tracker `feat/landing-polish`).
- **Model routing**: Sonnet subagents hit the weekly API limit
  (2026-09-23); delegated writers use Opus.
- **Rollback**: `pnpm exec wrangler rollback <previous version> --name
  cominorsa-web` (record the version before each production merge).

## Tasks

- [x] **P1 — Privacy & consent truthfulness** (audit P0-1, P0-2): no
      banner / no "Preferencias de cookies" button when no GA ID is
      configured; privacy policy describes CRM storage (Twenty), email
      notification (Resend) and WhatsApp handoff accurately; consent
      notice at the form. Retention period and data-rights contact
      flagged for client review. Route: delegated writer (writer
      trigger: 2+ non-trivial files). Commit `638868c`.
      - Design: `runStaticBuild(outDir, { gaMeasurementId })` (default
        `NEXT_PUBLIC_GA_MEASUREMENT_ID`) is the single source — baked into
        the consent bundle and passed as `RenderContext.analyticsEnabled`
        to every page (footer button, privacy GA paragraphs).
      - RED `consent-storage.test.ts`: `SyntaxError: Export named
        'clearConsent' not found` → GREEN 6 pass (try/catch
        `readConsent`/`writeConsent`/`clearConsent`).
      - RED `cookie-consent.test.ts`: 4 fail (banner created with empty
        ID; `SecurityError` thrown from init) → GREEN 5 pass.
      - RED `site-shell.test.ts` "renders no cookie-preferences button by
        default", `consultation-form.test.ts` consent notice, `build.test.ts`
        "without a GA ID, no page renders the cookie-preferences button" →
        GREEN. `privacy-page.test.ts` RED on missing
        `PRIVACY_LAST_UPDATED_LABEL` export → GREEN 12 pass; CLDR es-PE
        formats the date as "23 de setiembre de 2026" (same in Bun and
        Node), test pinned to that.
      - Visual: no cookie banner on any page (before: banner shown with no
        GA ID); footer has no "Preferencias de cookies"; form shows the
        consent notice with an underlined privacy link (`--copper-ink` on
        `--paper`, 8.94:1, approved pair).
- [x] **P2 — SEO head completeness** (P1-1, P1-2, P2-14): home canonical
      + `og:url`; per-page OG/Twitter title/description; descriptions
      ≤160 chars. `www` → apex 301 is a Cloudflare setting (documented in
      `DEPLOY.md` → "Redirección www → dominio raíz"; not applied — no
      API calls from this task). Route: delegated writer. Commit
      `9468c45`.
      - RED `document.test.ts` (2 OG/Twitter), `routes.test.ts` (home
        canonical, ≤160: gestion-ambiental-minera 171), `build.test.ts`
        (home canonical, site-wide head invariants) — 6 fail → GREEN.
      - Descriptions shortened: gestion-ambiental-minera 171→156 chars,
        seguridad-minera 158→150 (live was 163 bytes); all ≤160 in chars
        and bytes.
- [x] **P3 — Landmarks, skip link, heading text, nav trap** (P1-4, P1-5,
      P1-6, P2-5). Route: delegated writer. Commit `6361642`.
      - `SiteLayout`: skip link → `<header>` → `<main id="contenido">` →
        `<footer>` on every page; 404 gets `SkipLink` + `main#contenido`.
      - RED `build.test.ts` landmarks (skip link not first/absent outside
        home) and heading text (`index: "Técnica que
        impulsa.Responsabilidad que permanece."`); `focus-trap.test.ts`
        `SyntaxError: Export named 'buildFocusCycle' not found` → GREEN
        244 pass. E2E (`static-landmarks.spec.ts`, extended
        `static-mobile-nav.spec.ts`) written with the fix, run GREEN only
        (not run RED against the old build).
      - Visual: hero/section headings unchanged (lines are block-level);
        first Tab focuses "Ir al contenido" on `/`, `/seguridad-minera`,
        `/privacidad`.
- [x] **P4 — Harden `/api/crm-lead`** (P1-7): Origin/`Sec-Fetch-Site`
      check, honeypot; rate limiting documented as a Cloudflare rule.
      Decide on unused `/api/next-business-day` (it was built for a
      Twenty CRM SLA workflow — verify before removing). Route: delegated
      writer. Commit `5cb0021`.
      - Guard: `Origin` must be `https://cominorsa.com` or the request's
        own origin; `Sec-Fetch-Site`, if present, must be `same-origin`;
        missing `Origin` → `403 {"ok":false}` (browsers always send it on
        POST). Accepted/dropped submissions keep `200 {"ok":true}`.
      - Honeypot `website` (wrapper `.form-honeypot` visually hidden +
        `aria-hidden`; input `tabindex=-1`, `autocomplete=off`); non-empty
        → dropped silently, no Twenty/Resend call.
      - Rate limit: `DEPLOY.md` → "Protección de `/api/crm-lead`" (WAF
        rule 5 req/1 min per IP → block 10 min; plan-dependent). Not
        applied (dashboard step for the owner).
      - `/api/next-business-day` KEPT: commit `6e22cc5` + route header —
        Twenty workflow's HTTP Request node calls it server-to-server for
        Task due dates; documented in `DEPLOY.md`.
      - RED `crm-lead-route.test.mjs`: 4 fail (`actual: 200, expected:
        403` ×3; honeypot `actual: 3, expected: 0` fetch calls);
        `crm-lead-payload.test.ts` 3 fail (`website` missing),
        `consultation-form.test.ts` honeypot `Expected: not null` → GREEN
        24/24 route, 14/14 payload+form. Worker test updated to send
        `Origin` + new 403 case (written with the fix).
      - Local `wrangler dev`: same-origin `{}` → 200 ok; `Origin:
        https://evil.example` → 403; no `Origin` → 403; honeypot → 200 +
        log "dropped submission with a filled honeypot". Valid-payload
        POST deliberately not sent (`.env` has `TWENTY_API_*`).
        Playwright: honeypot never reached by Tab, `clip-path: inset(50%)`,
        no layout gap in the form (1440/390).
- [x] **P5 — Service pages & JSON-LD** (P1-8, P1-10): related services,
      `BreadcrumbList`, `Service`, enriched `ProfessionalService` with
      only verified data. Route: delegated writer. Commit `c92e453`.
      - Service pages: breadcrumb `nav[aria-label="Migas de pan"]`
        (Inicio › Servicios › `pageTitle`), "Preguntas frecuentes" links
        to mapped FAQ anchors (new `FaqEntry.id`/`serviceSlug`, mapped by
        existing question text; trámites has none), "Otros servicios"
        with the 5 siblings (`pageTitle` + `description`). No new copy.
      - `structured-data.ts`: `ProfessionalService` `@id`
        `https://cominorsa.com/#organization`, `contactPoint` ×2 (both
        WhatsApp lines), `logo` `/apple-touch-icon.png` (180×180 logo
        mark; `logo-44.png` is 88×85), `image` `/og.jpg`, `areaServed`
        ["Piura, Perú", "Norte del Perú"] (hero eyebrow + FAQ). Per
        service page: `Service` (`provider` → `@id`) + `BreadcrumbList`
        (positions 1–3, absolute URLs). No `geo`/hours/`email`/`sameAs`.
      - RED: `service-page.test.ts` 12 fail (`expect(block).not.toBeNull()`
        received null), `faq.test.ts` 2 fail, `structured-data.test.ts`
        module missing, `build.test.ts` P5 `expected 6, received 0` →
        GREEN 281 pass.
- [x] **P6 — Image & cache weight** (P1-3, P2-10, P2-12). Route:
      delegated writer. Commit `ecd8792`.
      - OG: `og.png` 715 180 B → `og.jpg` 149 876 B (1200×630, baseline
        JPEG q88 4:4:4 via ImageMagick; SSIM distance 0.020 vs the PNG);
        `og:image:type image/jpeg`; validate-env, smoke/bootstrap
        scripts, README updated.
      - Removed `file.svg`, `globe.svg`, `window.svg` (unreferenced);
        `logo.png` → `docs/assets/logo-source.png`, `public/fonts/README.md`
        → `docs/fonts.md`. `logo-44.png` (88×85) left as is: no square
        source exists (`logo.png` is 211×203).
      - Fonts content-hashed at build (`/fonts/<name>-<sha256:8>.woff2`,
        `fonts.css` + preload rewritten), `/fonts/*` stays immutable.
        Images (`og.jpg`, logo, favicons) → `public, max-age=86400`; HTML
        unchanged (`max-age=0, must-revalidate`).
      - RED: bun 5 fail (document og/preload, headers image rule, build
        hashed fonts); node 6 fail (og.jpg missing, dist root had
        `file.svg`/`globe.svg`/`logo.png`/`og.png`/`window.svg`, image
        cache rule) → GREEN. New guard "every same-site URL in built
        HTML/CSS resolves" passed before and after.
      - `wrangler dev`: `/og.jpg` 200 `image/jpeg` `max-age=86400`;
        hashed font 200 `immutable`; `/` `max-age=0, must-revalidate`;
        `/og.png`, `/file.svg` 404. Gotcha: a 404 under `/fonts/*` (old
        unhashed URL) also gets the immutable header — harmless since
        HTML is always revalidated.
- [x] **P7 — Form UX & robustness** (P2-6, P2-7, P2-3). Route: delegated
      writer. Commit `7a0e15b`.
      - Submit renders enabled; form is `method="post"` (a submit before
        the script attaches, or with JS off, never puts PII in a URL —
        the static host answers 405 and stores nothing; trade-off: a
        no-JS submit shows that 405). `<noscript>` line links
        `wa.me/51910728575` with the default inquiry text. JS sets
        `form[data-enhanced]` as the e2e readiness marker.
      - Status: "Preparamos tu mensaje en WhatsApp. Revísalo y envíalo…"
        + link "Si WhatsApp no se abrió, toca aquí" → the same wa.me URL
        (DOM-built, no innerHTML). Placeholders end with "…".
      - Contrast (contrast-check.mjs): field border 1.58:1 →
        `--copper-ink` 9.51:1 on `--white`, 8.94:1 on `--paper`; focus
        2px `--copper-ink` outline, offset 2px (8.94:1).
      - RED: `consultation-form.test.ts` 7 fail, `globals-css.test.ts` 2
        fail; e2e P7 specs run RED against the pre-change build (4 failed:
        `Received: disabled`, fallback link `element(s) not found`) →
        GREEN (form specs 22 passed).
- [x] **P8 — Copy fixes** (P2-1 voseo on 404 + shell, P2-15 quotes).
      IGAFOM framing (P2-2) needs client confirmation (untouched). Route:
      delegated writer. Commit `44014f3`.
      - 404: "buscas / aquí / avísanos", rendered in `SiteLayout` (skip
        link, header, footer, GA-aware footer); `noindex, follow`, no
        canonical kept. Only voseo in the built site was the 404.
      - Privacy (GA builds only): `“Preferencias de cookies”`.
      - RED: `not-found-page.test.ts` 2 fail, `build.test.ts` 4 fail
        (404 shell, landmarks, GA button on 404, copy scan) → GREEN 250
        pass. Copy scan re-run with the old privacy text proves it
        catches the straight quotes in the GA build.
- [x] **P9 — Performance & CSS polish** (P2-8, P2-9, P2-11, P2-13,
      P2-15 tokens). Route: delegated writer. Commit `31e06c1`.
      - `fonts.css` bundled into `globals-<hash>.css`: CSS requests 2 → 1
        per page (transfer 8 342 → 8 193 B, decoded 33 235 → 35 290 B,
        `wrangler dev`). Home preloads Newsreader italic too: its load
        finished at ~850–1 100 ms before, ~50–90 ms after (headless, 390
        px).
      - Hero reveal: clip-path mask → transform + opacity from 0.4 (never
        hidden). Chrome's LCP entry was already ≈FCP before (~870–1 000
        ms locally) and still is — the gain is the h1 being visible from
        first paint, not the local metric. Reduced motion unchanged.
      - CSP `style-src 'self'` (no `'unsafe-inline'`): no `style=`/
        `<style>` in built HTML (new guard); Playwright console check on
        all 11 pages (with and without GA ID, and after accepting GA
        consent) → 0 CSP violations.
      - `theme-color` and manifest colours → `--paper` `#f6f1e2` (was
        `#fbf8ef` / `#001713` + `#f4eed9`).
      - Global `text-wrap: balance` (h1–h3) / `pretty` (p, li,
        blockquote). Channel tokens `--ink-rgb`, `--copper-rgb`,
        `--copper-light-rgb`, `--white-rgb`, `--line-rgb`; all
        `rgba(255,253,247,…)` → `--white-rgb`, `rgba(243,207,89,…)` →
        `--copper-rgb`. Lowest affected text: `.section-kicker.light`
        4.72 → 4.57:1, `.footer-meta` 4.91 → 4.75:1 (still ≥ 4.5).
        Lint test allows only 8 remaining literals (token gaps: Preflight
        `#0000`, hero gradient greens, contour line, copper-orange glow,
        card and form shadows).
      - RED: 15 fail (CSP, manifest, theme-color, preloads, stylesheet
        count, reveal, text-wrap, colour lint) → GREEN 295 pass.
- [x] **P10 — Migration follow-up T12**: `pnpm shots` screenshot script
      (used >2 times) + skill update. Route: delegated writer (bundled
      with P5–P9). Commit `42e454f`.
      - `ci.yml` `pull_request.branches`: `main` + `"feat/**"` (push to
        `main` kept). RED `ci-workflow.test.mjs` 1 fail → GREEN.
      - `scripts/screenshots.mjs` + `pnpm shots <baseUrl> <outDir>
        <paths…>` (1440/390 full page, `home-1440.png` naming, refuses
        `test-results/`); `cominorsa-run` skill step 3 uses it. RED
        `ERR_MODULE_NOT_FOUND` → GREEN 5 pass.
- [x] **P11 — Lighthouse follow-up** (production Lighthouse 12,
      2026-09-24: mobile 90/100/93/100, desktop 99/100/93/100; failing
      `errors-in-console`/`inspector-issues`, `render-blocking-resources`,
      `modern-image-formats`). Route: delegated writer (writer trigger:
      2+ non-trivial files). Branch `feat/landing-polish-p11`.
      - A `db7b736` — CSP `script-src` + `https://static.cloudflareinsights.com`
        (edge-injected Web Analytics beacon). `connect-src` unchanged:
        Cloudflare's CSP FAQ
        (developers.cloudflare.com/web-analytics/faq/#what-do-i-need-to-add-to-my-content-security-policy-csp)
        says auto-injection reports to same-origin `/cdn-cgi/rum`
        (`'self'`), only a manual snippet to cloudflareinsights.com;
        confirmed in the live beacon (report URL is `/cdn-cgi/rum` when
        `data-cf-beacon` has `version`, which the injected tag has).
        Privacy policy (date → 24 de setiembre de 2026) discloses
        Cloudflare Web Analytics as cookieless aggregated statistics,
        wording from cloudflare.com/web-analytics ("does not use any
        client-side state, such as cookies or localStorage"; no
        fingerprinting) and its documented dimensions; GA4 stays
        conditional; "no usa herramientas de analítica" and "ningún
        script de analítica" removed. RED 2 fail (script-src list,
        privacy disclosure) → GREEN 297 pass.
      - B `6cae71c` — CSS inlined as one `<style>` per page; `_headers`
        `style-src 'self' 'sha256-…'` computed at build from the exact
        bytes (build fails on `</style` or CR); no `'unsafe-inline'`; no
        CSS file ships. RED 6 fail unit (buildCsp/headers hash option,
        document `<style>`, build hash match, P6 font test) + 4 fail QA
        → GREEN. `/` gzip: before 5152 B HTML + 7843 B CSS (2 requests)
        → after 12930 B (1 request); brotli 4240 + 6948 → 11118 B.
        Trade-off: each further page view re-downloads ~7.8 KB gzip CSS
        that was cached before.
      - C `f31a46c` — `logo-44.png` (13656 B, 88×85, fully opaque) →
        `logo-44.webp` (2146 B, `magick -quality 90`, PSNR 35 dB);
        width/height/alt unchanged; PNG referenced nowhere else
        (manifest/JSON-LD use apple-touch-icon) → removed with its cache
        rule. RED 5 fail → GREEN 302 pass.
      - Local Lighthouse (wrangler dev, 2 runs each, same machine):
        pre-P11 mobile perf 90/93 FCP 2.8/2.6 s, desktop 97/99; P11
        mobile 93/92 FCP 2.6/2.6 s, desktop 99/99 FCP 0.7/0.6 s; a11y,
        best-practices, SEO 100; render-blocking and modern-image audits
        pass. Local has no injected beacon: A is proven by the CSP tests
        and needs a production check after deploy.
- [ ] **BLOCKED — Trust section** (P1-9): needs real data from the
      client.

## Needs the client

Client-review items raised by P1 (also for the PR description):

- Privacy policy retention wording is a neutral commitment ("solo el
  tiempo necesario…"); confirm a concrete retention period.
- ARCO requests currently point to the two WhatsApp lines and the
  registered address; confirm the preferred data-rights channel (an
  email would need to be provided — none was invented).
- The Resend notification lands in a Gmail inbox
  (`app/api/crm-lead/route.ts`); confirm whether the policy should name
  the inbox provider too.
- "Setiembre" (CLDR es-PE) vs. "septiembre" in the update date: both
  valid; confirm preference.

- GA4 measurement ID (`G-…`) → Workers Builds build variable
  `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- Data retention period and preferred data-rights (ARCO) contact.
- Trust data: years in business, team/CIP registrations, cases, hours,
  response time, email.
- IGAFOM framing ("IGAFOM de Cierre" as separate service vs. included).
- `.env.example` stale `vinext` comment (harness blocks `.env*` edits).
- Structured data gaps (P5, not on the site so not in JSON-LD): email,
  opening hours, geo coordinates, social profiles (`sameAs`), a square
  logo ≥ 112 px other than the favicon mark.
- Cloudflare WAF rate-limiting rule for `POST /api/crm-lead`
  (`DEPLOY.md`) — dashboard step for the zone owner.

## Acceptance criteria

- All checks green: `pnpm validate`, `lint`, `typecheck`, `bun test
  src/`, `pnpm test`, `pnpm test:e2e`.
- Chrome + Playwright verification of each visible change (1440/390).
- Deployed to production with live verification and a recorded rollback
  point.

## Audit reference

Full findings table (IDs P0-1…P2-15) with evidence: this document's
Progress section links each task to its IDs; the raw audit is summarized
in Engram topic `odd/landing-polish/audit`.

## Progress

- 2026-09-24: P11 done on `feat/landing-polish-p11` (commits `db7b736`,
  `6cae71c`, `f31a46c`). `git diff --shortstat feat/landing-polish...HEAD`
  → 22 files changed, 333 insertions(+), 130 deletions(-) before this
  document update. Checks: `pnpm validate` OK (1 known `.env` warning),
  `pnpm lint` 0, `pnpm typecheck` 0, `bun test src/` 302 pass / 0 fail,
  `pnpm build` 11 pages, `pnpm test` 195 pass / 0 fail, `pnpm test:e2e`
  58 passed. Playwright on `wrangler dev`: 11 pages, 1 `<style>`, 0
  stylesheet links, Archivo applied, 0 CSP violations. Screenshots
  (`/`, `/seguridad-minera`, 1440/390) vs production in the session
  scratchpad `polish-p11/`: service pages identical except the logo
  (6 px); home differs only in the hero reveal animation's capture
  timing. Engram mirror update left to the orchestrator.

- 2026-09-24: P5, P7, P9, P10 done on `feat/landing-polish-p5` (commits
  `c92e453`, `7a0e15b`, `31e06c1`, `42e454f`). `git diff --shortstat
  feat/landing-polish...HEAD` → 34 files changed, 1102 insertions(+),
  256 deletions(-) before this document update. Checks: `pnpm validate`
  OK (1 known `.env` warning), `pnpm lint` 0, `pnpm typecheck` 0, `bun
  test src/` 295 pass / 0 fail, `pnpm build` 11 pages, `pnpm test` 192
  pass / 0 fail, `pnpm test:e2e` 58 passed (first attempt: wrangler's
  local proxy crashed "Network connection lost" → 45 ERR_CONNECTION_REFUSED;
  rerun clean). Screenshots before/after (1440/390) in the session
  scratchpad `polish-p5/`. Engram mirror update left to the orchestrator.

- 2026-09-23: P4, P6, P8 done on `feat/landing-polish-p4` (commits
  `5cb0021`, `ecd8792`, `44014f3`). `git diff --shortstat
  feat/landing-polish...HEAD` → 37 files changed, 659 insertions(+),
  93 deletions(-) before this document update. Checks: `pnpm validate`
  OK (1 known `.env` warning), `pnpm lint` 0, `pnpm typecheck` 0, `bun
  test src/` 250 pass / 0 fail, `pnpm build` 11 pages, `pnpm test` 187
  pass / 0 fail, `pnpm test:e2e` 54 passed. Screenshots (`/`, `/nope`,
  form, 1440/390) in the session scratchpad `polish-p4/`. Engram mirror
  update left to the orchestrator.

- 2026-09-23: P1–P3 done on `feat/landing-polish-p1` (commits `638868c`,
  `9468c45`, `6361642`). `git diff --shortstat feat/landing-polish...HEAD`
  → 30 files changed, 1081 insertions(+), 378 deletions(-) at `6361642`
  (code, tests, DEPLOY.md; this document's update adds one more file). Checks: `pnpm validate` OK
  (1 known `.env` warning), `pnpm lint` 0, `pnpm typecheck` 0, `bun test
  src/` 244 pass / 0 fail, `pnpm build` 11 pages, `pnpm test` 176 pass /
  0 fail, `pnpm test:e2e` 54 passed. Screenshots (before/after, 1440/390)
  in the session scratchpad `polish-p1/`. Engram mirror update left to
  the orchestrator.

- 2026-09-23: audit done; parent verified P0-1 (privacy text
  `src/build/privacy-page.tsx:38-45` claims no server submission — false,
  form POSTs to `/api/crm-lead` → Twenty + Resend), P1-6 (built h1 text
  "impulsa.Responsabilidad"), P1-1 (`www.cominorsa.com` → 200, no
  redirect).

## Delivery log

- Slice 1 (P1–P3): PR #10 → tracker #9 → `main` (`b0cb63a`), deployed by
  Workers Builds 2026-09-23. Rollback point before it:
  `da7ecedd-ecb0-41ba-8803-2fd29f1178df`. Live checks: home canonical,
  no cookie button, privacy no longer claims "ningún servidor", routes
  200/404, CRM API 200. Chrome: skip link is first Tab stop and becomes
  visible after its 180 ms transition.
- CI gap: `ci.yml` only triggers on PRs to `main` and
  `feat/bun-vanilla-migration**`; slice PRs into `feat/landing-polish`
  get no CI — fix in P10 (trigger on `feat/**`).

- Slice 2 (P4, P6, P8): PR #11 → tracker #12 → `main` (`0e8b5d6`),
  deployed 2026-09-23. Rollback point before it:
  `79193eec-0111-41dc-ace7-30a4737a5046`. Live: routes 200/404, `og.jpg`
  200 (1-day cache), `og.png` 404, 404 copy without voseo, curl without
  Origin → 403. **Chrome (real browser) same-origin POST with the
  honeypot filled → 200 `{"ok":true}` on the preview and on production**
  (proves real leads pass the origin gate; honeypot prevents a real CRM
  record).

## Next step

After P11 merges and deploys: re-run production Lighthouse (expect
best-practices 100 once the beacon loads) and confirm in Cloudflare Web
Analytics that visits are recorded.

Slice 3 (P5, P7, P9, P10) ready for PR `feat/landing-polish-p5` →
`feat/landing-polish` (CI now triggers on it). After merge to `main`,
verify live: JSON-LD in Google's Rich Results test, CSP header without
`'unsafe-inline'` and no console violations. Remaining: BLOCKED trust
section (client data).
