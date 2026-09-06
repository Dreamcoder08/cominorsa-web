# Tasks: Twenty CRM Cloud Deploy — Self-Hosted VPS

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450 authored: compose+env diff ~15, backup-twenty.sh ~25, clear-demo-data.mjs ~140, PRODUCTION.md ~230, package.json ~2, 2 skills ~110, VPS host config (not in repo, see PRODUCTION.md) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No — single cohesive change, host-state work dominates over diff size |
| Delivery strategy | single PR |

Decision needed before apply: No (proposal + design already confirmed provider/TLS/backup/hardening choices)

## Phase 1: Compose Stack Hardening (repo)

- [x] 1.1 Add `SERVER_BIND_HOST` env var to `docker/twenty/docker-compose.yml`'s `server.ports`, default `0.0.0.0` (preserves local-dev behavior unchanged).
- [x] 1.2 Add `start_period: 210s` to the `server` healthcheck.
- [x] 1.3 [LIVE-VERIFIED] Confirm the `start_period` fix with a disposable, isolated compose project exercising a true cold start (fresh volumes, different project name) end-to-end — not a re-test against already-migrated data.
- [x] 1.4 Document `SERVER_BIND_HOST` in `docker/twenty/.env.example`.

## Phase 2: Backup Tooling

- [x] 2.1 Create `docker/twenty/backup-twenty.sh`: path-relative `pg_dump` + gzip + 14-day retention, runnable unmodified both locally and from VPS cron.
- [x] 2.2 Add `twenty:backup` script to `package.json`.
- [x] 2.3 [LIVE-VERIFIED] Run the backup script against the production instance; confirm a valid non-empty gzip dump is produced.
- [x] 2.4 [LIVE-VERIFIED] Restore drilled end-to-end against a real production backup, fully isolated from production: disposable compose project, `db`+`redis` only, direct `psql` restore of the full dump (schema+data, no prior migration run needed), then `server`+`worker` joined using production's `ENCRYPTION_KEY`. Result: 0 errors, `Upgrade summary: 1 workspace(s) succeeded, 0 workspace(s) failed`, REST API (with production's own API key, still valid post-restore) confirms exact counts (799 companies, 1222 people) and intact custom-field data. Torn down completely afterward.
- [x] 2.5 [LIVE-VERIFIED] Off-box backup copy: `docker/twenty/pull-backup.sh` + Windows Task Scheduler (`TwentyCRM-PullBackup`, daily 22:15 local, after the VPS cron) pulls the newest backup to the user's own machine. Ran manually this session, confirmed a real dump copied down. Known limitation: only runs while the machine is logged on (no stored credentials) — see PRODUCTION.md.

## Phase 3: Demo-Data Cleanup Script

- [x] 3.1 Create `docker/twenty/scripts/clear-demo-data.mjs`: fetches all Company/Person records, refuses (exit 1) unless the object's entire contents match the known 5-record demo set exactly, deletes only on an exact match.
- [x] 3.2 Add `twenty:clear-demo` script to `package.json`.
- [x] 3.3 [LIVE-VERIFIED] Ran equivalent logic manually against both the local and production instances this session (script codifies what was already done and verified twice, ahead of writing the script itself).
- [x] 3.4 [UNIT] `tests/qa/twenty-clear-demo-data.test.mjs`: 6 cases mirroring `create-fields.mjs`'s mocked-`fetch` pattern — exact-match deletion, extra-real-record refusal, renamed-demo-record refusal, Person-mismatch blocking already-matched Company deletion too, already-cleared refusal, and env validation. 6/6 pass.

## Phase 4: VPS Provisioning (host, not in repo)

- [x] 4.1 [LIVE-VERIFIED] Provision a DigitalOcean droplet (4GB/2vCPU, Ubuntu 24.04) — deviates from the proposal's Hetzner decision; see design.md.
- [x] 4.2 [LIVE-VERIFIED] Install Docker Engine + Compose plugin from Docker's official apt repo (not Ubuntu's bundled package).
- [x] 4.3 [LIVE-VERIFIED] `ufw`: allow only 22/80/443, deny by default.
- [x] 4.4 [LIVE-VERIFIED] Create `deploy` user (passwordless sudo, `docker` group), copy SSH key, **verify it works before** touching root access.
- [x] 4.5 [LIVE-VERIFIED] `PermitRootLogin no`; confirmed root SSH refused, `deploy` still works, after reload.
- [x] 4.6 [LIVE-VERIFIED] Install and confirm active: `fail2ban` (sshd jail), `unattended-upgrades`.
- [x] 4.7 [LIVE-VERIFIED] Copy `docker-compose.yml` + host-specific `.env` (fresh `ENCRYPTION_KEY`/`PG_DATABASE_PASSWORD`, `SERVER_BIND_HOST=127.0.0.1`) to `/opt/twenty/`, owned by `deploy`.
- [x] 4.8 [LIVE-VERIFIED] Nginx reverse proxy + Certbot (`nip.io` domain) — real Let's Encrypt cert, HTTP→HTTPS redirect, auto-renew timer confirmed active.
- [x] 4.9 [LIVE-VERIFIED] `docker compose up -d`; all 4 services (`db`, `redis`, `server`, `worker`) healthy/running.
- [x] 4.10 [LIVE-VERIFIED] Cron: daily `backup-twenty.sh` at 03:00.
- [x] 4.11 [LIVE-VERIFIED, regression caught and fixed] Confirmed port 3000 refuses external connections after `SERVER_BIND_HOST` was actually applied — first attempt regressed this (see design.md's "Config change delivery" decision), caught by this same check, fixed, re-verified.

## Phase 5: Data + Application Wiring

- [ ] 5.1 Human-required: browser signup on the production instance (no API for this), generate production `TWENTY_API_KEY`.
- [x] 5.2 [LIVE-VERIFIED] `create-fields.mjs` against production: all 20 fields (15 shared + 5 Person-only) confirmed present.
- [x] 5.3 [LIVE-VERIFIED] Cleared the 5 seeded demo Company/Person records on production via REST (predates `clear-demo-data.mjs`'s existence; same verified logic).
- [x] 5.4 [LIVE-VERIFIED] `import-crm-data.mjs` against production: 799 companies + 1,222 people imported.
- [x] 5.5 [LIVE-VERIFIED] `wrangler secret put TWENTY_API_KEY`/`TWENTY_API_URL --name cominorsa-web`; confirmed a new Worker version was auto-deployed.
- [x] 5.6 [LIVE-VERIFIED] End-to-end: real `POST /api/crm-lead` against the live `*.workers.dev` Worker URL created a real Person record on the production Twenty instance (confirmed by id/timestamp), then deleted as a test artifact.

## Phase 6: Documentation & Tooling

- [x] 6.1 `docker/twenty/PRODUCTION.md`: architecture, hardening applied, backup/restore, redeploy procedure, known issues, deviations from the proposal.
- [x] 6.2 `.claude/skills/twenty-crm-ops/SKILL.md` and `.claude/skills/vps-deploy/SKILL.md`, registered in `AGENTS.md`.

## Phase 7: Domain Diagnosis (turned out unrelated to any real outage)

- [x] 7.1 [LIVE-VERIFIED] Confirmed `cominorsa.com` (not `.com.pe`) is the real production domain, already live: `curl https://cominorsa.com` → 200, real site content; `POST https://cominorsa.com/api/crm-lead` created a real Person record on the production Twenty instance (confirmed by id/timestamp), deleted as a test artifact.
- [x] 7.2 [LIVE-VERIFIED, fixed] `scripts/cloudflare-domain.sh`/`scripts/lib/api.sh` used Cloudflare Pages APIs against a project that never had a Pages project (`wrangler pages project list` → empty). Rewrote both to use the Workers Custom Domains API (`PUT /accounts/:id/workers/domains`), confirmed working: `--check` mode now correctly lists `cominorsa.com`/`www.cominorsa.com` as the Worker's real custom domains.
- [x] 7.3 Corrected `scripts/lib/check-env.sh`'s documented token scope (Workers Scripts:Edit, not Pages:Edit).
- [x] 7.4 Annotated `COMINORSA-COM-DOMAIN-SETUP.md` with a status banner — describes a Pages-based plan that shipped as a Worker instead; kept as historical record, not rewritten.
- [ ] 7.5 `cominorsa.com.pe` DNS delegation — genuinely still not done, but confirmed **non-blocking**: it was always meant as an optional secondary/redirect domain, not the primary one. Needs registrar-side (likely NIC.pe) action the agent cannot perform.
- [ ] 7.6 Monitoring/alerting if the VPS or a container goes down — still not implemented (off-box backups and the restore drill, previously listed here, are both now done — see Phase 2).
