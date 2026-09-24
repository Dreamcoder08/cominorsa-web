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
      },
      "51910728575",
    );

    expect(payload).toEqual({
      name: "Rosa Elvira Quispe Mamani",
      city: "Piura",
      service: "REINFO",
      question: "Necesito ayuda con mi trámite.",
      whatsappLine: "51910728575",
    });
  });

  test("carries exactly 5 keys, nothing extra", () => {
    const payload = buildCrmLeadPayload(
      { name: "a", city: "b", service: "c", question: "d" },
      "e",
    );
    expect(Object.keys(payload).sort()).toEqual(
      ["city", "name", "question", "service", "whatsappLine"].sort(),
    );
  });
});
