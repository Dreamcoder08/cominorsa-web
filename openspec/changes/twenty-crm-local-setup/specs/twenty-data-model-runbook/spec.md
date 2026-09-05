# Delta for Twenty Data Model Runbook

## MODIFIED Requirements

### Requirement: Manual Prerequisite Is Explicit

The runbook MUST state that Twenty's CSV import does not create fields, so
every listed custom field MUST exist before either file is uploaded, and
that field creation is performed by running
`docker/twenty/scripts/create-fields.mjs` against the Metadata API, not by
manually clicking through Settings → Data Model. The runbook MUST also
state that the CSV import step itself remains a human-executed action in
Twenty's UI, performed after the script completes.
(Previously: field creation was manual, human-executed in Settings → Data
Model, with no script involved)

#### Scenario: Runbook states the precondition before any import step

- GIVEN the runbook document
- WHEN its setup section is read
- THEN it states that fields must exist before either CSV is uploaded

#### Scenario: Runbook attributes field creation to the script, not a human

- GIVEN the runbook's setup section
- WHEN it is read
- THEN it states that field creation is performed by running
  `create-fields.mjs`, not by a human clicking through Settings → Data
  Model

#### Scenario: Runbook states which step remains manual

- GIVEN the runbook's setup section
- WHEN it is read
- THEN it states that importing each CSV through Twenty's UI import
  wizard is still a human-executed step, performed only after
  `create-fields.mjs` has completed successfully
