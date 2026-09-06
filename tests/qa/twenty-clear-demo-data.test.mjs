import assert from "node:assert/strict";
import test from "node:test";
import { run } from "../../docker/twenty/scripts/clear-demo-data.mjs";
import { readConfig } from "../../docker/twenty/scripts/create-fields.mjs";

const DEMO_COMPANIES = ["Notion", "Stripe", "Figma", "Airbnb", "Anthropic"].map(
  (name, i) => ({ id: `co-${i}`, name }),
);
const DEMO_PEOPLE = [
  ["Ivan", "Zhao"],
  ["Dario", "Amodei"],
  ["Brian", "Chesky"],
  ["Dylan", "Field"],
  ["Patrick", "Collison"],
].map(([firstName, lastName], i) => ({
  id: `pe-${i}`,
  name: { firstName, lastName },
}));

function jsonResponse(status, body) {
  const text = JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

/**
 * Mocks GET /rest/companies, GET /rest/people (single page, no
 * pageInfo.hasNextPage) and DELETE for both. `companies`/`people` are the
 * full record sets the mock instance currently holds.
 */
function makeFetchMock({ companies = DEMO_COMPANIES, people = DEMO_PEOPLE } = {}) {
  const deletedIds = [];
  const fetchMock = async (url, options = {}) => {
    const method = options.method ?? "GET";
    const parsed = new URL(url);

    if (method === "GET" && parsed.pathname === "/rest/companies") {
      return jsonResponse(200, {
        data: { companies },
        pageInfo: { hasNextPage: false },
      });
    }
    if (method === "GET" && parsed.pathname === "/rest/people") {
      return jsonResponse(200, {
        data: { people },
        pageInfo: { hasNextPage: false },
      });
    }
    const deleteMatch = parsed.pathname.match(/^\/rest\/(companies|people)\/(.+)$/);
    if (method === "DELETE" && deleteMatch) {
      deletedIds.push(deleteMatch[2]);
      return jsonResponse(200, {});
    }
    throw new Error(`Unhandled mock fetch: ${method} ${url}`);
  };
  return { fetchMock, deletedIds };
}

const CONFIG_ENV = { SERVER_URL: "http://localhost:3000", TWENTY_API_KEY: "key" };

test("missing SERVER_URL/TWENTY_API_KEY exits 1 before any network call (reuses create-fields.mjs's readConfig)", (t) => {
  const exitCalls = [];
  const fetchSpy = t.mock.fn(() => {
    throw new Error("fetch must not be called when env validation fails");
  });
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", fetchSpy);

  readConfig({});

  assert.deepEqual(exitCalls, [1]);
  assert.equal(fetchSpy.mock.calls.length, 0);
});

test("deletes exactly the 5 demo companies and 5 demo people on an exact match", async (t) => {
  const exitCalls = [];
  const logMessages = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "log", (msg) => logMessages.push(msg));
  const { fetchMock, deletedIds } = makeFetchMock();
  t.mock.method(globalThis, "fetch", fetchMock);

  await run(CONFIG_ENV);

  assert.deepEqual(exitCalls, []);
  assert.equal(deletedIds.length, 10);
  assert.deepEqual(
    new Set(deletedIds),
    new Set([...DEMO_COMPANIES.map((c) => c.id), ...DEMO_PEOPLE.map((p) => p.id)]),
  );
  assert.ok(logMessages.some((m) => m.includes("Deleted 5 demo Person") && m.includes("5 demo Company")));
});

test("refuses and deletes nothing when Company has an extra (real) record mixed in with the demo set", async (t) => {
  const exitCalls = [];
  const errorMessages = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(console, "log", () => {});
  const realCompany = { id: "co-real", name: "S.M.R.L. Real Mining Co" };
  const { fetchMock, deletedIds } = makeFetchMock({
    companies: [...DEMO_COMPANIES, realCompany],
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  await run(CONFIG_ENV);

  assert.deepEqual(exitCalls, [1]);
  assert.equal(deletedIds.length, 0, "must not delete anything, including the real record");
  assert.ok(errorMessages.some((m) => m.includes("Company") && m.includes("expected exactly 5")));
});

test("refuses and deletes nothing when a demo company was renamed/removed (name mismatch)", async (t) => {
  const exitCalls = [];
  const errorMessages = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(console, "log", () => {});
  const renamed = DEMO_COMPANIES.map((c) =>
    c.name === "Stripe" ? { ...c, name: "Stripe Inc (renamed)" } : c,
  );
  const { fetchMock, deletedIds } = makeFetchMock({ companies: renamed });
  t.mock.method(globalThis, "fetch", fetchMock);

  await run(CONFIG_ENV);

  assert.deepEqual(exitCalls, [1]);
  assert.equal(deletedIds.length, 0);
  assert.ok(errorMessages.some((m) => m.includes('"Stripe"') && m.includes("not found")));
});

test("refuses and deletes nothing (not even matched companies) when Person doesn't match the demo set", async (t) => {
  const exitCalls = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "log", () => {});
  const { fetchMock, deletedIds } = makeFetchMock({ people: DEMO_PEOPLE.slice(0, 3) });
  t.mock.method(globalThis, "fetch", fetchMock);

  await run(CONFIG_ENV);

  assert.deepEqual(exitCalls, [1]);
  assert.equal(
    deletedIds.length,
    0,
    "a Person mismatch must block Company deletion too, even though companies matched",
  );
});

test("refuses (already cleared) when both objects are empty", async (t) => {
  const exitCalls = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "log", () => {});
  const { fetchMock, deletedIds } = makeFetchMock({ companies: [], people: [] });
  t.mock.method(globalThis, "fetch", fetchMock);

  await run(CONFIG_ENV);

  assert.deepEqual(exitCalls, [1]);
  assert.equal(deletedIds.length, 0);
});
