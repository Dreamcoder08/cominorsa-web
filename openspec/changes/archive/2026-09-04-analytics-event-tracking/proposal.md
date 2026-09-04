# Proposal: Vendor-Neutral Event-Tracking Attributes (GA4 Kept, Umami-Ready)

> **STATUS: RESUMED (2026-09-04).** Re-confirmed with the user: GA4 (`G-TV5E1T44EZ`) is live in production and stays — it is NOT being removed. `privacidad/page.tsx` §3 was already corrected in a parallel session to accurately state GA4 is active; that item is done and dropped from scope. The only remaining real gap is that conversion touchpoints (WhatsApp CTAs, contact form) carry no stable event markers, so wiring a second vendor (Umami) or GA4 custom events later means re-deriving which element means what. This revision drops the GA4-removal and privacy-rewrite scope items and keeps only the additive instrumentation work.

## Intent

Conversion touchpoints (WhatsApp CTAs, contact form submit) have no stable, vendor-neutral event markers today. This change adds a kebab-case `data-event`/`data-event-context` attribute convention at each real touchpoint — purely additive, no vendor script reads them yet — so a future Umami (or GA4 custom-event) wiring change is a small diff instead of a fresh audit of every CTA. It also dedupes a `WHATSAPP_INFORMATION` constant while those files are already being touched.

## Scope

### In Scope
- Add a kebab-case `data-event`/`data-event-context` attribute convention (matching the sole existing `data-open` precedent) to all 4 WhatsApp touchpoints: `SiteHeader.tsx`, `MobileNav.tsx`, `ServicePageLayout.tsx`, and `ConsultationForm.tsx`'s submit button/handler.
- Fix `SiteHeader.tsx`'s locally duplicated `WHATSAPP_INFORMATION` constant to reuse `constants.ts`'s exported one, since that file is already being touched to add the attribute.
- Document the `contact_submit`-style event as "attempt", not "success" (no `window.open`/send confirmation exists).

### Out of Scope
- Removing, modifying, or wiring GA4 (`app/CookieConsent.tsx` stays as-is).
- Rewriting `privacidad/page.tsx` (§3 already accurate — done in a prior session).
- Provisioning any server or Umami instance, or installing Umami.
- Writing any script that reads the new `data-*` attributes or fires real analytics events from them.
- Removing or restructuring the cookie-consent infrastructure itself.
- Changing the consent decision UX (accept/reject flow, storage key, custom event).

## Capabilities

### New Capabilities
- `analytics-event-attributes`: vendor-neutral `data-*` event-naming convention applied to the 4 WhatsApp touchpoints and the contact form's submit attempt; no vendor script consumes it yet.

### Modified Capabilities
None — no prior spec baseline exists in this repo for analytics/consent behavior. GA4 script injection (`CookieConsent.tsx`) and the privacy-policy analytics disclosure (`privacidad/page.tsx` §3) are pre-existing, out-of-scope behavior — not touched by this change.

## Approach

1. Define a small shared event-name constant set (or literal `data-event`/`data-event-context` values) in `constants.ts` alongside `buildWhatsAppLink`, and apply them at each of the 4 touchpoints — static anchors get the attribute directly; `ConsultationForm.tsx` fires from `handleSubmit` since the per-submission context isn't known at render time.
2. Replace `SiteHeader.tsx`'s local `WHATSAPP_INFORMATION` with the `constants.ts` export.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/constants.ts` | Modified | Add shared event-name values |
| `app/SiteHeader.tsx` | Modified | Dedupe `WHATSAPP_INFORMATION`; add `data-*` attrs |
| `app/MobileNav.tsx` | Modified | Add `data-*` attrs to WhatsApp CTA |
| `app/ServicePageLayout.tsx` | Modified | Add `data-*` attrs, keyed by service slug |
| `app/ConsultationForm.tsx` | Modified | Fire attempt event from `handleSubmit` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Event-name convention drifts from future Umami's actual event model | Low | Keep names generic/descriptive, not Umami-API-shaped |
| Attribute addition accidentally changes existing click/submit behavior | Low | Attributes only; no handler logic changes except firing one inert data attribute read in `ConsultationForm.tsx`'s existing `handleSubmit` |

## Rollback Plan

Pure revert of the touched files (`constants.ts`, `SiteHeader.tsx`, `MobileNav.tsx`, `ServicePageLayout.tsx`, `ConsultationForm.tsx`) via git; no data migration, no external service state involved.

## Dependencies

None — GA4 stays as-is; no external service or credential needed for this change.

## Success Criteria

- [ ] All 4 WhatsApp touchpoints and the contact form carry consistent `data-event`/`data-event-context` attributes.
- [ ] `SiteHeader.tsx` no longer duplicates `WHATSAPP_INFORMATION`.
- [ ] `CookieConsent.tsx` and `privacidad/page.tsx` are untouched by this change.
