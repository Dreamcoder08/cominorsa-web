# Design: Vendor-Neutral Event-Tracking Attributes

## Technical Approach

Add two exported event-name constants to `app/constants.ts` (alongside the
existing `buildWhatsAppLink`/`WHATSAPP_INFORMATION` exports) and apply
`data-event` / `data-event-context` attributes at the 3 static WhatsApp
anchors and one dynamic marker in `ConsultationForm.tsx`. Per-touchpoint
`data-event-context` values are derived from data already in scope at each
site (a literal origin string, the existing `service.slug`, or the
form's selected service) rather than centralized, since the spec requires
them to differ per instance. `SiteHeader.tsx`'s local `WHATSAPP_INFORMATION`
duplicate is replaced by the `constants.ts` export in the same edit. No
vendor script, dispatch, or new dependency is introduced — matches spec
`analytics-event-attributes`.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Where event-name strings live | Export `WHATSAPP_CTA_EVENT` and `CONTACT_SUBMIT_EVENT` from `constants.ts`; keep per-touchpoint `data-event-context` as local literals/derived values, not centralized | (a) Fully inline literals at all 4 sites — rejected, the same WhatsApp CTA event name would be retyped 3x with no compiler-enforced consistency; (b) a full `{event, context}` map object in `constants.ts` — rejected, contexts are inherently per-instance (`service.slug`, selected service text) already in scope, a static map adds indirection for no gain | Matches the proposal's "shared event-name constant set" while avoiding a map that duplicates data that already exists locally |
| Service-page context value | `data-event-context={service.slug}` reusing the existing `service` prop | Pass a new `eventContext` prop from each `page.tsx` | `ServiceGroup.slug` already flows into `ServicePageLayout`; no new prop needed |
| Contact-form attempt marker | Inside `handleSubmit`, immediately before `window.open`, set `event.currentTarget.dataset.event = CONTACT_SUBMIT_EVENT` and `event.currentTarget.dataset.eventContext = service` on the `<form>` (`event.currentTarget`, already `HTMLFormElement`) | (a) Statically render the attrs on the submit `<button>` — rejected, the context must reflect the *selected* service, unknown until `FormData` is read at submit time; (b) a no-op function call/`console.log` — rejected, produces no inspectable DOM marker, defeats the markup-convention intent; (c) `dispatchEvent`/`CustomEvent` — rejected, spec's "No Vendor Script Coupling" requirement forbids dispatching these values | Only way to reflect a submit-time-known value as inert markup without state, a ref, or a vendor call |
| Testing approach | Extend the existing SSR-HTML regex convention (`tests/qa/helpers.mjs` `fetchHtml(pathname)`) in a new `tests/qa/analytics-events.test.mjs`; add one source-text assertion for `handleSubmit`'s imperative `dataset` writes | (a) Add `@testing-library/react` + jsdom to unit-test the handler in isolation — rejected, no precedent exists (zero React component unit tests in this repo; `MobileNav`'s existing `data-open` has no covering test per codegraph blast-radius scan); (b) skip testing the form behavior — rejected, Strict TDD is active and the spec has an explicit scenario for it | Proportional to project convention; avoids introducing new test infrastructure for a 1-line dataset assignment |

## Data Flow

    Render time (SSR):
      SiteHeader ──data-event, data-event-context="header"──→ anchor
      MobileNav  ──data-event, data-event-context="mobile-nav"──→ anchor
      ServicePageLayout(service) ──data-event, data-event-context=service.slug──→ anchor

    Submit time (client, after hydration):
      ConsultationForm.handleSubmit(event)
        → reads FormData → service
        → event.currentTarget.dataset.event = CONTACT_SUBMIT_EVENT
        → event.currentTarget.dataset.eventContext = service
        → window.open(wa.me URL)   (unchanged, no script reads the dataset)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/constants.ts` | Modify | Export `WHATSAPP_CTA_EVENT` and `CONTACT_SUBMIT_EVENT` alongside `buildWhatsAppLink` |
| `app/SiteHeader.tsx` | Modify | Drop local `WHATSAPP_INFORMATION`, import it from `constants.ts`; add `data-event`/`data-event-context="header"` to the header CTA anchor |
| `app/MobileNav.tsx` | Modify | Add `data-event`/`data-event-context="mobile-nav"` to the panel CTA anchor, kebab-case alongside the existing `data-open` |
| `app/ServicePageLayout.tsx` | Modify | Add `data-event`/`data-event-context={service.slug}` to the service CTA anchor |
| `app/ConsultationForm.tsx` | Modify | Import `CONTACT_SUBMIT_EVENT`; set `dataset.event`/`dataset.eventContext` on the form element in `handleSubmit`, before `window.open` |
| `tests/qa/analytics-events.test.mjs` | Create | RED/GREEN coverage per Testing Strategy below |

## Interfaces / Contracts

```typescript
// app/constants.ts additions
export const WHATSAPP_CTA_EVENT = "whatsapp_cta_click";
export const CONTACT_SUBMIT_EVENT = "contact_submit_attempt";
```

No other type/interface changes; `ServiceGroup` and component prop shapes are unchanged.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| SSR-HTML (existing convention) | Header + mobile-nav CTAs carry `data-event="whatsapp_cta_click"` and their respective `data-event-context` | `fetchHtml("/")`, regex-match both anchors' attributes |
| SSR-HTML (existing convention) | Two distinct service pages render distinct `data-event-context` values | `fetchHtml("/igafom-reinfo")` and `fetchHtml("/seguridad-minera")`, assert contexts differ and match each slug |
| SSR-HTML negative | Contact form's initial markup does NOT carry the attempt attributes (proves submit-time-only, not pre-rendered) | `fetchHtml("/")`, assert `data-event="contact_submit_attempt"` is absent |
| Source-text | `handleSubmit` imperatively sets `dataset.event`/`dataset.eventContext` using `CONTACT_SUBMIT_EVENT` before `window.open` | Read `app/ConsultationForm.tsx` as text, regex-assert the assignment exists and precedes `window.open` |
| Dedupe regression | `SiteHeader.tsx` no longer declares a local `WHATSAPP_INFORMATION`; link URL/target unchanged | Source-text assertion (no local `const WHATSAPP_INFORMATION`) + existing `wa.me/51910728575` SSR-HTML assertion in `tests/qa/security.test.mjs` still passes |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This change is additive markup plus one constant dedupe.

## Migration / Rollout

No migration required. Pure additive `data-*` attributes and one constant dedupe; ships in the normal deploy pipeline, no flag needed.

## Open Questions

None.
