# CRM Import Transform Specification

## Purpose

Defines the behavior of `scripts/generate-crm-import-csvs.mjs`: reading the
ICP source CSV, validating it, filtering rows, splitting output by `tipo`,
and writing two Twenty-ready CSV files.

## Requirements

### Requirement: Source File Validation

The script MUST validate `empresas-mineras-zona17S-icp.csv` before producing
any output, and MUST fail loudly instead of writing partial or garbage
output.

#### Scenario: Source file missing

- GIVEN `empresas-mineras-zona17S-icp.csv` does not exist at the expected path
- WHEN the script runs
- THEN it exits with a non-zero status and a message naming the missing file
- AND it writes neither output CSV

#### Scenario: Source file empty

- GIVEN the source file exists but contains zero bytes, or contains only a
  header row with no data rows
- WHEN the script runs
- THEN it exits with a non-zero status and a message stating no data rows
  were found
- AND it writes neither output CSV

#### Scenario: Unexpected header row

- GIVEN the source file's first row does not match the expected column set
  (`titular,tipo,perfil_icp,n_concesiones,hectareas_totales,departamentos,provincias,sustancias,estados_concesion`)
- WHEN the script runs
- THEN it exits with a non-zero status and a message listing the expected vs.
  actual columns
- AND it writes neither output CSV

### Requirement: Row Filtering by ICP Profile

The script MUST exclude rows whose `perfil_icp` is
`EXCLUIDO_mediana_o_gran_mineria` and MUST retain all other profile values.

#### Scenario: Excluded profile is dropped

- GIVEN a row with `perfil_icp=EXCLUIDO_mediana_o_gran_mineria`
- WHEN the script processes the source file
- THEN that row does not appear in either output CSV

#### Scenario: Ambiguous profile is kept, not dropped

- GIVEN a row with `perfil_icp=OTRO_estado`
- WHEN the script processes the source file
- THEN the row appears in its `tipo`-matching output CSV
- AND its `revisar_manual` column is `true`

### Requirement: Output Split by Tipo

The script MUST route each retained row to exactly one output file based on
`tipo`, and MUST NOT fabricate a Company record for standalone people.

#### Scenario: Company row routing

- GIVEN a retained row with `tipo=EMPRESA`
- WHEN outputs are written
- THEN the row appears in `crm-import-companies.csv` only

#### Scenario: Person row routing

- GIVEN a retained row with `tipo=PERSONA_NATURAL`
- WHEN outputs are written
- THEN the row appears in `crm-import-people.csv` only
- AND no Company record is created or referenced for that row

#### Scenario: Unrecognized tipo value

- GIVEN a retained row whose `tipo` is neither `EMPRESA` nor
  `PERSONA_NATURAL`
- WHEN the script processes that row
- THEN it exits with a non-zero status and a message naming the row and the
  unexpected value, instead of silently dropping or misrouting the row

### Requirement: Blank Fields Are Not Fabricated

Fields with no source column (RUC, email, phone, decision-maker name,
job title/cargo) MUST be emitted as present, empty columns.

#### Scenario: No-source fields ship blank, not omitted

- GIVEN any output row
- WHEN the row is written
- THEN the RUC, email, phone, and job-title columns exist in the row
- AND each contains an empty string, not a placeholder like "N/A" or
  "unknown", and is not omitted from the row

### Requirement: Output CSV Format Correctness

Both output files MUST be valid, single-delimiter CSV that a standard parser
reads back into the same columns and values that were written.

#### Scenario: Header row present

- GIVEN either output file
- WHEN it is opened
- THEN its first line is a header row naming every column in the runbook's
  field list for that object

#### Scenario: Multi-value field stays one column

- GIVEN a `departamentos` value of `ANCASH; CAJAMARCA; PIURA` (semicolon-joined)
- WHEN the row is written and re-parsed by a standard CSV parser
- THEN the value round-trips as a single column, not split into three columns

#### Scenario: Comma or quote in a value is escaped

- GIVEN a field value containing a comma or a double-quote character
- WHEN the row is written
- THEN the value is wrapped in double quotes and any embedded double-quote is
  doubled, so re-parsing yields the original value unchanged
