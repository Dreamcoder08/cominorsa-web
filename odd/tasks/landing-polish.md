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

- [ ] **P1 — Privacy & consent truthfulness** (audit P0-1, P0-2): no
      banner / no "Preferencias de cookies" button when no GA ID is
      configured; privacy policy describes CRM storage (Twenty), email
      notification (Resend) and WhatsApp handoff accurately; consent
      notice at the form. Retention period and data-rights contact
      flagged for client review. Route: delegated writer.
- [ ] **P2 — SEO head completeness** (P1-1, P1-2, P2-14): home canonical
      + `og:url`; per-page OG/Twitter title/description; descriptions
      ≤160 chars. `www` → apex 301 is a Cloudflare setting (documented,
      applied if the API token allows). Route: delegated writer.
- [ ] **P3 — Landmarks, skip link, heading text, nav trap** (P1-4, P1-5,
      P1-6, P2-5). Route: delegated writer.
- [ ] **P4 — Harden `/api/crm-lead`** (P1-7): Origin/`Sec-Fetch-Site`
      check, honeypot; rate limiting documented as a Cloudflare rule.
      Decide on unused `/api/next-business-day` (it was built for a
      Twenty CRM SLA workflow — verify before removing). Route: delegated
      writer.
- [ ] **P5 — Service pages & JSON-LD** (P1-8, P1-10): related services,
      `BreadcrumbList`, `Service`, enriched `ProfessionalService` with
      only verified data. Route: delegated writer.
- [ ] **P6 — Image & cache weight** (P1-3, P2-10, P2-12). Route:
      delegated writer.
- [ ] **P7 — Form UX & robustness** (P2-6, P2-7, P2-3). Route: delegated
      writer.
- [ ] **P8 — Copy fixes** (P2-1 voseo on 404 + shell, P2-15 quotes).
      IGAFOM framing (P2-2) needs client confirmation. Route: inline or
      delegated.
- [ ] **P9 — Performance & CSS polish** (P2-8, P2-9, P2-11, P2-13,
      P2-15 tokens). Route: delegated writer.
- [ ] **P10 — Migration follow-up T12**: `pnpm shots` screenshot script
      (used >2 times) + skill update. Route: inline.
- [ ] **BLOCKED — Trust section** (P1-9): needs real data from the
      client.

## Needs the client

- GA4 measurement ID (`G-…`) → Workers Builds build variable
  `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- Data retention period and preferred data-rights (ARCO) contact.
- Trust data: years in business, team/CIP registrations, cases, hours,
  response time, email.
- IGAFOM framing ("IGAFOM de Cierre" as separate service vs. included).
- `.env.example` stale `vinext` comment (harness blocks `.env*` edits).

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

- 2026-09-23: audit done; parent verified P0-1 (privacy text
  `src/build/privacy-page.tsx:38-45` claims no server submission — false,
  form POSTs to `/api/crm-lead` → Twenty + Resend), P1-6 (built h1 text
  "impulsa.Responsabilidad"), P1-1 (`www.cominorsa.com` → 200, no
  redirect).

## Next step

P1 (privacy & consent) on `feat/landing-polish-p1`.
