import assert from "node:assert/strict";
import test from "node:test";
import {
  readConfig,
  twentyRequest,
  ensureFieldsForObject,
  run,
} from "../../docker/twenty/scripts/create-fields.mjs";
import { CUSTOM_FIELDS } from "../../docker/twenty/scripts/field-definitions.mjs";

const CONFIG = { SERVER_URL: "http://localhost:3000", TWENTY_API_KEY: "test-key" };

const OBJECTS = [
  { id: "obj-company", nameSingular: "company" },
  { id: "obj-person", nameSingular: "person" },
];

function jsonResponse(status, body) {
  const text = JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

function textResponse(status, text) {
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

/**
 * Builds a mocked `fetch` for the Metadata API contract sketched in
 * design.md: GET /rest/metadata/objects (list objects), GET
 * /rest/metadata/fields?objectMetadataId=... (list existing fields), POST
 * /rest/metadata/fields (create one field).
 *
 * `existingByObjectId` maps an object id to the array of field names that
 * already exist on it (default: none exist on either object).
 */
function makeFetchMock({ existingByObjectId = {}, postStatus = 200 } = {}) {
  const calls = [];

  const fetchMock = async (url, options = {}) => {
    const method = options.method ?? "GET";
    calls.push({ url, method, body: options.body });
    const parsed = new URL(url);

    if (method === "GET" && parsed.pathname === "/rest/metadata/objects") {
      return jsonResponse(200, { data: { objects: OBJECTS } });
    }

    if (method === "GET" && parsed.pathname === "/rest/metadata/fields") {
      const objectMetadataId = parsed.searchParams.get("objectMetadataId");
      const names = existingByObjectId[objectMetadataId] ?? [];
      return jsonResponse(200, {
        data: { fields: names.map((name) => ({ name })) },
      });
    }

    if (method === "POST" && parsed.pathname === "/rest/metadata/fields") {
      if (postStatus < 200 || postStatus >= 300) {
        return textResponse(postStatus, "field creation rejected");
      }
      return jsonResponse(200, { data: { field: JSON.parse(options.body) } });
    }

    throw new Error(`Unhandled mock fetch: ${method} ${url}`);
  };

  return { fetchMock, calls };
}

function postedFieldNames(calls, objectMetadataId) {
  return calls
    .filter((c) => c.method === "POST")
    .map((c) => JSON.parse(c.body))
    .filter((body) => body.objectMetadataId === objectMetadataId)
    .map((body) => body.name);
}

test("missing SERVER_URL exits 1 naming the variable, before any network call", (t) => {
  const exitCalls = [];
  const errorMessages = [];
  const fetchSpy = t.mock.fn(() => {
    throw new Error("fetch must not be called when env validation fails");
  });
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(globalThis, "fetch", fetchSpy);

  readConfig({ TWENTY_API_KEY: "key-only" });

  assert.deepEqual(exitCalls, [1]);
  assert.ok(
    errorMessages.some((m) => m.includes("SERVER_URL")),
    "expected an error message naming SERVER_URL",
  );
  assert.equal(fetchSpy.mock.calls.length, 0);
});

test("missing TWENTY_API_KEY exits 1 naming the variable, before any network call", (t) => {
  const exitCalls = [];
  const errorMessages = [];
  const fetchSpy = t.mock.fn(() => {
    throw new Error("fetch must not be called when env validation fails");
  });
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(globalThis, "fetch", fetchSpy);

  readConfig({ SERVER_URL: "http://localhost:3000" });

  assert.deepEqual(exitCalls, [1]);
  assert.ok(
    errorMessages.some((m) => m.includes("TWENTY_API_KEY")),
    "expected an error message naming TWENTY_API_KEY",
  );
  assert.equal(fetchSpy.mock.calls.length, 0);
});

test("valid env returns a config with a trailing slash stripped from SERVER_URL", () => {
  const config = readConfig({
    SERVER_URL: "http://localhost:3000/",
    TWENTY_API_KEY: "key",
  });
  assert.equal(config.SERVER_URL, "http://localhost:3000");
  assert.equal(config.TWENTY_API_KEY, "key");
});

test("twentyRequest exits 1 and logs status + raw body on a non-2xx response", async (t) => {
  const exitCalls = [];
  const errorMessages = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(globalThis, "fetch", async () =>
    textResponse(401, "invalid API key"),
  );

  await twentyRequest(CONFIG, "GET", "/rest/metadata/objects");

  assert.deepEqual(exitCalls, [1]);
  assert.ok(
    errorMessages.some((m) => m.includes("401") && m.includes("invalid API key")),
    "expected the raw status and body to be logged",
  );
});

test("twentyRequest exits 1 when the instance is unreachable (network error)", async (t) => {
  const exitCalls = [];
  const errorMessages = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("ECONNREFUSED");
  });

  await twentyRequest(CONFIG, "GET", "/rest/metadata/objects");

  assert.deepEqual(exitCalls, [1]);
  assert.ok(
    errorMessages.some((m) => m.includes("unreachable")),
    "expected an 'unreachable' error message",
  );
});

test("twentyRequest exits 1 on an unparseable 2xx body", async (t) => {
  const exitCalls = [];
  const errorMessages = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(globalThis, "fetch", async () => textResponse(200, "not json"));

  await twentyRequest(CONFIG, "GET", "/rest/metadata/objects");

  assert.deepEqual(exitCalls, [1]);
  assert.ok(
    errorMessages.some((m) => m.includes("non-JSON")),
    "expected a 'non-JSON' error message",
  );
});

test("ensureFieldsForObject creates all 15 fields when none exist (empty existing-fields response)", async (t) => {
  t.mock.method(process, "exit", () => {});
  t.mock.method(console, "error", () => {});
  const { fetchMock, calls } = makeFetchMock({ existingByObjectId: {} });
  t.mock.method(globalThis, "fetch", fetchMock);

  const finalFields = await ensureFieldsForObject(CONFIG, "company");

  const posted = postedFieldNames(calls, "obj-company");
  assert.equal(posted.length, 15);
  assert.deepEqual(new Set(posted), new Set(CUSTOM_FIELDS.map((f) => f.name)));
  assert.equal(finalFields.size, 15);
});

test("ensureFieldsForObject creates only the missing fields (partial existing-fields response)", async (t) => {
  t.mock.method(process, "exit", () => {});
  t.mock.method(console, "error", () => {});
  const preExisting = CUSTOM_FIELDS.slice(0, 5).map((f) => f.name);
  const { fetchMock, calls } = makeFetchMock({
    existingByObjectId: { "obj-company": preExisting },
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  const finalFields = await ensureFieldsForObject(CONFIG, "company");

  const posted = postedFieldNames(calls, "obj-company");
  assert.equal(posted.length, 10);
  for (const name of preExisting) {
    assert.ok(!posted.includes(name), `pre-existing field "${name}" must not be re-created`);
  }
  assert.equal(finalFields.size, 15);
});

test("ensureFieldsForObject creates nothing when all 15 fields already exist (full existing-fields response)", async (t) => {
  t.mock.method(process, "exit", () => {});
  t.mock.method(console, "error", () => {});
  const allNames = CUSTOM_FIELDS.map((f) => f.name);
  const { fetchMock, calls } = makeFetchMock({
    existingByObjectId: { "obj-company": allNames },
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  const finalFields = await ensureFieldsForObject(CONFIG, "company");

  assert.equal(postedFieldNames(calls, "obj-company").length, 0);
  assert.equal(finalFields.size, 15);
});

test("run() provisions all 15 fields on both company and person from an empty state and logs success", async (t) => {
  const exitCalls = [];
  const logMessages = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "log", (msg) => logMessages.push(msg));
  const { fetchMock, calls } = makeFetchMock({ existingByObjectId: {} });
  t.mock.method(globalThis, "fetch", fetchMock);

  await run({ SERVER_URL: "http://localhost:3000", TWENTY_API_KEY: "key" });

  assert.deepEqual(exitCalls, []);
  assert.equal(postedFieldNames(calls, "obj-company").length, 15);
  assert.equal(postedFieldNames(calls, "obj-person").length, 15);
  assert.ok(
    logMessages.some((m) => m.includes("All 15 custom fields exist")),
    "expected the final success message to be logged",
  );
});

test("run() is idempotent: re-running when both objects are already fully provisioned creates nothing", async (t) => {
  const exitCalls = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "log", () => {});
  const allNames = CUSTOM_FIELDS.map((f) => f.name);
  const { fetchMock, calls } = makeFetchMock({
    existingByObjectId: { "obj-company": allNames, "obj-person": allNames },
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  await run({ SERVER_URL: "http://localhost:3000", TWENTY_API_KEY: "key" });

  assert.deepEqual(exitCalls, []);
  assert.equal(calls.filter((c) => c.method === "POST").length, 0);
});
