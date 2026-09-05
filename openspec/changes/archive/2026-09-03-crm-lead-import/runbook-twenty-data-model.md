# Runbook: Twenty CRM Data Model Setup (Manual, Pre-Import)

Twenty CSV import creates records but never creates fields. Every custom field
below MUST exist under **Settings → Data Model** on the target object
(Company or Person) before `crm-import-companies.csv` / `crm-import-people.csv`
is uploaded. Import Companies before People (People→Company relation requires
the Company side to exist first).

## Company standard fields

| Standard field | Source |
|---|---|
| Name | `titular` |

## Company custom fields

| Field label | Type | Notes |
|---|---|---|
| Perfil ICP | Select | Values: `PERFIL_1_formalizacion`, `PERFIL_2_cumplimiento`, `MIXTO_1_y_2`, `OTRO_estado` |
| N Concesiones | Number | From `n_concesiones` |
| Hectareas Totales | Number | From `hectareas_totales` |
| Departamentos | Text | Semicolon-joined, kept as-is (no clean 1:1 region mapping) |
| Provincias | Text | Slash/semicolon-joined, kept as-is |
| Sustancias | Text | Semicolon-joined |
| Estados Concesion | Text | Semicolon-joined |
| Servicio Potencial | Text | Derived value, see proposal §Approach |
| REINFO | Boolean | Derived flag |
| IGAFOM | Boolean | Derived flag |
| DAC | Boolean | Derived flag |
| ESTAMIN | Boolean | Derived flag |
| Revisar Manual | Boolean | True only for `OTRO_estado` rows |
| RUC | Text | Ships blank — no source data |
| Fuente Dato | Text | Constant: "INGEMMET - Catastro Minero (zona 17S)" |

## Person custom fields

Same list as Company (Perfil ICP through Fuente Dato) — PERSONA_NATURAL rows
carry identical derived/context fields. Standard fields cover the rest:

| Standard field | Source |
|---|---|
| Name | `titular` |
| Email | blank (no source data) |
| Phone | blank (no source data) |
| Job Title | blank (no source data) |
| Company | not set — standalone individuals, no placeholder Company created |

## Sequencing

1. Create all Company custom fields above.
2. Create all Person custom fields above.
3. Import `crm-import-companies.csv` → map columns → confirm.
4. Import `crm-import-people.csv` → map columns → confirm.
5. Re-verify this field list against a live Twenty template download before
   step 3 — the standard-field inventory beyond `name`/`domainName`/`employees`
   (Company) and `Name`/`Email`/`Phone`/`Job Title`/`Company` (Person) was not
   fully confirmed from docs during exploration.
