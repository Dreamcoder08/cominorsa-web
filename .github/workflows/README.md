# CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push and PR
to `main`.

## Pipeline

```
checkout → setup pnpm 11.22.0 → setup Node 22.13.0 → cache pnpm store
       → pnpm install --frozen-lockfile
       → pnpm run validate
       → pnpm audit --audit-level=high
       → pnpm run build
       → node --test (rendered-html + QA suites)
       → pnpm run lint
```

## Why this order

- **install --frozen-lockfile** is the first gate. If the lockfile is out of
  sync with `package.json` (someone bumped a dep but didn't regen), it fails
  here before any code runs.
- **validate** is fast (no build, no install) and catches structural issues
  early: missing required files, oversized `og.png`, CSP missing, etc.
- **audit** blocks on `high` or `critical` vulnerabilities. The project is
  currently at 0 vulns.
- **build** + **test** is the canonical `pnpm test` split so the build
  artifact and test report are inspectable separately in the Actions UI.
- **lint** runs last; this project has a single ESLint config, so failures
  are usually a flag for review, not a blocker.

## Caching

`actions/setup-node` with `cache: pnpm` caches the pnpm content-addressable
store (`~/.local/share/pnpm/store/v3`). First run downloads the store;
subsequent runs use the cache.

## Concurrency

In-flight runs for the same branch cancel each other on rapid pushes. This
prevents queue buildup for active branches.

## Triggers

- `push` to `main` (every commit)
- `pull_request` to `main` (every PR, including from forks)

Pushes to feature branches do not run CI — push to `main` or open a PR to
trigger.

## Adding secrets

If you later add a Wrangler secret for deployment, configure it via
`Settings → Secrets and variables → Actions` in the GitHub repo. Do NOT
commit secrets to the workflow file.
