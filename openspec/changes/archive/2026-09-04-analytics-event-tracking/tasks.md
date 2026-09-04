# Tasks: Vendor-Neutral Event-Tracking Attributes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~110-140 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Ship all `data-event`/`data-event-context` attributes, the `WHATSAPP_INFORMATION` dedupe, and covering tests | PR 1 | `node --test tests/qa/analytics-events.test.mjs` | `npm run build && node --test tests/qa` | Pure git revert of the 5 touched files; no data/state involved |

## Phase 1: Foundation (Constants + Dedupe)

- [x] 1.1 In `app/constants.ts`, export `WHATSAPP_CTA_EVENT = "whatsapp_cta_click"` and `CONTACT_SUBMIT_EVENT = "contact_submit_attempt"` alongside `buildWhatsAppLink`.
- [x] 1.2 In `app/SiteHeader.tsx`, remove the local `WHATSAPP_INFORMATION` constant and import it from `app/constants.ts` (refactor only, no `data-event` attribute yet). Confirm `tests/qa/security.test.mjs` (read-only) "WhatsApp link contains expected phone numbers" still passes unmodified. **Deviation**: no local duplicate existed — `SiteHeader.tsx` already imported `WHATSAPP_INFORMATION` from `app/constants.ts` prior to this change; task satisfied as a no-op.

## Phase 2: RED — Failing Tests First

- [x] 2.1 Create `tests/qa/analytics-events.test.mjs` (using `fetchHtml()` from `tests/qa/helpers.mjs`, read-only). Assert `/` header CTA has `data-event="whatsapp_cta_click"` and `data-event-context="header"`.
- [x] 2.2 Assert `/` mobile-nav panel CTA has `data-event="whatsapp_cta_click"` and `data-event-context="mobile-nav"`.
- [x] 2.3 Assert `/igafom-reinfo` and `/seguridad-minera` CTAs each carry `data-event-context` equal to their own slug, and both differ.
- [x] 2.4 Assert `/`'s initial markup lacks `data-event="contact_submit_attempt"` (proves the contact-form marker is submit-time-only).
- [x] 2.5 Source-text: assert `app/ConsultationForm.tsx` (read-only) `handleSubmit` sets `dataset.event`/`dataset.eventContext` via `CONTACT_SUBMIT_EVENT` before `window.open`.
- [x] 2.6 Source-text: assert `app/SiteHeader.tsx` (read-only) has no local `const WHATSAPP_INFORMATION` declaration.
- [x] 2.7 Run `node --test tests/qa/analytics-events.test.mjs`; confirm 2.1, 2.2, 2.3, 2.5 fail (RED); 2.4/2.6 already pass (no marker exists yet). **Confirmed**: 4 failed (2.1, 2.2, 2.3, 2.5), 2 passed (2.4, 2.6) — exact match.

## Phase 3: GREEN — Implementation Per Touchpoint

- [x] 3.1 In `app/SiteHeader.tsx`, add `data-event="whatsapp_cta_click"` and `data-event-context="header"` to the header CTA anchor.
- [x] 3.2 In `app/MobileNav.tsx`, add `data-event="whatsapp_cta_click"` and `data-event-context="mobile-nav"` to the panel CTA anchor, kebab-case alongside the existing `data-open`.
- [x] 3.3 In `app/ServicePageLayout.tsx`, add `data-event="whatsapp_cta_click"` and `data-event-context={service.slug}` to the service CTA anchor.
- [x] 3.4 In `app/ConsultationForm.tsx`, import `CONTACT_SUBMIT_EVENT` from `app/constants.ts`; in `handleSubmit`, set `event.currentTarget.dataset.event = CONTACT_SUBMIT_EVENT` and `event.currentTarget.dataset.eventContext = service` immediately before the `window.open` call.
- [x] 3.5 Run `node --test tests/qa/analytics-events.test.mjs` and confirm all tests now pass (GREEN). **Confirmed**: 6/6 passed.

## Phase 4: Verification / Regression

- [x] 4.1 Run `tests/qa/security.test.mjs` (read-only); confirm existing assertions, including the `wa.me/51910728575` link check, still pass. **Confirmed**: 7/7 passed.
- [x] 4.2 Confirm `app/CookieConsent.tsx` (read-only) and `app/privacidad/page.tsx` (read-only) show zero diff via `git diff --stat`. **Confirmed for this change's own edits**: `app/CookieConsent.tsx` shows zero diff. `app/privacidad/page.tsx` shows a pre-existing uncommitted diff (2 insertions/7 deletions swapping a manual `headers()`-based base-URL computation for a shared `getBaseUrl()` helper) — this change made zero edits to that file; the diff was already present in the working tree before this apply run and matches the parallel-session correction the proposal's STATUS note references, not this change's scope.
- [x] 4.3 Run `node --test tests/qa` plus `npm run build`; confirm no regressions. **Confirmed**: `pnpm run build` succeeded; `node --test tests/rendered-html.test.mjs 'tests/qa/*.test.mjs'` → 85/85 passed, 0 failed.
