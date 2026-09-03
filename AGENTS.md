# AGENTS.md

Project-specific skills for AI coding agents working on this repo. Each
`SKILL.md` is the source of truth — this file only points to them.

## Skills (`.claude/skills/`)

- **cominorsa-run** — launch the dev server and verify a frontend change
  with a real screenshot before calling it done. Also has a WCAG contrast
  calculator (`assets/contrast-check.mjs`) — use it instead of eyeballing
  or trusting a pasted claim about contrast.
- **cominorsa-deploy** — this app deploys to Cloudflare Workers (not
  Pages) via `pnpm cf:deploy`, and CI never deploys on its own. Needs
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` — never fabricate these.
- **cominorsa-design-tokens** — every color/spacing/radius value used in
  `app/globals.css` comes from the token system in `:root`. No magic
  values, no off-palette colors, `border-radius: 0` everywhere except one
  documented exception.

## Stack notes

- Next.js 16 (App Router) + Cloudflare Workers via `vinext`/`wrangler`,
  not Vercel.
- Styling is hand-written CSS in `app/globals.css` (Tailwind v4 is
  imported but barely used — most of the UI predates it and isn't a
  utility-class rewrite target without being asked).
- `pnpm test` runs `next build` + the Node test files under `tests/qa/`.
- Pre-commit hook runs `pnpm validate` (`scripts/validate-env.mjs`) —
  expect it on every `git commit`.
