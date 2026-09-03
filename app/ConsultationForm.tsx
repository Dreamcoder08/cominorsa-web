"use client";

import { FormEvent, useState } from "react";

const PRIMARY_WHATSAPP = "51910728575";
const SECONDARY_WHATSAPP = "51987817100";

const serviceOptions = [
  "Formalización minera e IGAFOM",
  "REINFO",
  "DIA, PAMA e instrumentos ambientales",
  "DAC y ESTAMIN",
  "Informes y expedientes técnicos",
  "Planes de minado, mapas y planos",
  "Seguridad y salud ocupacional",
  "Trámites ante MINEM, INGEMMET o DREM",
  "Otra consulta minera o ambiental",
];

export function ConsultationForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const service = String(form.get("service") ?? "").trim();
    const question = String(form.get("question") ?? "").trim();
    const selectedWhatsApp = String(form.get("whatsapp") ?? "");
    const recipient =
      selectedWhatsApp === SECONDARY_WHATSAPP
        ? SECONDARY_WHATSAPP
        : PRIMARY_WHATSAPP;

    const message = [
      "Hola COMINORSA, quiero realizar una consulta profesional.",
      "",
      `Nombre: ${name}`,
      `Ciudad / Región: ${city}`,
      `Servicio: ${service}`,
      `Consulta: ${question}`,
      "",
      "Deseo coordinar el pago y la atención por WhatsApp.",
    ].join("\n");

    const url = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setSent(true);
  }

  return (
    <form className="consultation-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          <span>Nombre completo</span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Escribe tu nombre"
            required
          />
        </label>
        <label>
          <span>Ciudad o región</span>
          <input
            type="text"
            name="city"
            autoComplete="address-level1"
            placeholder="Ej. Piura"
            required
          />
        </label>
      </div>

      <label>
        <span>Servicio de interés</span>
        <select name="service" defaultValue="" required>
          <option value="" disabled>
            Selecciona un servicio
          </option>
          {serviceOptions.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Línea de WhatsApp</span>
        <select name="whatsapp" defaultValue={PRIMARY_WHATSAPP} required>
          <option value={PRIMARY_WHATSAPP}>910 728 575</option>
          <option value={SECONDARY_WHATSAPP}>987 817 100</option>
        </select>
      </label>

      <label>
        <span>Escribe tu consulta</span>
        <textarea
          name="question"
          rows={5}
          minLength={10}
          placeholder="Cuéntanos brevemente qué necesitas resolver"
          required
        />
      </label>

      <div className="form-submit">
        <div>
          <strong>Consulta profesional</strong>
          <span>Te respondemos por WhatsApp</span>
        </div>
        <button type="submit">
          Enviar por WhatsApp
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      <p className="form-disclaimer">
        Al continuar se abrirá WhatsApp. El pago y el horario de atención se
        coordinan directamente con COMINORSA.
      </p>
      <p className="form-status" aria-live="polite">
        {sent ? "Tu mensaje fue preparado y enviado a WhatsApp." : ""}
      </p>
    </form>
  );
}
