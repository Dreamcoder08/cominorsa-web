// src/client/lib/whatsapp-message.test.ts
//
// Pure logic behind the consultation form's WhatsApp handoff, ported
// from `app/ConsultationForm.tsx`'s `handleSubmit` (T7). No DOM: these
// three functions only ever see plain strings in and a string out, so
// they're unit-tested directly with `bun test` — DOM wiring
// (`src/client/consultation-form.ts`) is covered by Playwright e2e
// instead (see odd/tasks/bun-vanilla-migration.md, T7 verification).

import { describe, expect, test } from "bun:test";
import {
  PRIMARY_WHATSAPP_NUMBER,
  SECONDARY_WHATSAPP_NUMBER,
} from "../../../app/constants";
import {
  buildConsultationMessage,
  buildWhatsAppUrl,
  selectWhatsAppRecipient,
} from "./whatsapp-message";

describe("selectWhatsAppRecipient", () => {
  test("routes the secondary line when explicitly selected", () => {
    expect(selectWhatsAppRecipient(SECONDARY_WHATSAPP_NUMBER)).toBe(
      SECONDARY_WHATSAPP_NUMBER,
    );
  });

  test("defaults to the primary line for any other value", () => {
    expect(selectWhatsAppRecipient(PRIMARY_WHATSAPP_NUMBER)).toBe(
      PRIMARY_WHATSAPP_NUMBER,
    );
    expect(selectWhatsAppRecipient("")).toBe(PRIMARY_WHATSAPP_NUMBER);
    expect(selectWhatsAppRecipient("garbage")).toBe(PRIMARY_WHATSAPP_NUMBER);
  });
});

describe("buildConsultationMessage", () => {
  test("matches the exact line-by-line template from ConsultationForm.tsx", () => {
    const message = buildConsultationMessage({
      name: "Rosa Elvira Quispe Mamani",
      city: "Piura",
      service: "REINFO",
      question: "Necesito ayuda con mi trámite.",
    });

    expect(message).toBe(
      [
        "Hola COMINORSA, quiero realizar una consulta profesional.",
        "",
        "Nombre: Rosa Elvira Quispe Mamani",
        "Ciudad / Región: Piura",
        "Servicio: REINFO",
        "Consulta: Necesito ayuda con mi trámite.",
        "",
        "Deseo coordinar el pago y la atención por WhatsApp.",
      ].join("\n"),
    );
  });
});

describe("buildWhatsAppUrl", () => {
  test("builds a wa.me link with the message URL-encoded", () => {
    const url = buildWhatsAppUrl(PRIMARY_WHATSAPP_NUMBER, "hola mundo");
    expect(url).toBe(
      `https://wa.me/${PRIMARY_WHATSAPP_NUMBER}?text=hola%20mundo`,
    );
  });

  test("encodes line breaks and special characters safely", () => {
    const url = buildWhatsAppUrl(PRIMARY_WHATSAPP_NUMBER, "a\nb&c=d");
    expect(url).toBe(
      `https://wa.me/${PRIMARY_WHATSAPP_NUMBER}?text=a%0Ab%26c%3Dd`,
    );
  });
});
