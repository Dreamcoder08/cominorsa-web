// docker/twenty/scripts/create-fields.mjs
//
// Idempotently provisions the runbook's 15 custom fields (see
// field-definitions.mjs) on both the Company and Person standard objects of
// a running Twenty CRM instance, via Twenty's Metadata API
// (`/rest/metadata/...`).
//
// PROVISIONAL / LIVE-VERIFY (see design.md "Open Questions" and
// tasks.md Phase 3): the exact Metadata API endpoint paths and
// request/response JSON shapes implemented below (object-listing shape,
// field-listing query parameter, and field-creation payload) are a
// best-effort implementation grounded in design.md's contract sketch and
// Data Flow section — they are NOT hands-on verified against a running
// Twenty instance. If a live instance responds with a different shape,
// `twentyRequest()`'s defensive error handling is specifically designed to
// fail loudly with the real HTTP status + raw response body instead of
// silently reporting false success or corrupting data. Phase 6 (manual
// verification, human-required) is the step that confirms or corrects these
// shapes against a real instance.
//
// Exit-code contract: exit 0 only if all 15 fields exist on BOTH objects
// when the script finishes (whether pre-existing or newly created this
// run). Exit 1 on any missing/invalid required env var, any non-2xx
// response, any network failure, or any unparseable 2xx body — no partial
// silent success.

import { pathToFileURL } from "node:url";
import { CUSTOM_FIELDS } from "./field-definitions.mjs";

const OBJECT_NAMES = ["company", "person"];

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
 * PROVISIONAL (see file header): resolves the object metadata id for a
 * standard object's singular name (e.g. "company", "person") by listing
 * all object metadata and matching `nameSingular`. Unverified against a
 * live instance — see design.md Open Question "Whether field creation
 * targets built-in objects by singular name directly, or requires
 * resolving an objectMetadataId first."
 */
export async function getObjectMetadataId(config, objectName) {
  const data = await twentyRequest(config, "GET", "/rest/metadata/objects");
  const objects = data?.data?.objects ?? data?.objects ?? [];
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
 * PROVISIONAL (see file header): lists existing custom field names for a
 * given object metadata id. Endpoint/query shape unverified — see
 * design.md Open Question "Exact GET endpoint/query shape for listing a
 * given object's existing fields (assumed
 * /rest/metadata/fields?objectId=... or similar)."
 */
export async function getExistingFieldNames(config, objectMetadataId) {
  const data = await twentyRequest(
    config,
    "GET",
    `/rest/metadata/fields?objectMetadataId=${encodeURIComponent(objectMetadataId)}`,
  );
  const fields = data?.data?.fields ?? data?.fields ?? [];
  return new Set(fields.map((f) => f?.name).filter(Boolean));
}

/**
 * PROVISIONAL (see file header): creates one custom field on the given
 * object via the Metadata API. Request payload shape unverified against a
 * live instance.
 */
export async function createField(config, objectMetadataId, field) {
  const body = {
    objectMetadataId,
    name: field.name,
    label: field.label,
    type: field.type,
    ...(field.options ? { options: field.options } : {}),
  };
  await twentyRequest(config, "POST", "/rest/metadata/fields", body);
}

/**
 * GET-diff-POST for one standard object: fetches its existing fields,
 * diffs them against `CUSTOM_FIELDS` by name, and creates only the missing
 * ones. Returns the set of field names confirmed to exist on the object
 * after this call (pre-existing + newly created).
 */
export async function ensureFieldsForObject(config, objectName) {
  const objectMetadataId = await getObjectMetadataId(config, objectName);
  const existing = await getExistingFieldNames(config, objectMetadataId);

  const missing = CUSTOM_FIELDS.filter((f) => !existing.has(f.name));
  for (const field of missing) {
    await createField(config, objectMetadataId, field);
    existing.add(field.name);
  }

  return existing;
}

/**
 * Entry point: validates env, runs GET-diff-POST against both "company"
 * and "person", and only reports success once all 15 fields are confirmed
 * present on both objects.
 */
export async function run(env = process.env) {
  const config = readConfig(env);
  if (!config) return; // env validation already exited 1

  const requiredNames = new Set(CUSTOM_FIELDS.map((f) => f.name));

  for (const objectName of OBJECT_NAMES) {
    const finalFields = await ensureFieldsForObject(config, objectName);
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

  console.log("All 15 custom fields exist on both Company and Person.");
}

// Only auto-run when this file is executed directly (`node create-fields.mjs`
// or `pnpm twenty:fields`), never when imported by tests.
const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  run();
}
