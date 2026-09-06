# Proposal: Twenty CRM Cloud Deploy — Self-Hosted VPS

## Intent

`docker/twenty/` (change 1) runs Twenty CRM locally only; `app/api/crm-lead/route.ts`
(change 2, `website-crm-lead-capture`) is already fully wired to write leads to it
but no-ops in production because `TWENTY_API_KEY`/`TWENTY_API_URL` are unset — every
consultation-form lead is silently dropped once the site is live. This change moves
the already-verified `docker-compose.yml` stack (4 services: `server`, `worker`,
`db`, `redis`) from the developer's laptop to a reachable, always-on host, and points
production's Cloudflare Workers secrets at it. Success is: a real lead submitted on
the live site creates a Person record in a production Twenty instance, reachable
24/7, independent of anyone's laptop being on.

## Scope

### In Scope
- Provision a self-hosted VPS (see **Decision 1** below) and run the existing,
  unmodified `docker/twenty/docker-compose.yml` stack on it.
- A reverse proxy (Nginx or Traefik — exact choice deferred to design.md) in front
  of the `server` service, terminating TLS via Let's Encrypt.
- Set `TWENTY_API_KEY`/`TWENTY_API_URL` as real Cloudflare Workers secrets
  (`wrangler secret put`, per `DEPLOY.md`'s existing pattern) pointing at the new host.
- Fresh reprovisioning of CRM data on the new host: re-run `create-fields.mjs`
  against it, then reimport `crm-import-companies.csv`/`crm-import-people.csv`
  via `pnpm twenty:import` (see **Decision 4**).
- Baseline operational setup this project has never needed before: SSH key-based
  access, a backup routine for the Postgres volume, and a documented secret/API-key
  rotation procedure (see **Decision 2**).

### Out of Scope
- Twenty Cloud (managed SaaS) and container-PaaS options — ruled out by
  **Decision 1**, not pursued further.
- A branded `crm.cominorsa.com` DNS record — ruled out by **Decision 3**; access is
  via the VPS's IP address or a generic/non-branded host.
- `pg_dump`/restore migration from the local Docker stack — ruled out by
  **Decision 4**; change 1 never held real production data, so there is nothing
  worth migrating byte-for-byte.
- Any change to `app/api/crm-lead/route.ts` or other application code — already
  fully env-driven (confirmed by re-reading the handler; the only production gap is
  the two unset secrets).
- Worker horizontal-scaling — no officially documented Twenty path exists (carried
  forward from exploration.md's Risks); out of scope until real load data exists.

## Decisions (confirmed, not open questions)

1. **Hosting: self-hosted VPS.** Representative target: Hetzner CX22
   (2 vCPU / 4GB RAM) at ~€4.35–4.59/month, matching Twenty's documented minimum/
   recommended RAM and reusing the existing `docker-compose.yml` verbatim. Rejected
   Twenty Cloud ($9–19/user/month recurring, data on shared infra, custom domain
   gated behind the pricier Organization tier) and container PaaS (no official
   Twenty-authored guide, community-only templates, ambiguous cost/ops middle
   ground) as documented in exploration.md's Approaches Considered.
2. **Ops owner: the user, alone.** No other named owner exists or is being
   introduced. This is the project's first internet-facing, stateful, credentialed
   system — everything before it (the Cloudflare Workers site itself) is stateless
   and edge-managed. Choosing self-hosting creates real, ongoing operational
   responsibilities that did not exist before:
   - **TLS certificate lifecycle** — issuing and renewing the Let's Encrypt
     certificate used by the reverse proxy; Twenty itself does not terminate TLS.
   - **Backup cadence** — a recurring, tested backup of the `db-data` Postgres
     volume (Twenty's docs describe backups as `pg_dump`-based and the deployer's
     responsibility, not something Twenty automates).
   - **SSH key management** — provisioning, storing, and, if ever needed, revoking
     the SSH credentials that are now the only way to reach this host's data.
   - **Secret rotation** — a policy for rotating `TWENTY_API_KEY` (and the VPS's own
     SSH keys) if compromised, matching the discipline `DEPLOY.md` already expects
     of Cloudflare secrets.
3. **No branded subdomain.** Access is via the VPS's plain IP address (or a
   generic host provided by the VPS/proxy setup), not `crm.cominorsa.com`. No new
   DNS record is added to the existing Cloudflare-managed `cominorsa.com` zone.
4. **Data migration: fresh reprovision-and-reimport, not `pg_dump`/restore.**
   Change 1 never held real production data — re-running `create-fields.mjs`
   against the new host and reimporting the two tracked CSVs via
   `pnpm twenty:import` (the same procedure already documented in
   `docker/twenty/README.md`'s wipe-before-reimport section — the import
   itself moved from a UI wizard to `docker/twenty/scripts/import-crm-data.mjs`,
   a scripted GraphQL batch-create, after change 1 already proved out the
   API shapes it needs) is simpler and just as correct as migrating a
   database that only ever held test data.

## Approach

1. **Reuse, don't rebuild, the compose stack.** `docker/twenty/docker-compose.yml`
   is already pinned (`twentycrm/twenty:v2.38.1`, `postgres:16.15`, `redis:7.4.11`)
   and healthcheck-gated; it runs on the VPS exactly as it runs locally, no compose
   file changes anticipated.
2. **Reverse proxy for TLS only.** Twenty's `server` service listens on port 3000
   with no TLS of its own (confirmed against Twenty's official docker-compose docs
   in exploration.md); a proxy is the standard, officially-acknowledged way to put
   TLS in front of it. Proxy choice, config, and renewal automation are design.md's
   job, not this proposal's.
3. **Secrets follow the existing Cloudflare pattern exactly.** `DEPLOY.md` already
   documents `wrangler secret put` for sensitive values; `TWENTY_API_KEY`/
   `TWENTY_API_URL` are set the same way, no new secrets-management pattern
   introduced.
4. **Data goes in once, from source-of-truth CSVs, not from a live dump.** Both
   CSVs are already tracked at the repo root and treated as the source of truth per
   `docker/twenty/README.md`; the new host is provisioned from them the same way the
   local stack originally was.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| New VPS host | New | Runs the unmodified `docker/twenty/docker-compose.yml` stack |
| Reverse proxy config (new, host-side) | New | TLS termination in front of the `server` service, port 3000 |
| Cloudflare Workers secrets | Modified | `TWENTY_API_KEY`/`TWENTY_API_URL` set to real values via `wrangler secret put` |
| `docker/twenty/scripts/create-fields.mjs` | Reused, not modified | Re-run against the new host's `SERVER_URL`/`TWENTY_API_KEY` |
| `crm-import-companies.csv`, `crm-import-people.csv` | Reused, not modified | Reimported via `pnpm twenty:import` against the new host |
| `app/api/crm-lead/route.ts` | Unaffected | Already fully env-driven; zero code changes |
| DNS (`cominorsa.com` zone) | Unaffected | No new record added per Decision 3 |

## Risks

Carried forward from exploration.md, unmitigated by this proposal and not softened:

| Risk | Likelihood | Note |
|---|---|---|
| First internet-facing, stateful, credentialed system this project operates | — | TLS lifecycle, backup/restore cadence, SSH access, and API-key rotation are all genuinely new operational surface with a single, unbacked-up owner (the user) |
| No documented worker-scaling path from Twenty | Low (current load) | No official guidance exists if lead volume ever grows enough to matter |
| Backup/restore has no tested procedure yet | Med | Twenty's own docs describe backups as `pg_dump`-based and entirely the deployer's responsibility; none exists today |
| `create-fields.mjs`/CSV-import behavior against the real VPS host specifically not yet hands-on verified | Low | Same product surface already verified end-to-end locally in change 1; still a first live-host run |
| Single point of failure | Med | One VPS, one operator, no redundancy for TLS, backups, or SSH access |

## Rollback Plan

Stop and remove the VPS's Twenty stack (`docker compose down -v` on the host);
revert the two Cloudflare Workers secrets to unset (`wrangler secret delete
TWENTY_API_KEY`/`TWENTY_API_URL`), which restores `app/api/crm-lead/route.ts`'s
existing no-op behavior with zero code changes. No DNS record exists to revert
(Decision 3). The local Docker stack from change 1 is entirely unaffected and
remains available for development.

## Dependencies

- `twenty-crm-local-setup` (change 1) — compose stack, `create-fields.mjs`, and
  both CSVs, all verified end-to-end locally; this change ports them, unmodified,
  to a new host.
- `website-crm-lead-capture` (change 2) — already reads `TWENTY_API_KEY`/
  `TWENTY_API_URL` from the environment with no further code changes needed; this
  change only supplies real values for those two secrets.

## Success Criteria

- [ ] Twenty's `server`/`worker`/`db`/`redis` stack runs on the VPS, reachable over
      HTTPS via a valid, auto-renewing Let's Encrypt certificate.
- [ ] `TWENTY_API_KEY`/`TWENTY_API_URL` are set as real Cloudflare Workers secrets
      pointing at the new host.
- [ ] `create-fields.mjs` run against the new host provisions all 15 shared
      Company/Person fields plus the 5 Person-only lead-capture fields, exiting `0`.
- [ ] Both CSVs are reimported via `pnpm twenty:import` against the new host with
      correct row counts.
- [ ] A real consultation-form submission on the live site creates a Person record
      in the production Twenty instance.
- [ ] A documented backup procedure exists and has been run at least once
      successfully against the production Postgres volume.
- [ ] No `crm.cominorsa.com` DNS record exists; access is via IP/generic host only.
