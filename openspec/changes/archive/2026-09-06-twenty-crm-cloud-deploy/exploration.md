# Exploration: twenty-crm-cloud-deploy — moving Twenty CRM from local Docker to a reachable production host

> Paused after this phase at the user's explicit request ("primero en local") —
> change 1 (local setup) must be fully working and verified before this change
> advances to proposal. Kept here as a record so the research isn't lost.

## Current State

- `docker/twenty/docker-compose.yml` confirms Twenty's real shape: 4 services — `server` (Node, port 3000, `/healthz` healthcheck, `restart: unless-stopped`), `worker` (BullMQ-style background jobs, migrations/cron disabled since `server` handles them), `db` (Postgres 16.15, persistent volume `db-data`), `redis` (7.4.11). Two named volumes persist state. This is a stateful, multi-process, long-running application — architecturally impossible on Cloudflare Workers, confirmed directly from the compose file and cross-checked against Twenty's own production-deployment docs, not assumed.
- `app/api/crm-lead/route.ts` re-read in full: env-gates on `process.env.TWENTY_API_KEY`/`TWENTY_API_URL` as the very first check, no-ops with `200 {"ok":true}` if either is unset, otherwise `fetch(`${apiUrl}/rest/people`, ...)` with Bearer auth. No localhost, no dev-only URL anywhere. Confirmed: the only repo-side change needed is setting real `TWENTY_API_KEY`/`TWENTY_API_URL` as Cloudflare Workers secrets/vars — zero code changes.
- `DEPLOY.md` confirms the existing secrets pattern (`wrangler secret put`, `wrangler.json` `"vars"`) already fits this need exactly.
- `COMINORSA-COM-DOMAIN-SETUP.md` confirms `cominorsa.com` is on Cloudflare DNS with existing automation for adding subdomain records — a `crm.cominorsa.com` record would be trivial to add if wanted.
- Change 1 (local Docker + `create-fields.mjs` provisioning 19 fields + 2 CSVs) has no production data anywhere yet — nothing valuable would be lost by re-provisioning from scratch against a new host.

## Verified Online

1. **Twenty Cloud is real** (fetched `twenty.com/pricing` directly): Pro $9/user/month, Organization $19/user/month (adds custom domain + SSO), Enterprise from $50k/year. 30-day free trial.
2. Self-hosting is free (AGPL-3.0, already confirmed in change 1).
3. Twenty's official docs (`docs.twenty.com/.../docker-compose`, fetched directly) state the compose file **is** meant for production hosting, not dev-only — but Twenty does **not** terminate TLS itself; a reverse proxy (Nginx/Traefik) is the deployer's job. Backups are `pg_dump`-based and the deployer's responsibility. No worker horizontal-scaling guidance exists.
4. No official Twenty-authored PaaS guide exists; only third-party/community Railway templates (~$10–20/month flat for the 4-service stack) were found.
5. Representative VPS ballpark: Hetzner CX22 (2 vCPU/4GB RAM) ≈ €4.35–4.59/month (~$5/month), meeting Twenty's documented RAM minimum/recommendation.

## Affected Areas

- No application code changes (`app/api/crm-lead/route.ts` already env-driven only).
- Cloudflare Workers secrets/vars (`TWENTY_API_KEY`, `TWENTY_API_URL`).
- DNS, only if self-hosted or a branded custom domain is wanted.
- `docker/twenty/scripts/create-fields.mjs` re-run against the new host; both CSVs re-imported via UI wizard.

## Approaches Considered

1. **Twenty Cloud** ($9–19/user/month) — Low effort, zero new ops surface, but recurring per-seat cost and data on Twenty's shared infra; custom domain needs the pricier tier.
2. **Self-hosted VPS** (~$5/month, reuse existing `docker-compose.yml`) — Medium effort, cheapest, full data control, but COMINORSA now owns TLS, backups, SSH access, and secret rotation entirely — none of which exists anywhere in this project today.
3. **Container PaaS** (community templates, ~$10–20/month flat) — Low–Medium effort, managed TLS/no SSH, still self-hosted data, but not an officially documented Twenty path and sits in an ambiguous cost/ops middle ground.

**Lean (not a decision)**: Twenty Cloud Pro as the lowest-risk starting point given this team has zero prior ops experience beyond a static/serverless site — it eliminates the entire new TLS/backup/SSH/secret-rotation surface this exploration flagged. Self-hosted VPS is materially cheaper but should only be chosen if a specific person is named as ops owner. Final choice is a business/budget decision, not made here.

## Risks

- No documented worker-scaling path from Twenty.
- Custom domain gated behind Organization tier, not Pro.
- Twenty Cloud's backup/restore SLA not confirmed from public pricing page.
- `create-fields.mjs`/CSV-import behavior against Twenty Cloud specifically not hands-on verified (very likely fine, same product surface).
- First internet-facing, stateful, credentialed system this project would operate if self-hosted — TLS lifecycle, backup/restore cadence, SSH/dashboard access, and API key rotation policy are all genuinely new.

## Open Questions for sdd-propose (when this resumes)

1. Hosting choice (Twenty Cloud vs. self-hosted VPS vs. PaaS) — genuine budget/ops decision.
2. Seat count (drives Twenty Cloud per-seat cost).
3. Data migration approach: fresh re-provision-and-reimport (recommended) vs. `pg_dump`/restore.
4. Whether a branded `crm.cominorsa.com` subdomain is worth pursuing.
5. Named ops owner if a self-hosted path is chosen.
