#!/usr/bin/env node
/**
 * CRM lead import CSV generator.
 *
 * Reads the ICP mining-concession source CSV, validates it, filters out
 * `EXCLUIDO_mediana_o_gran_mineria` rows, derives service-fit fields per
 * `perfil_icp`, and writes two Twenty-CRM-ready CSVs: one for `EMPRESA`
 * rows (Companies) and one for `PERSONA_NATURAL` rows (People).
 *
 * No external dependencies — runs with plain `node`, matches the
 * `validate-env.mjs` / `bundle-report.mjs` convention.
 *
 * Usage:  node scripts/generate-crm-import-csvs.mjs [sourcePath]
 *         `sourcePath` is optional and test-only; it overrides the source
 *         CSV location. Output files are always written next to the real
 *         repo-root source CSV.
 * Exit:   0 on success, 1 on any validation/derivation/routing failure.
 *         On failure, neither output CSV is written (all-or-nothing).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_SOURCE = join(ROOT, "empresas-mineras-zona17S-icp.csv");
const COMPANIES_OUTPUT = join(ROOT, "crm-import-companies.csv");
const PEOPLE_OUTPUT = join(ROOT, "crm-import-people.csv");

const FUENTE_DATO = "INGEMMET - Catastro Minero (zona 17S)";
const EXCLUDED_PERFIL = "EXCLUIDO_mediana_o_gran_mineria";

const EXPECTED_HEADER = [
  "titular",
  "tipo",
  "perfil_icp",
  "n_concesiones",
  "hectareas_totales",
  "departamentos",
  "provincias",
  "sustancias",
  "estados_concesion",
];

// Custom fields shared by both output objects (Company and Person), in the
// order documented by runbook-twenty-data-model.md.
const SHARED_COLUMNS = [
  "perfil_icp",
  "n_concesiones",
  "hectareas_totales",
  "departamentos",
  "provincias",
  "sustancias",
  "estados_concesion",
  "servicio_potencial",
  "REINFO",
  "IGAFOM",
  "DAC",
  "ESTAMIN",
  "revisar_manual",
  "ruc",
  "fuente_dato",
];

const COMPANY_HEADER = ["titular", ...SHARED_COLUMNS];
const PEOPLE_HEADER = [
  "titular",
  "email",
  "phone",
  "job_title",
  "company",
  ...SHARED_COLUMNS,
];

/** Derivation rules keyed by `perfil_icp` — the only place service-fit
 * logic lives. See specs/crm-field-derivation-rules/spec.md. */
const DERIVATION_BY_PERFIL = {
  PERFIL_1_formalizacion: {
    servicio_potencial: "IGAFOM + REINFO",
    REINFO: true,
    IGAFOM: true,
    DAC: false,
    ESTAMIN: false,
    revisar_manual: false,
  },
  PERFIL_2_cumplimiento: {
    servicio_potencial: "DIA/PAMA + DAC/ESTAMIN + Seguridad",
    REINFO: false,
    IGAFOM: false,
    DAC: true,
    ESTAMIN: true,
    revisar_manual: false,
  },
  MIXTO_1_y_2: {
    servicio_potencial: "IGAFOM + REINFO + DIA/PAMA + DAC/ESTAMIN + Seguridad",
    REINFO: true,
    IGAFOM: true,
    DAC: true,
    ESTAMIN: true,
    revisar_manual: false,
  },
  OTRO_estado: {
    servicio_potencial: "REVISAR_MANUAL",
    REINFO: false,
    IGAFOM: false,
    DAC: false,
    ESTAMIN: false,
    revisar_manual: true,
  },
};

/**
 * Looks up the derived service-fit fields for a `perfil_icp` value.
 * Throws if `perfilIcp` is not one of the 4 known post-filter values.
 */
export function deriveFields(perfilIcp) {
  const derived = DERIVATION_BY_PERFIL[perfilIcp];
  if (!derived) {
    throw new Error(`Unknown perfil_icp: "${perfilIcp}"`);
  }
  return derived;
}

/**
 * Quote-aware, single-line RFC4180 CSV line parser. Handles fields wrapped
 * in double quotes (which may contain commas) and doubled-quote escaping
 * of embedded double-quote characters. Does not handle embedded newlines
 * (the source CSV is confirmed single-line-per-row).
 */
export function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Formats a single CSV output field: wraps in double quotes and doubles
 * any embedded double-quote iff the value contains a comma, double-quote,
 * or newline.
 */
export function csvField(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvLine(fields) {
  return fields.map(csvField).join(",");
}

/** Reads and splits a file into non-trailing-empty lines. */
function readLines(path) {
  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r\n|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function buildSharedFields(row, derived) {
  return {
    perfil_icp: row.perfil_icp,
    n_concesiones: row.n_concesiones,
    hectareas_totales: row.hectareas_totales,
    departamentos: row.departamentos,
    provincias: row.provincias,
    sustancias: row.sustancias,
    estados_concesion: row.estados_concesion,
    servicio_potencial: derived.servicio_potencial,
    REINFO: String(derived.REINFO),
    IGAFOM: String(derived.IGAFOM),
    DAC: String(derived.DAC),
    ESTAMIN: String(derived.ESTAMIN),
    revisar_manual: String(derived.revisar_manual),
    ruc: "",
    fuente_dato: FUENTE_DATO,
  };
}

function buildCompanyRow(row, shared) {
  return COMPANY_HEADER.map((col) =>
    col === "titular" ? row.titular : shared[col],
  );
}

function buildPersonRow(row, shared) {
  const personFields = { email: "", phone: "", job_title: "", company: "" };
  return PEOPLE_HEADER.map((col) => {
    if (col === "titular") return row.titular;
    if (col in personFields) return personFields[col];
    return shared[col];
  });
}

/**
 * Runs the full transform pipeline against `sourcePath`. Fails closed:
 * on any error, returns `{ errors }` with zero output written by the
 * caller. On success, returns `{ companies, people }` row arrays (each
 * including the header row as the first entry).
 */
function runPipeline(sourcePath) {
  if (!existsSync(sourcePath)) {
    return { errors: [`Source file not found: ${sourcePath}`] };
  }

  const lines = readLines(sourcePath);
  if (lines.length === 0) {
    return { errors: [`No data rows found in ${sourcePath} (file is empty)`] };
  }

  const dataLines = lines.slice(1);
  if (dataLines.length === 0) {
    return {
      errors: [
        `No data rows found in ${sourcePath} (only a header row is present)`,
      ],
    };
  }

  const actualHeader = parseCsvLine(lines[0]);
  const headerMatches =
    actualHeader.length === EXPECTED_HEADER.length &&
    actualHeader.every((col, i) => col === EXPECTED_HEADER[i]);
  if (!headerMatches) {
    return {
      errors: [
        `Unexpected header row in ${sourcePath}.\n` +
          `  Expected: ${EXPECTED_HEADER.join(",")}\n` +
          `  Actual:   ${actualHeader.join(",")}`,
      ],
    };
  }

  const errors = [];
  const companies = [COMPANY_HEADER];
  const people = [PEOPLE_HEADER];

  dataLines.forEach((line, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-indexing
    const values = parseCsvLine(line);
    const row = Object.fromEntries(
      EXPECTED_HEADER.map((col, i) => [col, values[i] ?? ""]),
    );

    if (row.perfil_icp === EXCLUDED_PERFIL) {
      return;
    }

    let derived;
    try {
      derived = deriveFields(row.perfil_icp);
    } catch (err) {
      errors.push(`Row ${rowNum} ("${row.titular}"): ${err.message}`);
      return;
    }

    const shared = buildSharedFields(row, derived);

    if (row.tipo === "EMPRESA") {
      companies.push(buildCompanyRow(row, shared));
    } else if (row.tipo === "PERSONA_NATURAL") {
      people.push(buildPersonRow(row, shared));
    } else {
      errors.push(
        `Row ${rowNum} ("${row.titular}"): unrecognized tipo "${row.tipo}"`,
      );
    }
  });

  if (errors.length > 0) {
    return { errors };
  }

  return { companies, people };
}

function main(argv) {
  const sourcePath = argv[0] ? resolve(argv[0]) : DEFAULT_SOURCE;
  const result = runPipeline(sourcePath);

  if (result.errors) {
    process.stderr.write(`${result.errors.join("\n")}\n`);
    process.exit(1);
    return;
  }

  const { companies, people } = result;
  writeFileSync(
    COMPANIES_OUTPUT,
    `${companies.map(toCsvLine).join("\n")}\n`,
    "utf8",
  );
  writeFileSync(PEOPLE_OUTPUT, `${people.map(toCsvLine).join("\n")}\n`, "utf8");

  process.stdout.write(
    `Wrote ${companies.length - 1} company rows to ${COMPANIES_OUTPUT}\n` +
      `Wrote ${people.length - 1} people rows to ${PEOPLE_OUTPUT}\n`,
  );
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main(process.argv.slice(2));
}
