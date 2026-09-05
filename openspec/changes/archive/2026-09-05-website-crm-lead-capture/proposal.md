# Proposal: Website CRM Lead Capture (ConsultationForm → Twenty)

## Intent

`app/ConsultationForm.tsx` currently only builds a `wa.me` link and opens
WhatsApp — every consultation lead is lost to CRM the moment the visitor's
WhatsApp app takes over. Change 1 (`twenty-crm-local-setup`) stood up a local
Twenty instance and its 15 concession-import fields, but nothing on the live
site writes to it. This change wires the form's actual submission to Twenty
as a Person record, without touching or slowing down the WhatsApp flow that
is the site's only functioning contact path today.

## Scope

### In Scope
- New Route Handler (`app/api/crm-lead/route.ts`) that creates a Twenty
  Person via the Core REST API, gated on `TWENTY_API_KEY`/`TWENTY_API_URL`.
- Non-blocking `fetch` call from `ConsultationForm.tsx` to that handler,
  fired before/alongside `window.open()` — never awaited, never delays or
  breaks WhatsApp opening.
- 4 new Person-only custom fields in `field-definitions.mjs`, provisioned
  locally via `create-fields.mjs` alongside the existing 15.
- Unit tests for the Route Handler with a mocked `fetch`, following
  `twenty-create-fields.test.mjs` conventions.

### Out of Scope
- `twenty-crm-local-setup` (change 1) — already done.
- `twenty-crm-cloud-deploy` (change 3) — future; this change must work with
  zero reachable Twenty instance, which is production's state until then.
- Plain WhatsApp CTA links (`SiteHeader`, `MobileNav`, `ServicePageLayout`) —
  no form data, GA4-only instrumentation, unchanged.
- Exact root `.env.example` var placement — unreadable this session
  (sandbox permission denial); finalize in design/tasks.

## Capabilities

### New Capabilities
- `website-lead-capture`: Route Handler + fire-and-forget client call that
  turns a `ConsultationForm` submission into a Twenty Person record.

### Modified Capabilities
- `twenty-field-provisioning`: extended to also provision a new,
  website-lead-specific field set on the Person object (not Company),
  alongside the existing 15-field set from change 1.

## Approach

1. **Route Handler, not Server Action** — explicit fire-and-forget
   semantics; avoids popup-blocker sequencing risk between a Server Action's
   response round-trip and `window.open()`.
2. **New Data Model, not reuse** — the 15 existing `CUSTOM_FIELDS` model
   imported concession-holder companies/people and must not be overloaded.
   Add a separate `WEBSITE_LEAD_FIELDS` export, applied to **Person only**:

   | name | label | type | notes |
   |---|---|---|---|
   | `servicioConsulta` | Servicio de Consulta | TEXT | selected service label; TEXT (not SELECT) so `serviceOptions` can evolve without a metadata migration — mirrors existing `servicioPotencial` precedent |
   | `consultaMensaje` | Consulta | TEXT | free-text question body |
   | `lineaWhatsapp` | Línea WhatsApp | SELECT | options: `PRINCIPAL_910728575`, `SECUNDARIA_987817100` — fixed, small set, safe as SELECT |
   | `origenLead` | Origen del Lead | TEXT | always `"Sitio Web - Formulario de Consulta"`; distinguishes these from imported concession leads without a separate enum |

   `name` and `city` map to Twenty's existing standard Person fields (Name,
   City) — no new custom fields needed for them.
3. **Fail-silent by design** — the handler checks env vars first and no-ops
   (200, does nothing) if unset; all Twenty API errors are caught and logged
   server-side only, following `create-fields.mjs`'s `twentyRequest()`
   pattern (read raw body, never assume payload shape, never throw outward).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `app/ConsultationForm.tsx` | Modified | Add non-awaited `fetch()` to the new route before `window.open()` |
| `app/api/crm-lead/route.ts` | New | Route Handler: env-gated, creates a Twenty Person, never throws |
| `docker/twenty/scripts/field-definitions.mjs` | Modified | Add `WEBSITE_LEAD_FIELDS` (4 entries, Person-only) |
| `docker/twenty/scripts/create-fields.mjs` | Modified | Also provision `WEBSITE_LEAD_FIELDS` on Person |
| `.env.example` (root) | Modified | Document `TWENTY_API_KEY`/`TWENTY_API_URL`; exact placement TBD in design |
| `tests/qa/` | New | Route handler unit tests, mocked `fetch`, no live instance needed |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| CRM outage/latency leaks into WhatsApp flow | Low (if built as specced) | Fetch is never awaited before `window.open()`; handler catches everything, always no-ops cleanly |
| Twenty Core REST payload shape for creating a Person is unverified | Med | Same defensive `twentyRequest()`-style handling as change 1: read raw body, fail loudly server-side only |
| Root `.env.example` unreadable this session | Low | Re-verify contents in design phase before naming new vars |
| New fields drift from change 3's eventual cloud schema | Low | `field-definitions.mjs` stays the single source of truth; change 3 provisions from it, not a duplicate |

## Rollback Plan

Revert `ConsultationForm.tsx` and delete `app/api/crm-lead/route.ts`; drop
`WEBSITE_LEAD_FIELDS` from `field-definitions.mjs`/`create-fields.mjs`. No
production Twenty instance exists yet, so no data migration or live-data
cleanup is needed at any point.

## Dependencies

- `twenty-crm-local-setup` (change 1) stack for local dev verification.
- `twenty-crm-cloud-deploy` (change 3) for the handler to ever reach a
  production instance — this change must fully function without it.

## Success Criteria

- [ ] Submitting `ConsultationForm` opens WhatsApp exactly as today, zero
      perceptible delay, when Twenty env vars are unset (today's prod state).
- [ ] With env vars set (local dev, change 1's stack running), submitting
      the form creates a Person in Twenty with all 4 new fields populated.
- [ ] A CRM API failure (network error, bad key, Twenty down) never surfaces
      to the user and never blocks/delays WhatsApp opening.
- [ ] Route Handler is fully unit-tested with a mocked `fetch`; zero
      regressions across the existing 109+ test suite.
- [ ] All 4 new Person fields exist locally, provisioned by
      `create-fields.mjs`, not by hand.
