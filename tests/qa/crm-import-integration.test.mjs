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
// TEMPORARY fixture CSVs — never the real repo-root
// `empresas-mineras-zona17S-icp.csv` — per the CLI source-path override
// added in PR1 (see scripts/generate-crm-import-csvs.mjs's header comment
// and openspec/changes/crm-lead-import/design.md's testing strategy). The
// script always writes its two output CSVs to the repo root regardless of
// the source path passed in, so every test cleans those generated files up
// afterward in addition to its own temp fixture directory.

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SCRIPT_PATH = join(
  REPO_ROOT,
  "scripts",
  "generate-crm-import-csvs.mjs",
);
const COMPANIES_OUTPUT = join(REPO_ROOT, "crm-import-companies.csv");
const PEOPLE_OUTPUT = join(REPO_ROOT, "crm-import-people.csv");

const EXPECTED_HEADER_LINE =
  "titular,tipo,perfil_icp,n_concesiones,hectareas_totales,departamentos,provincias,sustancias,estados_concesion";

const BOOLEAN_COLUMNS = ["REINFO", "IGAFOM", "DAC", "ESTAMIN", "revisar_manual"];

/** Deletes both generated output files at the repo root if present. Safe to
 * call before a run (defensive) and always called after, in a `finally`. */
function cleanOutputs() {
  for (const path of [COMPANIES_OUTPUT, PEOPLE_OUTPUT]) {
    if (existsSync(path)) rmSync(path);
  }
}

/** Creates a fresh OS temp directory (never the repo root) containing one
 * fixture CSV file. Returns the directory (for cleanup) and the file path
 * to pass as the script's source-path override argument. */
function makeFixture(name, content) {
  const dir = mkdtempSync(join(tmpdir(), "crm-import-integration-"));
  const filePath = join(dir, name);
  writeFileSync(filePath, content, "utf8");
  return { dir, filePath };
}

/** Runs the script as a real subprocess against `sourcePath`, cwd'd at the
 * repo root. Never throws on a non-zero exit — returns the exit status,
 * stdout, and stderr so callers can assert fail-closed behavior. */
function runScript(sourcePath) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT_PATH, sourcePath], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
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
 * a non-empty `servicio_potencial` and explicit `"true"`/`"false"` string
 * values for all 5 boolean columns, per crm-field-derivation-rules/spec.md. */
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
        ["true", "false"].includes(fields[booleanIdx[col]]),
        `${col} must be an explicit "true"/"false" string in row: ${line}`,
      );
    }
  }
}

test("full run against a known fixture produces the correct row-count split with derived fields present", () => {
  const { dir, filePath } = makeFixture("source.csv", fixtureCsv(FIXTURE_ROWS));
  try {
    cleanOutputs();
    const result = runScript(filePath);
    assert.equal(result.status, 0, `expected exit 0, stderr: ${result.stderr}`);
    assert.ok(existsSync(COMPANIES_OUTPUT), "companies CSV must be written");
    assert.ok(existsSync(PEOPLE_OUTPUT), "people CSV must be written");

    const companiesLines = readFileSync(COMPANIES_OUTPUT, "utf8")
      .trim()
      .split("\n");
    const peopleLines = readFileSync(PEOPLE_OUTPUT, "utf8").trim().split("\n");

    // Fixture has 2 retained EMPRESA rows and 2 retained PERSONA_NATURAL
    // rows; the EXCLUIDO_mediana_o_gran_mineria row is dropped from both.
    // +1 for each file's header row.
    assert.equal(companiesLines.length, 1 + 2, "companies row count");
    assert.equal(peopleLines.length, 1 + 2, "people row count");

    assertDerivedFieldsPresent(companiesLines);
    assertDerivedFieldsPresent(peopleLines);
  } finally {
    cleanOutputs();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("running twice against the same fixture produces byte-identical output files", () => {
  const { dir, filePath } = makeFixture("source.csv", fixtureCsv(FIXTURE_ROWS));
  try {
    cleanOutputs();

    const first = runScript(filePath);
    assert.equal(first.status, 0, `expected exit 0, stderr: ${first.stderr}`);
    const companiesFirst = readFileSync(COMPANIES_OUTPUT);
    const peopleFirst = readFileSync(PEOPLE_OUTPUT);

    const second = runScript(filePath);
    assert.equal(second.status, 0, `expected exit 0, stderr: ${second.stderr}`);
    const companiesSecond = readFileSync(COMPANIES_OUTPUT);
    const peopleSecond = readFileSync(PEOPLE_OUTPUT);

    assert.ok(
      companiesFirst.equals(companiesSecond),
      "companies CSV must be byte-identical across two runs",
    );
    assert.ok(
      peopleFirst.equals(peopleSecond),
      "people CSV must be byte-identical across two runs",
    );
  } finally {
    cleanOutputs();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing source file exits non-zero, names the file, and writes no output", () => {
  const dir = mkdtempSync(join(tmpdir(), "crm-import-integration-"));
  const missingPath = join(dir, "does-not-exist.csv");
  try {
    cleanOutputs();
    const result = runScript(missingPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not found/i);
    assert.match(result.stderr, /does-not-exist\.csv/);
    assert.ok(!existsSync(COMPANIES_OUTPUT), "no companies CSV on failure");
    assert.ok(!existsSync(PEOPLE_OUTPUT), "no people CSV on failure");
  } finally {
    cleanOutputs();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an empty source file exits non-zero and writes no output", () => {
  const { dir, filePath } = makeFixture("empty.csv", "");
  try {
    cleanOutputs();
    const result = runScript(filePath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no data rows/i);
    assert.ok(!existsSync(COMPANIES_OUTPUT), "no companies CSV on failure");
    assert.ok(!existsSync(PEOPLE_OUTPUT), "no people CSV on failure");
  } finally {
    cleanOutputs();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a malformed header row exits non-zero, lists expected vs. actual columns, and writes no output", () => {
  const badHeaderLine =
    "nombre,categoria,perfil,concesiones,hectareas,depto,provincia,sustancia,estado";
  const content = `${badHeaderLine}\n${FIXTURE_ROWS[0].join(",")}\n`;
  const { dir, filePath } = makeFixture("bad-header.csv", content);
  try {
    cleanOutputs();
    const result = runScript(filePath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unexpected header row/i);
    assert.match(result.stderr, /Expected:/);
    assert.match(result.stderr, /Actual:/);
    assert.ok(!existsSync(COMPANIES_OUTPUT), "no companies CSV on failure");
    assert.ok(!existsSync(PEOPLE_OUTPUT), "no people CSV on failure");
  } finally {
    cleanOutputs();
    rmSync(dir, { recursive: true, force: true });
  }
});
