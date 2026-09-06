---
name: twenty-crm-ops
description: "Trigger: Twenty CRM, twenty:fields, twenty:import, twenty:clear-demo, twenty:backup, docker/twenty, crm-lead, custom fields, demo data, CSV import. Operate the Twenty CRM stack (local or production) safely and in order."
license: Apache-2.0
metadata:
  author: "cominorsa-web"
  version: "1.0"
---

## Activation Contract

Load when the task touches `docker/twenty/`, any `pnpm twenty:*` script, Twenty's REST/Metadata API, `app/api/crm-lead/route.ts`, or setting up/wiping a Twenty workspace (local or the production VPS).

## Hard Rules

- Never run `pnpm twenty:import` before `pnpm twenty:fields` — Person/Company must have the 20 custom fields provisioned first.
- Never run `pnpm twenty:import` before `pnpm twenty:clear-demo` on a fresh workspace — it refuses to run (exit 1) if Company or Person already has *any* records, demo or real.
- Never assume a first-boot `docker compose up -d` completed instantly — the server's healthcheck has a 210s `start_period` for cold start (see `docker-compose.yml` comment); use `pnpm twenty:setup`, which waits correctly, not a raw `up -d && curl` in a loop.
- Targeting production: never point these scripts at `docker/twenty/.env` — build a separate temp env file with the production `SERVER_URL`/`TWENTY_API_KEY` (from that instance's own Settings -> APIs & Webhooks), and delete it after use. See `docker/twenty/PRODUCTION.md`.
- After any destructive REST call (`DELETE /rest/...`) against production, verify the result with a `GET` before considering the step done.

## Execution Steps

1. Bring the stack up: `pnpm twenty:setup` (local) — waits for health, never times out early.
2. First-ever workspace only: sign up in the browser (no API for this — human step), generate an API key (Settings -> APIs & Webhooks).
3. `pnpm twenty:fields` — idempotent, safe to re-run.
4. `pnpm twenty:clear-demo` — refuses (exit 1, explains why) unless the object contains *exactly* the 5 known demo records; never force-deletes on mismatch.
5. `pnpm twenty:import` — imports both tracked CSVs; refuses if any records already exist.
6. `pnpm twenty:backup` — manual on-demand dump; production runs this daily via cron (see `vps-deploy` skill).

## Output Contract

State which script ran, its exit code, and — for anything against production — the verification query result, not just "done."

## References

- `docker/twenty/README.md` — full local setup/teardown/wipe procedure.
- `docker/twenty/PRODUCTION.md` — production runbook, backup/restore, known gaps.
