# Exploration: website-crm-lead-capture — wiring ConsultationForm/WhatsApp CTAs to Twenty CRM

## Current State

`app/ConsultationForm.tsx` is client-only: it builds a `wa.me` deep link from FormData and calls `window.open()`. Confirmed via `grep fetch\( app/` — zero matches anywhere under `app/`. `SiteHeader.tsx`/`MobileNav.tsx`/`ServicePageLayout.tsx` WhatsApp CTAs are plain links carrying only GA4 `data-event` markers (verified directly, not just trusted from the brief). No `route.ts` and no `"use server"` exist anywhere in `app/` yet — this change would introduce the site's first backend code path. `scripts/validate-env.mjs` explicitly documents the current assumption: "form is WhatsApp-based, no DB."

## Verified Online / In-Package

- vinext's own README (read from `node_modules/.pnpm/vinext@1.0.0-beta.9.../README.md`) confirms full support for both Server Actions and Route Handlers on Cloudflare Workers, plus `next/server`'s `after()` for post-response fire-and-forget work — this is the framework-native equivalent of `ctx.waitUntil()`.
- Twenty's Core REST API (`/rest/people`, `/rest/companies`, etc., exact plural unverified) uses the same `Authorization: Bearer <TWENTY_API_KEY>` pattern already proven in `docker/twenty/scripts/create-fields.mjs` (Metadata API, change 1). Rate limit ~100 req/min, batch up to 60 — irrelevant at this site's volume.
- Twenty has no purpose-built public form-submission endpoint; it has inbound Workflow webhook triggers, but those require a live, already-configured Twenty workspace — which doesn't exist yet (change 3 is later). Not viable for this change.

## Affected Areas

- `app/ConsultationForm.tsx` — needs a non-blocking call to a new server entry point.
- New file: a Server Action or Route Handler doing the actual Twenty Core API call, env-var-gated on `TWENTY_API_KEY`/`TWENTY_API_URL`.
- Root `.env.example` — needs new documented vars; could not be read this session (sandbox permission denial, same class as change 1's `docker/twenty/.env.example` blocker) — must be re-verified before editing.
- `docker/twenty/scripts/field-definitions.mjs` — possibly, if new lead-specific fields are needed (see open question below).
- `tests/qa/` — new test following the `twenty-create-fields.test.mjs` convention (mocked `fetch`, `node --test`).
- Not affected: WhatsApp-only CTA links in header/nav/service pages (no form data to submit).

## Approaches Considered

1. **Server Action or Route Handler calling Twenty's Core REST API directly**, gated on env vars being present, fire-and-forget, with the same defensive Bearer-auth/error-handling pattern as `create-fields.mjs`. This is the only approach consistent with verified vinext/Workers capability, existing repo precedent, WhatsApp-flow safety, and full unit-testability without a live Twenty instance.
2. **Twenty inbound webhook trigger** — rejected: requires a live, pre-configured Twenty workspace with a Workflow already set up, which doesn't exist until change 3.
3. **Third-party form backend** (e.g. Formspree-style) — rejected: relocates the same integration problem to a different vendor without any benefit given change 1 already stood up Twenty's own API surface.

**Recommendation**: Approach 1.

## Open Questions for sdd-propose

1. **Server Action vs. Route Handler** — a Route Handler makes the "never block WhatsApp" fire-and-forget intent more explicit and avoids popup-blocker sequencing risk with `window.open()` (a Server Action's response round-trip could delay the click-triggered popup past the browser's popup-blocker window).
2. **What data model to send** — the 15 existing custom fields (perfilIcp, nConcesiones, etc.) target imported concession-holder companies, not a fresh web lead with just name/city/service/question. Needs new fields, reuse of `servicioPotencial`/`fuenteDato`, or a Note-based approach — a genuine product decision, not guessed here.
3. Root `.env.example`'s exact current contents need re-confirmation (unreadable this session due to the same sandbox permission class as change 1's `.env.example` blocker) before design decides the new env var names.

## Risks

- Twenty's exact Core API endpoint/payload shape is unverified without a live instance (same risk class change 1 flagged and mitigated defensively).
- No live Twenty instance exists until change 3 — this must be a true no-op when env vars are unset, never a blocking/retrying failure.
- Popup-blocker UX risk if the CRM call is awaited before `window.open()` — must design around this explicitly.
- New backend attack surface (however small) — needs a Threat Matrix entry in design.md, following change 1's precedent.
