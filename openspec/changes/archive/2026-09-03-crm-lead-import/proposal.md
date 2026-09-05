# Proposal: CRM Lead Import — Mining Concession Data to Twenty CRM

## Intent

COMINORSA has a validated ICP dataset (2,115 mining titulares in zone 17S) sitting in an untracked CSV with zero CRM presence. Sales outreach cannot start until this data is transformed into Twenty CRM's per-object import format, with service-fit signals derived so reps can prioritize outreach. No Twenty instance exists yet, so this change ships the transformation tooling and import-ready artifacts as a repeatable, auditable pipeline — not a live integration.

## Scope

### In Scope
- `scripts/generate-crm-import-csvs.mjs`: dependency-free Node ESM script (matches `bundle-report.mjs`/`validate-env.mjs` convention) reading `empresas-mineras-zona17S-icp.csv` only.
- Filter out `EXCLUIDO_mediana_o_gran_mineria` rows (94, confirmed off-ICP). Keep `PERFIL_1_formalizacion`, `PERFIL_2_cumplimiento`, `MIXTO_1_y_2`, and `OTRO_estado` — the last flagged for manual review, not silently dropped, since ambiguous concession status isn't grounds to remove a real titular from the funnel.
- Two output CSVs: `crm-import-companies.csv` (tipo=EMPRESA) and `crm-import-people.csv` (tipo=PERSONA_NATURAL). People rows import standalone — Twenty's Person→Company relation is optional, so no placeholder Company is fabricated for lone individuals.
- Derived fields (rules below) computed per row, never copied from a nonexistent source column.
- `openspec/changes/crm-lead-import/runbook-twenty-data-model.md`: exact custom fields + types to create manually in Twenty's Data Model UI before any upload.

### Out of Scope
- Provisioning any Twenty instance or creating fields inside a live workspace (runbook documents it; a human executes it).
- Fabricating RUC, email, phone, or decision-maker data — these ship blank.
- The secondary top-100 CSV (wrong ICP segment).
- Any live API integration or scheduled sync.

## Capabilities

### New Capabilities
- `crm-import-transform`: script producing Twenty-ready Companies/People CSVs from the ICP source.
- `crm-field-derivation-rules`: explicit rule set mapping `perfil_icp` (+ `sustancias`/`estados_concesion` as tie-breakers) to `servicio_potencial` and boolean REINFO/IGAFOM/DAC/ESTAMIN fields.
- `twenty-data-model-runbook`: documented field/type checklist, manual prerequisite.

### Modified Capabilities
None.

## Approach

1. Parse ICP CSV with manual split/join (no embedded newlines; one column needs quote-escaping on write).
2. Filter `EXCLUIDO_mediana_o_gran_mineria`; split remaining rows by `tipo`.
3. Derive per row: `servicio_potencial` — PERFIL_1→"IGAFOM + REINFO", PERFIL_2→"DIA/PAMA + DAC/ESTAMIN + Seguridad", MIXTO→both concatenated, OTRO_estado→"REVISAR_MANUAL". Booleans: REINFO/IGAFOM = true iff perfil_icp ∈ {PERFIL_1, MIXTO}; DAC/ESTAMIN = true iff perfil_icp ∈ {PERFIL_2, MIXTO}; OTRO_estado → all false + `revisar_manual=true`.
4. Write two CSVs matching the runbook's field names exactly.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `scripts/generate-crm-import-csvs.mjs` | New | Transform script |
| `crm-import-companies.csv`, `crm-import-people.csv` | New | Import-ready outputs |
| `openspec/changes/crm-lead-import/runbook-twenty-data-model.md` | New | Manual setup checklist |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Derivation rules are heuristic, not sales-validated | Med | Flag as first version; easy to adjust in one function |
| Twenty standard-field inventory unconfirmed beyond docs | Low | Runbook re-verified against live template download before real import |
| `OTRO_estado` rows pollute pipeline if reps skip manual review | Low | Distinct `revisar_manual` boolean makes them filterable in Twenty |

## Rollback Plan

Delete the generated CSVs and the script; no external state, no live Twenty writes. Pure filesystem revert via git.

## Dependencies

- Twenty workspace with custom fields created per the runbook, before import.

## Success Criteria

- [ ] Two CSVs generated, row counts sum to 2,021 (2,115 minus 94 excluded).
- [ ] Every row has a non-empty `servicio_potencial` and boolean flags.
- [ ] Runbook lists every custom field referenced by the output CSVs, with type.
