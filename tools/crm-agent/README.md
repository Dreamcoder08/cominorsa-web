# CRM agent read tools

Standalone local TypeScript package for bounded Twenty CRM reads. It is not part of the public website runtime and does not modify Twenty or send messages. The four allowlisted tools are `list_people`, `get_person`, `list_companies`, and `get_company`. CLI and MCP stdio transport share the same `createToolRegistry`, configuration gate, and `createTwentyReadPort`.

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

The adapter only sends `GET` to the four fixed REST routes with `fields=id,name` and `depth=0`. It rejects redirects, oversized or malformed responses, more than two concurrent reads per server session, unsupported inputs, and unsafe configuration. Error output is categorical and does not include response bodies or credential-bearing URLs. Tests use injected fetch fixtures and do not access a CRM.

## MCP stdio transport

The MCP server is implemented with the official split TypeScript SDK (`@modelcontextprotocol/server` 2.3.1) and Zod 4.6.6. Start it directly with Node from the repository root when configuring an MCP client:

```sh
node tools/crm-agent/src/mcp.ts
```

Do **not** launch it through a package-manager script in an MCP client: pnpm may print script banners to stdout, which would corrupt the stdio protocol. The package's `pnpm --dir tools/crm-agent --ignore-workspace mcp` script is for direct terminal use only. The server sends protocol messages on stdout and does not log CRM records. It can initialize and list the four tools without a CRM URL or API key. A tool call requires the same three `COMINORSA_CRM_*` environment variables as the CLI and fails closed when network access is not explicitly enabled. Configure those variables only for a CRM instance you are authorized to access; this repository does not alter global Codex configuration or provide credentials.

The four MCP tools expose the same input and output contracts as the CLI. They are annotated read-only, non-destructive, and idempotent, but these annotations are descriptive only; the local registry and Twenty adapter enforce the policy. MCP errors contain a safe category and message, not upstream response bodies or secret-bearing URLs. The real stdio handshake and fixture-backed calls run in the package test suite without live CRM access.
