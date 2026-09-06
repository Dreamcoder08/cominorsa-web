# Twenty CRM — Local Setup

Local-only Docker Compose stack running [Twenty CRM](https://twenty.com) for
importing and managing the COMINORSA mining-lead CRM data (`crm-import-companies.csv`,
`crm-import-people.csv`, both tracked read-only at the repo root). Nothing here
is wired into `dev`, `build`, `test`, or any `cf:*` deploy script — this stack
never runs in CI or production.

## Data & repository visibility

This repository is **public** as of 2026-09-05 (changed deliberately so a
fresh checkout works over plain HTTPS with no SSH key or GitHub credentials
on a new machine — see "Setup" step 0). That has one direct consequence for
this stack: `crm-import-companies.csv` and `crm-import-people.csv` (repo
root, 799 + 1,222 rows) are tracked in git and are now public too.

- Verified before the visibility change: no real secrets are tracked
  anywhere in history — only placeholder values (`replace_me_with_...`,
  `change-me`) in `.env.example` files. `docker/twenty/.env` itself is
  git-ignored and has never been committed.
- The CSV rows are the COMINORSA mining-lead list, sourced from INGEMMET's
  public Catastro Minero (see `fuente_dato` column) plus limited data
  captured through the website's own consultation form
  (`ciudadConsulta`/`servicioConsulta`/`consultaMensaje` fields). The
  underlying concession data is a public registry; what's not public
  elsewhere is COMINORSA's specific compiled/filtered lead list and any
  consultation-form submissions blended into it.
- If this needs to be reversed, **flipping the repo back to private does
  not retroactively unpublish the CSVs**: anyone who already cloned or
  fetched the repo while it was public keeps a copy, and GitHub's own
  caches (and any search-engine or scraper crawl) may still hold it. A
  correct rollback is: make the repo private again, then rewrite history to
  drop both CSVs (`git filter-repo` or the BFG Repo-Cleaner, not a plain
  `git rm` commit, which leaves the blobs reachable in prior commits) and
  force-push, treating every existing clone as compromised for that data.

## Prerequisites

- Docker Engine + Docker Compose v2 (the `docker compose` subcommand, not the
  legacy standalone `docker-compose`).
- Node.js `>=22.13.0` and pnpm `>=11.0.0` (see the root `package.json`
  `engines` field) to run `pnpm install` and the `twenty:*` scripts below.
- At least ~2GB of free RAM for the four containers (`server`, `worker`,
  `db`, `redis`), on top of whatever the Docker runtime itself reserves.
- No fixed port other than `3000` (the `server` service) needs to be free on
  the host.
- The stack pins every image tag for reproducibility — currently
  `twentycrm/twenty:v2.38.1`, `postgres:16.15`, `redis:7.4.11`. See
  `docker/twenty/docker-compose.yml` for the source of truth; bumping any tag
  is a deliberate, reviewable diff, never `latest`.

### Windows

Everything under `docker/twenty/scripts/` is plain Node.js (no shell
scripts), and `docker-compose.yml` is a standard Compose file, so the exact
same `pnpm twenty:*` commands below work unchanged from PowerShell, CMD, or
Git Bash — there is nothing Windows-specific to translate.

What Windows adds is the underlying platform:

- **Docker Desktop with the WSL2 backend** is required (Docker Engine alone
  isn't installable natively on Windows). This needs Windows 10 build 19041+
  or Windows 11, and hardware virtualization (Intel VT-x / AMD-V) enabled in
  the BIOS/UEFI — on a laptop that has never run a VM or WSL before, check
  this first, since it's the most common hard blocker and usually requires
  a BIOS setting change, not just a Windows setting.
- Installing Docker Desktop and enabling the WSL2 Windows feature both
  require an **administrator account** on that machine.
- Install Node.js from [nodejs.org](https://nodejs.org) (LTS ≥22.13) or via
  `winget install OpenJS.NodeJS.LTS`, then enable pnpm with
  `corepack enable` (bundled with Node ≥16.13) — this avoids installing an
  unpinned global pnpm version.
- Antivirus or endpoint-management software on a work/school laptop can
  block the WSL2 kernel install or Docker's virtual network adapter; if
  Docker Desktop fails to start with a generic error, that's the next thing
  to check.
- After installing Docker Desktop, **restart the laptop** before running
  `pnpm twenty:setup` — the WSL2/virtualization feature install only takes
  effect after a reboot, and `docker info` will otherwise fail with the
  daemon unreachable.

## Configuration (`.env`)

`docker/twenty/.env.example` documents the required environment variables:
`ENCRYPTION_KEY`, `PG_DATABASE_PASSWORD`, `SERVER_URL`, `TWENTY_API_KEY`.

Before running `pnpm twenty:setup`, `pnpm twenty:up`, or `pnpm twenty:fields`,
copy that template to `docker/twenty/.env` and fill in real values:

```bash
cp docker/twenty/.env.example docker/twenty/.env
# then edit docker/twenty/.env with real values
```

`docker/twenty/.env` is git-ignored (matched by the repo's existing `.env*`
rule) and must never be committed. `TWENTY_API_KEY` is only available after
the stack is up and running — generate it from Twenty's own UI (Settings →
APIs & Webhooks) on first login, then add it to `.env` before running
`pnpm twenty:fields`.

## AI-assisted setup (e.g. Claude Code)

Every command below is a plain CLI invocation, so an AI coding agent running
in a terminal on the target machine can execute most of this setup — but not
all of it. Three points in this flow are hard human-in-the-loop boundaries,
not automation gaps that a smarter prompt closes:

- **Installing Docker Desktop itself.** On Windows/macOS this is an
  interactive GUI installer that requests administrator elevation and
  typically requires a reboot before the daemon is reachable (see the
  Windows notes above). An agent can detect that Docker is missing and tell
  the human what to install, but cannot click through the installer or
  force a reboot.
- **Twenty's first-login signup.** Step 1 below brings the containers up,
  but creating the workspace and admin account is a browser-only flow with
  **no API to bootstrap it** (documented again under "Wipe-before-reimport").
  An agent can get the stack healthy and stop there, but a human has to
  open `http://localhost:3000`, sign up, and generate the `TWENTY_API_KEY`
  (Settings → APIs & Webhooks) before steps 2 and 4 can run.
- **Viewing the running UI.** A terminal-only agent has no way to render or
  screenshot a browser tab; "seeing" the CRM means a human opens the URL
  themselves, or the agent has separate browser-automation tooling
  (e.g. a connected Chrome extension) configured on that same machine.

In practice, the efficient split is: the agent runs step 0, generates real
values for `PG_DATABASE_PASSWORD`/`ENCRYPTION_KEY` and runs step 1, then
pauses and asks the human for the `TWENTY_API_KEY` from the browser
sign-up before continuing with steps 2–4.

## Setup

0. Clone the repository and install dependencies (skip if you already have a
   working checkout):

   ```bash
   git clone https://github.com/Dreamcoder08/cominorsa-web.git
   cd cominorsa-web
   pnpm install
   ```

   The repository is public, so this works over plain HTTPS with no SSH key
   or GitHub credentials needed — on Windows, run these same commands from
   PowerShell, CMD, or Git Bash.

1. Validate the local configuration, start the stack, and wait for its bounded
   health check:

   ```bash
   pnpm twenty:setup
   ```

   The startup script resolves its Compose paths independently of the caller's
   working directory. It validates the two mandatory secrets without printing
   them, checks Docker, Compose v2, and the Docker
   daemon, runs Compose's quiet configuration validation, starts the pinned
   services, and waits for `http://localhost:3000/healthz`. It fails clearly
   instead of waiting forever. It never creates or replaces secrets and never
   starts the Docker daemon. The existing `pnpm twenty:up` command remains
   available when only the original direct Compose behavior is wanted.

2. Provision the custom CRM fields — 15 shared fields on both Company and
   Person (from the imported mining-concession data), plus 5 more on Person
   only (`ciudadConsulta`, `servicioConsulta`, `consultaMensaje`,
   `lineaWhatsapp`, `origenLead` — for leads captured via the website's
   consultation form):

   ```bash
   pnpm twenty:fields
   ```

   This runs `docker/twenty/scripts/create-fields.mjs`, which reads
   `SERVER_URL`/`TWENTY_API_KEY` from the environment, diffs each object's
   field set (see `OBJECT_FIELD_SETS` in the script) against what already
   exists, and creates only what's missing. It exits `0` only once every
   field exists on its assigned object(s) — 15 on Company, 20 on Person; any
   failure (missing env var, unreachable instance, non-2xx response,
   unparseable body) exits `1` with the real error printed to stderr.

3. **Clear Twenty's own sample data first.** Observed directly on this
   stack: a freshly created workspace already contains 5 demo Company
   records (Notion, Stripe, Figma, Airbnb, Anthropic) and their 5 founder
   People records, all sharing one `createdAt` timestamp from workspace
   creation — not something either CSV produces. Delete all 10 (Command
   Menu → each object's index → select all → delete, or via
   `DELETE /rest/companies/:id` / `DELETE /rest/people/:id`) before
   importing; otherwise the real CRM data ends up mixed with 5 fake
   companies and 5 fake people with no indication they don't belong.

4. Import both CSVs:

   ```bash
   pnpm twenty:import
   ```

   This runs `docker/twenty/scripts/import-crm-data.mjs`, which reads
   `crm-import-companies.csv`/`crm-import-people.csv` (repo root,
   read-only, 799 + 1,222 rows) and creates the records via Twenty's
   GraphQL Core API in batches of 60 (its documented per-request limit).
   It refuses to run — before writing anything — if Company or Person
   already has any records, since Twenty's `upsert` matches by `id` only,
   not by name; there is nothing to safely deduplicate against for a fresh
   CSV. That is also why step 3 (clearing sample data) matters: this script
   only checks for *any* existing records, sample or real, and treats
   either as a reason to refuse.

   An earlier version of this step used Twenty's UI import wizard instead.
   That was the right call when it was made (the row counts are well under
   the wizard's 10k limit, and no code existed yet to reuse) — it stopped
   being the right call once this project already had `create-fields.mjs`
   proving the API shapes work, a live-verified GraphQL batch-create path,
   and a hard requirement to run this exact step again on a fresh VPS.
   Needing a human to click through the wizard twice for the same fixed,
   already-known column mapping was the actual complexity to avoid — a
   ~300-line script covering it was less complexity, not more.

## Teardown

Stop the stack without deleting data (containers stop, volumes persist):

```bash
pnpm twenty:down
```

## Wipe-before-reimport

Twenty has no native upsert by business key (live-verified: even
`upsert: true` on the GraphQL batch-create mutations matches by `id` only).
`pnpm twenty:import` (see step 4 above) refuses to run at all if Company or
Person already has any records, specifically to avoid creating
**duplicate Company/Person records** the way blindly re-running an import
would. If you need a clean re-import (e.g. after changing the source CSVs
or field definitions), you must fully wipe the instance first:

1. Destroy the stack **and its volumes** — this deletes the Postgres
   database and all local storage, i.e. **all local Twenty workspace data**
   (every record, view, field, and anything clicked together inside the
   instance):

   ```bash
   docker compose -f docker/twenty/docker-compose.yml down -v
   ```

   This also deletes the workspace itself, including the admin account and
   every previously generated API key — none of that lives anywhere outside
   this volume. `pnpm twenty:setup`'s env validation only checks that
   `PG_DATABASE_PASSWORD`/`ENCRYPTION_KEY` are present and non-placeholder;
   it cannot detect that a *stale* `TWENTY_API_KEY` now points at a
   workspace that no longer exists.

2. Bring the stack back up and wait for health:

   ```bash
   pnpm twenty:setup
   ```

3. Go through Twenty's first-login signup flow again in the browser (new
   workspace, new admin account — there is no API-driven way to bootstrap
   this), then generate a new API key from Settings → APIs & Webhooks and
   update **both** `docker/twenty/.env` and the root `.env`'s
   `TWENTY_API_KEY` with it (the two files are independent; `create-fields.mjs`
   and `pnpm twenty:fields` read the former, the website's `/api/crm-lead`
   route reads the latter).

4. Clear the fresh workspace's seeded sample data — see the "Clear Twenty's
   own sample data first" step above; a brand-new workspace seeds it again
   every time.

5. Re-provision all fields from scratch (the volumes were wiped, so nothing
   exists yet on either object — 15 on Company, 20 on Person):

   ```bash
   pnpm twenty:fields
   ```

6. Re-import both CSVs — Company and Person are both empty again after the
   wipe, so this succeeds without the pre-flight refusal:

   ```bash
   pnpm twenty:import
   ```

Only follow this sequence when you actually want to discard all local
Twenty data. The source of truth for the CRM data model and content is the
two committed CSVs plus the archived runbook, never anything authored by
hand inside the running instance — so the *data* is always safe to
regenerate. The *workspace/credentials* are not: budget time for the manual
signup-and-rekey step above, it is not just "slow," it needs a human in a
browser.
