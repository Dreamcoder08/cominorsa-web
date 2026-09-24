# Bun + Vanilla Migration — CLOSED

**Status: done and live in production (2026-09-23).** Full working
history, per-task RED/GREEN evidence and every verification log:
[`odd/archive/2026-09-23-bun-vanilla-migration.md`](../archive/2026-09-23-bun-vanilla-migration.md).

## Outcome

- `https://cominorsa.com` is served by Cloudflare Workers Static Assets
  from `dist-static/` (Bun build, hand-written JSX-to-HTML runtime) plus
  one small Worker for `/api/crm-lead` and `/api/next-business-day`.
- Zero runtime dependencies. Next.js, React, vinext, Vite and Tailwind
  removed (−8,095 lines in the cutover alone).
- JS shipped: ~2.6 KB gzip across 3 progressive-enhancement modules (was
  a 600 KB budget). Worker bundle: 11 KiB (3.9 KiB gzip).
- Metadata, JSON-LD, canonical URLs, robots and manifest verified
  identical to the pre-migration site; security headers via `_headers`
  with a nonce-free CSP (`script-src 'self'` + GA4 host).

## Tasks

- [x] T0 remove Drizzle/D1 · [x] T1 toolchain (pnpm stays package
  manager; Bun is build/dev/test runtime) · [x] T2 JSX runtime ·
  [x] T3 Bun.build pipeline · [x] T4 head/metadata · [x] T5 fonts ·
  [x] T6a/T6b all 11 routes · [x] T7 vanilla widgets · [x] T8
  sitemap/robots/manifest · [x] T9 static Worker · [x] T10 headers ·
  [x] T11 cutover
- [ ] T12 skills/automation — moved to `odd/tasks/landing-polish.md`.

## Delivery

Feature Branch Chain: tracker PR #1, child PRs #2–#8, merged top-down,
then #1 → `main` (`afc6300`). Workers Builds auto-deployed `main` as
version `da7ecedd-ecb0-41ba-8803-2fd29f1178df`.

## Go-live verification (parent, against production)

- Branch preview on real Cloudflare first
  (`feat-bun-vanilla-migration-t11-cominorsa-web…workers.dev`): all
  routes, 307 slash redirect, 404, headers, both APIs — pass.
- Tracker CI `Build + Test` (incl. e2e) — pass. `Twenty CRM stack` job
  fails, pre-existing since 2026-09-06, unrelated.
- Production after deploy: 11 routes 200, `/seguridad-minera/` → 307 to
  no-slash, `/nope` 404, SEO files 200, CSP/HSTS/XFO present, no `_next`
  markers, both APIs 200; Worker secrets `TWENTY_API_KEY`,
  `TWENTY_API_URL`, `RESEND_API_KEY` present on the new version
  (`keep_vars: true` added as a guard); Playwright screenshots at
  1440/390 render correctly.
- Rollback point: `pnpm exec wrangler rollback
  85b8720c-4559-4452-bdec-96fa3b8ceb49 --name cominorsa-web`.

## Honest gaps

- T6a units: RED not captured (writer cut off by an API limit).
- T7 DOM wiring: e2e specs written after the code; compensated by a
  mutation test on the consent gate (mutant killed).
- Not verified: a real lead reaching Twenty/Resend after cutover (would
  send a real notification email to the client's team). Handler code is
  unchanged and its secrets are present.
