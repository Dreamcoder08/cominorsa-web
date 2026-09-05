# Twenty CRM — Local Setup

Local-only Docker Compose stack running [Twenty CRM](https://twenty.com) for
importing and managing the COMINORSA mining-lead CRM data (`crm-import-companies.csv`,
`crm-import-people.csv`, both tracked read-only at the repo root). Nothing here
is wired into `dev`, `build`, `test`, or any `cf:*` deploy script — this stack
never runs in CI or production.

## Prerequisites

- Docker Engine + Docker Compose v2 (the `docker compose` subcommand, not the
  legacy standalone `docker-compose`).
- At least ~2GB of free RAM for the four containers (`server`, `worker`,
  `db`, `redis`).
- No fixed port other than `3000` (the `server` service) needs to be free on
  the host.
- The stack pins every image tag for reproducibility — currently
  `twentycrm/twenty:v2.38.1`, `postgres:16.15`, `redis:7.4.11`. See
  `docker/twenty/docker-compose.yml` for the source of truth; bumping any tag
  is a deliberate, reviewable diff, never `latest`.

## Configuration (`.env`)

`docker/twenty/.env.example` documents the required environment variables:
`ENCRYPTION_KEY`, `PG_DATABASE_PASSWORD`, `SERVER_URL`, `TWENTY_API_KEY`.

Before running `pnpm twenty:up` or `pnpm twenty:fields`, copy that template to
`docker/twenty/.env` and fill in real values:

```bash
cp docker/twenty/.env.example docker/twenty/.env
# then edit docker/twenty/.env with real values
```

`docker/twenty/.env` is git-ignored (matched by the repo's existing `.env*`
rule) and must never be committed. `TWENTY_API_KEY` is only available after
the stack is up and running — generate it from Twenty's own UI (Settings →
APIs & Webhooks) on first login, then add it to `.env` before running
`pnpm twenty:fields`.

## Setup

1. Start the stack:

   ```bash
   pnpm twenty:up
   ```

2. Wait for the server to become healthy before doing anything else:

   ```bash
   until curl -sf "$SERVER_URL/healthz"; do sleep 2; done
   ```

   (`$SERVER_URL` is the value you set in `docker/twenty/.env`, e.g.
   `http://localhost:3000`.)

3. Provision the 15 custom CRM fields on both the Company and Person objects:

   ```bash
   pnpm twenty:fields
   ```

   This runs `docker/twenty/scripts/create-fields.mjs`, which reads
   `SERVER_URL`/`TWENTY_API_KEY` from the environment, diffs the runbook's
   15-field list against what already exists on each object, and creates
   only what's missing. It exits `0` only once all 15 fields exist on both
   objects; any failure (missing env var, unreachable instance, non-2xx
   response, unparseable body) exits `1` with the real error printed to
   stderr.

4. Import the Company records first, then the Person records, via Twenty's
   UI Command Menu (never scripted — both files are well under the wizard's
   10k-row limit):

   - Open the Command Menu → **Import records** → select the **Company**
     object → upload `crm-import-companies.csv` (repo root, read-only,
     ~799 rows) → map columns → confirm.
   - Open the Command Menu → **Import records** → select the **Person**
     object → upload `crm-import-people.csv` (repo root, read-only,
     ~1,222 rows) → map columns → confirm.

   Import Companies before People so any company-linking fields on the
   Person import can resolve against already-created Company records.

## Teardown

Stop the stack without deleting data (containers stop, volumes persist):

```bash
pnpm twenty:down
```

## Wipe-before-reimport

Twenty has no native upsert. Re-running the CSV import wizard on records
that already exist creates **duplicate Company/Person records** — it does
not update or merge them. If you need a clean re-import (e.g. after
changing the source CSVs or field definitions), you must fully wipe the
instance first:

1. Destroy the stack **and its volumes** — this deletes the Postgres
   database and all local storage, i.e. **all local Twenty workspace data**
   (every record, view, and anything clicked together inside the instance):

   ```bash
   docker compose -f docker/twenty/docker-compose.yml down -v
   ```

2. Bring the stack back up:

   ```bash
   docker compose -f docker/twenty/docker-compose.yml up -d
   ```

3. Wait for health again:

   ```bash
   until curl -sf "$SERVER_URL/healthz"; do sleep 2; done
   ```

4. Re-provision all 15 fields from scratch (the volumes were wiped, so
   nothing exists yet on either object):

   ```bash
   pnpm twenty:fields
   ```

5. Re-import `crm-import-companies.csv` via Command Menu → Import records.
6. Re-import `crm-import-people.csv` via Command Menu → Import records.

Only follow this sequence when you actually want to discard all local
Twenty data. The source of truth for the CRM data model and content is the
two committed CSVs plus the archived runbook, never anything authored by
hand inside the running instance — so wiping and redoing is always safe from
a data-loss perspective, just slow.
