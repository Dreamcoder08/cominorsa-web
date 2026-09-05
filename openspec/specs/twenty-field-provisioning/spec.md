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
or Boolean). The script MUST additionally create the 4
`WEBSITE_LEAD_FIELDS` custom fields (`servicioConsulta`,
`consultaMensaje`, `lineaWhatsapp`, `origenLead`) on the Person object
only — these MUST NOT be created on Company.
(Previously: covered only the 15-field `CUSTOM_FIELDS` set, applied
identically to both objects.)

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

#### Scenario: Website lead fields exist on Person after a clean run

- GIVEN a running Twenty instance with no `WEBSITE_LEAD_FIELDS` custom
  fields on Person
- WHEN `create-fields.mjs` runs successfully
- THEN all 4 website-lead fields exist on Person
- AND `servicioConsulta`, `consultaMensaje`, and `origenLead` are Text
- AND `lineaWhatsapp` is Select

#### Scenario: Website lead fields are never created on Company

- GIVEN `create-fields.mjs` runs successfully
- WHEN the Company object's fields are inspected
- THEN none of the 4 website-lead fields exist on Company

#### Scenario: Línea WhatsApp select field ships its declared value set

- GIVEN the `lineaWhatsapp` field is created on Person
- WHEN its Metadata API definition is inspected
- THEN its allowed values are exactly `PRINCIPAL_910728575` and
  `SECUNDARIA_987817100`


### Requirement: Idempotent Re-Run
The script MUST check whether a field already exists on the target
object before creating it, for both the 15-field `CUSTOM_FIELDS` set and
the 4-field `WEBSITE_LEAD_FIELDS` set. Running the script again against
an instance that already has some or all of either set MUST NOT error
and MUST NOT create duplicate field definitions.
(Previously: idempotency scoped only to the 15-field `CUSTOM_FIELDS`
set.)

#### Scenario: Re-running after a full prior run is a no-op

- GIVEN all 15 `CUSTOM_FIELDS` already exist on both Company and Person,
  and all 4 `WEBSITE_LEAD_FIELDS` already exist on Person
- WHEN `create-fields.mjs` runs again
- THEN it exits successfully
- AND no duplicate field definitions are created on either object

#### Scenario: Re-running after a partial prior run completes the set

- GIVEN some `CUSTOM_FIELDS` exist on Company and none exist on Person
- WHEN `create-fields.mjs` runs
- THEN it creates only the missing fields on Company
- AND it creates the full set on Person
- AND no existing field is recreated or duplicated

#### Scenario: Re-running after Person is missing only website lead fields

- GIVEN Person already has all 15 `CUSTOM_FIELDS` but none of the 4
  `WEBSITE_LEAD_FIELDS`
- WHEN `create-fields.mjs` runs
- THEN it creates only the 4 missing `WEBSITE_LEAD_FIELDS` on Person
- AND no `CUSTOM_FIELDS` field is recreated or duplicated

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
