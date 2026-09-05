# Twenty Data Model Runbook Specification

## Purpose

Defines what the manual runbook document must contain so a human can
prepare a Twenty CRM workspace's Data Model before either output CSV is
uploaded. This is a documentation deliverable; no automation executes it.

## Requirements

### Requirement: Field List Completeness

The runbook MUST list every custom field referenced by the output CSVs'
headers, for both the Company and Person objects, each with a declared type.

#### Scenario: Every non-standard output column has a runbook entry

- GIVEN the header row of `crm-import-companies.csv` or
  `crm-import-people.csv`
- WHEN each non-standard column name is looked up in the runbook
- THEN a matching field row exists with a declared type (Text, Number,
  Boolean, or Select)

#### Scenario: Select-type fields enumerate allowed values

- GIVEN a runbook field declared as type Select (e.g. Perfil ICP)
- WHEN its row is inspected
- THEN it lists the exact set of allowed values the field may take

### Requirement: Manual Prerequisite Is Explicit

The runbook MUST state that Twenty's CSV import does not create fields, so
every listed custom field MUST exist before either file is uploaded, and
that field creation is a human-executed step, not part of the script.

#### Scenario: Runbook states the precondition before any import step

- GIVEN the runbook document
- WHEN its setup section is read
- THEN it states that fields must be created first and that this is a
  manual, human-executed action

### Requirement: Import Sequencing

The runbook MUST document that Companies are imported before People,
because the Person-to-Company relation requires the Company object to
already exist.

#### Scenario: Sequencing order is stated with its reason

- GIVEN the runbook's sequencing section
- WHEN it is read
- THEN Company field creation and Company import are listed before Person
  field creation and Person import
- AND the reason (Person→Company relation dependency) is stated

### Requirement: Field Labels Enable Unambiguous Mapping

Runbook field labels MUST correspond one-to-one with output CSV column
names so a human can map columns to fields during Twenty's import wizard
without guessing.

#### Scenario: A derived column maps to exactly one runbook label

- GIVEN the output column `servicio_potencial`
- WHEN it is looked up in the runbook
- THEN exactly one field row corresponds to it (Servicio Potencial), with no
  ambiguity against any other listed field
