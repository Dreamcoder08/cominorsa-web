# Twenty Field Provisioning Specification

## Purpose

Defines the behavior of `docker/twenty/scripts/create-fields.mjs`, which
creates the runbook's custom field set on a running Twenty instance via
the Metadata API (`/rest/metadata/`), replacing manual UI field creation.

## Requirements

### Requirement: Full Field Set Creation on Both Objects

The script MUST create all 15 custom fields listed in
`runbook-twenty-data-model.md` on both the Company object and the Person
object, each with the type declared in the runbook (Select, Number, Text,
or Boolean).

#### Scenario: All fields exist after a clean run

- GIVEN a running Twenty instance with neither object carrying any of the
  runbook's custom fields
- WHEN `create-fields.mjs` runs successfully
- THEN all 15 fields exist on Company and all 15 exist on Person
- AND each field's type matches the runbook (e.g. Perfil ICP is Select,
  N Concesiones is Number, REINFO is Boolean)

#### Scenario: Select field ships its declared value set

- GIVEN the Perfil ICP field is created on either object
- WHEN its Metadata API definition is inspected
- THEN its allowed values are exactly `PERFIL_1_formalizacion`,
  `PERFIL_2_cumplimiento`, `MIXTO_1_y_2`, and `OTRO_estado`

### Requirement: Idempotent Re-Run

The script MUST check whether a field already exists on the target object
before creating it, and running the script again against an instance that
already has some or all fields MUST NOT error and MUST NOT create
duplicate field definitions.

#### Scenario: Re-running after a full prior run is a no-op

- GIVEN all 15 fields already exist on both Company and Person
- WHEN `create-fields.mjs` runs again
- THEN it exits successfully
- AND no duplicate field definitions are created on either object

#### Scenario: Re-running after a partial prior run completes the set

- GIVEN some fields exist on Company and none exist on Person
- WHEN `create-fields.mjs` runs
- THEN it creates only the missing fields on Company
- AND it creates the full set on Person
- AND no existing field is recreated or duplicated

### Requirement: Loud Failure on Unreachable Instance or Invalid Credentials

The script MUST exit with a non-zero status and a message naming the
cause when the target Twenty instance cannot be reached or the supplied
API key is rejected, instead of exiting successfully having created
nothing.

#### Scenario: Twenty instance is unreachable

- GIVEN the configured server URL refuses connections or times out
- WHEN `create-fields.mjs` runs
- THEN it exits with a non-zero status
- AND its output states that the instance could not be reached
- AND it creates zero fields

#### Scenario: API key is invalid

- GIVEN the configured API key is rejected by the Metadata API with an
  authentication error
- WHEN `create-fields.mjs` runs
- THEN it exits with a non-zero status
- AND its output states that authentication failed
- AND it creates zero fields
