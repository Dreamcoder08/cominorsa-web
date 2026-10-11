# CRM Agent Foundation

## Objective

Make COMINORSA's existing Twenty CRM usable by Codex and other agents through a
bounded, independently testable interface without changing the public landing
runtime or inventing customer facts.

## Problem and rationale

The landing currently captures leads but has no agent-facing CRM read interface.
Twenty stores the CRM records; its operations and imports are maintained here.
An agent foundation must establish permissions, provenance, and reliable tools
before adding unattended customer-facing actions.

## Authorized scope and constraints

- Local architecture, implementation, tests, documentation, skills and scripts
  are authorized by the user's 2026-10-11 autonomous implementation request.
- Preserve Twenty, existing data/imports, Cloudflare delivery and public APIs.
- Preserve the pre-existing untracked `logs/` directory; never stage its contents.
- Do not access live CRM instances, read credentials, publish repositories, push,
  deploy, send customer messages or migrate production data without explicit
  destination, operation and credential/session authorization.
- Generated artifacts use English; existing Spanish UI copy is not changed.
- Keep CRM-agent tooling outside the landing's production runtime/dependencies.
- Start read-only. Any future writes require explicit capabilities, approval,
  an audit trail and idempotency; empty fields never reduce evidence requirements.
- Model-selected evidence is not independent source verification.
- Promote stable repeated workflows to skills/scripts; do not introduce a
  dynamically loaded arbitrary-code plugin system.

## Architecture direction

Use a ports-and-adapters boundary around Twenty, with a narrow allowlisted tool
registry shared by CLI and MCP transports. Maintain separate execution and
deployment boundaries now. Reassess a separate CRM Git repository after its
interface, tests and release lifecycle are independently usable; do not move
imports or sensitive CSVs just to create a second repository.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: approximately 1,500 authored added/deleted lines; generated Archify
  HTML excluded. This is an estimate, not a size cap or permission to omit tests.
- Chain strategy: `feature-branch-chain`, the recommended local branch strategy
  confirmed by the user's autonomous continuation on 2026-10-11. Publishing
  tracker/child PRs is not authorized by local implementation permission.
- Branch point: `f5c2cc0`; working branch: `feat/crm-agent-foundation`.
- Running committed authored line count: 964 (T1 274 + T2 690; generated HTML,
  receipts, screenshots and dependency lockfiles excluded).
- Slice 1 / T1: `f5c2cc0..88cf2a5`, local documentation boundary; no PR published.
- Slice 2 / T2: `88cf2a5..494f7be`, adapter/CLI boundary. Future PR slicing or
  explicit size exception remains necessary; no oversized PR was published.
- RDD: clone-local OFF, observed via `gentle-ai review mode status`; do not enable.
  Delivery is disabled/unmanaged. Ordinary functional checks still apply.

## Tasks

- [x] **T1 — Document the system boundary and staged migration.** Produce an
  evidence-backed architecture document and Archify JSON/HTML distinguishing
  current components from planned ones. Route: delegated; multi-file authoring.
  Checks: structural readback, Archify showcase validation/delivery, browser
  evidence and honest perceptual-review status. No meaningful runnable RED for
  passive architecture documentation. Outcome: architecture Markdown + Archify
  specification/HTML and hash-bound browser evidence delivered. Writer and
  independent verifier observed 9/9 showcase checks, zero errors/warnings,
  desktop containment at four sizes. Screenshots inspected; browser receipt's
  formal perceptual-review field remains pending. Parent reran validation and
  structural readback. Native assessment was unassessable due untracked files,
  treated as high: independent verification completed, RDD disabled/unmanaged.
  Commit: recorded in the work-unit evidence below after creation.
- [x] **T2 — Add a bounded read-only Twenty adapter and CLI.** Use documented
  API contracts, injectable transport, timeouts, bounded results, secret-safe
  errors and a read-only tool allowlist. Route: delegated; non-trivial code/tests.
  Checks: observed mocked RED/GREEN, network-denial/write-denial tests, timeout,
  pagination/limit tests and applicable existing regression checks. Outcome:
  four read-only id/name tools, isolated TypeScript package and JSON CLI. RED
  observed for missing registry and official root pagination; corrected a
  fixture-masked envelope bug and added response-stream cancellation on timeout.
  Writer, independent verifier and parent spot check: 24/24 package tests pass;
  writer/verifier strict typecheck and credential-free list-tools smoke pass.
  Root manifest/lock unchanged. Native risk high (process boundary); RDD OFF,
  independent check completed, disabled/unmanaged. Landing regression deferred
  to T4; no live CRM access. This coherent adapter/CLI/test unit exceeds the
  400-line heuristic; no tests or documentation were removed to shrink it.
  Commit: recorded in work-unit evidence after creation.
- [x] **T3 — Expose the same tools through MCP for Codex.** Use supported MCP
  protocol/SDK rather than an ad hoc wire implementation; document local setup
  without modifying the user's global config. Route: delegated; transport/tests.
  Checks: real local protocol handshake and tool invocation against fixtures,
  no credentials or live CRM access, no sensitive logging. Outcome: official
  MCP v2 server/client 2.3.1, strict schemas, shared CLI/MCP configuration and
  lazily cached registry/adapter. Linked-client and real stdio RED/GREEN observed;
  independent check reproduced then verified fix of per-call concurrency reset.
  Writer, verifier and parent spot check: 36/36 package tests; strict typecheck
  passes. Discovery requires no credentials; production calls deny network by
  default. Root manifest/lock unchanged. Native high process-boundary risk;
  independent verification complete, RDD disabled/unmanaged. Commit recorded
  below after creation; no live CRM operation or global Codex config edit.
- [ ] **T4 — Document and automate agent operation and extension.** Add a
  project skill for recurring tasks, reproducible checks and an explicit
  extension contract. Distinguish implemented capabilities from future evidence
  proposals, approval-controlled writes and durable ingestion. Route: delegated;
  multi-file workflow/docs. Checks: examples against fixtures, script exits,
  clean install/dependency isolation and applicable full checks. Commit: pending.

## Acceptance criteria

- Codex can list and invoke tested read-only CRM tools through a local MCP server.
- CLI and MCP share policy and domain behavior, not duplicated business logic.
- No automatic CRM mutation, external messaging or production access occurs.
- Landing dependencies/runtime and existing Twenty operations remain intact.
- Architecture, setup, limitations and recovery are reproducibly documented.
- All failed, unavailable, skipped or pending checks are explicitly recorded.

## Progress and next step

T1–T3 verified locally. Next: T4 Codex skill/setup, reproducible automation,
root check isolation and applicable landing regression. Remote repository
extraction and deployment remain deferred.

Engram mirror topic: `odd/crm-agent-foundation/tasks`.

## Work-unit evidence

- T1: `88cf2a5` — `docs(crm): define agent foundation and runtime boundaries`.
  Pre-commit `pnpm validate`: required checks passed; warning about an existing
  real `.env` file, whose contents were not read or staged. Archify/browser
  evidence is scoped to the generated diagram, not the product runtime.
- T2: `494f7be` — `feat(crm): add bounded read-only Twenty tools and CLI`.
  24/24 tests, strict typecheck, credential-free CLI listing; independent
  verification corrected root pagination and confirmed stream cancellation.
  Pre-commit required checks passed with the same existing `.env` warning.
