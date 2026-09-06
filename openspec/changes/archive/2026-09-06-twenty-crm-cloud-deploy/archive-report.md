# Archive Report: twenty-crm-cloud-deploy

**Date Archived**: 2026-09-06
**Change Name**: twenty-crm-cloud-deploy
**Status**: COMPLETE, PASS, 0 open WARNINGs

## Executive Summary

Twenty CRM (`twenty-crm-local-setup`, change 1) is now running on a production DigitalOcean VPS, hardened, backed up (with an off-box copy and a drilled restore), and wired end-to-end to the live site's lead-capture route (`website-crm-lead-capture`, change 2). All 7 proposal success criteria are met with live, re-checked evidence. 33/38 tasks complete; the 5 remaining are explicitly disclosed, non-blocking follow-ups (registrar-side DNS for an optional secondary domain, and monitoring/alerting — out of this change's original scope).

Two real defects were found and fixed during this rollout rather than shipped: a port-exposure regression (server briefly reachable from the public internet after a routine config copy, fixed structurally with a `SERVER_BIND_HOST` env var) and a Cloudflare Pages/Workers API mismatch in `scripts/cloudflare-domain.sh` (unrelated to Twenty CRM, discovered while investigating a domain question that turned out to be a misdiagnosis — the real production domain, `cominorsa.com`, was already live all along).

## Verification Report Summary

**Verification Status**: PASS ✅
- **Blockers**: 0
- **CRITICAL Findings**: 0
- **Requirements**: 6/6
- **Scenarios**: 12/12
- **Tests**: 158/158 (152 pre-existing + 6 new for `clear-demo-data.mjs`)
- **Build**: ✅ Passed
- **Open WARNINGs**: 0

Full detail in `verify-report.md` (moved into this archive folder below).

## Task Completion Status

**Total tasks**: 38 (excluding the forecast table)
**Complete**: 33
**Incomplete (disclosed, non-blocking)**: 5

- `cominorsa.com.pe` DNS delegation — confirmed non-blocking (optional secondary domain; `cominorsa.com` is the real, already-live production domain).
- Monitoring/alerting for VPS/container downtime — never in this change's original scope.
- (3 further sub-items already resolved during this session's follow-up work: off-box backups, the restore drill, and the `clear-demo-data.mjs` unit test — all now `[x]` in `tasks.md`.)

## Specs Synchronization

**None** — this change has no `specs/` delta directory. It is pure infrastructure/deployment work (a VPS, hardening, backups, tooling fixes); it does not add or modify any behavioral requirement already captured by `openspec/specs/website-lead-capture/spec.md` or `openspec/specs/twenty-field-provisioning/spec.md` (both owned by earlier changes). No main-spec merge is needed.

## Archive Contents

**Location**: `openspec/changes/archive/2026-09-06-twenty-crm-cloud-deploy/`

| Artifact | Status | Details |
|---|---|---|
| proposal.md | ✅ Present | Provider decision, scope, success criteria |
| exploration.md | ✅ Present | Prior research (hosting options, Twenty's official docs) |
| design.md | ✅ Present | Architecture decisions (including two live-session corrections), data flow, file changes, testing strategy, threat matrix |
| tasks.md | ✅ Present | 38 tasks, 33 complete, 5 disclosed non-blocking follow-ups |
| verify-report.md | ✅ Present | PASS, 0 CRITICAL, 6/6 requirements, 12/12 scenarios, 158/158 tests |

## Final-State Authority

1. **tasks.md**: 33/38 complete, 5 correctly left unchecked (disclosed, non-blocking).
2. **verify-report.md**: PASS, 0 CRITICAL, 0 open WARNINGs, live-re-checked infrastructure evidence (not merely quoted from earlier in the session).
3. All sources agree: no contradictions.

## Issues and Deviations

**CRITICAL**: None.

**Deviations from proposal.md** (disclosed in `design.md`, not defects):
- Provider: DigitalOcean, not Hetzner (Decision 1) — user's real-time choice to avoid Hetzner's account-verification delay.
- TLS domain for the Twenty CRM instance itself: `nip.io`, not a purchased domain — still satisfies Decision 3 ("no branded subdomain").
- Off-box backup destination: the user's own machine (free, logged-on-only), not DigitalOcean Spaces (~$5/mo, always-on) — asked directly, user chose free.

**Corrected mid-session** (recorded transparently in `design.md`/`verify-report.md` rather than silently edited): an earlier draft of this change's own documents misdiagnosed `cominorsa.com.pe`'s missing DNS as blocking site/CRM access. It does not — `cominorsa.com` is the real production domain and was already live throughout.

## Known Follow-Ups

1. **`cominorsa.com.pe` DNS delegation** (registrar-side, likely NIC.pe) — optional secondary/redirect domain, not required for anything currently live. No agent action possible; needs the domain owner's registrar login.
2. **Monitoring/alerting** for the VPS or its containers going down — was never in this change's scope; would be a new change if the user wants it.

## SDD Cycle Complete

✅ Exploration — ✅ Proposal — ✅ Design — ✅ Tasks — ✅ Apply (live infrastructure work, this session) — ✅ Verify (PASS, re-checked) — ✅ Archive

**Readiness for next change**: Yes. The production CRM deployment is live, hardened, backed up, restore-tested, and fully documented (`docker/twenty/PRODUCTION.md`). The only remaining follow-up (`.com.pe` DNS) requires the domain owner, not an agent.
