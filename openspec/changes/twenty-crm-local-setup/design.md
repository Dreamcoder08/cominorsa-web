# Design: Twenty CRM Local Setup (Docker + Scripted Fields + CSV Import)

## Technical Approach

A vendored, version-pinned Docker Compose stack (`docker/twenty/`) runs Twenty
CRM locally: `server`, `worker`, `db` (Postgres 16), `redis`. A dependency-free
Node ESM script, `create-fields.mjs`, authenticates against Twenty's Metadata
API with a bearer API key and idempotently provisions the runbook's 15 custom
fields on Company and Person. CSV import stays on Twenty's UI wizard (both
files are well under its 10k-row limit). Everything lives under `docker/`,
gated behind new `twenty:*` `package.json` scripts, never referenced by
`dev`/`build`/`test`/deploy. There is no upsert: resetting the instance means
wiping it and redoing field creation + import from the same tracked CSVs.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Image pinning | Vendor the official compose file, pin `image: twentycrm/twenty:<exact-tag>` (tag confirmed during apply, recorded in README) | Track `image: twentycrm/twenty:latest` | Reproducibility: which 15 fields exist and how CSV import behaves must not depend on which day the image was pulled. A pinned tag makes "wipe and reimport" produce the same result every time; bumping the tag becomes a deliberate, reviewable diff instead of silent drift. |
| Field idempotency | `GET` existing fields for the object first, diff by field name against the runbook's 15-field list, `POST` only the missing ones | Blind `POST` and swallow a 409/"already exists" error | Explicit and auditable; does not depend on guessing Twenty's exact duplicate-field error shape, which is unverified without a live instance. |
| API response handling | Read the real response body/status on every request; on non-2xx, print status + raw body to stderr and `exit(1)`; on 2xx, `JSON.parse` defensively and fail loudly if it isn't valid JSON | Assume a documented payload shape and parse it blindly | The Metadata API's exact JSON shapes were only doc-summarized during exploration, never hands-on verified. Defensive parsing turns an unverified assumption into a loud, diagnosable failure instead of silent corruption. |
| CSV import mechanism | Twenty's built-in UI import wizard for both files | Scripted Core/GraphQL batch import (60 rows/request, ~34 calls) | 799 + 1,222 rows are far under the wizard's 10k limit; the wizard already validates/maps columns. Scripted import adds real complexity for zero benefit at this volume (proposal Approach 2). |
| Reset strategy | Full stack wipe (`down -v`) + re-provision + re-import; no dedup/upsert logic | Build upsert/dedup logic now | Twenty has no native upsert (confirmed in exploration). Source of truth is the two committed CSVs + the runbook, not anything a human clicks together inside Twenty, so discarding local Twenty state is safe. Upsert is explicitly out of scope. |
| Secret handling | Bearer API key read from `docker/twenty/.env` (`TWENTY_API_KEY`), never a CLI flag or hardcoded value | CLI argument | Avoids the key leaking into shell history / `ps` output; matches the project's existing `.env.example` template convention. |
| `.gitignore` | No new rule needed — verified `.env*` (no leading `/`) already matches any nested path, including `docker/twenty/.env` | Add an explicit `docker/twenty/.env` entry | Confirmed by reading the current `.gitignore`: an unanchored pattern matches at any depth per Git's own semantics. Resolves the proposal's "Low" risk without adding a redundant rule. |

## Data Flow

```
docker compose -f docker/twenty/docker-compose.yml up -d
  db (Postgres 16) ─┐
  redis ─────────────┼──→ server (:3000, GET /healthz) ──→ worker (migrations/cron)
                      └──→ wait loop polls /healthz until 200
                                     │
                                     ▼
create-fields.mjs  ──Bearer API key──→  GET  /rest/metadata/objects, /rest/metadata/fields
                                     │
                         diff response vs. CUSTOM_FIELDS (15 entries) × {company, person}
                                     │
                                POST /rest/metadata/fields  (missing entries only)
                                     │  non-2xx at any step → print raw body, exit 1
                                     ▼
Human: Command Menu → Import records → crm-import-companies.csv → map → confirm
                                     │
                                     ▼
Human: Command Menu → Import records → crm-import-people.csv → map → confirm
```

## File Changes

| File | Action | Description |
|---|---|---|
| `docker/twenty/docker-compose.yml` | Create | Vendored, pinned stack: server, worker, db, redis |
| `docker/twenty/.env.example` | Create | Template for `ENCRYPTION_KEY`, `PG_DATABASE_PASSWORD`, `SERVER_URL`, `TWENTY_API_KEY` |
| `docker/twenty/scripts/field-definitions.mjs` | Create | `CUSTOM_FIELDS` array, transcribed 1:1 from the runbook's 15-field table; imported by both the script and its tests |
| `docker/twenty/scripts/create-fields.mjs` | Create | Metadata API provisioning script (GET-diff-POST, defensive error handling) |
| `docker/twenty/README.md` | Create | Setup, teardown, `/healthz` wait loop, and the wipe-before-reimport procedure |
| `package.json` | Modify | Add `twenty:up`, `twenty:down`, `twenty:fields` scripts (no `dev`/`build`/`test` wiring) |
| `openspec/specs/twenty-data-model-runbook/spec.md` | Modify (delta) | Manual UI field creation → scripted Metadata API creation |
| `.gitignore` | No change | Confirmed `.env*` already covers `docker/twenty/.env` |

## Interfaces / Contracts

```js
// docker/twenty/scripts/field-definitions.mjs
export const CUSTOM_FIELDS = [
  { name: "perfilIcp", label: "Perfil ICP", type: "SELECT",
    options: ["PERFIL_1_formalizacion", "PERFIL_2_cumplimiento", "MIXTO_1_y_2", "OTRO_estado"] },
  { name: "nConcesiones", label: "N Concesiones", type: "NUMBER" },
  { name: "hectareasTotales", label: "Hectareas Totales", type: "NUMBER" },
  { name: "departamentos", label: "Departamentos", type: "TEXT" },
  { name: "provincias", label: "Provincias", type: "TEXT" },
  { name: "sustancias", label: "Sustancias", type: "TEXT" },
  { name: "estadosConcesion", label: "Estados Concesion", type: "TEXT" },
  { name: "servicioPotencial", label: "Servicio Potencial", type: "TEXT" },
  { name: "reinfo", label: "REINFO", type: "BOOLEAN" },
  { name: "igafom", label: "IGAFOM", type: "BOOLEAN" },
  { name: "dac", label: "DAC", type: "BOOLEAN" },
  { name: "estamin", label: "ESTAMIN", type: "BOOLEAN" },
  { name: "revisarManual", label: "Revisar Manual", type: "BOOLEAN" },
  { name: "ruc", label: "RUC", type: "TEXT" },
  { name: "fuenteDato", label: "Fuente Dato", type: "TEXT" },
];
// Applied identically to both the "company" and "person" standard objects.
```

```js
// docker/twenty/scripts/create-fields.mjs (contract sketch — exact endpoint
// paths/bodies are placeholders pending live-instance verification, see
// Open Questions)
async function twentyRequest(method, path, body) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Twenty API ${method} ${path} failed (${res.status}):\n${text}`);
    process.exit(1);
  }
  try { return text ? JSON.parse(text) : null; }
  catch { console.error(`Twenty API ${method} ${path}: non-JSON 2xx body:\n${text}`); process.exit(1); }
}
```

**Exit-code contract**: `0` only if every one of the 15 fields exists on both
objects when the script finishes (pre-existing or newly created). `1` on any
missing/invalid env var, any non-2xx response, or any unparseable 2xx body —
no partial silent success, per `twenty-field-provisioning`'s fail-loudly
requirement.

**Wipe-before-reimport procedure** (authoritative source for the reset
requirement):

1. `docker compose -f docker/twenty/docker-compose.yml down -v`
2. `docker compose -f docker/twenty/docker-compose.yml up -d`
3. Wait for health: `until curl -sf "$SERVER_URL/healthz"; do sleep 2; done`
4. `pnpm twenty:fields` (re-runs `create-fields.mjs`; volumes were wiped, so all 15 fields are recreated from scratch on both objects)
5. Re-import `crm-import-companies.csv` via Command Menu → Import records
6. Re-import `crm-import-people.csv` via Command Menu → Import records

State lost: **all local Twenty data** — every record, view, and anything a
human clicked together inside the instance. This is acceptable because the
source of truth is the two committed CSVs plus `runbook-twenty-data-model.md`,
never anything authored by hand inside Twenty.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `CUSTOM_FIELDS` has exactly 15 entries matching the runbook's names/types | `node --test`, static assertion against the table above |
| Unit | Diff logic: given a mocked "existing fields" response, computes the correct missing subset | `node --test`, table-driven, mocked `fetch` |
| Unit | `twentyRequest` error path: mocked non-2xx response exits 1 and logs the raw body | `node --test`, mocked `fetch` + stubbed `process.exit` |
| Unit | Startup validation: missing `TWENTY_API_KEY`/`SERVER_URL` exits 1 before any network call | `node --test` |
| Manual (README-documented) | Real field creation against a live local instance; confirms actual Metadata API payload shapes | Human runs `pnpm twenty:up` then `pnpm twenty:fields`, inspects Settings → Data Model |
| Manual | Real CSV import via UI wizard, zero mapping errors | Human follows runbook sequencing |
| Manual | Full wipe cycle (`down -v` → `up -d` → healthy → `twenty:fields` → reimport) | Human, documented step-by-step in README |

The diffing/idempotency logic, argument/env validation, and error-path
behavior are fully unit-testable against mocked responses. Actual field
creation and CSV import require a running Twenty instance and are not
automatable here.

## Threat Matrix

Not fully N/A: `create-fields.mjs` reads a secret from the environment and
makes outbound HTTP calls, unlike the prior fully-local CSV transform.

| Concern | Applicable? | Notes |
|---|---|---|
| Secret exposure | Applicable | `TWENTY_API_KEY` read from `.env` only, never logged; error paths log the response body, never request headers |
| Network target (SSRF-adjacent) | Applicable, low risk | `SERVER_URL` is a local dev-only value the human controls via their own `.env`; the script is run manually against a locally owned Docker stack, never given untrusted/remote input or triggered by CI/PR content |
| Response body handling | Applicable | Response bodies are only ever printed (stderr) or `JSON.parse`d — never `eval`d or passed to a shell |
| Shell/subprocess injection | N/A | Script uses `fetch` only; no `child_process`, no shell interpolation |
| VCS/PR automation | N/A | No git/PR operations |
| Executable-file classification / routing | N/A | No routing, no file-type dispatch |

## Migration / Rollout

No data migration. This introduces local-only tooling with no production
system touched. Rollback: `docker compose down -v`, `rm -rf docker/twenty/`,
revert the `package.json` script additions.

## Open Questions

- [ ] Exact request/response JSON shapes for `/rest/metadata/objects` and `/rest/metadata/fields` (create + list) — doc-summarized only, not hands-on verified; must be confirmed against a live local instance before `create-fields.mjs`'s bodies are finalized.
- [ ] Whether field creation targets built-in objects by singular name (`"company"`/`"person"`) directly, or requires resolving an `objectMetadataId` first.
- [ ] Exact `GET` endpoint/query shape for listing a given object's existing fields (assumed `/rest/metadata/fields?objectId=...` or similar).
- [ ] Exact compose image tag to pin — must be selected from Twenty's published release tags at apply time, not guessed here.
- [ ] Whether the Company/Person standard-field inventory matches a live Twenty template (the runbook itself already flags this as unresolved).
- [ ] Exact `/healthz` response shape/timing for a reliable wait-loop (bare 200 vs. a specific JSON body).
