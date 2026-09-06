---
name: vps-deploy
description: "Trigger: VPS, DigitalOcean droplet, production Twenty CRM, SSH deploy, docker-compose.yml update, SERVER_BIND_HOST, wrangler secret put. Deploy and harden the production VPS without reverting existing security fixes."
license: Apache-2.0
metadata:
  author: "cominorsa-web"
  version: "1.0"
---

## Activation Contract

Load when updating the production VPS (157.245.247.246) running Twenty CRM, changing `docker/twenty/docker-compose.yml` for production, touching SSH/firewall/backup config there, or setting Cloudflare Workers secrets for `cominorsa-web`.

## Hard Rules

- SSH as `deploy@157.245.247.246`, never `root@` — root login is disabled by design. `deploy` has passwordless sudo and is in the `docker` group.
- Never hand-edit `docker-compose.yml` or `.env` directly on the VPS with `sed`/inline edits. Edit the repo copy, `scp` it up, and let `SERVER_BIND_HOST` (from `.env`) parameterize the difference — a raw `sed` on the host is silently lost the next time the file is re-copied, and has already caused one real regression (port 3000 briefly exposed to the internet).
- Production's `docker/twenty/.env` on the VPS MUST contain `SERVER_BIND_HOST=127.0.0.1`. After any `docker compose up -d` there, verify externally that port 3000 refuses connections and that the Nginx HTTPS URL still serves `/healthz` with 200 — both, every time, not just one.
- Do not disable/skip: `ufw` (22/80/443 only), `fail2ban` (sshd jail), `unattended-upgrades`, or the daily backup cron (`0 3 * * * /opt/twenty/backup-twenty.sh`). If a task seems to require touching one of these, stop and confirm with the user first.
- `wrangler secret put` auto-deploys a new Worker version — no separate `wrangler deploy` needed for a secret change to take effect.

## Execution Steps

1. Edit `docker/twenty/docker-compose.yml` (or `.env.example`) in the repo, never on the host.
2. `scp` the changed file(s) to `deploy@157.245.247.246:/opt/twenty/`.
3. `ssh deploy@157.245.247.246 "cd /opt/twenty && docker compose --env-file .env up -d"`.
4. Verify: `curl -o /dev/null -w '%{http_code}' http://157.245.247.246:3000/healthz` must NOT return 200; `curl .../healthz` on the public HTTPS URL must return 200.
5. Secrets: `pnpm exec wrangler secret put <NAME> --name cominorsa-web`, value piped via stdin, never as a CLI arg (shell history).

## Output Contract

Report both post-deploy checks (port closed + HTTPS working) explicitly, not just "deployed."

## References

- `docker/twenty/PRODUCTION.md` — architecture diagram, full hardening list, backup/restore, known issues.
