# Twenty Local Instance Specification

## Purpose

Defines the behavior of the vendored `docker/twenty/docker-compose.yml`
stack that runs a local Twenty CRM instance for provisioning and CSV
import, fully isolated from site build/deploy tooling.

## Requirements

### Requirement: Stack Composition and Reachability

The stack MUST bring up the `server`, `worker`, `db`, and `redis` services
together via `docker compose up`, and the server MUST be reachable over
HTTP at a URL documented in `docker/twenty/README.md`.

#### Scenario: All four services start successfully

- GIVEN Docker and Docker Compose are installed
- WHEN `docker compose up -d` runs in `docker/twenty/`
- THEN `server`, `worker`, `db`, and `redis` all reach a running state
- AND the documented local URL returns a successful HTTP response

#### Scenario: Missing a required service blocks readiness

- GIVEN one of `server`, `worker`, `db`, or `redis` fails to start
- WHEN the stack's status is checked
- THEN the documented URL MUST NOT be treated as ready

### Requirement: Version-Pinned Images

`docker-compose.yml` MUST pin every Twenty image to an explicit tag and
MUST NOT use `latest`, so a fresh `docker compose up` is reproducible.

#### Scenario: Compose file has no floating tags

- GIVEN `docker/twenty/docker-compose.yml`
- WHEN each service's `image:` line is inspected
- THEN every tag is an explicit version, never `latest` or unset

### Requirement: Isolation From Site Tooling

The Twenty stack MUST NOT be invoked, directly or transitively, by
`pnpm dev`, `pnpm build`, `pnpm test`, or the Cloudflare deploy script, and
those commands MUST succeed with no Docker daemon present.

#### Scenario: Site commands run without Docker

- GIVEN Docker is not installed or not running
- WHEN `pnpm dev`, `pnpm build`, or `pnpm test` runs
- THEN each command completes its normal behavior unaffected
- AND none of them attempts to reach a Twenty container or fails because
  Docker is absent

#### Scenario: New scripts are additive, not wired into existing ones

- GIVEN `package.json` after this change
- WHEN `dev`, `build`, `test`, and the Cloudflare deploy script are read
- THEN none of them reference `twenty:up`, `twenty:down`, or
  `twenty:fields`

### Requirement: Environment Configuration via Gitignored .env

`ENCRYPTION_KEY`, `PG_DATABASE_PASSWORD`, and `SERVER_URL` MUST be read
from `docker/twenty/.env`, which MUST be excluded from version control;
`docker/twenty/.env.example` MUST be committed and MUST list all three
variables with placeholder values.

#### Scenario: .env is never committed

- GIVEN a fresh clone of the repository
- WHEN `git status` is checked after creating `docker/twenty/.env`
- THEN the file does not appear as trackable, because the repository's
  existing `.env*` rule (no leading slash, so it matches at any depth)
  already covers `docker/twenty/.env` — no new `.gitignore` entry is added

#### Scenario: .env.example is a complete template

- GIVEN `docker/twenty/.env.example`
- WHEN it is compared against the variables `docker-compose.yml` requires
- THEN `ENCRYPTION_KEY`, `PG_DATABASE_PASSWORD`, and `SERVER_URL` are all
  present with placeholder, non-secret values

### Requirement: Documented Reset Procedure Before Reimport

Because Twenty's CSV import has no native upsert, `docker/twenty/README.md`
MUST document a destructive reset procedure a person can run before
re-provisioning fields and re-importing CSVs, and MUST state which data it
destroys.

#### Scenario: Reset procedure is fully specified

- GIVEN a local Twenty instance with previously-created fields and
  previously-imported records
- WHEN the README's reset section is read
- THEN it documents, in order: `docker compose down -v`, then
  `docker compose up -d`, then re-running `create-fields.mjs`, then
  reimporting both CSVs
- AND it states that `down -v` deletes the Postgres volume, permanently
  removing all workspace data, including manual edits made since the last
  import

#### Scenario: Reimporting without a reset is called out as unsafe

- GIVEN a person reimports a CSV into an instance that was not reset
- WHEN the README's reset section is read
- THEN it states that Twenty's import creates new records rather than
  matching existing ones, so reimporting without wiping first produces
  duplicate Company or Person records
