import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvLine } from "../../scripts/generate-crm-import-csvs.mjs";

// Integration tests spawn the real script as a subprocess against
// TEMPORARY fixture CSVs and a TEMPORARY output directory — never the real
// repo-root `empresas-mineras-zona17S-icp.csv` or the real, committed
// `crm-import-{companies,people}.csv` — per the CLI source-path/outDir
// overrides (see scripts/generate-crm-import-csvs.mjs's header comment and
// openspec/changes/crm-lead-import/design.md's testing strategy). Writing
// outputs into each test's own temp directory means a test run can never
// overwrite or delete the real output files, and tests never need to clean
// up repo-root state.

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SCRIPT_PATH = join(
  REPO_ROOT,
  "scripts",
  "generate-crm-import-csvs.mjs",
);

const EXPECTED_HEADER_LINE =
  "titular,tipo,perfil_icp,n_concesiones,hectareas_totales,departamentos,provincias,sustancias,estados_concesion";

const BOOLEAN_COLUMNS = ["REINFO", "IGAFOM", "DAC", "ESTAMIN", "revisar_manual"];

/** Creates a fresh OS temp directory (never the repo root) containing one
 * fixture CSV file. Returns the directory (used both for the source
 * fixture and, via `outputPaths`, as the script's output directory) and
 * the fixture file path to pass as the script's source-path argument. */
function makeFixture(name, content) {
  const dir = mkdtempSync(join(tmpdir(), "crm-import-integration-"));
  const filePath = join(dir, name);
  writeFileSync(filePath, content, "utf8");
  return { dir, filePath };
}

/** The two output CSV paths the script would write inside `dir` when `dir`
 * is passed as its outDir argument. */
function outputPaths(dir) {
  return {
    companies: join(dir, "crm-import-companies.csv"),
    people: join(dir, "crm-import-people.csv"),
  };
}

/** Runs the script as a real subprocess against `sourcePath`, writing
 * outputs into `outDir` (a temp directory, never the repo root). Never
 * throws on a non-zero exit — returns the exit status, stdout, and stderr
 * so callers can assert fail-closed behavior. */
function runScript(sourcePath, outDir) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [SCRIPT_PATH, sourcePath, outDir],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

// A small, hand-built fixture covering all 4 known `perfil_icp` values, the
// `EXCLUIDO_mediana_o_gran_mineria` filter, and both `EMPRESA` /
// `PERSONA_NATURAL` routing — enough to assert an exact, known row-count
// split without depending on the real 2,021-row source file.
const FIXTURE_ROWS = [
  [
    "Empresa Uno SAC",
    "EMPRESA",
    "PERFIL_1_formalizacion",
    "2",
    "100.0",
    "PIURA",
    "PIURA",
    "AU",
    "TITULADO",
  ],
  [
    "Empresa Dos SAC",
    "EMPRESA",
    "PERFIL_2_cumplimiento",
    "1",
    "50.0",
    "ANCASH",
    "ANCASH",
    "CU",
    "TRAMITE",
  ],
  [
    "Persona Uno",
    "PERSONA_NATURAL",
    "MIXTO_1_y_2",
    "3",
    "300.0",
    "CAJAMARCA",
    "CAJAMARCA",
    "AU; CU",
    "TITULADO",
  ],
  [
    "Persona Dos",
    "PERSONA_NATURAL",
    "OTRO_estado",
    "1",
    "10.0",
    "PIURA",
    "PIURA",
    "AU",
    "TRAMITE",
  ],
  [
    "Empresa Excluida SAC",
    "EMPRESA",
    "EXCLUIDO_mediana_o_gran_mineria",
    "50",
    "9000.0",
    "LIMA",
    "LIMA",
    "CU",
    "TITULADO",
  ],
];

function fixtureCsv(rows) {
  return `${[EXPECTED_HEADER_LINE, ...rows.map((r) => r.join(","))].join("\n")}\n`;
}

/** Asserts every data row (excluding the header) in a parsed output file has
 * a non-empty `servicio_potencial` and explicit `"TRUE"`/`"FALSE"` string
 * values for all 5 boolean columns, per crm-field-derivation-rules/spec.md.
 * Uppercase is mandatory: Twenty's CSV import wizard does not recognize
 * lowercase "true"/"false" (docs.twenty.com/user-guide/data-migration/
 * how-tos/prepare-your-csv-files). */
function assertDerivedFieldsPresent(lines) {
  const header = parseCsvLine(lines[0]);
  const servicioIdx = header.indexOf("servicio_potencial");
  assert.notEqual(servicioIdx, -1, "servicio_potencial column must exist");
  const booleanIdx = Object.fromEntries(
    BOOLEAN_COLUMNS.map((col) => [col, header.indexOf(col)]),
  );
  for (const col of BOOLEAN_COLUMNS) {
    assert.notEqual(booleanIdx[col], -1, `${col} column must exist`);
  }

  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    assert.notEqual(
      fields[servicioIdx],
      "",
      `servicio_potencial must not be empty in row: ${line}`,
    );
    for (const col of BOOLEAN_COLUMNS) {
      assert.ok(
        ["TRUE", "FALSE"].includes(fields[booleanIdx[col]]),
        `${col} must be an explicit "TRUE"/"FALSE" string in row: ${line}`,
      );
    }
  }
}

test("full run against a known fixture produces the correct row-count split with derived fields present", () => {
  const { dir, filePath } = makeFixture("source.csv", fixtureCsv(FIXTURE_ROWS));
  const { companies: companiesOutput, people: peopleOutput } = outputPaths(dir);
  try {
    const result = runScript(filePath, dir);
    assert.equal(result.status, 0, `expected exit 0, stderr: ${result.stderr}`);
    assert.ok(existsSync(companiesOutput), "companies CSV must be written");
    assert.ok(existsSync(peopleOutput), "people CSV must be written");

    const companiesLines = readFileSync(companiesOutput, "utf8")
      .trim()
      .split("\n");
    const peopleLines = readFileSync(peopleOutput, "utf8").trim().split("\n");

    // Fixture has 2 retained EMPRESA rows and 2 retained PERSONA_NATURAL
    // rows; the EXCLUIDO_mediana_o_gran_mineria row is dropped from both.
    // +1 for each file's header row.
    assert.equal(companiesLines.length, 1 + 2, "companies row count");
    assert.equal(peopleLines.length, 1 + 2, "people row count");

    assertDerivedFieldsPresent(companiesLines);
    assertDerivedFieldsPresent(peopleLines);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("running twice against the same fixture produces byte-identical output files", () => {
  const { dir, filePath } = makeFixture("source.csv", fixtureCsv(FIXTURE_ROWS));
  const { companies: companiesOutput, people: peopleOutput } = outputPaths(dir);
  try {
    const first = runScript(filePath, dir);
    assert.equal(first.status, 0, `expected exit 0, stderr: ${first.stderr}`);
    const companiesFirst = readFileSync(companiesOutput);
    const peopleFirst = readFileSync(peopleOutput);

    const second = runScript(filePath, dir);
    assert.equal(second.status, 0, `expected exit 0, stderr: ${second.stderr}`);
    const companiesSecond = readFileSync(companiesOutput);
    const peopleSecond = readFileSync(peopleOutput);

    assert.ok(
      companiesFirst.equals(companiesSecond),
      "companies CSV must be byte-identical across two runs",
    );
    assert.ok(
      peopleFirst.equals(peopleSecond),
      "people CSV must be byte-identical across two runs",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing source file exits non-zero, names the file, and writes no output", () => {
  const dir = mkdtempSync(join(tmpdir(), "crm-import-integration-"));
  const missingPath = join(dir, "does-not-exist.csv");
  const { companies: companiesOutput, people: peopleOutput } = outputPaths(dir);
  try {
    const result = runScript(missingPath, dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not found/i);
    assert.match(result.stderr, /does-not-exist\.csv/);
    assert.ok(!existsSync(companiesOutput), "no companies CSV on failure");
    assert.ok(!existsSync(peopleOutput), "no people CSV on failure");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an empty source file exits non-zero and writes no output", () => {
  const { dir, filePath } = makeFixture("empty.csv", "");
  const { companies: companiesOutput, people: peopleOutput } = outputPaths(dir);
  try {
    const result = runScript(filePath, dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no data rows/i);
    assert.ok(!existsSync(companiesOutput), "no companies CSV on failure");
    assert.ok(!existsSync(peopleOutput), "no people CSV on failure");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a malformed header row exits non-zero, lists expected vs. actual columns, and writes no output", () => {
  const badHeaderLine =
    "nombre,categoria,perfil,concesiones,hectareas,depto,provincia,sustancia,estado";
  const content = `${badHeaderLine}\n${FIXTURE_ROWS[0].join(",")}\n`;
  const { dir, filePath } = makeFixture("bad-header.csv", content);
  const { companies: companiesOutput, people: peopleOutput } = outputPaths(dir);
  try {
    const result = runScript(filePath, dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unexpected header row/i);
    assert.match(result.stderr, /Expected:/);
    assert.match(result.stderr, /Actual:/);
    assert.ok(!existsSync(companiesOutput), "no companies CSV on failure");
    assert.ok(!existsSync(peopleOutput), "no people CSV on failure");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
