# Design: CRM Lead Import — Mining Concession Data to Twenty CRM

## Technical Approach

A single dependency-free Node ESM script (`scripts/generate-crm-import-csvs.mjs`)
reads `empresas-mineras-zona17S-icp.csv`, filters/splits rows, derives
service-fit fields via a lookup table keyed by `perfil_icp`, and writes two
output CSVs. No framework, no DB, no network I/O — this is a one-shot batch
transform, so the design stays flat: three small functions (parse line,
derive fields, write CSV), no classes, no plugin surface. Confirmed by direct
inspection: the source file contains RFC4180-quoted fields with embedded
commas and doubled-quote escaping (e.g. line 18 `"SOUTHERN PERU COPPER
CORPORATION, SUCURSAL DEL PERU"`, line 1230 `""SERLISA EIRL""`), so the parser
must be quote-aware, not a naive `split(",")` — but confirmed single-line
only (no embedded newlines), so no multi-line buffering is needed.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| CSV parsing | Hand-rolled `parseCsvLine(line)` state machine (quote-aware, single-line) | `csv-parse` npm package; naive `.split(",")` | Matches `validate-env.mjs`/`bundle-report.mjs` convention (zero deps). `split(",")` breaks on the 6 confirmed quoted-comma rows. A full CSV library is overkill for one fixed 9-column shape. |
| CSV writing | One `csvField(value)` helper applied uniformly to every output field | Track which columns need escaping (proposal mentions "one column") | Applying escaping to all fields is cheaper to write and impossible to get wrong later if a new field gains a comma; the one-column note becomes an implementation detail, not a rule to maintain. |
| Derivation rules | Plain object literal `DERIVATION_BY_PERFIL` keyed by `perfil_icp`, one `deriveFields()` lookup function | Switch statement; class with strategy methods | Object literal is the smallest structure that is still trivially auditable/editable (open file, see 4 rows, change a value) — no abstraction a one-shot script doesn't need. |
| Script invocation | `node scripts/generate-crm-import-csvs.mjs` + pnpm alias `crm:export` | No alias (raw `node` only); alias named `import:crm` | Matches existing `domain:verb` alias convention (`bundle:report`, `db:generate`, `cf:setup`). `crm:export` reads correctly since the script exports data *from* the ICP CSV *for* Twenty import. |
| Output location | Repo root, alongside the source CSV | New `crm-export/` directory | Source input CSVs already sit untracked at repo root (`.gitignore` has no CSV rule) — this is the established pattern for this data; a new directory adds structure with no reader. |
| Failure mode | All-or-nothing: on any row error, print all errors to stderr, write zero output files, exit 1 | Write partial output with a warnings file | A half-written import CSV is worse than no CSV — a rep could import incomplete/wrong data. Fail loud, fail closed. |

## Data Flow

    empresas-mineras-zona17S-icp.csv
              │
              ▼
      parseCsvLine() × N rows ──→ validate header + column count
              │
              ▼
      filter EXCLUIDO_mediana_o_gran_mineria (94 rows dropped)
              │
              ▼
      split by tipo ──┬─→ EMPRESA rows ──→ deriveFields(perfil_icp) ──→ csvField() ──→ crm-import-companies.csv
                       └─→ PERSONA_NATURAL rows ──→ deriveFields(perfil_icp) ──→ csvField() ──→ crm-import-people.csv

Row order within each output file matches source order (no re-sorting) —
keeps output diffable across reruns.

## File Changes

| File | Action | Description |
|---|---|---|
| `scripts/generate-crm-import-csvs.mjs` | Create | Transform script: parse, filter, derive, write |
| `crm-import-companies.csv` | Create (generated) | EMPRESA rows, Twenty-ready |
| `crm-import-people.csv` | Create (generated) | PERSONA_NATURAL rows, Twenty-ready |
| `package.json` | Modify | Add `"crm:export": "node scripts/generate-crm-import-csvs.mjs"` script alias |

## Interfaces / Contracts

```js
// Derivation lookup — the only place service-fit logic lives.
const DERIVATION_BY_PERFIL = {
  PERFIL_1_formalizacion: { servicio_potencial: "IGAFOM + REINFO",
    REINFO: true,  IGAFOM: true,  DAC: false, ESTAMIN: false, revisar_manual: false },
  PERFIL_2_cumplimiento:  { servicio_potencial: "DIA/PAMA + DAC/ESTAMIN + Seguridad",
    REINFO: false, IGAFOM: false, DAC: true,  ESTAMIN: true,  revisar_manual: false },
  MIXTO_1_y_2:            { servicio_potencial: "IGAFOM + REINFO; DIA/PAMA + DAC/ESTAMIN + Seguridad",
    REINFO: true,  IGAFOM: true,  DAC: true,  ESTAMIN: true,  revisar_manual: false },
  OTRO_estado:            { servicio_potencial: "REVISAR_MANUAL",
    REINFO: false, IGAFOM: false, DAC: false, ESTAMIN: false, revisar_manual: true },
};

/** Throws if perfilIcp is not one of the 4 known post-filter values. */
function deriveFields(perfilIcp) { /* lookup, throw on miss */ }

function parseCsvLine(line) { /* -> string[], quote-aware, single-line only */ }
function csvField(value)   { /* -> string, quotes+escapes iff needed */ }
```

`ultimo_contacto` / `proximo_seguimiento` are **not** produced by this script
— the runbook's field list omits them entirely; they are populated later by
reps inside Twenty. No timestamps are embedded anywhere in the output, so
re-running the script against an unchanged source CSV produces byte-identical
output files (verified by the testing strategy below).

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `parseCsvLine` on the 6 quoted-comma/quoted-quote lines found in the source | `node --test`, assert exact field arrays |
| Unit | `deriveFields` for all 4 known `perfil_icp` values + throws on unknown | `node --test`, table-driven assertions |
| Unit | `csvField` round-trips a value containing comma/quote/semicolon | `node --test` |
| Integration | Full script run against the real CSV: row-count sum = 2,021, every row has non-empty `servicio_potencial` | `node --test`, spawn script, parse outputs |
| Integration | Idempotency: run twice, diff output bytes, expect zero diff | `node --test` |
| Integration | Missing/malformed input exits 1 with stderr message, writes no output files | `node --test`, temp fixture with bad header |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary. This script only reads one
local CSV and writes two local CSVs via `node:fs`.

## Migration / Rollout

No migration required. Outputs are regenerated files; deleting them and the
script fully reverts (per proposal's rollback plan). No live Twenty writes.

## Open Questions

None — the proposal's approach section and this design agree on all
derivation rules, and direct inspection of the source CSV confirms the
quoting behavior the parser must handle.
