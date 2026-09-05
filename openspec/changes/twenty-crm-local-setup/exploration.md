# Exploration: Twenty CRM Local Setup (Docker Provisioning + Field Creation + CSV Import)

## Current State

- COMINORSA-pagina-web is a Next.js/vinext site on Cloudflare Workers, fully SSR, no DB writes on the request path. `db/schema.ts` is an intentionally empty Drizzle/D1 placeholder (`dialect: "sqlite"` in `drizzle.config.ts`), and `scripts/validate-env.mjs` actively asserts no `d1`/`r2` binding exists in `.openai/hosting.json` — the deploy pipeline is deliberately D1/R2-free today.
- No `DATABASE_URL` env var exists anywhere in the codebase (grepped across scripts, DEPLOY.md, vite.config.ts, worker/index.ts). `worker/index.ts` declares an unused `DB: D1Database` in its `Env` interface.
- `pnpm-workspace.yaml` has **no `packages:` glob** — it's pnpm-11-only config (`allowBuilds`, `overrides`). It is not a monorepo file, so a new `docker/` subfolder cannot be swept into workspace package resolution.
- `package.json` scripts follow a strict `domain:verb` convention (`cf:setup`, `db:generate`, `crm:export`, `bundle:report`); no `docker:*`/`twenty:*` namespace exists. `scripts/` holds only dependency-free `.mjs` and Cloudflare `.sh` files — no docker/infra tooling exists yet.
- The archived `2026-09-03-crm-lead-import` change produced `scripts/generate-crm-import-csvs.mjs` (`pnpm crm:export`), `crm-import-companies.csv` (799 rows), `crm-import-people.csv` (1,222 rows), and `runbook-twenty-data-model.md` listing ~14 custom fields needed on Company/Person before import. No Twenty instance was ever provisioned; the runbook itself flags an unresolved caveat ("re-verify field list against a live Twenty template download").

## Verified Online (Twenty CRM)

Sources: docs.twenty.com self-host/API/data-migration pages, and the official `twenty-docker/docker-compose.yml`.

1. Official docker-compose exists, four services: `server` (image `twentycrm/twenty:${TAG:-latest}`, port 3000, `/healthz`), `worker` (same image, migrations/cron disabled), `db` (**Postgres 16**), `redis` (standard Redis image, `noeviction` policy). Exact Redis version tag was not confirmed verbatim (fetch tool summarized rather than quoting raw YAML).
2. Minimum **2GB RAM** documented explicitly; CPU minimum not documented.
3. Required env vars: `ENCRYPTION_KEY`, `PG_DATABASE_PASSWORD`, `SERVER_URL`.
4. License: **AGPL-3.0**, self-hostable free indefinitely; internal-only self-hosting generally does not trigger AGPL's network-service disclosure clause (general open-source consensus, not verified legal advice).
5. **Metadata API confirmed** (`/rest/metadata/`, bearer API key) — fields/objects/relations CAN be created programmatically, contradicting the prior change's assumption that field creation must be manual-only.
6. **CSV import has a UI wizard** (Command Menu → object → Import records → map columns → confirm), confirming the runbook's core assumption ("fields must pre-exist; import creates records, never fields"). **Row limit: 10,000/file** — both existing CSVs (799, 1,222) are comfortably under this.
7. Core API (REST/GraphQL) supports batch create up to 60 records/request; GraphQL adds plural batch-upsert. Twenty has **no native upsert for CSV import** — reruns would duplicate records without extra dedup logic.

## Affected Areas

- New isolated subfolder, e.g. `docker/twenty/` or `infra/twenty/` — houses `docker-compose.yml` and a Twenty-specific `.env`, kept separate from the site's `.env.example`.
- `package.json` — any new `twenty:*` scripts must follow `domain:verb` convention and must NOT be wired into `pnpm dev`/`build`/`test`.
- `db/schema.ts`, `drizzle.config.ts` — confirmed no naming/env-var collision (different DB engine — SQLite/D1 vs Twenty's Postgres — and Twenty doesn't use Drizzle).
- `pnpm-workspace.yaml`, `.gitignore` — confirmed no collision risk (no workspace glob; nested `.env` placement needs one gitignore-glob-semantics confirmation, noted as a risk below).
- `scripts/generate-crm-import-csvs.mjs`, `runbook-twenty-data-model.md` — consumed as inputs, not modified.

## Approaches Considered

1. **Fully manual** (UI field creation + UI CSV import) — Pros: zero new scripting, lowest risk. Cons: error-prone across ~14 fields × 2 objects, not repeatable. Effort: Low.
2. **Hybrid** (scripted Docker Compose + Metadata-API-scripted field creation + UI-wizard CSV import) — Pros: removes manual-UI-typo risk on the error-prone field-creation step; CSV import stays simple since both files are well under the 10k row limit. Cons: needs hands-on Metadata API payload verification against a live instance. Effort: Medium.
3. **Fully scripted** (Docker Compose + Metadata API fields + Core/GraphQL batch import) — Pros: maximal repeatability. Cons: no native upsert means dedup logic is needed; ~2,021 rows / 60-per-request ≈ 34 calls of added complexity for a one-time-ish local import. Effort: High.

**Recommendation**: Approach 2 — script the error-prone, repeated-14-fields-×-2-objects step via Twenty's Metadata API; keep CSV import on the UI wizard since row counts are small and the wizard already handles validation/error review. Final decision belongs to `sdd-propose`.

## Risks

- License: internal self-hosting AGPL exposure is low-risk by community consensus but not independently legal-verified; revisit if change 3 (cloud deploy) exposes Twenty externally.
- 2GB RAM minimum is a real local-dev/CI cost; must be documented as an explicit prerequisite.
- Must stay fully optional/isolated — no existing script currently requires Docker; this must not become a `pnpm dev`/build dependency.
- Nested `.env` file placement inside `docker/twenty/` needs confirmation against `.gitignore`'s root `.env*` glob semantics before finalizing folder location.
- Metadata API field-type payload shapes (Select/Number/Text/Boolean) were described only in secondary sources — needs hands-on verification against a running local instance, not assumed from docs summaries.
- No native upsert in Twenty — rebuilding the local instance and re-importing needs a documented dedup approach.

## Open Questions for sdd-propose

1. Exact docker subfolder name/location, and whether the compose file is vendored in-repo vs. fetched at setup time.
2. Field-creation method — manual UI vs. scripted Metadata API (recommended: scripted).
3. CSV import method — UI wizard (recommended) vs. scripted API — and whether any new `package.json` scripts are added at all.
