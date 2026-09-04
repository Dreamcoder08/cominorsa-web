---
name: cominorsa-deploy
description: "Trigger: deploy, publish, cf:deploy, wrangler, cloudflare, ir a producción, publicar cambios on cominorsa-web. Deploy this app to Cloudflare Workers and diagnose credential/config blockers."
license: Apache-2.0
metadata:
  author: "dreamcoder08"
  version: "1.0"
---

## Activation Contract

Use whenever asked to publish/deploy this site, or when a user references what's "live" and it's unclear whether local changes have actually shipped.

## Hard Rules

- Deploy target is **Cloudflare Workers**, not Pages — `scripts/cloudflare-deploy.sh` runs `wrangler deploy --config dist/server/wrangler.json --name cominorsa-web` from the project root. Running it from inside `dist/server/` makes wrangler also pick up a stale `.wrangler/deploy/config.json` and fail with a duplicate-config error.
- `pnpm cf:deploy` pushes straight to the live production Worker — no staging step, no PR gate. Confirm with the user before running it (see the global risky-action rule), even if they already asked for "the fixes" in general terms.
- `.github/workflows/ci.yml` only builds/tests on push — it never deploys. A green CI run and a merged PR do **not** mean the site is live; only a successful `cf:deploy` does.
- Never guess or fabricate `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`. If missing, say so plainly and stop — don't attempt a deploy that will fail, and don't paper over it by saying "the fix is complete."
- Never ask the user to paste the raw token/account ID into the chat. Point them to `.env` (Option B below) instead — they edit it themselves outside the conversation, then just confirm "listo"; verify presence with `scripts/lib/check-env.sh`, which reports missing/present without echoing values.
- Before telling the user to create a brand-new API token, have them check https://dash.cloudflare.com/profile/api-tokens for one that already fits (this account has had a token literally named `cominorsa-web-deploy`, scoped to `Account.Workers Scripts` + `Zone.SSL and Certificates` on the right account/zone — a prior session's deploy setup). If they don't have that token's value saved anywhere, the `•••` menu on its row has **Roll** — regenerates the secret under the same name/scope instead of accumulating another overlapping token. Don't suggest reusing `wrangler-pages-cominorsa` (scoped to *All accounts, All zones* — broader than this deploy needs).

## Execution Steps

1. Commit + push the changes first (`git add`, `git commit`, `git push origin main`) — deploy builds from local disk regardless of git state, but keeping history in sync is expected as part of "ship this."
2. Check credentials before attempting deploy: `[ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]` (also checks `.env` via `scripts/lib/check-env.sh`, which `pnpm cf:deploy` sources automatically).
3. If credentials are present: `pnpm cf:deploy`.
4. If missing: tell the user exactly what's missing. Give them the `.env` path (they fill it in themselves — see the "never ask them to paste it" rule above) as the primary option, or they run `! pnpm cf:deploy` themselves (their own terminal may have the vars, or can complete an interactive `wrangler login` this sandbox can't).
5. Other scripts available if relevant: `cf:rollback`, `cf:status`, `cf:watch`, `cf:bootstrap`, `cf:smoke`, `cf:domain` — check `package.json` scripts before assuming one exists.

## Output Contract

State explicitly whether the deploy actually ran and succeeded, or only got as far as commit/push. Never let "I committed the fix" read as "it's live."
