# Tasks: Twenty CRM Local Setup (Docker + Scripted Fields + CSV Import)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~850 authored: compose+env ~75, `field-definitions.mjs` ~45, `create-fields.mjs` ~150, README ~180, `package.json` ~5, 3 new test files ~350 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Focused test | Runtime harness | Rollback |
|---|---|---|---|---|---|
| 1 | Compose stack + env template + up/down scripts | PR 1 | `docker compose -f docker/twenty/docker-compose.yml config` | Manual `pnpm twenty:up` (human, Docker) | Delete compose file + `.env.example`; revert 2 `package.json` lines |
| 2 | Field definitions data | PR 2 | `node --test tests/qa/twenty-field-definitions.test.mjs` | N/A — pure data, no I/O | Delete both files |
| 3 | `create-fields.mjs` + `twenty:fields` script + unit tests | PR 3 | `node --test tests/qa/twenty-create-fields.test.mjs` | Manual `pnpm twenty:fields` vs live instance (human, Docker) | Delete script + test; revert `package.json` line |
| 4 | README wipe procedure + isolation regression test | PR 4 | `node --test tests/qa/twenty-isolation.test.mjs` | Manual full wipe cycle (human, Docker) | Revert README section; delete isolation test |

## Phase 1: Docker Compose Stack

- [x] 1.1 Create `docker/twenty/docker-compose.yml`: `server`, `worker`, `db` (Postgres 16), `redis`; pin every `image:` tag, never `latest`.
- [x] 1.2 Create `docker/twenty/.env.example`: `ENCRYPTION_KEY`, `PG_DATABASE_PASSWORD`, `SERVER_URL`, `TWENTY_API_KEY` placeholders. Unblocked in a later session (2026-09-05/06) — the sandbox restriction that denied `.env*` writes in the original apply session did not apply here; file created directly, no permission escalation needed. Extended with `SERVER_BIND_HOST` (optional) as part of `twenty-crm-cloud-deploy`.
- [x] 1.3 Add `twenty:up`/`twenty:down` scripts to `package.json`; never reference from `dev`/`build`/`test`/`cf:*`.

## Phase 2: Field Definitions Data

- [x] 2.1 Create `docker/twenty/scripts/field-definitions.mjs` exporting `CUSTOM_FIELDS` (15 entries), transcribed from `openspec/changes/archive/2026-09-03-crm-lead-import/runbook-twenty-data-model.md` (read-only).
- [x] 2.2 Write `tests/qa/twenty-field-definitions.test.mjs`: assert 15 entries, correct name/type per entry, Perfil ICP's 4 option values.

## Phase 3: create-fields.mjs Script

- [x] 3.1 [LIVE-VERIFY] Create `docker/twenty/scripts/create-fields.mjs`: validate `SERVER_URL`/`TWENTY_API_KEY`, exit 1 naming the missing var before any network call. Fully implemented and unit-tested (`readConfig`); this behavior does not depend on live-instance payload shapes.
- [x] 3.2 [LIVE-VERIFY] Implement `twentyRequest()`: non-2xx logs status+raw body to stderr, exit 1; 2xx `JSON.parse`s defensively, exit 1 on invalid JSON. Fully implemented and unit-tested (network-error, non-2xx, and unparseable-2xx-body paths); this generic HTTP-defense behavior does not depend on live-instance payload shapes.
- [ ] 3.3 [LIVE-VERIFY] Implement GET-diff-POST against `/rest/metadata/` for `company`/`person`; exact endpoint/payload shapes are an open design question — confirm against a running instance. **PROVISIONAL, NOT LIVE-VERIFIED**: `getObjectMetadataId`, `getExistingFieldNames`, and `createField` are implemented per design.md's contract sketch and Data Flow section (assumes `GET /rest/metadata/objects` matched by `nameSingular`, `GET /rest/metadata/fields?objectMetadataId=...`, `POST /rest/metadata/fields` with `{objectMetadataId, name, label, type, options?}`), and the diff/idempotency logic around them is unit-tested against those assumed shapes — but the actual request/response JSON shapes remain unverified against a running Twenty instance (design.md Open Questions). Any shape mismatch will fail loudly via `twentyRequest`'s defensive error handling (Phase 6, task 6.2/6.3 is the human step that confirms or corrects these shapes).
- [x] 3.4 [UNIT] Exit 0 only when all 15 fields exist on both objects when the script finishes; exit 1 on any failure above. Implemented in `run()`, unit-tested for the empty/full/idempotent-rerun cases.
- [x] 3.5 [UNIT] Write `tests/qa/twenty-create-fields.test.mjs`: mocked-`fetch` diff logic (full/partial/empty existing-fields responses), non-2xx error path, missing-env-var path. 11 `node --test` cases, all pass.
- [x] 3.6 Add `twenty:fields` script to `package.json`.

## Phase 4: README

- [x] 4.1 Create `docker/twenty/README.md`: prerequisites (Docker + Docker Compose, ~2GB RAM, the pinned image tag).
- [x] 4.2 Document setup: `twenty:up` → `/healthz` wait loop → `twenty:fields` → import Companies then People via Command Menu, referencing `crm-import-companies.csv` (read-only) and `crm-import-people.csv` (read-only).
- [x] 4.3 Document teardown (`twenty:down`) and the wipe-before-reimport sequence (`down -v` → `up -d` → healthz → `twenty:fields` → reimport both CSVs); state `down -v` destroys all workspace data.
- [x] 4.4 State that reimporting without wiping first creates duplicate Company/Person records (no upsert).

## Phase 5: Automated Verification

- [ ] 5.1 Write `tests/qa/twenty-isolation.test.mjs`: assert `dev`/`build`/`test`/every `cf:*` script value in `package.json` never contains `docker/` or `twenty:`.
- [ ] 5.2 Run `pnpm test`; confirm all 3 new `tests/qa/twenty-*.test.mjs` files pass (auto-picked up by the existing `tests/qa/*.test.mjs` glob).
- [ ] 5.3 Run `pnpm build` with no Docker daemon running; confirm success, proving isolation.

## Phase 6: Manual Verification (human required — NOT automatable by sdd-apply)

- [x] 6.1 Run `pnpm twenty:setup`; confirm `/healthz` returns 200 at the documented `SERVER_URL`. Done 2026-09-05/06 against a live local instance.
- [ ] 6.2 Run `pnpm twenty:fields`; in Twenty's UI (Settings → Data Model) confirm all 15 fields on Company and Person, correct types, Perfil ICP's 4 options. Fields confirmed present via the script's own exit-0 contract and via `GET /rest/metadata/objects/:id`, but not visually cross-checked in the Data Model UI — leaving unchecked pending that specific manual look.
- [ ] 6.3 Re-run `pnpm twenty:fields`; confirm exit 0, no duplicate fields (idempotency). Not deliberately re-run a second time against an already-provisioned instance to observe a true no-op; leaving unchecked rather than assuming.
- [x] 6.4 / 6.5 Import both CSVs — **superseded**: `twenty-crm-cloud-deploy` (change 3) replaced the UI Command Menu wizard with a scripted GraphQL batch importer (`docker/twenty/scripts/import-crm-data.mjs`, `pnpm twenty:import`), used instead for both local and production. Confirmed 799 companies + 1,222 people imported via that script's own count-matching success message, both locally and in production. The wizard path this task originally specified was not exercised in this session; the data-correctness outcome it was checking for was, via the superseding method.
- [ ] 6.6 Run the full wipe-before-reimport cycle once end-to-end; confirm the README procedure works as documented. Not exercised this session — the production VPS deploy (change 3) went through an equivalent fresh-provision sequence on a *different* host, which is not the same test as wiping and rebuilding this same local instance.
