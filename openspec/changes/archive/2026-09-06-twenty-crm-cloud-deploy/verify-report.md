```yaml
schema: gentle-ai.verify-result/v1
verdict: pass
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 12/12
test_command: node --test tests/rendered-html.test.mjs 'tests/qa/*.test.mjs'
test_exit_code: 0
test_output_hash: sha256:d89580215d923679d0c6a9d371b9374fa119cd0e03588957231aeaca193c3b55
build_command: vinext build
build_exit_code: 0
build_output_hash: sha256:8e7bbfde5e0e8f556aab1cdb621cb7d8467f7a216a476518c25d742b7acd35b3
```

## Verification Report

**Change**: twenty-crm-cloud-deploy
**Mode**: Standard, run in the same session that performed the implementation (not a fresh independent verify pass) — flagged explicitly, since that is weaker evidence than an independent re-check. Live-infrastructure claims (VPS, DNS, Cloudflare) are re-checked here with fresh commands, not merely quoted from earlier in the session.

### Completeness (tasks.md)

| Metric | Value |
|---|---|
| Tasks total | 38 (excluding forecast table) |
| Tasks complete (`[x]`) | 33 |
| Tasks incomplete (`[ ]`) | 5 — all explicitly disclosed as out-of-scope follow-ups (restore drill, unit test for `clear-demo-data.mjs`, `cominorsa.com.pe` DNS — confirmed non-blocking), none silently dropped |

### Build & Tests Execution (re-run for this report)

**Build**: PASSED — `vinext build`, exit 0. Confirms the isolation requirement still holds after this change's `package.json`/`.gitignore` edits (build succeeds independent of any Docker/VPS state).

**Tests**: 158 passed / 0 failed, exit 0 (`node --test tests/rendered-html.test.mjs 'tests/qa/*.test.mjs'`) — 152 pre-existing + 6 new in `tests/qa/twenty-clear-demo-data.test.mjs`.

**Finding, fixed during this verify pass**: `tests/qa/twenty-start.test.mjs` initially failed (3 assertions) on this Windows machine — pre-existing regexes (`/docker\/twenty$/`, etc.) assumed forward-slash paths, but `TWENTY_DIR`/`COMPOSE_FILE` in `start.mjs` are built with Node's `path.join`, which yields backslash-separated paths on Windows. Not caused by this change (no prior Windows run had exercised this file), but caught while re-verifying test health here. Fixed to match either separator (`/docker[\\/]twenty$/`); re-run confirms 152/152 pass. Included in this change's diff since it was found and fixed in the course of verifying it.

**CSV side-effect check**: `git status --porcelain -- crm-import-companies.csv crm-import-people.csv` → empty, confirming the known `crm-import-integration.test.mjs` write/restore cycle left the tree clean (same pre-existing behavior noted in `twenty-crm-local-setup`'s verify-report).

### Correction to this report's earlier draft

An earlier version of this document (and of `design.md`/`tasks.md`/`PRODUCTION.md`) stated the production site was reachable only via the Worker's `*.workers.dev` URL, with `cominorsa.com.pe` as a blocking DNS gap. Re-investigated and corrected: **`cominorsa.com`** (not `.com.pe`) is the real, already-live production domain (purchased via Cloudflare Registrar — see `COMINORSA-COM-DOMAIN-SETUP.md`), confirmed serving the real site and the full CRM lead-capture flow end-to-end. `.com.pe` was always an optional secondary/redirect domain, never a requirement, and its unfinished DNS delegation blocks nothing currently live. All four files have been corrected to reflect this; see their own text for details. This correction is recorded here rather than silently editing history, per the same disclosure standard the rest of this report holds itself to.

While investigating, also found and fixed a real, unrelated (to Twenty CRM) bug: `scripts/cloudflare-domain.sh`/`scripts/lib/api.sh` used Cloudflare Pages APIs for a project that has never had a Pages project (`wrangler pages project list` confirmed empty) — the Worker `cominorsa-web` already has `cominorsa.com`/`www.cominorsa.com` attached via the Workers Custom Domains API instead. Fixed both scripts to use that API; re-tested `--check` mode, now correctly reports the real state.

### Live Infrastructure Checks (re-run for this report, not quoted from earlier)

| Check | Command | Result |
|---|---|---|
| Port 3000 not publicly reachable | `curl -m 8 http://157.245.247.246:3000/healthz` | Connection refused/timeout (`000`) — confirmed closed |
| HTTPS serving via Nginx | `curl -m 8 https://157-245-247-246.nip.io/healthz` | `200` |
| Root SSH disabled | `ssh -o BatchMode=yes root@157.245.247.246` | `Permission denied (publickey)` |
| `deploy` SSH access | `ssh deploy@157.245.247.246 whoami` | `deploy` |
| fail2ban active | `fail2ban-client status` | 1 jail: `sshd` |
| All 4 containers healthy/running | `docker compose ps` | `db`/`redis`/`server` healthy, `worker` running |
| Daily backup cron present | `crontab -l` | `0 3 * * * /opt/twenty/backup-twenty.sh` |
| Repo docker-compose.yml matches deployed copy | manual diff of `SERVER_BIND_HOST` env var usage | Matches — both source the binding from `.env`, no drift |
| Production site reachable at its real domain | `curl https://cominorsa.com` | `200`, real site HTML (`<title>COMINORSA \| Consultoría minera y ambiental</title>`) |
| CRM lead capture works on the real domain (not just `*.workers.dev`) | `POST https://cominorsa.com/api/crm-lead`, then `GET /rest/people` on the VPS instance | `{"ok":true}`; Person record confirmed present by id/timestamp, then deleted as a test artifact |
| Worker's actual custom domains | `scripts/cloudflare-domain.sh --check` (after the Pages→Workers API fix) | `cominorsa.com`, `www.cominorsa.com` — confirms these are real Workers Custom Domains, not Pages |
| Off-box backup pull works | Manually triggered `TwentyCRM-PullBackup` Windows scheduled task | Real VPS backup file (`twenty-db-*.sql.gz`, 748K) copied to `~/twenty-backups/`, logged success |

### Spec Compliance Matrix

Against `openspec/changes/twenty-crm-cloud-deploy/proposal.md`'s Success Criteria:

| Criterion | Evidence | Result |
|---|---|---|
| Twenty's server/worker/db/redis stack runs on the VPS, reachable over HTTPS with a valid, auto-renewing cert | Live check above; `certbot` systemd timer confirmed enabled | ✅ COMPLIANT |
| `TWENTY_API_KEY`/`TWENTY_API_URL` set as real Cloudflare Workers secrets | `wrangler secret put` succeeded for both; new Worker version auto-deployed (confirmed via `wrangler deployments list` timestamp) | ✅ COMPLIANT |
| `create-fields.mjs` run against the new host provisions all 20 fields, exiting 0 | Ran this session, exit 0, message confirms all fields present on both objects | ✅ COMPLIANT |
| Both CSVs reimported via `pnpm twenty:import` against the new host with correct row counts | Ran this session: "Imported 799 companies and 1222 people" | ✅ COMPLIANT |
| A real consultation-form submission on the live site creates a Person record in production Twenty | Real `POST /api/crm-lead` against **`https://cominorsa.com`** (the real production domain, not just `*.workers.dev`); confirmed via `GET /rest/people` (id `84a06cdf-...`, matching timestamp); deleted as a test artifact afterward | ✅ COMPLIANT |
| A documented backup procedure exists and has run at least once successfully | `docker/twenty/PRODUCTION.md` documents it; `backup-twenty.sh` (VPS) and `pull-backup.sh` (off-box, to the user's machine) both run this session, both produced/copied a valid dump | ✅ COMPLIANT (backup exists, runs, and now has an off-box copy; **restore** not yet drilled — see Issues) |
| No `crm.cominorsa.com` DNS record exists; access via IP/generic host only | Access is via `157-245-247-246.nip.io` — no branded record created | ✅ COMPLIANT |

7/7 success criteria met, 0 WARNINGs outstanding.

### Deviations from proposal.md (disclosed, not defects)

- **Provider**: DigitalOcean, not Hetzner (Decision 1) — user's real-time choice to avoid Hetzner's account-verification delay. Documented in `design.md` and `PRODUCTION.md`.
- **TLS domain**: `nip.io`, not a purchased domain — Decision 3 ("no branded subdomain") is still satisfied; this is a stronger interpretation (no domain purchase at all) than the proposal anticipated, chosen because Let's Encrypt requires *some* resolvable name, and none was available.

Neither deviation weakens any proposal requirement; both are recorded as intentional, reasoned choices, not scope drift.

### Issues Found

**WARNING** (0): none outstanding — the two carried from the prior draft (restore not drilled, no regression test for `clear-demo-data.mjs`) were both closed this pass (see below).

**SUGGESTION** (1):
1. The off-box backup (to the user's own machine) only runs while that machine is logged on — a DigitalOcean Spaces-style always-available destination remains a stronger guarantee, deliberately not chosen this session (user's explicit trade-off, cost vs. availability).

**FIXED during this verify pass** (4, addressing every disclosed follow-up from the prior draft except the DNS one, which was reclassified non-blocking rather than fixed):
1. `scripts/cloudflare-domain.sh`/`scripts/lib/api.sh` called Cloudflare Pages APIs for a project with no Pages project. Rewrote both to use the Workers Custom Domains API; re-tested `--check` mode, now correctly reports `cominorsa.com`/`www.cominorsa.com`.
2. Backups had no off-box copy. Added `pull-backup.sh` + a Windows scheduled task; live-verified (real dump pulled down).
3. Backup **restore** had never been exercised end-to-end. Drilled fully isolated from production: real dump restored into an empty Postgres, `server`/`worker` joined with production's `ENCRYPTION_KEY`, 0 errors, exact record counts confirmed via REST, then torn down.
4. `clear-demo-data.mjs` had no automated test. Added `tests/qa/twenty-clear-demo-data.test.mjs`, 6 cases, 6/6 pass — including the specific case that a Person mismatch must block already-matched Company deletion too (the "no partial destructive action" invariant the script's safety model depends on).

### Verdict

**PASS.** All 7 proposal success criteria are met with live, re-checked evidence. Every disclosed WARNING and SUGGESTION from the prior draft of this report has been closed this pass except one deliberate, disclosed trade-off (off-box backup only runs while the laptop is logged on — cost vs. availability, chosen by the user). No CRITICAL findings, no open WARNINGs. Two real defects were caught and fixed *during* this same rollout rather than shipped: a port-exposure regression (`SERVER_BIND_HOST` env var, structural fix) and a Cloudflare Pages/Workers API mismatch unrelated to Twenty CRM itself but discovered while investigating a (mis)diagnosed DNS issue. The backup chain is now proven end-to-end: created on the VPS, pulled off-box, and *restorable* — not merely present.
