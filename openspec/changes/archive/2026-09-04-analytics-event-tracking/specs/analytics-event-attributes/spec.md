# Analytics Event Attributes Specification

## Purpose

Defines a vendor-neutral `data-event` / `data-event-context` attribute
convention applied to the site's WhatsApp conversion touchpoints and the
contact form's submission attempt. The attributes are inert markup: no
script reads or dispatches them yet. They exist so a future analytics
vendor (e.g. Umami) or a GA4 custom event can be wired against a stable
marker instead of re-auditing every call-to-action.

## Requirements

### Requirement: WhatsApp CTA Event Attributes

The system MUST expose `data-event` and `data-event-context` — kebab-case,
consistent with the existing `data-open` precedent in `MobileNav.tsx` — on
each of the 3 static WhatsApp anchors: the header CTA in `SiteHeader.tsx`,
the mobile panel CTA in `MobileNav.tsx`, and the service-page CTA in
`ServicePageLayout.tsx`. `data-event-context` MUST identify the CTA's
origin, and for `ServicePageLayout.tsx` MUST vary per rendered service.

#### Scenario: Header and mobile-nav CTAs carry attributes

- GIVEN the `SiteHeader.tsx` header CTA and the `MobileNav.tsx` panel CTA
- WHEN either is rendered
- THEN it carries `data-event` and a `data-event-context` identifying its
  own origin (header vs. mobile-nav), not a differently cased or named
  variant (e.g. not `dataEvent`)

#### Scenario: Service page CTA carries per-service context

- GIVEN `ServicePageLayout.tsx` rendering two different services
- WHEN each page's CTA anchor is rendered
- THEN both carry `data-event`, and their `data-event-context` values
  differ, each identifying its own service

### Requirement: Contact Form Attempt Event (Not Success)

The system MUST mark a contact-form submission as an attempt at the point
`ConsultationForm.tsx`'s `handleSubmit` builds and opens the WhatsApp
link, using `data-event` and `data-event-context` (the latter reflecting
the selected service). The system MUST NOT represent this as a delivery
or read confirmation, because no signal exists that the WhatsApp message
was actually sent or received.

#### Scenario: Submission attempt is marked

- GIVEN a user fills the contact form and submits it
- WHEN `handleSubmit` runs and opens the WhatsApp link
- THEN the submit action is marked with `data-event` and
  `data-event-context` describing an attempt (e.g. `contact_submit`), not
  a success or confirmation

#### Scenario: No success/delivery semantics implied

- GIVEN the contact form's submission marker
- WHEN its naming or context value is read
- THEN nothing in the value or its surrounding logic asserts the message
  was delivered, read, or answered — only that a submission attempt
  occurred

### Requirement: WHATSAPP_INFORMATION Single Source of Truth

`SiteHeader.tsx` MUST reuse the `WHATSAPP_INFORMATION` constant exported
by `app/constants.ts` instead of declaring a local duplicate. This MUST
NOT change the resulting WhatsApp link URL, target, or click behavior for
either the header CTA or the CTA rendered inside `MobileNav.tsx`.

#### Scenario: Local duplicate removed

- GIVEN `SiteHeader.tsx`'s source after this change
- WHEN it is inspected
- THEN it contains no locally declared `WHATSAPP_INFORMATION` constant and
  imports it from `app/constants.ts` instead

#### Scenario: Link behavior unchanged

- GIVEN the header CTA and the mobile-nav CTA before and after this change
- WHEN a user clicks either
- THEN both open the identical WhatsApp URL, in the identical way
  (`target="_blank"`, `rel="noreferrer"`), as before the dedupe

### Requirement: No Vendor Script Coupling

The new attributes MUST remain inert: no script introduced or modified by
this change may read, dispatch, or transmit `data-event` /
`data-event-context` values. GA4 injection (`app/CookieConsent.tsx`), the
cookie-consent decision flow, and `app/privacidad/page.tsx` MUST remain
unmodified by this change.

#### Scenario: Click/submit behavior is unchanged

- GIVEN any of the 4 instrumented touchpoints after this change
- WHEN a user clicks or submits it
- THEN the only observable DOM difference is the presence of the new
  `data-*` attributes; navigation, link target, and form-submission
  behavior are unchanged from before this change

#### Scenario: Consent and GA4 files untouched

- GIVEN this change's file diff
- WHEN it is reviewed
- THEN `app/CookieConsent.tsx` and `app/privacidad/page.tsx` show no
  changes
