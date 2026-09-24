// src/client/lib/crm-lead-payload.test.ts
//
// Pure payload-shaping for the fire-and-forget `POST /api/crm-lead` call,
// ported from `app/ConsultationForm.tsx`'s `handleSubmit`. Must match the
// exact key set/shape `app/api/crm-lead/route.ts` expects.

import { describe, expect, test } from "bun:test";
import { buildCrmLeadPayload } from "./crm-lead-payload";

describe("buildCrmLeadPayload", () => {
  test("shapes the exact payload ConsultationForm.tsx posts today", () => {
    const payload = buildCrmLeadPayload(
      {
        name: "Rosa Elvira Quispe Mamani",
        city: "Piura",
        service: "REINFO",
        question: "Necesito ayuda con mi trámite.",
        website: "",
      },
      "51910728575",
    );

    expect(payload).toEqual({
      name: "Rosa Elvira Quispe Mamani",
      city: "Piura",
      service: "REINFO",
      question: "Necesito ayuda con mi trámite.",
      website: "",
      whatsappLine: "51910728575",
    });
  });

  test("carries exactly 6 keys (5 lead fields + the honeypot), nothing extra", () => {
    const payload = buildCrmLeadPayload(
      { name: "a", city: "b", service: "c", question: "d", website: "" },
      "e",
    );
    expect(Object.keys(payload).sort()).toEqual(
      ["city", "name", "question", "service", "website", "whatsappLine"].sort(),
    );
  });

  test("P4: forwards the honeypot value verbatim so the route can drop bot submissions", () => {
    const payload = buildCrmLeadPayload(
      { name: "a", city: "b", service: "c", question: "d", website: "https://spam.example" },
      "e",
    );
    expect(payload.website).toBe("https://spam.example");
  });
});
