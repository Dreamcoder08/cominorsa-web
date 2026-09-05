# Tasks: CRM Lead Import — Mining Concession Data to Twenty CRM

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~460 authored: script ~200, package.json +1, unit test ~140, integration test ~120. Generated CSVs (~4,044 lines, 2 files) excluded as generated artifacts |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Focused test | Runtime harness | Rollback |
|------|------|----|--------------|-----------------|----------|
| 1 | Core script: parser, escaper, derivation, pipeline, alias | PR 1 | `node --check scripts/generate-crm-import-csvs.mjs` | Manual `node scripts/generate-crm-import-csvs.mjs` vs real CSV | Revert script + package.json alias line |
| 2 | Unit tests | PR 2 | `node --test tests/qa/crm-import-unit.test.mjs` | N/A — pure functions, no I/O | Delete `tests/qa/crm-import-unit.test.mjs` |
| 3 | Integration tests | PR 3 | `node --test tests/qa/crm-import-integration.test.mjs` | Same command; spawns real script vs real CSV + temp fixture | Delete `tests/qa/crm-import-integration.test.mjs` |
| 4 | Generated CSVs + runbook sync | PR 4 | `pnpm crm:export` | `pnpm crm:export` produces the 2 deliverable CSVs | Delete both generated CSVs; revert runbook edit if any |

## Phase 1: Core Script

- [x] 1.1 `scripts/generate-crm-import-csvs.mjs`: export `parseCsvLine`, `csvField`, `deriveFields`; guard CLI execution via `main()`. Accept optional CLI arg for source path override (test-only; default `empresas-mineras-zona17S-icp.csv`).
- [x] 1.2 Implement `parseCsvLine(line)`: quote-aware, single-line RFC4180 parser.
- [x] 1.3 Implement `csvField(value)`: quotes + doubles embedded quotes iff comma/quote/newline present.
- [x] 1.4 Implement `DERIVATION_BY_PERFIL` + `deriveFields(perfilIcp)`; throws on unknown key.
- [x] 1.5 Validate source file exists and has ≥1 data row; exit 1 + named message, no output on failure.
- [x] 1.6 Validate header matches the 9-column expected set; exit 1 listing expected vs. actual on mismatch.
- [x] 1.7 Filter `EXCLUIDO_mediana_o_gran_mineria`; route by `tipo`; exit 1 naming row+value on unrecognized `tipo`.
- [x] 1.8 Map retained rows to output columns (blank ruc/email/phone/job-title present; `fuente_dato` constant; `deriveFields()`); write both CSVs via `csvField()`; all-or-nothing fail-closed (collect errors, exit 1, write nothing).
- [x] 1.9 Add `"crm:export": "node scripts/generate-crm-import-csvs.mjs"` to `package.json`.

## Phase 2: Unit Tests

- [x] 2.1 `tests/qa/crm-import-unit.test.mjs`: `parseCsvLine` on the 6 confirmed quoted-comma/quoted-quote source lines; assert exact field arrays.
- [x] 2.2 Same file: `deriveFields` table-driven for all 4 `perfil_icp` values + throws on unknown.
- [x] 2.3 Same file: `csvField` round-trip for comma, quote, semicolon values via `parseCsvLine`.

## Phase 3: Integration Tests

- [x] 3.1 `tests/qa/crm-import-integration.test.mjs`: spawn script vs real CSV; assert combined row count = 2,021 and every row has non-empty `servicio_potencial` + explicit booleans.
- [x] 3.2 Same file: idempotency — run twice, assert byte-identical output files.
- [x] 3.3 Same file: fail-closed — temp fixture with bad header (via 1.1's arg seam); assert exit 1, stderr message, no output files written.

## Phase 4: Deliverables & Docs

- [x] 4.1 Run `pnpm crm:export`; confirm `crm-import-companies.csv` + `crm-import-people.csv` row counts sum to 2,021.
- [x] 4.2 Cross-check `openspec/changes/crm-lead-import/runbook-twenty-data-model.md` against final CSV headers; edit only if mismatched.
