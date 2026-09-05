// docker/twenty/scripts/create-fields.mjs
//
// Idempotently provisions custom fields (see field-definitions.mjs) on the
// Company and Person standard objects of a running Twenty CRM instance, via
// Twenty's Metadata API (`/rest/metadata/...`). The runbook's 15
// `CUSTOM_FIELDS` apply to both objects; the 5 `WEBSITE_LEAD_FIELDS` (from
// the `website-crm-lead-capture` change) apply to Person only — see
// `OBJECT_FIELD_SETS` below.
//
// LIVE-VERIFIED against a running Twenty v2.38.1 instance (see
// getObjectMetadataId/getExistingFieldNames below for the corrected
// endpoint shapes): `GET /rest/metadata/objects` wraps its array directly
// as `data` (not `data.objects`), and `GET
// /rest/metadata/fields?objectMetadataId=...` silently ignores the query
// filter — listing one object's fields requires `GET
// /rest/metadata/objects/:id` instead, which nests them correctly scoped
// under `fields`. `twentyRequest()`'s defensive error handling still fails
// loudly with the real HTTP status + raw response body on any other
// mismatch instead of silently reporting false success.
//
// Exit-code contract: exit 0 only if every field in each object's field
// set (see `OBJECT_FIELD_SETS`) exists on that object when the script
// finishes (whether pre-existing or newly created this run). Exit 1 on any
// missing/invalid required env var, any non-2xx response, any network
// failure, or any unparseable 2xx body — no partial
// silent success.

import { pathToFileURL } from "node:url";
import { CUSTOM_FIELDS, WEBSITE_LEAD_FIELDS } from "./field-definitions.mjs";

const OBJECT_NAMES = ["company", "person"];

// Which field sets apply to which standard object. `person` additionally
// gets `WEBSITE_LEAD_FIELDS` (website-crm-lead-capture change) — `company`
// never does, since those fields describe a `ConsultationForm` submission,
// not an imported concession holder.
const OBJECT_FIELD_SETS = {
  company: [CUSTOM_FIELDS],
  person: [CUSTOM_FIELDS, WEBSITE_LEAD_FIELDS],
};

/**
 * Validates required environment variables before any network call is
 * made. Exits 1 naming the first missing variable.
 */
export function readConfig(env = process.env) {
  const SERVER_URL = env.SERVER_URL;
  const TWENTY_API_KEY = env.TWENTY_API_KEY;

  if (!SERVER_URL) {
    console.error("Missing required environment variable: SERVER_URL");
    process.exit(1);
    return null;
  }
  if (!TWENTY_API_KEY) {
    console.error("Missing required environment variable: TWENTY_API_KEY");
    process.exit(1);
    return null;
  }

  return { SERVER_URL: SERVER_URL.replace(/\/+$/, ""), TWENTY_API_KEY };
}

/**
 * Defensive HTTP wrapper around `fetch` for the Twenty Metadata API.
 *
 * - Never assumes a payload shape without first confirming the request
 *   succeeded.
 * - A network-level failure (instance unreachable) logs the cause and
 *   exits 1.
 * - A non-2xx response (including an invalid/rejected API key) logs the
 *   real status + raw response body and exits 1.
 * - A 2xx response is `JSON.parse`d defensively; an unparseable 2xx body
 *   also logs the raw body and exits 1.
 */
export async function twentyRequest(config, method, path, body) {
  const url = `${config.SERVER_URL}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.TWENTY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    console.error(
      `Twenty API ${method} ${path}: instance unreachable: ${err.message}`,
    );
    process.exit(1);
    return null;
  }

  const text = await res.text();

  if (!res.ok) {
    console.error(`Twenty API ${method} ${path} failed (${res.status}):\n${text}`);
    process.exit(1);
    return null;
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    console.error(`Twenty API ${method} ${path}: non-JSON 2xx body:\n${text}`);
    process.exit(1);
    return null;
  }
}

/**
 * Resolves the object metadata id for a standard object's singular name
 * (e.g. "company", "person") by listing all object metadata and matching
 * `nameSingular`. Live-verified against Twenty v2.38.1: `GET
 * /rest/metadata/objects` returns `{ data: [...objects], pageInfo,
 * totalCount }` — the array is `data` itself, not `data.objects`.
 */
export async function getObjectMetadataId(config, objectName) {
  const data = await twentyRequest(config, "GET", "/rest/metadata/objects");
  const objects = Array.isArray(data?.data) ? data.data : [];
  const match = objects.find((o) => o?.nameSingular === objectName);
  if (!match) {
    console.error(
      `Twenty Metadata API: no object found with nameSingular "${objectName}" in /rest/metadata/objects response`,
    );
    process.exit(1);
    return null;
  }
  return match.id;
}

/**
 * Lists existing custom field names for a given object metadata id.
 * Live-verified against Twenty v2.38.1: `GET
 * /rest/metadata/fields?objectMetadataId=...` silently ignores the query
 * filter and returns every field across every object, so diffing field
 * names against it produces false "already exists" positives for fields
 * that only exist on a different object. `GET /rest/metadata/objects/:id`
 * returns the single object directly (no `data` wrapper) with its own
 * `fields` array correctly scoped to that object — use that instead.
 */
export async function getExistingFieldNames(config, objectMetadataId) {
  const data = await twentyRequest(
    config,
    "GET",
    `/rest/metadata/objects/${encodeURIComponent(objectMetadataId)}`,
  );
  const fields = Array.isArray(data?.fields) ? data.fields : [];
  return new Set(fields.map((f) => f?.name).filter(Boolean));
}

// Rotating palette for SELECT option colors, live-verified as accepted by
// Twenty v2.38.1's Metadata API.
const SELECT_OPTION_COLORS = ["blue", "green", "orange", "purple", "yellow", "gray"];

/**
 * Creates one custom field on the given object via the Metadata API.
 * Live-verified against Twenty v2.38.1: a SELECT field's `options` must be
 * an array of `{ value, label, position, color }` objects, not bare
 * strings — sending strings produces a cryptic "Option value/label is
 * required" validation error. `field-definitions.mjs` defines `options` as
 * plain strings for readability, so this maps them here.
 */
export async function createField(config, objectMetadataId, field) {
  const options = field.options?.map((value, position) => ({
    value,
    label: value.replace(/_/g, " "),
    position,
    color: SELECT_OPTION_COLORS[position % SELECT_OPTION_COLORS.length],
  }));
  const body = {
    objectMetadataId,
    name: field.name,
    label: field.label,
    type: field.type,
    ...(options ? { options } : {}),
  };
  await twentyRequest(config, "POST", "/rest/metadata/fields", body);
}

/**
 * GET-diff-POST for one standard object: fetches its existing fields,
 * diffs them against the given `fields` array by name, and creates only
 * the missing ones. Returns the set of field names confirmed to exist on
 * the object after this call (pre-existing + newly created).
 */
export async function ensureFieldsForObject(config, objectName, fields) {
  const objectMetadataId = await getObjectMetadataId(config, objectName);
  const existing = await getExistingFieldNames(config, objectMetadataId);

  const missing = fields.filter((f) => !existing.has(f.name));
  for (const field of missing) {
    await createField(config, objectMetadataId, field);
    existing.add(field.name);
  }

  return existing;
}

/**
 * Entry point: validates env, runs GET-diff-POST against both "company"
 * and "person" using each object's field sets from `OBJECT_FIELD_SETS`,
 * and only reports success once every required field is confirmed present
 * on its target object(s).
 */
export async function run(env = process.env) {
  const config = readConfig(env);
  if (!config) return; // env validation already exited 1

  for (const objectName of OBJECT_NAMES) {
    const fieldSets = OBJECT_FIELD_SETS[objectName];
    const fields = fieldSets.flat();
    const requiredNames = new Set(fields.map((f) => f.name));

    const finalFields = await ensureFieldsForObject(config, objectName, fields);
    if (!finalFields) return; // an upstream call already exited 1

    const missingAfterRun = [...requiredNames].filter(
      (name) => !finalFields.has(name),
    );
    if (missingAfterRun.length > 0) {
      console.error(
        `Twenty field provisioning incomplete on "${objectName}": missing ${missingAfterRun.join(", ")}`,
      );
      process.exit(1);
      return;
    }
  }

  console.log(
    "All custom fields exist on both Company and Person (Person also carries the website lead fields).",
  );
}

// Only auto-run when this file is executed directly (`node create-fields.mjs`
// or `pnpm twenty:fields`), never when imported by tests.
const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  run();
}
