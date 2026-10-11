# CRM agent read tools

Standalone local TypeScript package for bounded Twenty CRM reads. It is not part of the public website runtime and does not modify Twenty or send messages. The four allowlisted tools are `list_people`, `get_person`, `list_companies`, and `get_company`. CLI and the future MCP transport share `createToolRegistry` and `createTwentyReadPort`.

## Setup and offline discovery

Requires Node.js 22.18+ and pnpm 11.25.0. From the repository root:

```sh
pnpm --dir tools/crm-agent --ignore-workspace install --frozen-lockfile
pnpm --dir tools/crm-agent --ignore-workspace test
pnpm --dir tools/crm-agent --ignore-workspace typecheck
pnpm --dir tools/crm-agent --ignore-workspace cli list-tools
```

`--ignore-workspace` ensures this package uses its own manifest and lockfile rather than the site's workspace. `list-tools` and `--help` require no CRM URL, credentials, or network permission.

## Explicit local invocation

Only if you are authorized to access the selected Twenty instance, supply its URL and API key in the process environment. Do not commit them, pass them as CLI arguments, or point this package at an instance merely because ambient credentials exist.

```sh
COMINORSA_CRM_ALLOW_NETWORK=1 \
COMINORSA_CRM_URL=https://crm.example.invalid \
COMINORSA_CRM_API_KEY='<operator-provided-key>' \
pnpm --dir tools/crm-agent --ignore-workspace cli call list_people '{"limit":10}'
```

`call` requires all three environment variables. Only HTTPS origins and explicit loopback HTTP origins are accepted; URL credentials, path, query, and fragment are rejected. The package never loads a dotenv file or searches other CRM credentials. No live call is needed for installation or tests.

`get_person` and `get_company` require `{"id":"<uuid>"}`. Lists accept an optional `limit` (1–25, default 10) and `cursor` (up to 256 printable characters). To request another page, pass the prior result's `nextCursor` explicitly; the tool never automatically traverses pages. Results contain only record id/name, `source: "twenty"`, and `retrievedAt`. Null names mean unknown, not inferred facts. Twenty observations do not independently verify third-party claims.

The adapter only sends `GET` to the four fixed REST routes with `fields=id,name` and `depth=0`. It rejects redirects, oversized or malformed responses, excess concurrency, unsupported inputs, and unsafe configuration. Error output is categorical and does not include response bodies or credential-bearing URLs. Tests use injected fetch fixtures and do not access a CRM.
