// docker/twenty/scripts/import-crm-data.mjs
//
// Imports crm-import-companies.csv / crm-import-people.csv into a running
// Twenty CRM instance via its GraphQL Core API, batching up to 60 records
// per request per Twenty's documented limits (100 req/min, 60 records per
// batch call — docs.twenty.com/developers/extend/api "Batch operations").
// Replaces the manual UI import wizard: this project's CSVs (799 + 1,222
// rows) need no column-mapping UI (the mapping is fixed and already known
// from field-definitions.mjs) and no relation resolution (verified: zero
// Person rows reference a Company).
//
// Deliberately does NOT attempt upsert/dedup: live-tested against Twenty
// v2.38.1, `createCompanies(data: [...], upsert: true)` matches by `id`
// only, not by any business key (e.g. `name`) — running it twice with the
// same fresh CSV data (no `id`s) creates duplicates exactly like running
// the UI wizard twice, `upsert: true` or not. Building client-side
// name-based dedup would be real, unjustified complexity for a one-time
// load into an empty instance, so instead this script refuses to run at
// all if either object already has any records — see `assertObjectEmpty`.
//
// Usage:  node docker/twenty/scripts/import-crm-data.mjs [companiesCsv] [peopleCsv]
//         Both args are optional and test-only; they override the source
//         CSV locations (default: the real, committed repo-root CSVs).
// Env:    SERVER_URL, TWENTY_API_KEY (same contract as create-fields.mjs).
// Exit:   0 only if both objects were empty before the run and every row
//         imported without a GraphQL error. 1 on any failure — never
//         partial success silently reported as success.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readConfig, twentyRequest } from "./create-fields.mjs";
import { parseCsvLine } from "../../../scripts/generate-crm-import-csvs.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const DEFAULT_COMPANIES_CSV = join(ROOT, "crm-import-companies.csv");
const DEFAULT_PEOPLE_CSV = join(ROOT, "crm-import-people.csv");

// Twenty's documented per-request batch cap (docs.twenty.com/developers/
// extend/api). 799 + 1,222 rows stays at 14 + 21 = 35 requests total, far
// under the 100 req/min rate limit — no throttling needed at this volume.
const BATCH_SIZE = 60;

// CSV column -> Twenty field API name, for the 15 fields shared by Company
// and Person (see field-definitions.mjs CUSTOM_FIELDS). Live-verified via
// GraphQL schema introspection against a running Twenty v2.38.1 instance
// (CompanyCreateInput/PersonCreateInput), not guessed from docs.
const TEXT_FIELD_MAP = {
  perfil_icp: "perfilIcp",
  departamentos: "departamentos",
  provincias: "provincias",
  sustancias: "sustancias",
  estados_concesion: "estadosConcesion",
  servicio_potencial: "servicioPotencial",
  ruc: "ruc",
  fuente_dato: "fuenteDato",
};
const NUMBER_FIELD_MAP = {
  n_concesiones: "nConcesiones",
  hectareas_totales: "hectareasTotales",
};
const BOOLEAN_FIELD_MAP = {
  REINFO: "reinfo",
  IGAFOM: "igafom",
  DAC: "dac",
  ESTAMIN: "estamin",
  revisar_manual: "revisarManual",
};

/** Splits a "titular" value into Twenty's composite FullName shape, same
 * convention as app/api/crm-lead/route.ts: first token is firstName, the
 * rest (if any) is lastName. */
export function splitName(titular) {
  const parts = String(titular ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const [firstName, ...rest] = parts;
  return { firstName: firstName ?? "", lastName: rest.join(" ") };
}

/** Maps the 15 shared columns present on both CSVs to Twenty field names,
 * converting numbers and "TRUE"/"FALSE" strings to real types. Omits a
 * field entirely when its source cell is empty, rather than sending "" or
 * coercing to 0 — an empty cell means "unknown", not "zero" or "blank". */
function buildSharedFields(row) {
  const out = {};
  for (const [col, field] of Object.entries(TEXT_FIELD_MAP)) {
    if (row[col]) out[field] = row[col];
  }
  for (const [col, field] of Object.entries(NUMBER_FIELD_MAP)) {
    if (row[col]) out[field] = Number(row[col]);
  }
  for (const [col, field] of Object.entries(BOOLEAN_FIELD_MAP)) {
    if (row[col]) out[field] = row[col] === "TRUE";
  }
  return out;
}

export function buildCompanyInput(row) {
  return { name: row.titular, ...buildSharedFields(row) };
}

export function buildPersonInput(row) {
  const input = { name: splitName(row.titular), ...buildSharedFields(row) };
  if (row.email) input.emails = { primaryEmail: row.email };
  if (row.phone) input.phones = { primaryPhoneNumber: row.phone };
  if (row.job_title) input.jobTitle = row.job_title;
  return input;
}

/** Splits `items` into fixed-size chunks, last chunk possibly shorter. */
export function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Reads a CSV file into an array of row objects keyed by its header. */
export function loadCsvRows(path) {
  if (!existsSync(path)) {
    throw new Error(`Source file not found: ${path}`);
  }
  const lines = readFileSync(path, "utf8")
    .split(/\r\n|\n/)
    .filter((line) => line !== "");
  if (lines.length === 0) {
    throw new Error(`No data rows found in ${path} (file is empty)`);
  }
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((col, i) => [col, values[i] ?? ""]));
  });
}

/**
 * GraphQL-aware request wrapper. `twentyRequest` only inspects the HTTP
 * status — live-verified against Twenty v2.38.1 that GraphQL always
 * responds HTTP 200 for both resolver-level and query-syntax errors,
 * embedding them in an `errors` array in an otherwise-200 body. Without
 * this check, a rejected mutation would be silently treated as success.
 */
export async function graphqlRequest(config, query, variables) {
  const result = await twentyRequest(config, "POST", "/graphql", {
    query,
    variables,
  });
  if (result?.errors?.length) {
    console.error(
      `Twenty GraphQL error:\n${JSON.stringify(result.errors, null, 2)}`,
    );
    process.exit(1);
    return null;
  }
  return result?.data;
}

/** Fails loud if `objectName` (e.g. "companies") already has any records —
 * see file header for why this script refuses rather than deduplicates.
 * `GET /rest/:objectName` returns `{ data: { [objectName]: [...] },
 * totalCount, pageInfo }` — the array is capped at one page (Twenty's
 * default page size), so `totalCount` (not the array length) is the real
 * count to report in the refusal message. */
async function assertObjectEmpty(config, objectName) {
  const result = await twentyRequest(config, "GET", `/rest/${objectName}`);
  const pageLength = result?.data?.[objectName]?.length ?? 0;
  if (pageLength > 0) {
    const totalCount = result?.totalCount ?? pageLength;
    console.error(
      `Refusing to import: ${objectName} already has ${totalCount} record(s). ` +
        `This script does not deduplicate. Wipe first if you want a clean ` +
        `reimport — see docker/twenty/README.md's "Wipe-before-reimport".`,
    );
    process.exit(1);
  }
}

async function createBatches(config, mutationField, typeName, inputs, label) {
  let created = 0;
  const query = `mutation($data: [${typeName}!]!) { ${mutationField}(data: $data) { id } }`;
  for (const batch of chunk(inputs, BATCH_SIZE)) {
    const data = await graphqlRequest(config, query, { data: batch });
    created += data[mutationField].length;
    process.stdout.write(`  ${label}: ${created}/${inputs.length}\n`);
  }
  return created;
}

export async function run(env = process.env, argv = []) {
  const config = readConfig(env);

  await assertObjectEmpty(config, "companies");
  await assertObjectEmpty(config, "people");

  const companiesCsv = argv[0] ? resolve(argv[0]) : DEFAULT_COMPANIES_CSV;
  const peopleCsv = argv[1] ? resolve(argv[1]) : DEFAULT_PEOPLE_CSV;

  const companyInputs = loadCsvRows(companiesCsv).map(buildCompanyInput);
  const personInputs = loadCsvRows(peopleCsv).map(buildPersonInput);

  const companiesCreated = await createBatches(
    config,
    "createCompanies",
    "CompanyCreateInput",
    companyInputs,
    "companies",
  );
  const peopleCreated = await createBatches(
    config,
    "createPeople",
    "PersonCreateInput",
    personInputs,
    "people",
  );

  process.stdout.write(
    `Imported ${companiesCreated} companies and ${peopleCreated} people.\n`,
  );
  return true;
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  await run(process.env, process.argv.slice(2));
}
