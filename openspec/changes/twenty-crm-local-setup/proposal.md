# Proposal: Twenty CRM Local Setup (Docker + Scripted Fields + CSV Import)

## Intent

The archived `crm-lead-import` change produced import-ready CSVs (799 companies, 1,222 people) and a manual field-creation runbook, but no Twenty instance has ever been provisioned — sales outreach is blocked. This change stands up a local Twenty CRM, provisions its data model without manual UI clicking (error-prone across ~15 fields × 2 objects), and imports both CSVs, while keeping all tooling completely isolated from `pnpm dev`/`build`/`test`/Cloudflare deploy.

## Scope

### In Scope
- Vendored, version-pinned `docker/twenty/docker-compose.yml` (server, worker, db, redis) with `.env.example` for `ENCRYPTION_KEY`, `PG_DATABASE_PASSWORD`, `SERVER_URL`.
- `docker/twenty/scripts/create-fields.mjs`: Metadata API (`/rest/metadata/`) script creating all 15 custom fields from `runbook-twenty-data-model.md` on both Company and Person objects, idempotently (check-before-create).
- New `package.json` scripts (`twenty:up`, `twenty:down`, `twenty:fields`), `domain:verb` convention, never referenced by `dev`/`build`/`test`/deploy scripts.
- `docker/twenty/README.md`: setup, teardown, and a documented "wipe before reimport" reset procedure.
- Importing both existing CSVs via Twenty's UI import wizard (well under its 10,000-row limit).

### Out of Scope
- **website-crm-lead-capture** (change 2 of 3): wiring `ConsultationForm`/WhatsApp to Twenty.
- **twenty-crm-cloud-deploy** (change 3 of 3): moving Twenty to cloud hosting.
- Scripted/API-based CSV import — the UI wizard already handles mapping and validation for this row count.
- True idempotent upsert on re-import — see Risks.

## Capabilities

### New Capabilities
- `twenty-local-instance`: Docker Compose stack for local Twenty, isolated from site tooling.
- `twenty-field-provisioning`: Metadata-API script creating the runbook's field set on Company/Person.

### Modified Capabilities
- `twenty-data-model-runbook`: "Manual Prerequisite" requirement changes from human-executed UI field creation to scripted Metadata API creation; runbook becomes the script's data source.

## Approach

1. Vendor the official compose file pinned to a specific image tag (not `latest`) for reproducibility; commit under `docker/twenty/` (its `.env` is already covered by the repo's existing `.env*` gitignore rule).
2. `create-fields.mjs` reads the runbook's field table, authenticates with a bearer API key, and POSTs each field (Select/Number/Text/Boolean) to `/rest/metadata/` for Company then Person, skipping fields that already exist.
3. Human imports Companies then People via Command Menu → Import records, per existing runbook sequencing.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `docker/twenty/docker-compose.yml`, `.env.example` | New | Vendored, pinned local stack |
| `docker/twenty/scripts/create-fields.mjs` | New | Metadata API field provisioning |
| `docker/twenty/README.md` | New | Setup/teardown/reset docs |
| `package.json` | Modified | Adds isolated `twenty:*` scripts |
| `openspec/specs/twenty-data-model-runbook/spec.md` | Modified | Delta: scripted, not manual, field creation |

No `.gitignore` change is needed: its existing `.env*` rule (no leading slash) already matches at any depth, so `docker/twenty/.env` is ignored and `docker/twenty/.env.example` stays trackable via the existing `!.env.example` negation — verified directly against the file.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| No native upsert — reimport duplicates records | High | Document "wipe before reimport": `docker compose down -v` + `up -d` + re-run `create-fields.mjs` + reimport; true upsert deferred to a later change |
| Metadata API payload shapes unverified beyond docs | Med | Verify against running local instance during apply; adjust script before relying on it |
| Docker/2GB RAM requirement surprises contributors | Low | Documented prerequisite in README; entirely opt-in |

## Rollback Plan

`docker compose down -v` removes the stack and volumes; `rm -rf docker/twenty/`; revert the `package.json` diff. No production system, CI, or deploy pipeline is touched at any point.

## Dependencies

- Docker + Docker Compose installed locally; ~2GB RAM.
- Archived `crm-lead-import` artifacts: both CSVs and `runbook-twenty-data-model.md`.

## Success Criteria

- [ ] `docker compose up` brings up Twenty, reachable at a documented local URL.
- [ ] All 15 custom fields exist on both Company and Person, created by `create-fields.mjs`, not by hand.
- [ ] Both CSVs import with zero mapping errors.
- [ ] `pnpm dev`/`build`/`test`/Cloudflare deploy run unaffected with no Docker present.
- [ ] README documents the wipe-before-reimport reset procedure.
