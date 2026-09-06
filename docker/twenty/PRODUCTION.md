# Twenty CRM — Production (VPS)

Companion to `docker/twenty/README.md` (which covers the **local** Docker
stack). This document is the actual, live production deployment: a
self-hosted VPS running the same `docker-compose.yml`, reachable 24/7 and
wired to `app/api/crm-lead/route.ts` via Cloudflare Workers secrets.

Implements `openspec/changes/archive/2026-09-06-twenty-crm-cloud-deploy/proposal.md`. Where this
document and the proposal disagree, this document reflects what is actually
running (see "Deviations from the original proposal" below).

## Current deployment

| Item | Value |
|---|---|
| Provider | DigitalOcean (not Hetzner — see Deviations) |
| Droplet | `ubuntu-s-2vcpu-4gb-nyc1`, 2 vCPU / 4GB RAM, region NYC1 |
| OS | Ubuntu 24.04 LTS |
| Public IP | `157.245.247.246` |
| Public URL | `https://157-245-247-246.nip.io` (see Deviations — no branded domain) |
| App directory | `/opt/twenty/` (owned by `deploy`, not `root`) |
| TLS | Let's Encrypt via Certbot + Nginx reverse proxy, auto-renews (systemd timer) |
| SSH access | Key-only, `deploy` user (sudo, no password); root login disabled |

## Architecture

```
Internet ──443/80──> Nginx (TLS termination) ──127.0.0.1:3000──> Twenty `server` container
                                                                       │
                                                        db (Postgres) ─┤
                                                        redis ─────────┤
                                                        worker ────────┘
```

The `server` container's port is bound to `127.0.0.1:3000` only, **not**
published on the public interface — Nginx is the only way in from outside.
This matters specifically on Docker hosts: Docker manipulates `iptables`
directly and bypasses `ufw` rules for published ports, so binding to
`127.0.0.1` in `docker-compose.yml` is the actual control, not the firewall
rule alone.

## Security hardening applied

- **No root SSH.** `PermitRootLogin no` in `/etc/ssh/sshd_config`. All admin
  access is through the `deploy` user (passwordless sudo, in the `docker`
  group).
- **No password SSH auth** (DigitalOcean default for key-provisioned
  droplets) — key-only login.
- **fail2ban** active with the default `sshd` jail (bans repeated failed SSH
  attempts).
- **Unattended security upgrades** enabled (`unattended-upgrades`, DigitalOcean
  default on this image — confirmed active, not just installed).
- **ufw** allows only 22 (SSH), 80, 443. Everything else is denied by
  default — but see the Docker/ufw caveat above; the `server` port binding is
  the real control for that specific port.
- **Secrets never committed.** `/opt/twenty/.env` (`ENCRYPTION_KEY`,
  `PG_DATABASE_PASSWORD`, `SERVER_URL`) exists only on the VPS, chmod 600,
  generated fresh for this host — **not** copied from the local dev stack's
  `.env` (Decision 4 in the proposal: fresh reprovision, not migration).

## Backups

`/opt/twenty/backup-twenty.sh` runs a `pg_dump` of the `default` database
inside the `db` container, gzips it to `/opt/twenty/backups/`, and prunes
anything older than 14 days. Scheduled via the `deploy` user's crontab, daily
at 03:00 server time:

```
0 3 * * * /opt/twenty/backup-twenty.sh
```

Log of each run: `/opt/twenty/backups/backup.log`.

**Off-box copy**: `docker/twenty/pull-backup.sh` runs on the user's own
Windows machine (Task Scheduler task `TwentyCRM-PullBackup`, daily 22:15
`SA Pacific Standard Time` / UTC-5 — after the VPS's 03:00 UTC cron has had
time to finish) and pulls the newest VPS backup down to
`~/twenty-backups/` via `scp`, skipping files already present, pruning
anything older than 30 days. This means a VPS-level loss (not just a bad
DB write) doesn't take every copy of the backup with it.

**Known gap**: the scheduled task is registered "run only when the user is
logged on" (no stored Windows credentials) — it does not run if the
machine is fully logged out at 22:15, only if it's on and at least locked.
A true off-site copy (DigitalOcean Spaces or similar, always available
regardless of any single machine's power/login state) is a stronger
guarantee than either the VPS-local or the pulled-to-laptop copy alone, and
remains a possible future upgrade if this dependency on the laptop being on
becomes a problem in practice.

### Manual backup

```bash
ssh deploy@157.245.247.246 /opt/twenty/backup-twenty.sh
```

### Restore from a backup

```bash
# copy the .sql.gz you want to restore to the VPS if it isn't there already
ssh deploy@157.245.247.246
cd /opt/twenty
gunzip -c backups/twenty-db-<TIMESTAMP>.sql.gz | \
  docker compose exec -T db psql -U postgres -d default
```

Restoring into a database that already has data will conflict on primary
keys; this is meant for restoring into an **empty** Postgres — either a
freshly wiped instance before `server`/`worker` have run any migrations,
or (as drilled below) `db`/`redis` started alone, restored into, and only
then joined by `server`/`worker`. The dump is a full `pg_dump` (schema +
data), not data-only, so it recreates everything from nothing — no prior
`docker compose up -d` on `server` is needed first.

**Drilled end-to-end (2026-09-06), fully isolated from production**: a
disposable compose project (different project name, fresh volumes, a
different local port — never touching `/opt/twenty` on the VPS or
`~/twenty-crm` locally) was built from a real production backup:

1. Started only `db`+`redis` (empty Postgres, no migrations run).
2. `gunzip | docker compose exec -T db psql ...` restored the dump directly — exit 0, zero errors in the output.
3. Started `server`+`worker` against that restored DB, using **the same `ENCRYPTION_KEY` as production** (required — a different key can't decrypt whatever the dump already has encrypted at rest). Result: `Upgrade summary: 1 workspace(s) succeeded, 0 workspace(s) failed`, all 30 cron jobs registered, `/healthz` → 200, zero errors/decrypt failures in the logs.
4. Verified via REST with production's own API key (still valid — it's part of the restored data): `GET /rest/companies` → `totalCount: 799`, `GET /rest/people` → `totalCount: 1222`, both matching production exactly; spot-checked one full company record, all 15 custom fields present with real values.
5. Torn down completely (`down -v`) — nothing from this drill persists anywhere.

This confirms the backup is not just non-empty but **actually restorable**,
including its encrypted contents, without needing a live Twenty signup —
the fastest true disaster-recovery path if this exact VPS is ever lost.

## Redeploying / updating the stack

```bash
ssh deploy@157.245.247.246
cd /opt/twenty
docker compose pull            # only if bumping image tags — see README.md's pinning policy
docker compose up -d
```

`docker-compose.yml` and `.env` on the VPS are **not** managed by CI/CD —
they were copied up manually during initial setup. Bumping a pinned image
tag means editing `docker/twenty/docker-compose.yml` in the repo (per the
project's "never `latest`" policy) and then re-copying it to the VPS, the
same as the initial deploy.

## Re-provisioning fields / re-importing data against production

Same scripts as local, pointed at the production instance instead of
`localhost`. Run from your machine (not the VPS — these are plain Node
scripts that just call the public API):

```bash
# .env.prod (not committed — create locally, delete after use)
SERVER_URL=https://157-245-247-246.nip.io
TWENTY_API_KEY=<production API key, from that instance's own Settings -> APIs & Webhooks>

node --env-file=.env.prod docker/twenty/scripts/create-fields.mjs
node --env-file=.env.prod docker/twenty/scripts/import-crm-data.mjs
```

Same caveats as local apply: `import-crm-data.mjs` refuses to run if
Company or Person already has any records (see README.md's
Wipe-before-reimport section).

## Cloudflare Workers wiring

```bash
pnpm exec wrangler secret put TWENTY_API_KEY --name cominorsa-web
pnpm exec wrangler secret put TWENTY_API_URL --name cominorsa-web
# value: https://157-245-247-246.nip.io
```

Setting a secret creates a new Worker deployment automatically — no separate
`wrangler deploy` is needed for the secret to take effect.

Verify end-to-end against the real production domain:

```bash
curl -X POST https://cominorsa.com/api/crm-lead \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Lead","city":"Lima","service":"...","question":"...","whatsappLine":"..."}'
```

(`https://cominorsa-web.<workers-dev-subdomain>.workers.dev/api/crm-lead`
also works and hits the same Worker — useful if `cominorsa.com` itself is
ever the thing under test.)

Then confirm the Person record exists via `GET /rest/people` against the
production Twenty instance (see README.md's REST examples), and delete the
test record afterward.

## Known issues / follow-ups

1. **`cominorsa.com.pe` does not resolve** (`NXDOMAIN` even for its own `NS`
   records) — not delegated to any nameserver. **This does not block
   anything currently live**: the real production domain is
   `cominorsa.com` (purchased via Cloudflare Registrar — see
   `COMINORSA-COM-DOMAIN-SETUP.md`), confirmed serving the real site and
   the full CRM lead-capture flow end-to-end (`POST
   https://cominorsa.com/api/crm-lead` verified to create a real Person
   record on this VPS's Twenty instance). `.com.pe` was always meant as an
   optional secondary domain redirecting to `.com` (per that doc's own
   rationale), never a requirement — it was added as a Cloudflare zone at
   some point (status `pending`, assigned nameservers
   `harleigh.ns.cloudflare.com` / `johnathan.ns.cloudflare.com`) but the
   registrar-side NS delegation was never finished. Finishing it is a
   nice-to-have, not a fix for anything broken.
2. **Backups are not off-box** (see Backups section above).
3. **No monitoring/alerting** if the VPS or any container goes down —
   `docker compose ps` / `systemctl status` require someone to check
   manually. Not in scope of the original proposal either.

## Deviations from the original proposal

`openspec/changes/archive/2026-09-06-twenty-crm-cloud-deploy/proposal.md` decided **Hetzner
CX22** (Decision 1) and no explicit TLS domain strategy beyond "no branded
subdomain" (Decision 3). Actual execution deviated on both, by the user's
choice at deploy time, not a design change:

- **Provider: DigitalOcean, not Hetzner.** Hetzner requires manual new-account
  verification that can take hours to days; DigitalOcean activates
  instantly with a valid card. Trade-off: ~$24/mo instead of ~€4.50/mo for
  equivalent specs (2 vCPU / 4GB). Everything else in the proposal (compose
  stack reused unmodified, fresh reprovision-and-reimport, self-managed ops)
  held as designed.
- **TLS domain: `nip.io`, not a purchased/owned domain.** Let's Encrypt
  cannot issue a certificate for a bare IP address. `157-245-247-246.nip.io`
  is a wildcard DNS service that resolves any `<ip-with-dashes>.nip.io` to
  that IP, letting Certbot issue a real certificate without buying or
  configuring a custom domain — satisfying Decision 3 ("no branded
  subdomain") while still getting valid HTTPS instead of a self-signed
  certificate or no TLS at all.
