# Design: Twenty CRM Cloud Deploy — Self-Hosted VPS

## Technical Approach

The already-verified local stack (`docker/twenty/docker-compose.yml`, unmodified) runs on a VPS instead of a laptop. Nginx terminates TLS in front of the `server` service (bound to `127.0.0.1:3000` only — never published on the public interface) and Certbot issues a real Let's Encrypt certificate. `TWENTY_API_KEY`/`TWENTY_API_URL` become real Cloudflare Workers secrets, replacing the no-op env-gate in `app/api/crm-lead/route.ts`. Data is fresh-provisioned on the new host (`create-fields.mjs` + `import-crm-data.mjs`), not migrated, per the proposal's Decision 4.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Provider | **DigitalOcean**, 4GB/2vCPU droplet (~$24/mo) | Hetzner CX22 (~€4.50/mo, proposal's original Decision 1) | Hetzner's new-account verification is manual and can take hours to days; the user chose to pay ~5x more for instant activation over waiting. A real deviation from the proposal, made at deploy time, not a design flaw — recorded here and in `PRODUCTION.md`. |
| TLS domain | **`<ip-with-dashes>.nip.io`** wildcard DNS (`157-245-247-246.nip.io`) | A purchased/owned domain; a self-signed cert; no TLS | Let's Encrypt cannot issue a cert for a bare IP. `nip.io` resolves any dashed-IP subdomain to that IP with zero registration, satisfying Decision 3 ("no branded subdomain") while still getting a real, browser-trusted certificate instead of a self-signed one or plaintext HTTP. |
| Port exposure | `server`'s published port is bound to `127.0.0.1` via a `SERVER_BIND_HOST` env var (defaults to `0.0.0.0` for local dev) | Rely on `ufw` alone to block port 3000 | Docker manipulates `iptables` directly and bypasses `ufw` rules for published ports — a well-known Docker/ufw interaction, confirmed live on this host (curl to `:3000` succeeded despite `ufw` denying non-allowed ports). Binding the publish address itself is the only control that actually works, and it's re-verified after every deploy (see `vps-deploy` skill). |
| SSH/access hardening | Non-root `deploy` user (passwordless sudo, `docker` group); `PermitRootLogin no`; password auth already off (DO default); `fail2ban` (`sshd` jail) | Leave `root` SSH open (default DO droplet state) | This is the project's first internet-facing, credentialed system (proposal's Decision 2 risk). Root-over-SSH plus no intrusion-ban policy is the highest-leverage compromise path for a single-operator VPS; the fix is one-time and the `deploy` user was verified working *before* root access was revoked, avoiding a lockout. |
| Backups | `pg_dump` → gzip → local file, cron daily 03:00, 14-day retention, tracked script (`docker/twenty/backup-twenty.sh`) | `pg_dump`/restore from local Docker stack; no backup at all | Matches proposal Decision 4 (fresh reprovision, not migration) — this is a *new* recurring backup of the *new* host's data, not a one-time migration. Known gap: still local to the same disk as the DB (no off-box copy yet) — see `PRODUCTION.md` Known Issues. |
| Healthcheck cold-start | Added `start_period: 210s` to the `server` healthcheck | Leave as-is and retry `docker compose up -d` manually on failure | Reproduced on **both** the local stack and this VPS: `retries: 20 × interval: 5s` (~100s) is shorter than real first-boot time (migrations + module init), so `docker compose up -d` reliably failed with "dependency failed to start" on a fresh volume before this fix. Verified fixed with a disposable, isolated compose project (`twenty-fixtest`) exercising a true cold start end-to-end (exit 0, ~4 min, no manual retry). |
| Config change delivery | Edit the repo's `docker-compose.yml`/`.env.example`, `scp` to the host, never edit the host copy in place | `ssh` + `sed` directly on the VPS | A direct host edit (binding fix) was in fact overwritten by a later routine `scp` of the repo's compose file during this same rollout — a real, observed regression (port 3000 briefly public again), fixed by moving the difference into an env var instead of a file edit that only exists on one machine. |
| Off-box backup destination | User's own Windows machine, via a scheduled `scp` pull (`pull-backup.sh` + Task Scheduler) | DigitalOcean Spaces (~$5/mo, always-on off-site storage) | Asked the user directly; chose free over always-available. Disclosed trade-off: the pull only happens while that machine is logged on, so a VPS failure occurring during an extended period with the laptop off/logged-out could still lose the days-since-last-pull gap — acceptable to the user, revisit if that gap ever matters in practice. |
| Custom domain API (unrelated to Twenty, fixed while investigating DNS) | Workers Custom Domains API (`PUT /accounts/:id/workers/domains`) | Leave `scripts/cloudflare-domain.sh` using Cloudflare Pages APIs (its original implementation) | `wrangler pages project list` confirmed no Pages project ever existed for this repo; `cominorsa-web` is a Worker, and its real custom domains (`cominorsa.com`, `www.cominorsa.com`) were already attached via the Workers API, not Pages. The script's Pages calls could never have worked here — not a hypothetical bug, a live-confirmed one. |

## Data Flow

```
Repo: docker/twenty/docker-compose.yml, .env.example
          │ scp
          ▼
VPS /opt/twenty/ (owned by deploy, not root)
   .env: ENCRYPTION_KEY, PG_DATABASE_PASSWORD (fresh, host-specific),
         SERVER_URL=https://<ip>.nip.io, SERVER_BIND_HOST=127.0.0.1
          │ docker compose --env-file .env up -d
          ▼
db (healthy) ─┬─→ server (127.0.0.1:3000, start_period 210s) ──┐
redis ────────┘                                                 ├─→ worker
                                                                 │
Nginx (:80/:443, this host) ──proxy_pass 127.0.0.1:3000────────┘
          │ Certbot (Let's Encrypt, HTTP-01 on :80)
          ▼
https://<ip>.nip.io  ←── human: browser signup (no API), generate API key
          │
          ▼
create-fields.mjs, clear-demo-data.mjs, import-crm-data.mjs
   (run from any machine, pointed at SERVER_URL + that key — not on the VPS itself)
          │
          ▼
wrangler secret put TWENTY_API_KEY / TWENTY_API_URL --name cominorsa-web
   (auto-deploys a new Worker version; no separate `wrangler deploy`)
          │
          ▼
Real POST to /api/crm-lead on the live Worker → Person record on the VPS instance
```

## File Changes

| File | Action | Description |
|---|---|---|
| `docker/twenty/docker-compose.yml` | Modify | `SERVER_BIND_HOST` env var for the publish address; `start_period: 210s` on the `server` healthcheck |
| `docker/twenty/.env.example` | Modify | Document optional `SERVER_BIND_HOST` |
| `docker/twenty/backup-twenty.sh` | Create | Path-relative pg_dump + rotation, identical file runs locally and via VPS cron |
| `docker/twenty/pull-backup.sh` | Create | Runs on the user's machine, `scp`s the newest VPS backup down (off-box copy), skips already-present files, prunes after 30 days |
| `docker/twenty/scripts/clear-demo-data.mjs` | Create | Codifies the previously-manual "delete Twenty's 5 seeded demo records" step, with an all-or-nothing safety match against the known demo set |
| `docker/twenty/PRODUCTION.md` | Create | Production runbook: architecture, hardening applied, backup/restore, redeploy procedure, known issues |
| `package.json` | Modify | Add `twenty:clear-demo`, `twenty:backup` scripts |
| `.gitignore` | Modify | Add `/docker/twenty/backups/` |
| `.claude/skills/twenty-crm-ops/SKILL.md` | Create | Operational order-of-steps guardrails (fields → clear-demo → import) |
| `.claude/skills/vps-deploy/SKILL.md` | Create | Deploy/security guardrails for the specific regression class observed in this rollout |
| VPS host state (not in repo) | New | Droplet, `deploy` user, Nginx config, Certbot cert, ufw/fail2ban config, cron entry — see `PRODUCTION.md` for the full inventory |
| Cloudflare Workers secrets (not in repo) | Modify | `TWENTY_API_KEY`, `TWENTY_API_URL` set via `wrangler secret put` |
| `scripts/lib/api.sh` | Modify | Add `cf_list_worker_domains`/`cf_add_worker_domain` (Workers Custom Domains API); unrelated to Twenty, fixed in the course of diagnosing the `.com.pe` DNS question |
| `scripts/cloudflare-domain.sh` | Modify | Use the new Workers-domain functions instead of `wrangler pages domain add`/Pages APIs |
| `scripts/lib/check-env.sh` | Modify | Correct the documented required token scope (Workers Scripts:Edit, not Pages:Edit) |
| `COMINORSA-COM-DOMAIN-SETUP.md` | Modify | Add a status banner noting it describes a Pages-based plan that shipped as a Worker instead; not rewritten (historical record) |

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `clear-demo-data.mjs` refuses when the object doesn't match the demo set exactly | Same `node --test` pattern as `create-fields.mjs` (not yet written — see Open Questions) |
| Manual, live-verified this session | Cold-start healthcheck fix | Disposable isolated compose project (`twenty-fixtest`, throwaway volumes/network), full `up -d` from empty, confirmed exit 0 and both `server`/`worker` healthy without manual retry |
| Manual, live-verified this session | Port exposure control | `curl` to `http://<ip>:3000/healthz` from outside the host, before (200 — exposed) and after (connection refused/timeout) the `SERVER_BIND_HOST` fix |
| Manual, live-verified this session | SSH hardening didn't lock out access | `deploy` user's sudo + docker-group access confirmed working *before* `PermitRootLogin no` was applied; root access confirmed refused after |
| Manual, live-verified this session | End-to-end lead capture | Real `POST /api/crm-lead` against the live `*.workers.dev` Worker URL created a real Person record on the VPS Twenty instance (confirmed by id + timestamp via `GET /rest/people`), then deleted as a test artifact |
| Manual, live-verified this session | Backup restore | Disposable, isolated compose project restored a real production dump into an empty Postgres (`db`+`redis` only, direct `psql` restore, then `server`+`worker` joined with production's `ENCRYPTION_KEY`); confirmed 0 errors, exact record counts (799/1222) via REST with the production API key, then torn down completely |

## Threat Matrix

| Concern | Applicable? | Notes |
|---|---|---|
| Unauthenticated network exposure | Applicable, mitigated | `server`'s port bound to `127.0.0.1`; only Nginx (same host) reaches it; `ufw` additionally restricts 22/80/443 (belt-and-suspenders given the Docker/ufw caveat above) |
| SSH brute-force | Applicable, mitigated | Password auth off, `fail2ban` sshd jail active, root login disabled |
| Secret exposure | Applicable, mitigated | VPS `.env` chmod 600, never committed; Cloudflare secrets set via `wrangler secret put` (stdin), never a CLI arg; production API key kept only in a temp local file, deleted after use |
| Backup exfiltration/loss | Applicable, partially mitigated | Local-only backups reduce loss-from-bad-write risk but not loss-from-VPS-failure risk — disclosed as a known gap, not silently accepted |
| TLS certificate lifecycle | Applicable, mitigated | Certbot's systemd timer auto-renews; `nip.io` domain requires no registrar renewal (unlike a purchased domain) |
| Unattended OS patching | Applicable, mitigated | `unattended-upgrades` confirmed active (DigitalOcean default image), not just installed |

## Migration / Rollout

No existing production data to migrate (local Docker stack never held real production traffic). Rollback matches the proposal exactly: `docker compose down -v` on the VPS, `wrangler secret delete TWENTY_API_KEY`/`TWENTY_API_URL` (restores the route's existing no-op), destroy the droplet. No DNS record exists to revert.

## Open Questions

- [ ] `cominorsa.com.pe` still does not resolve at all (no NS delegation) — **not blocking**: `cominorsa.com` is the real production domain (Cloudflare Registrar) and is confirmed live, serving the site and the full CRM lead-capture flow end-to-end. `.com.pe` was always an optional secondary/redirect domain (see `COMINORSA-COM-DOMAIN-SETUP.md`), never a requirement; finishing its registrar-side NS delegation (likely NIC.pe) is a nice-to-have the agent cannot perform, not a fix for anything currently broken.
- [ ] `scripts/cloudflare-domain.sh` and `scripts/lib/api.sh` used Cloudflare **Pages** APIs (`wrangler pages domain add`, `/pages/projects/.../domains`) for a project that has never had a Pages project — confirmed via `wrangler pages project list` (empty) while the Worker `cominorsa-web` already has `cominorsa.com`/`www.cominorsa.com` attached as real Workers Custom Domains. Fixed in this change: both scripts now use the Workers Custom Domains API (`PUT /accounts/:id/workers/domains`). `COMINORSA-COM-DOMAIN-SETUP.md` (a separate, pre-existing planning doc) still describes the original Pages-based plan and has been annotated, not rewritten, since it has historical value.
- [x] Off-box backup copy — implemented via `pull-backup.sh` + a Windows Task Scheduler task on the user's own machine, chosen over DigitalOcean Spaces (~$5/mo) after asking the user directly; known limitation is it only runs while that machine is logged on.
- [x] Unit test for `clear-demo-data.mjs` — `tests/qa/twenty-clear-demo-data.test.mjs`, 6 cases mirroring `create-fields.mjs`'s pattern, 6/6 pass.
- [ ] No monitoring/alerting if the VPS or a container goes down — out of the original proposal's scope too.
