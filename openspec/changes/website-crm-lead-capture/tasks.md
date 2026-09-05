# Tasks: Website CRM Lead Capture (ConsultationForm → Twenty)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300–360 authored: `field-definitions.mjs` +10, `create-fields.mjs` refactor ~30, `twenty-create-fields.test.mjs` ~60, `route.ts` new ~45, `ConsultationForm.tsx` +7, `crm-lead-route.test.mjs` new ~150, `.env.example` +3 (if unblocked) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Field provisioning refactor: `WEBSITE_LEAD_FIELDS` + `OBJECT_FIELD_SETS` | PR 1 | `node --test tests/qa/twenty-create-fields.test.mjs` | Manual `pnpm twenty:fields` vs change 1's local stack (human, Docker) | Drop `WEBSITE_LEAD_FIELDS` export + `OBJECT_FIELD_SETS`; restore single-set `ensureFieldsForObject(config, objectName)` |
| 2 | Route Handler + non-blocking client wiring | PR 1 | `node --test tests/qa/crm-lead-route.test.mjs` | Manual form submission vs change 1's local stack (human, Docker + `.env.example` pending) | Delete `app/api/crm-lead/route.ts`; revert the appended `fetch()` block in `ConsultationForm.tsx` |

## Phase 1: Field Provisioning Refactor

- [x] 1.1 [UNIT] Add `WEBSITE_LEAD_FIELDS` export to `docker/twenty/scripts/field-definitions.mjs` (4 entries: `servicioConsulta` TEXT, `consultaMensaje` TEXT, `lineaWhatsapp` SELECT with options `PRINCIPAL_910728575`/`SECUNDARIA_987817100`, `origenLead` TEXT).
- [x] 1.2 [UNIT] Refactor `ensureFieldsForObject` in `docker/twenty/scripts/create-fields.mjs` to `ensureFieldsForObject(config, objectName, fields)`, diffing against the passed `fields` array instead of the hardcoded `CUSTOM_FIELDS`.
- [x] 1.3 [UNIT] Add `OBJECT_FIELD_SETS` map (`company: [CUSTOM_FIELDS]`, `person: [CUSTOM_FIELDS, WEBSITE_LEAD_FIELDS]`) and update `run()` to flatten each object's field sets before calling `ensureFieldsForObject`, and to check completeness against that object's full required-name set.
- [x] 1.4 [UNIT] Update `tests/qa/twenty-create-fields.test.mjs` call sites to the new 3-arg `ensureFieldsForObject` signature.
- [x] 1.5 [UNIT] Add test cases: `WEBSITE_LEAD_FIELDS` (4 entries, `lineaWhatsapp` is the only SELECT) provisions on person only; none of the 4 fields are ever posted for company.

## Phase 2: Route Handler

- [x] 2.1 [LIVE-VERIFY] Create `app/api/crm-lead/route.ts` exporting `POST`: env gate on `TWENTY_API_KEY`/`TWENTY_API_URL` (unset/empty → `Response.json({ ok: true })`, no fetch), `try/catch` JSON body parse, split `name` into `firstName`/`lastName`, map `whatsappLine` to `lineaWhatsapp`, POST to `${apiUrl}/rest/people` with `Bearer` auth and the 4 custom fields + fixed `origenLead`. Payload shape is provisional per design.md's contract sketch — unverified against a live instance.
- [x] 2.2 [UNIT] Implement error handling as a self-contained, non-exiting variant (do NOT import `twentyRequest` from `create-fields.mjs` — its `process.exit(1)` would crash the Workers isolate): non-2xx and network-error paths log via `console.error` and always still return `Response.json({ ok: true })`.

## Phase 3: Client Wiring

- [x] 3.1 Append a non-awaited, `.catch(() => {})`-guarded `fetch("/api/crm-lead", ...)` call to `handleSubmit` in `app/ConsultationForm.tsx`, placed after the existing `window.open()`/`setSent(true)` lines (unchanged, untouched), sending `{ name, city, service, question, whatsappLine: recipient }`.

## Phase 4: Route Handler Testing

- [x] 4.1 [UNIT] Create `tests/qa/crm-lead-route.test.mjs`: env-gate case — `TWENTY_API_KEY`/`TWENTY_API_URL` unset → response is `200`, mocked `fetch` call count is `0`.
- [x] 4.2 [UNIT] Happy-path case: mocked `fetch` captures the `/rest/people` URL, `Bearer` header, and body containing split `name`, `city`, all 4 custom fields, and fixed `origenLead`; response is `200`.
- [x] 4.3 [UNIT] Twenty non-2xx and network-error cases (mocked `fetch` returns 500 / rejects): response is still `200`, `console.error` is called, nothing throws.
- [x] 4.4 [UNIT] Malformed JSON body case (`request.json()` rejects): response is `200`, no throw, no `fetch` call.
- [x] 4.5 [UNIT] Run `pnpm test`; confirm all existing suites plus the two new/updated files pass with zero regressions.
- [x] 4.6 [UNIT] [FOLLOW-UP from sdd-verify FAIL, CRITICAL] Create `tests/qa/consultation-form-nonblocking.test.mjs`: render `ConsultationForm` in jsdom (`tsx/esm/api` + `@testing-library/react`, same convention as `tests/qa/mobile-nav-interaction.test.mjs`), mock `window.open` and `global.fetch`, submit the form, and assert `window.open` plus the "sent" status text land synchronously while a slow/hanging mocked `fetch` is still pending, and that a rejecting mocked `fetch` is silently absorbed by the existing `.catch(() => {})` without blocking or delaying `window.open`. Closes the "Non-Blocking Lead Capture Call" requirement's zero-runtime-coverage gap identified in `verify-report.md`. `app/ConsultationForm.tsx` was not modified — inspection confirmed the shipped code was already correct; only test coverage was missing.

## Phase 5: Environment Documentation (likely blocked)

- [ ] 5.1 [LIKELY BLOCKED — CONFIRMED] Add `TWENTY_API_KEY`/`TWENTY_API_URL` to root `.env.example`. `sdd-apply` attempted `Read` on this exact file this session and it was denied again ("File is in a directory that is denied by your permission settings"), identical to change 1's `docker/twenty/.env.example` denial. No edit was possible. Manual addition required — append:
  ```
  TWENTY_API_KEY=
  TWENTY_API_URL=
  ```

## Phase 6: Manual Verification (human required — NOT automatable by sdd-apply)

- [ ] 6.1 **Dependency**: confirm change 1's `docker/twenty/.env.example` has been created by a human (still pending as of this change) and `pnpm twenty:up` succeeds before proceeding.
- [ ] 6.2 Run `pnpm twenty:fields` against the running local stack; confirm all 4 `WEBSITE_LEAD_FIELDS` now exist on Person only (Settings → Data Model), alongside the existing 15 fields.
- [ ] 6.3 Set `TWENTY_API_KEY`/`TWENTY_API_URL` for the local dev server; submit `ConsultationForm` with all fields filled.
- [ ] 6.4 Confirm WhatsApp opens immediately with no perceptible delay, exactly as before this change.
- [ ] 6.5 In Twenty's UI, confirm a new Person record exists with Name and City set, and `servicioConsulta`, `consultaMensaje`, `lineaWhatsapp`, `origenLead` all populated from the submission.
- [ ] 6.6 Unset the env vars again and re-submit the form; confirm WhatsApp still opens instantly with zero errors in the browser console (matches today's production state).
