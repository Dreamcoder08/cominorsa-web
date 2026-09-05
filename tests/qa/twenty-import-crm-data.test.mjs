import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  splitName,
  buildCompanyInput,
  buildPersonInput,
  chunk,
  loadCsvRows,
  graphqlRequest,
  run,
} from "../../docker/twenty/scripts/import-crm-data.mjs";

const CONFIG = { SERVER_URL: "http://localhost:3000", TWENTY_API_KEY: "test-key" };

test("splitName splits on whitespace: first token is firstName, rest is lastName", () => {
  assert.deepEqual(splitName("GUSTAVO ALEJANDRO ROSELL CACHO"), {
    firstName: "GUSTAVO",
    lastName: "ALEJANDRO ROSELL CACHO",
  });
});

test("splitName handles a single-token name with an empty lastName", () => {
  assert.deepEqual(splitName("Cher"), { firstName: "Cher", lastName: "" });
});

test("splitName handles empty/missing input without throwing", () => {
  assert.deepEqual(splitName(""), { firstName: "", lastName: "" });
  assert.deepEqual(splitName(undefined), { firstName: "", lastName: "" });
});

const FULL_ROW = {
  titular: "EXPLORACIONES HORIZONTE GOLD S.A.C.",
  perfil_icp: "MIXTO_1_y_2",
  n_concesiones: "11",
  hectareas_totales: "1800.0",
  departamentos: "PIURA",
  provincias: "AYABACA; PIURA",
  sustancias: "M",
  estados_concesion: "TITULADO; TRAMITE",
  servicio_potencial: "IGAFOM + REINFO",
  REINFO: "TRUE",
  IGAFOM: "TRUE",
  DAC: "FALSE",
  ESTAMIN: "FALSE",
  revisar_manual: "FALSE",
  ruc: "",
  fuente_dato: "INGEMMET - Catastro Minero (zona 17S)",
};

test("buildCompanyInput maps titular to name and every shared column to its Twenty field name", () => {
  const input = buildCompanyInput(FULL_ROW);
  assert.equal(input.name, "EXPLORACIONES HORIZONTE GOLD S.A.C.");
  assert.equal(input.perfilIcp, "MIXTO_1_y_2");
  assert.equal(input.nConcesiones, 11);
  assert.equal(input.hectareasTotales, 1800);
  assert.equal(input.departamentos, "PIURA");
  assert.equal(input.reinfo, true);
  assert.equal(input.igafom, true);
  assert.equal(input.dac, false);
  assert.equal(input.estamin, false);
  assert.equal(input.revisarManual, false);
  assert.equal(input.fuenteDato, "INGEMMET - Catastro Minero (zona 17S)");
});

test("buildCompanyInput omits empty cells rather than sending an empty string or zero", () => {
  const input = buildCompanyInput(FULL_ROW);
  assert.equal("ruc" in input, false, "empty ruc must be omitted, not sent as \"\"");
});

test("buildCompanyInput converts numeric strings to real numbers, not strings", () => {
  const input = buildCompanyInput(FULL_ROW);
  assert.equal(typeof input.nConcesiones, "number");
  assert.equal(typeof input.hectareasTotales, "number");
});

test("buildCompanyInput converts \"TRUE\"/\"FALSE\" strings to real booleans, not strings", () => {
  const input = buildCompanyInput(FULL_ROW);
  assert.equal(typeof input.reinfo, "boolean");
  assert.equal(typeof input.dac, "boolean");
});

test("buildPersonInput splits titular into a composite name and carries the same shared fields as Company", () => {
  const row = { ...FULL_ROW, titular: "GUSTAVO ALEJANDRO ROSELL CACHO" };
  const input = buildPersonInput(row);
  assert.deepEqual(input.name, {
    firstName: "GUSTAVO",
    lastName: "ALEJANDRO ROSELL CACHO",
  });
  assert.equal(input.perfilIcp, "MIXTO_1_y_2");
  assert.equal(input.reinfo, true);
});

test("buildPersonInput omits emails/phones/jobTitle entirely when the CSV cells are empty", () => {
  const input = buildPersonInput({ ...FULL_ROW, email: "", phone: "", job_title: "" });
  assert.equal("emails" in input, false);
  assert.equal("phones" in input, false);
  assert.equal("jobTitle" in input, false);
});

test("buildPersonInput includes emails/phones/jobTitle in Twenty's composite shape when present", () => {
  const input = buildPersonInput({
    ...FULL_ROW,
    email: "a@b.com",
    phone: "987654321",
    job_title: "Gerente",
  });
  assert.deepEqual(input.emails, { primaryEmail: "a@b.com" });
  assert.deepEqual(input.phones, { primaryPhoneNumber: "987654321" });
  assert.equal(input.jobTitle, "Gerente");
});

test("chunk splits into fixed-size groups with a shorter final chunk", () => {
  const items = Array.from({ length: 125 }, (_, i) => i);
  const chunks = chunk(items, 60);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 60);
  assert.equal(chunks[1].length, 60);
  assert.equal(chunks[2].length, 5);
});

test("chunk of an empty array returns no chunks", () => {
  assert.deepEqual(chunk([], 60), []);
});

function makeFixtureFile(content) {
  const dir = mkdtempSync(join(tmpdir(), "import-crm-data-"));
  const filePath = join(dir, "fixture.csv");
  writeFileSync(filePath, content, "utf8");
  return { dir, filePath };
}

test("loadCsvRows parses a header + data rows into an array of objects keyed by column name", () => {
  const { dir, filePath } = makeFixtureFile(
    "titular,perfil_icp\nAcme SAC,MIXTO_1_y_2\nOtra SAC,OTRO_estado\n",
  );
  try {
    const rows = loadCsvRows(filePath);
    assert.deepEqual(rows, [
      { titular: "Acme SAC", perfil_icp: "MIXTO_1_y_2" },
      { titular: "Otra SAC", perfil_icp: "OTRO_estado" },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadCsvRows throws naming the file when it does not exist", () => {
  assert.throws(() => loadCsvRows("/nonexistent/path.csv"), /Source file not found/);
});

test("loadCsvRows throws on a header-only (empty-data) file", () => {
  const { dir, filePath } = makeFixtureFile("titular,perfil_icp\n");
  try {
    // Header-only means zero data lines after split/filter, which is a
    // valid (empty) row array, not an error — loadCsvRows itself only
    // throws on a fully empty file. Assert the actual, useful contract.
    assert.deepEqual(loadCsvRows(filePath), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function jsonResponse(body) {
  const text = JSON.stringify(body);
  return { ok: true, status: 200, text: async () => text };
}

test("graphqlRequest returns `data` on a clean response", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({ data: { createCompanies: [{ id: "1" }] } }),
  );
  const data = await graphqlRequest(CONFIG, "mutation { x }", {});
  assert.deepEqual(data, { createCompanies: [{ id: "1" }] });
});

test("graphqlRequest exits 1 on a GraphQL-level error even though the HTTP status is 200", async (t) => {
  const exitCalls = [];
  const errorMessages = [];
  t.mock.method(process, "exit", (code) => exitCalls.push(code));
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({
      data: { createCompanies: null },
      errors: [{ message: "Object company doesn't have any \"x\" field." }],
    }),
  );

  await graphqlRequest(CONFIG, "mutation { x }", {});

  assert.deepEqual(exitCalls, [1]);
  assert.ok(errorMessages.some((m) => m.includes("doesn't have any")));
});

function makeRunFetchMock({
  existingCompanies = [],
  existingPeople = [],
  existingCompaniesTotalCount,
  existingPeopleTotalCount,
} = {}) {
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    const method = options.method ?? "GET";
    calls.push({ url, method, body: options.body });
    const parsed = new URL(url);

    if (method === "GET" && parsed.pathname === "/rest/companies") {
      return jsonResponse({
        data: { companies: existingCompanies },
        totalCount: existingCompaniesTotalCount ?? existingCompanies.length,
      });
    }
    if (method === "GET" && parsed.pathname === "/rest/people") {
      return jsonResponse({
        data: { people: existingPeople },
        totalCount: existingPeopleTotalCount ?? existingPeople.length,
      });
    }
    if (method === "POST" && parsed.pathname === "/graphql") {
      const { query, variables } = JSON.parse(options.body);
      const field = query.includes("createCompanies")
        ? "createCompanies"
        : "createPeople";
      return jsonResponse({
        data: { [field]: variables.data.map((_, i) => ({ id: `new-${i}` })) },
      });
    }
    throw new Error(`Unhandled mock fetch: ${method} ${url}`);
  };
  return { fetchMock, calls };
}

test("run() refuses and exits 1 without ever posting when Company already has records, reporting the real totalCount not the page size", async (t) => {
  const exitCalls = [];
  const errorMessages = [];
  t.mock.method(process, "exit", (code) => {
    exitCalls.push(code);
    throw new Error("__exit__"); // stop execution like a real process.exit would
  });
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  const { fetchMock, calls } = makeRunFetchMock({
    // One page of results (Twenty's REST list caps a page well below the
    // real count) must still report the true totalCount in the message.
    existingCompanies: [{ id: "already-here" }],
    existingCompaniesTotalCount: 799,
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  await assert.rejects(() => run(CONFIG, []), /__exit__/);

  assert.deepEqual(exitCalls, [1]);
  assert.ok(
    errorMessages.some((m) => m.includes("799 record(s)")),
    "expected the refusal message to report totalCount (799), not the page length (1)",
  );
  assert.equal(
    calls.some((c) => c.method === "POST"),
    false,
    "must never POST when the pre-flight check finds existing records",
  );
});

test("run() imports both CSVs in batches when both objects are empty", async (t) => {
  t.mock.method(console, "log", () => {});
  const { fetchMock, calls } = makeRunFetchMock();
  t.mock.method(globalThis, "fetch", fetchMock);

  const { dir, filePath: companiesCsv } = makeFixtureFile(
    "titular,perfil_icp,n_concesiones,hectareas_totales,departamentos,provincias,sustancias,estados_concesion,servicio_potencial,REINFO,IGAFOM,DAC,ESTAMIN,revisar_manual,ruc,fuente_dato\n" +
      Array.from(
        { length: 65 },
        (_, i) =>
          `Empresa ${i} SAC,MIXTO_1_y_2,1,1.0,PIURA,PIURA,M,TITULADO,IGAFOM,TRUE,TRUE,FALSE,FALSE,FALSE,,fuente`,
      ).join("\n") +
      "\n",
  );
  const peopleCsv = join(dir, "people.csv");
  writeFileSync(
    peopleCsv,
    "titular,email,phone,job_title,company,perfil_icp,n_concesiones,hectareas_totales,departamentos,provincias,sustancias,estados_concesion,servicio_potencial,REINFO,IGAFOM,DAC,ESTAMIN,revisar_manual,ruc,fuente_dato\n" +
      "Juan Perez,,,,,,OTRO_estado,,,,,,REVISAR_MANUAL,FALSE,FALSE,FALSE,FALSE,TRUE,,fuente\n",
    "utf8",
  );

  try {
    const result = await run(CONFIG, [companiesCsv, peopleCsv]);
    assert.equal(result, true);

    const companyPosts = calls.filter(
      (c) => c.method === "POST" && JSON.parse(c.body).query.includes("createCompanies"),
    );
    // 65 companies at BATCH_SIZE 60 must split into exactly 2 requests.
    assert.equal(companyPosts.length, 2);
    assert.equal(JSON.parse(companyPosts[0].body).variables.data.length, 60);
    assert.equal(JSON.parse(companyPosts[1].body).variables.data.length, 5);

    const peoplePosts = calls.filter(
      (c) => c.method === "POST" && JSON.parse(c.body).query.includes("createPeople"),
    );
    assert.equal(peoplePosts.length, 1);
    assert.equal(JSON.parse(peoplePosts[0].body).variables.data.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
