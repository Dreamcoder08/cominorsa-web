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
- Running committed authored line count: 0. Slice boundaries: none yet.
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
- [ ] **T2 — Add a bounded read-only Twenty adapter and CLI.** Use documented
  API contracts, injectable transport, timeouts, bounded results, secret-safe
  errors and a read-only tool allowlist. Route: delegated; non-trivial code/tests.
  Checks: observed mocked RED/GREEN, network-denial/write-denial tests, timeout,
  pagination/limit tests and applicable existing regression checks. Commit: pending.
- [ ] **T3 — Expose the same tools through MCP for Codex.** Use supported MCP
  protocol/SDK rather than an ad hoc wire implementation; document local setup
  without modifying the user's global config. Route: delegated; transport/tests.
  Checks: real local protocol handshake and tool invocation against fixtures,
  no credentials or live CRM access, no sensitive logging. Commit: pending.
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

T1 documentation verified; no CRM-agent product implementation exists yet.
Next: T2 fixture-tested read-only adapter and CLI. Remote repository extraction
and deployment remain deferred.

Engram mirror topic: `odd/crm-agent-foundation/tasks`.
