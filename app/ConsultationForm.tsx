"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CONTACT_SUBMIT_EVENT,
  PRIMARY_WHATSAPP_NUMBER,
  SECONDARY_WHATSAPP_NUMBER,
} from "./constants";

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
  // Server-rendered HTML has no onSubmit wired at all — that's a React
  // prop, not an HTML attribute — so a submit click landing before this
  // client component finishes hydrating falls through to the browser's
  // *native* form submission: GET, every field (including the client's
  // name/city/question) appended to the URL as a query string. `mounted`
  // starts false on both server and first client render (so this can't
  // itself cause a hydration mismatch), then flips true in an effect,
  // which only fires after hydration has already attached the real
  // handler — closing the gap instead of just narrowing it with a delay.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const service = String(form.get("service") ?? "").trim();
    const question = String(form.get("question") ?? "").trim();
    const selectedWhatsApp = String(form.get("whatsapp") ?? "");
    const recipient =
      selectedWhatsApp === SECONDARY_WHATSAPP_NUMBER
        ? SECONDARY_WHATSAPP_NUMBER
        : PRIMARY_WHATSAPP_NUMBER;

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
    event.currentTarget.dataset.event = CONTACT_SUBMIT_EVENT;
    event.currentTarget.dataset.eventContext = service;
    window.open(url, "_blank", "noopener,noreferrer");
    setSent(true);

    fetch("/api/crm-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        city,
        service,
        question,
        whatsappLine: recipient,
      }),
    }).catch(() => {});
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
        <select name="whatsapp" defaultValue={PRIMARY_WHATSAPP_NUMBER} required>
          <option value={PRIMARY_WHATSAPP_NUMBER}>910 728 575</option>
          <option value={SECONDARY_WHATSAPP_NUMBER}>987 817 100</option>
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
        <button type="submit" disabled={!mounted}>
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
