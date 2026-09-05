# CRM Field Derivation Rules Specification

## Purpose

Defines the exact, deterministic mapping from a row's `perfil_icp` value to
its derived `servicio_potencial` string and boolean `REINFO`/`IGAFOM`/`DAC`/
`ESTAMIN`/`revisar_manual` fields. These fields do not exist in the source
CSV and MUST be computed, never copied from a nonexistent column.

Note: this spec derives fields from `perfil_icp` alone, matching the
proposal's concrete Approach algorithm. It does not use `sustancias` or
`estados_concesion` as tie-breakers, since the proposal's Approach section
defines no rule that reads them.

## Requirements

### Requirement: Servicio Potencial Derivation

The system MUST derive `servicio_potencial` from `perfil_icp` using exactly
one of four fixed string values, with no other value permitted.

#### Scenario: PERFIL_1_formalizacion

- GIVEN a row with `perfil_icp=PERFIL_1_formalizacion`
- WHEN derived fields are computed
- THEN `servicio_potencial` is exactly `IGAFOM + REINFO`
- AND `REINFO=true`, `IGAFOM=true`, `DAC=false`, `ESTAMIN=false`,
  `revisar_manual=false`

#### Scenario: PERFIL_2_cumplimiento

- GIVEN a row with `perfil_icp=PERFIL_2_cumplimiento`
- WHEN derived fields are computed
- THEN `servicio_potencial` is exactly `DIA/PAMA + DAC/ESTAMIN + Seguridad`
- AND `REINFO=false`, `IGAFOM=false`, `DAC=true`, `ESTAMIN=true`,
  `revisar_manual=false`

#### Scenario: MIXTO_1_y_2

- GIVEN a row with `perfil_icp=MIXTO_1_y_2`
- WHEN derived fields are computed
- THEN `servicio_potencial` is exactly the PERFIL_1 and PERFIL_2 strings
  concatenated as `IGAFOM + REINFO + DIA/PAMA + DAC/ESTAMIN + Seguridad`
- AND `REINFO=true`, `IGAFOM=true`, `DAC=true`, `ESTAMIN=true`,
  `revisar_manual=false`

#### Scenario: OTRO_estado

- GIVEN a row with `perfil_icp=OTRO_estado`
- WHEN derived fields are computed
- THEN `servicio_potencial` is exactly `REVISAR_MANUAL`
- AND `REINFO=false`, `IGAFOM=false`, `DAC=false`, `ESTAMIN=false`,
  `revisar_manual=true`

### Requirement: Boolean Flags Are Mutually Consistent With Revisar Manual

When `revisar_manual` is `true`, all four service-fit booleans MUST be
`false`, regardless of any other row data, since an unresolved concession
status is not evidence of any specific service fit.

#### Scenario: Revisar-manual rows never carry a service-fit signal

- GIVEN a row with `revisar_manual=true`
- WHEN derived fields are computed
- THEN `REINFO`, `IGAFOM`, `DAC`, and `ESTAMIN` are all `false`

### Requirement: Derived Fields Cover Every Retained Row

Every row present in either output CSV MUST have a non-empty
`servicio_potencial` and explicit (not blank) boolean values for `REINFO`,
`IGAFOM`, `DAC`, `ESTAMIN`, and `revisar_manual`.

#### Scenario: No retained row is missing derived fields

- GIVEN the full set of rows written to `crm-import-companies.csv` and
  `crm-import-people.csv`
- WHEN each row is inspected
- THEN `servicio_potencial` is non-empty and each boolean field is exactly
  `true` or `false`, never blank or a different value
