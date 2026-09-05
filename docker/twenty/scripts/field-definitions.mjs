// Static custom-field definitions for the local Twenty CRM instance.
//
// Transcribed 1:1 from
// openspec/changes/archive/2026-09-03-crm-lead-import/runbook-twenty-data-model.md
// ("Company custom fields" table, 15 rows). The same 15 fields are applied
// identically to both the "company" and "person" standard objects — see the
// runbook's "Person custom fields" section, which reuses this exact list.
//
// This module is pure data with zero I/O and zero network calls, so it is
// safe to import from both `create-fields.mjs` (PR 3, live Metadata API
// provisioning) and its unit tests.

export const CUSTOM_FIELDS = [
  {
    name: "perfilIcp",
    label: "Perfil ICP",
    type: "SELECT",
    options: [
      "PERFIL_1_formalizacion",
      "PERFIL_2_cumplimiento",
      "MIXTO_1_y_2",
      "OTRO_estado",
    ],
  },
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

// Website lead-capture fields, added by the `website-crm-lead-capture`
// change. Applied to the "person" standard object ONLY — these describe a
// visitor's `ConsultationForm` submission, not an imported concession
// holder, and must never appear on Company.
export const WEBSITE_LEAD_FIELDS = [
  { name: "servicioConsulta", label: "Servicio de Consulta", type: "TEXT" },
  { name: "consultaMensaje", label: "Consulta", type: "TEXT" },
  {
    name: "lineaWhatsapp",
    label: "Línea WhatsApp",
    type: "SELECT",
    options: ["PRINCIPAL_910728575", "SECUNDARIA_987817100"],
  },
  { name: "origenLead", label: "Origen del Lead", type: "TEXT" },
];
