# Landing Craft — Award-Level UI/UX

## Objective

Raise the home page from "professional" to award-level craft without
hurting clarity, speed or conversion: say each thing once, turn the
method into the real formalization route, and make the terrain concept
(real Piura topography + geological strata) the visual thread of the
whole site.

## Problem

Code review (2026-09-24) found: the WhatsApp CTA repeated ~5×, both
phones 3×, "formal, segura y sostenible" ~4×; the `impact` section
restates `nosotros`; the hero card competes with the primary CTA; the
method is 4 generic steps; the contour idea is a decorative
`repeating-radial-gradient` limited to the hero.

## Why

Audience: small/artisanal miners in Piura, mobile-first, possibly poor
connectivity, WhatsApp-centric. "Best in the world" here means clarity,
trust, speed and one obvious action — not WebGL or scroll-jacking.

## Constraints

- Zero runtime dependencies; build-time generation only. Tokens only in
  `app/globals.css` (`cominorsa-design-tokens`, radius 0).
- Copy in neutral Peruvian Spanish (tú). Code/tests/commits in English.
- Never invent business facts. Regulatory route content (T3) comes from
  official sources (MINEM, El Peruano, gob.pe), cited here, and is
  flagged for client review before production.
- Motion: CSS-only, progressive enhancement, `prefers-reduced-motion`
  respected; LCP (hero h1) never hidden.
- Every push to `main` deploys production. Work stays on
  `feat/landing-craft`; push/PR/merge are the user's decisions.
- Out of scope: point 1 (real photos, figures, cases, team) — needs
  client content.

## Resolved configuration

- **TDD**: Strict TDD ON (project convention). Runners: `bun test src/`,
  `pnpm test`, `pnpm test:e2e`.
- **Visual verification**: `cominorsa-run` skill (screenshots 1440/390).
- **Topography source**: AWS Terrain Tiles (Terrarium PNG, SRTM-derived),
  `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`,
  reachable 2026-09-24. Output committed as a static SVG asset.

## Tasks

- [ ] **T1 — Say it once**: one primary CTA in the hero; remove the
      duplicate hero-card phones; merge `impact` into `nosotros`; one
      contact block holding phones + address. Update home tests.
- [x] **T2 — Research the official formalization route** (REINFO →
      IGAFOM → …): steps, required documents, sources with publisher/date.
      Output `odd/research/formalization-route.md`.
      - Delegated explorer had no web tools; parent researched inline.
        Primary sources read: gob.pe/101185 (requirements, updated
        14 Oct 2025) and the MINEM news on Ley Nº 32537 (extends until
        31 Dec 2026 or Ley MAPE). The authority per stage is secondary
        and uncertain after the archive transfer to MINEM, so the site
        does not name DREM. 6-step copy drafted, REVIEW: client,
        4 open questions.
- [ ] **T3 — Method → formalization route**: replace the 4 generic steps
      with the researched route, presented as a path on the map; copy
      flagged `REVIEW: client` in the task doc.
- [ ] **T4 — Real Piura contours**: build-time script (no deps) that
      decodes Terrarium tiles and runs marching squares to emit an SVG of
      real Piura contour lines; replace the hero gradient and reuse it as
      the site-wide thread.
- [ ] **T5 — Geological strata**: section transitions as layered strata
      in the forest → sand → cream palette.
- [ ] **T6 — CSS-only motion**: scroll-driven reveals
      (`animation-timeline: view()`) and cross-document
      `@view-transition`, all under `prefers-reduced-motion:
      no-preference` and `@supports`.
- [ ] **T7 — Visual QA & full checks**: screenshots 1440/390 of every
      changed page, contrast check of new pairs, `pnpm test`,
      `bun test src/`, `pnpm test:e2e`.
