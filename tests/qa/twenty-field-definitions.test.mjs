import assert from "node:assert/strict";
import test from "node:test";
import { CUSTOM_FIELDS } from "../../docker/twenty/scripts/field-definitions.mjs";

// Authoritative source: the "Company custom fields" table in
// openspec/changes/archive/2026-09-03-crm-lead-import/runbook-twenty-data-model.md
// (15 rows, reused verbatim for "Person custom fields"). Each entry below is
// transcribed directly from that table's "Field label" / "Type" columns.
const RUNBOOK_FIELDS = [
  { name: "perfilIcp", label: "Perfil ICP", type: "SELECT" },
  { name: "nConcesiones", label: "N Concesiones", type: "NUMBER" },
  { name: "hectareasTotales", label: "Hectareas Totales", type: "NUMBER" },
  { name: "departamentos", label: "Departamentos", type: "TEXT" },
  { name: "provincias", label: "Provincias", type: "TEXT" },
  { name: "sustancias", label: "Sustancias", type: "TEXT" },
  { name: "estadosConcesion", label: "Estados Concesion", type: "TEXT" },
  { name: "servicioPotencial", label: "Servicio Potencial", type: "TEXT" },
  { name: "reinfo", label: "REINFO", type: "BOOLEAN" },
  { name: "igafom", label: "IGAFOM", type: "BOOLEAN" },
  { name: "dac", label: "DAC", type: "BOOLEAN" },
  { name: "estamin", label: "ESTAMIN", type: "BOOLEAN" },
  { name: "revisarManual", label: "Revisar Manual", type: "BOOLEAN" },
  { name: "ruc", label: "RUC", type: "TEXT" },
  { name: "fuenteDato", label: "Fuente Dato", type: "TEXT" },
];

const PERFIL_ICP_OPTIONS = [
  "PERFIL_1_formalizacion",
  "PERFIL_2_cumplimiento",
  "MIXTO_1_y_2",
  "OTRO_estado",
];

test("CUSTOM_FIELDS has exactly 15 entries", () => {
  assert.equal(CUSTOM_FIELDS.length, 15);
});

test("CUSTOM_FIELDS matches the runbook's name/label/type 1:1, in order", () => {
  assert.deepEqual(
    CUSTOM_FIELDS.map(({ name, label, type }) => ({ name, label, type })),
    RUNBOOK_FIELDS,
  );
});

test("CUSTOM_FIELDS has no duplicate field names", () => {
  const names = CUSTOM_FIELDS.map((f) => f.name);
  assert.equal(new Set(names).size, names.length);
});

test("Perfil ICP is the only SELECT field and exposes the runbook's 4 option values", () => {
  const selectFields = CUSTOM_FIELDS.filter((f) => f.type === "SELECT");
  assert.equal(selectFields.length, 1);

  const perfilIcp = selectFields[0];
  assert.equal(perfilIcp.name, "perfilIcp");
  assert.deepEqual(perfilIcp.options, PERFIL_ICP_OPTIONS);
});

test("only perfilIcp carries an options array", () => {
  for (const field of CUSTOM_FIELDS) {
    if (field.name === "perfilIcp") continue;
    assert.equal(
      "options" in field,
      false,
      `unexpected "options" on non-SELECT field "${field.name}"`,
    );
  }
});

test("field types are limited to the runbook's SELECT/NUMBER/TEXT/BOOLEAN set", () => {
  const allowedTypes = new Set(["SELECT", "NUMBER", "TEXT", "BOOLEAN"]);
  for (const field of CUSTOM_FIELDS) {
    assert.ok(
      allowedTypes.has(field.type),
      `unexpected type "${field.type}" on field "${field.name}"`,
    );
  }
});
