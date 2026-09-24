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

- [x] **T1 — Say it once**: one primary CTA in the hero; remove the
      duplicate hero-card phones; merge `impact` into `nosotros`; one
      contact block holding phones + address. Update home tests.
      - Commit `9286671`. Done inline (workers OOM-killed). The hero card
        is now "¿Qué necesitas?" with one link per `serviceGroups` slug;
        `.hero-footer` strip and `section.impact` removed with their CSS.
        Deviation: `impact` was removed rather than merged, because its
        copy repeated the `nosotros` title almost word for word.
      - Evidence: RED 3 fail → GREEN; `bun test src/` 306/306,
        `pnpm test` 195/195; DOM check at 1440/390: 0 px horizontal
        overflow, 6 links in the card. `pnpm test:e2e` deferred to T7.
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
- [x] **T3 — Method → formalization route**: replace the 4 generic steps
      with the researched route, presented as a path on the map; copy
      flagged `REVIEW: client` in the task doc.
      - Commit `7e87308`. Route: inline (1 TSX + its test + CSS, already
        understood). Six stops from `odd/research/formalization-route.md`
        as an `<ol class="steps route">`; kicker "Ruta de formalización",
        title "Tu ruta hacia la formalización."; source line linking
        gob.pe/101185. Layout: 3 × 2 path with a per-stop segment
        (scroll-drawn under `@supports`/no-preference), hollow marker
        on the destination; 2 columns ≤820 px; vertical rail with nodes
        ≤560 px.
      - **REVIEW: client** — all six step texts, the intro paragraph, and
        the 4 open questions in the research doc.
      - Evidence: RED 3 fail → GREEN; `bun test src/` 308/308,
        `pnpm test` 195/195; section screenshots 1440/900/700/390:
        0 px overflow, 0 console errors. Color pairs reused
        (`--muted`/`--copper-ink` on `--cream`), no new pair.
        RDD: off (clone-local), assess `medium`/`under_budget`.
- [x] **T4 — Real Piura contours**: build-time script (no deps) that
      decodes Terrarium tiles and runs marching squares to emit an SVG of
      real Piura contour lines; replace the hero gradient and reuse it as
      the site-wide thread.
      - Commit `aa87774`. Route: inline (writers OOM-killed earlier;
        module is self-contained). Pure `src/build/contours.ts` (PNG
        decode with all 5 filters, Terrarium, marching squares with
        saddle resolution, segment joining, RDP, SVG) +
        `scripts/generate-contours.ts` (manual, network) →
        committed `public/piura-contours.svg`: z11 tiles x568–570
        y1050–1051 (Paimas/Ayabaca), 149–3493 m, 200 m interval,
        1000 m index lines, 75 KB raw / 32 KB gzip.
      - Deviation: SVG used as CSS `mask-image` over a token
        `background-color` (an SVG loaded by CSS cannot inherit
        `currentColor`), so colors stay tokens. Marked external in the
        CSS bundle (not inlined as data: into every page's `<style>`),
        1-day cache like the other fixed-name images. Thread: hero
        (copper-light 0.16, faded behind the headline) + contact
        (forest 0.08, faded upward) — replaces both radial-gradient
        stand-ins.
      - Evidence: RED (missing module; then 4 wiring fails) → GREEN;
        `bun test src/` 323/323, `pnpm test` 195/195, typecheck ok;
        screenshots hero/contact 1440/390: 0 px overflow, 0 console
        errors, text legible over the lines.
- [x] **T5 — Geological strata**: section transitions as layered strata
      in the forest → sand → cream palette.
      - Commit `bea336b`. Route: inline. `src/build/strata.tsx`: inline
        SVG (4 folded bands, `preserveAspectRatio="none"`, ~400 B),
        colors only via CSS classes/custom properties. Five dividers on
        the home page (`to` paper/ink/cream/deep/sand); each overlaps
        the previous section's bottom padding (negative margin =
        `--strata-h`, clamp 40–88 px) and ends in the next section's
        surface token. Toward light: forest → copper vein → sand/cream;
        toward dark: sand → vein → forest. `.consultation` gained a
        solid `--ink-deep` top fade so its diagonal gradient meets the
        strata without a seam.
      - Evidence: RED (missing module + 3 fails) → GREEN; `bun test
        src/` 328/328, `pnpm test` 195/195, typecheck ok; seam contact
        sheets at 1440/390: no visible seam, no content overlap.
      - Gotcha: `bun test src/` (build.test) recreates `dist-static/`
        and leaves a running `wrangler dev` answering 500 — restart it.
- [ ] **T6 — CSS-only motion**: scroll-driven reveals
      (`animation-timeline: view()`) and cross-document
      `@view-transition`, all under `prefers-reduced-motion:
      no-preference` and `@supports`.
- [ ] **T7 — Visual QA & full checks**: screenshots 1440/390 of every
      changed page, contrast check of new pairs, `pnpm test`,
      `bun test src/`, `pnpm test:e2e`.
