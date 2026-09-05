import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCsvLine,
  csvField,
  deriveFields,
} from "../../scripts/generate-crm-import-csvs.mjs";

// The 6 real source lines confirmed in
// openspec/changes/crm-lead-import/design.md as containing RFC4180 quoting
// (embedded commas and/or doubled-quote escaping). Each `raw` value is
// copied verbatim from empresas-mineras-zona17S-icp.csv; `sourceLine` is the
// 1-indexed line number in that file, kept for traceability.
const QUOTED_SOURCE_LINES = [
  {
    sourceLine: 18,
    raw: '"SOUTHERN PERU COPPER CORPORATION, SUCURSAL DEL PERU",EMPRESA,EXCLUIDO_mediana_o_gran_mineria,23,8451.4,CAJAMARCA,CAJAMARCA; CAJAMARCA /  CELENDIN,M,TITULADO',
    expected: [
      "SOUTHERN PERU COPPER CORPORATION, SUCURSAL DEL PERU",
      "EMPRESA",
      "EXCLUIDO_mediana_o_gran_mineria",
      "23",
      "8451.4",
      "CAJAMARCA",
      "CAJAMARCA; CAJAMARCA /  CELENDIN",
      "M",
      "TITULADO",
    ],
  },
  {
    sourceLine: 175,
    raw: '"TRANSPORTES, MINERIA Y CONSTRUCCIONES SAGITARIO SAC",PERSONA_NATURAL,MIXTO_1_y_2,3,1300.0,ANCASH,CORONGO /  PALLASCA; PALLASCA; PALLASCA /  SANTA,N,TITULADO; TRAMITE',
    expected: [
      "TRANSPORTES, MINERIA Y CONSTRUCCIONES SAGITARIO SAC",
      "PERSONA_NATURAL",
      "MIXTO_1_y_2",
      "3",
      "1300.0",
      "ANCASH",
      "CORONGO /  PALLASCA; PALLASCA; PALLASCA /  SANTA",
      "N",
      "TITULADO; TRAMITE",
    ],
  },
  {
    sourceLine: 603,
    raw: '"TRANSPORTES, SERVICIOS MINEROS Y AGRICOLAS S.A.C.",EMPRESA,PERFIL_1_formalizacion,1,200.0,ANCASH /  LA LIBERTAD,SANTA /  VIRU,N,TRAMITE',
    expected: [
      "TRANSPORTES, SERVICIOS MINEROS Y AGRICOLAS S.A.C.",
      "EMPRESA",
      "PERFIL_1_formalizacion",
      "1",
      "200.0",
      "ANCASH /  LA LIBERTAD",
      "SANTA /  VIRU",
      "N",
      "TRAMITE",
    ],
  },
  {
    sourceLine: 1230,
    raw: '"SERVICIO DE LIMPIEZA Y SALUD ""SERLISA EIRL""",PERSONA_NATURAL,PERFIL_2_cumplimiento,1,100.0,ANCASH,CASMA,N,TITULADO',
    expected: [
      'SERVICIO DE LIMPIEZA Y SALUD "SERLISA EIRL"',
      "PERSONA_NATURAL",
      "PERFIL_2_cumplimiento",
      "1",
      "100.0",
      "ANCASH",
      "CASMA",
      "N",
      "TITULADO",
    ],
  },
  {
    sourceLine: 1307,
    raw: '"IMPORTACIONES, CONCESIONES & CONSTRUCCIONES BELPORT E.I.R.L.",EMPRESA,PERFIL_2_cumplimiento,1,100.0,ANCASH,HUARMEY,N,TITULADO',
    expected: [
      "IMPORTACIONES, CONCESIONES & CONSTRUCCIONES BELPORT E.I.R.L.",
      "EMPRESA",
      "PERFIL_2_cumplimiento",
      "1",
      "100.0",
      "ANCASH",
      "HUARMEY",
      "N",
      "TITULADO",
    ],
  },
  {
    sourceLine: 1398,
    raw: '"ASESORIA, INVERSIONES Y SERVICIOS NCF EIRL",EMPRESA,PERFIL_2_cumplimiento,1,100.0,ANCASH,SANTA,N,TITULADO',
    expected: [
      "ASESORIA, INVERSIONES Y SERVICIOS NCF EIRL",
      "EMPRESA",
      "PERFIL_2_cumplimiento",
      "1",
      "100.0",
      "ANCASH",
      "SANTA",
      "N",
      "TITULADO",
    ],
  },
];

test("parseCsvLine splits each confirmed quoted-comma source line into exact fields", () => {
  for (const { sourceLine, raw, expected } of QUOTED_SOURCE_LINES) {
    assert.deepEqual(
      parseCsvLine(raw),
      expected,
      `source line ${sourceLine} did not parse into the expected 9 fields`,
    );
  }
});

test("parseCsvLine unescapes a doubled double-quote inside a quoted field", () => {
  const { raw, expected } = QUOTED_SOURCE_LINES.find(
    (line) => line.sourceLine === 1230,
  );
  const fields = parseCsvLine(raw);
  assert.equal(fields[0], 'SERVICIO DE LIMPIEZA Y SALUD "SERLISA EIRL"');
  assert.deepEqual(fields, expected);
});

// deriveFields — table-driven for all 4 known perfil_icp values, per
// specs/crm-field-derivation-rules/spec.md.
const PERFIL_CASES = [
  {
    perfilIcp: "PERFIL_1_formalizacion",
    expected: {
      servicio_potencial: "IGAFOM + REINFO",
      REINFO: true,
      IGAFOM: true,
      DAC: false,
      ESTAMIN: false,
      revisar_manual: false,
    },
  },
  {
    perfilIcp: "PERFIL_2_cumplimiento",
    expected: {
      servicio_potencial: "DIA/PAMA + DAC/ESTAMIN + Seguridad",
      REINFO: false,
      IGAFOM: false,
      DAC: true,
      ESTAMIN: true,
      revisar_manual: false,
    },
  },
  {
    perfilIcp: "MIXTO_1_y_2",
    expected: {
      servicio_potencial:
        "IGAFOM + REINFO + DIA/PAMA + DAC/ESTAMIN + Seguridad",
      REINFO: true,
      IGAFOM: true,
      DAC: true,
      ESTAMIN: true,
      revisar_manual: false,
    },
  },
  {
    perfilIcp: "OTRO_estado",
    expected: {
      servicio_potencial: "REVISAR_MANUAL",
      REINFO: false,
      IGAFOM: false,
      DAC: false,
      ESTAMIN: false,
      revisar_manual: true,
    },
  },
];

test("deriveFields returns the exact spec-defined mapping for each known perfil_icp", () => {
  for (const { perfilIcp, expected } of PERFIL_CASES) {
    assert.deepEqual(
      deriveFields(perfilIcp),
      expected,
      `mismatch for perfil_icp "${perfilIcp}"`,
    );
  }
});

test("deriveFields keeps every service-fit boolean false when revisar_manual is true", () => {
  // OTRO_estado is the only known perfil_icp with revisar_manual=true — this
  // asserts the cross-field invariant from
  // specs/crm-field-derivation-rules/spec.md's "Boolean Flags Are Mutually
  // Consistent With Revisar Manual" requirement.
  const derived = deriveFields("OTRO_estado");
  assert.equal(derived.revisar_manual, true);
  assert.equal(derived.REINFO, false);
  assert.equal(derived.IGAFOM, false);
  assert.equal(derived.DAC, false);
  assert.equal(derived.ESTAMIN, false);
});

test("deriveFields throws a named error for an unrecognized perfil_icp", () => {
  assert.throws(() => deriveFields("PERFIL_NO_EXISTE"), {
    message: 'Unknown perfil_icp: "PERFIL_NO_EXISTE"',
  });
});

// csvField — round-trip through parseCsvLine for the three value shapes
// called out by crm-import-transform spec.md's "Output CSV Format
// Correctness" requirement: comma, quote, and semicolon values.
test("csvField round-trips a value containing a comma through parseCsvLine", () => {
  const original = "CAJAMARCA, CAJAMARCA / CELENDIN";
  const line = [csvField(original), csvField("EMPRESA")].join(",");
  assert.deepEqual(parseCsvLine(line), [original, "EMPRESA"]);
});

test("csvField round-trips a value containing a double-quote through parseCsvLine", () => {
  const original = 'SERVICIO DE LIMPIEZA Y SALUD "SERLISA EIRL"';
  const line = [csvField(original), csvField("PERSONA_NATURAL")].join(",");
  assert.deepEqual(parseCsvLine(line), [original, "PERSONA_NATURAL"]);
});

test("csvField leaves a semicolon-joined multi-value field unquoted, and it round-trips as one column", () => {
  const original = "ANCASH; CAJAMARCA; PIURA";
  // A bare semicolon is not one of csvField's trigger characters
  // (comma/quote/newline), so it must be emitted unquoted.
  assert.equal(csvField(original), original);
  const line = [csvField(original), csvField("TITULADO")].join(",");
  assert.deepEqual(parseCsvLine(line), [original, "TITULADO"]);
});
