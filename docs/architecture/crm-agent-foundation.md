# CRM agent foundation

Status: design for the local foundation; the CLI, MCP server, and read adapter
shown below are **planned**, not deployed or presently usable. The existing
Twenty CRM and website lead-capture flow remain operationally separate.

The [interactive architecture diagram](crm-agent-foundation.html) is generated
from [its Archify specification](crm-agent-foundation.architecture.json). The
solid upper path and dashed lower path distinguish current repository behavior
from planned components; the cards state this boundary explicitly.
No production deployment topology or unattended agent is claimed.

## Verified starting point

| Boundary | Current evidence | Consequence |
| --- | --- | --- |
| Public website | `src/worker/index.ts:9-26,39-59` routes `/api/*` through a Cloudflare Worker and serves other paths as static assets. | Do not import a CRM agent runtime into the Worker or add its dependencies to the landing bundle. |
| Lead intake | `app/api/crm-lead/route.ts:91-115` validates a same-origin POST, then independently attempts a Twenty Person creation and notification email. `:263-269` gates the Twenty call on environment variables. | Preserve this existing write path; it is **not** the agent interface. Its fail-open form behavior is inappropriate for an agent read API. |
| CRM record system | `docker/twenty/README.md:1-7,82-99` describes the local Twenty stack and API-key setup. `package.json:35-41` lists the existing Twenty operational scripts. | Twenty remains the source of record. No migration, duplicate datastore, or live access is implied. |
| Import data | `docker/twenty/README.md:9-35` records that import CSVs are tracked in a public repository and may include compiled leads or consultation data. | Repository extraction must not be mistaken for retroactive data removal; never copy CSVs into a new agent package by default. |
| Build/runtime | `package.json:11-21,43-53` uses Bun for site build/tests, pnpm for package management, and has only dev dependencies. | Put the future agent in an independently installable local `tools/crm-agent` package, not in the website's production dependency graph. |

These file references describe checked-in behavior, not a fresh verification of
the deployed service, CRM contents, email delivery, or credentials. This design
does not require access to any of them.

## Boundary and ownership decision

Keep one Git repository for now, but establish a separate **package and process
boundary** at `tools/crm-agent`. The package should own its dependency manifest,
tests, configuration schema, CLI entry point, and MCP stdio server. It should
not be imported by `src/worker`, `src/build`, `app/api`, or `docker/twenty`
scripts. The existing Twenty deployment, database, lead route, imports, and
operational scripts remain in place.

The planned package uses ports and adapters:

1. A narrow application layer exposes named, allowlisted **read-only** CRM use
   cases and defines input/output contracts. Neither CLI nor MCP embeds
   business logic or raw HTTP access.
2. A Twenty adapter implements the read port with injected HTTP transport,
   endpoint allowlisting, timeouts, bounded pagination/results, and bounded
   concurrency. It returns normalized records with stable identifiers and
   explicit source/provenance; it never guesses an absent field.
3. A JSON CLI and a local MCP stdio transport invoke the same registry and
   policy. MCP should use the official SDK/protocol, not a custom wire format.
   The transport translates protocol errors; it does not grant capabilities.
4. Configuration supplies a CRM URL and API credential at runtime, never via
   committed examples or the generated diagram. No ambient credential search
   or production connection is part of repository development.

The allowlist is the authority boundary. Adding a new tool requires reviewed
source, a documented contract, focused tests, and explicit operational scope.
There is no dynamic remote-code loader, plugin marketplace, or agent-driven
self-modification path. A tool's readable description is **not** an
authorization mechanism; inputs, configured endpoint, and HTTP method must be
enforced below the model. The adapter must reject mutations and arbitrary
network targets even if a client tries to supply them.

This package boundary trades a small amount of local duplication (its own
manifest and checks) for testability and a clean runtime boundary. A separate
Git repository today would add release coordination while the interface and
ownership are still changing, without reducing the already-public CSV exposure.
Keeping everything in the website's root runtime would be simpler to install
but would couple private CRM tooling to a public site deployment. The package
boundary is the safer intermediate step.

## Read contract and truthfulness

Initial tools should answer bounded questions about existing records, not
create records, send messages, or execute CRM administration. A result should
include its source system, record ID, observed field values, and a retrieval
timestamp where useful. Empty, null, or inaccessible fields remain unknown;
they must not become inferred facts. The UI/client may summarize results, but
model-selected evidence is not independent verification. A tool response is a
CRM observation, not proof that a third party or the world outside Twenty
agrees with it.

Use least privilege where Twenty supports it, and enforce read-only policy in
the local application regardless of credential breadth. An API key capable of
writes does not make writes acceptable. Bound request time and result count;
avoid unbounded traversal. Normalize remote errors to safe categories and
redact bearer tokens, URLs with secrets, response bodies, and personal data
from logs. Do not record fetched records in test snapshots or telemetry.
Tests should use fixtures and an injected fake HTTP client, not live CRM data.

The current public lead route remains intentionally outside this policy. It
already writes a Person record for a submitted form and has different failure
semantics (`app/api/crm-lead/route.ts:91-115`). Reusing it or calling its POST
from an agent would bypass the intended read-only boundary.

## Maturity stages

| Stage | Scope | Human/operational boundary |
| --- | --- | --- |
| 0 — current | Website lead capture, Twenty operations and imports. | Existing behavior; not an agent platform. |
| 1 — this foundation | Local package, fixture-tested Twenty reads, shared JSON CLI/MCP tool registry, reproducible setup. | Operator explicitly configures a target CRM. No write or outreach capability. |
| 2 — future proposal | Source-linked evidence collection and draft recommendations with confidence/unknowns. | Human reviews evidence; no automatic CRM mutation. Requires separate design and acceptance. |
| 3 — future controlled action | Narrow write capabilities, approval records, idempotency keys, audit trail and recovery. | Explicit user authorization for each capability and target; no blanket approval from an agent prompt. |
| 4 — future unattended workflows | Durable ingestion/scheduling, retries, observability, escalation, and incident/rollback controls. | Only after operating evidence and separate authorization. A local tool-access foundation is **not** an unattended agent. |

The user's ambition for an AI-first CRM is a product direction, not a current
capability claim. Agent access without independently testable facts, explicit
authority, and operational recovery merely automates uncertainty.

## Repository extraction decision

**Defer a separate CRM Git repository.** Reassess after all of these hold:

- The `tools/crm-agent` contracts and fixture tests can run without website
  source imports, Cloudflare build steps, or untracked local CRM state.
- Dependency, version, release, and migration lifecycles can be owned and
  documented independently, including a compatibility policy for Twenty API
  changes and a rollback path.
- Ownership and secret/data boundaries are documented; any data relocation has
  an explicit classification, access policy, and history-aware migration plan.
- Local CLI/MCP consumers can install a versioned artifact and exercise a
  reproducible, credential-free fixture path before any live configuration.

If those gates are met, extraction can make independent releases and access
controls easier. Until then, the monorepo package keeps reviews atomic and
avoids a second repository becoming an excuse to move sensitive data. Moving
tracked CSVs later does not erase their existing Git history
(`docker/twenty/README.md:9-35`).

## Extension and verification rule

Extend by a reviewed capability, not by a self-editing agent. Each proposed
tool needs a named use case, schema, maximum cost/result size, data-handling
rule, denial tests, and a decision on whether it is strictly read-only. Any
write-like capability is out of this foundation's scope. It must specify
approval, audit, idempotency, conflict handling, and rollback before code or
operational use. A new UI is unnecessary in this phase; the landing's token
system and styles remain unchanged.

For this passive design document there is no meaningful runnable RED. The
Archify specification is validated and delivered separately from any future
application test suite. Subsequent implementation tasks require observed
fixture-based failures before code changes where deterministic tests apply.
