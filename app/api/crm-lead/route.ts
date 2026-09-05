// app/api/crm-lead/route.ts
//
// Route Handler that turns a `ConsultationForm` submission into a Twenty
// CRM Person record, without ever surfacing an error to the client or
// slowing down the site's WhatsApp handoff (see `app/ConsultationForm.tsx`,
// which calls this endpoint fire-and-forget, never awaited).
//
// PROVISIONAL / LIVE-VERIFY (see design.md "Open Questions"): the exact
// Twenty Core REST payload shape for `POST /rest/people` (composite `name`
// shape, whether custom fields are set by bare `name` key at create time)
// is a best-effort implementation grounded in design.md's contract sketch,
// NOT hands-on verified against a running Twenty instance. Phase 6 (manual
// verification, human-required) confirms or corrects this shape.
//
// Response contract: this handler ALWAYS returns `200 {"ok":true}`,
// whatever happens internally (env unset, bad JSON, Twenty non-2xx,
// network error). Nothing on the client reads this response — a non-2xx
// here would only mislead uptime/monitoring tooling about an intentional
// no-op path. Real diagnostics go to server-side `console.error` only.
//
// Deliberately does NOT import `twentyRequest` from
// `docker/twenty/scripts/create-fields.mjs`: that helper calls
// `process.exit(1)` on failure, which is fine for a one-off CLI script but
// would crash the entire Workers isolate serving live traffic if reused
// here. This handler implements its own non-exiting, defensive variant.

type CrmLeadPayload = {
  name: string;
  city: string;
  service: string;
  question: string;
  whatsappLine: string;
};

const SECONDARY_WHATSAPP_SUFFIX = "987817100";
const TWENTY_LEAD_ORIGIN = "Sitio Web - Formulario de Consulta";

export async function POST(request: Request): Promise<Response> {
  // Env gate MUST be the very first thing this handler does, before any
  // body parsing or network call: production has no Twenty instance yet,
  // and this must stay a true no-op until change 3 sets real secrets.
  const apiKey = process.env.TWENTY_API_KEY;
  const apiUrl = process.env.TWENTY_API_URL;
  if (!apiKey || !apiUrl) {
    return Response.json({ ok: true });
  }

  let body: CrmLeadPayload;
  try {
    body = await request.json();
  } catch (err) {
    console.error(`crm-lead: malformed request body: ${(err as Error).message}`);
    return Response.json({ ok: true });
  }

  const name = String(body.name ?? "").trim();
  const [firstName, ...rest] = name.split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ");

  const whatsappLine = String(body.whatsappLine ?? "");
  const lineaWhatsapp = whatsappLine.endsWith(SECONDARY_WHATSAPP_SUFFIX)
    ? "SECUNDARIA_987817100"
    : "PRINCIPAL_910728575";

  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/rest/people`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: { firstName: firstName ?? "", lastName },
        ciudadConsulta: body.city ?? "",
        servicioConsulta: body.service ?? "",
        consultaMensaje: body.question ?? "",
        lineaWhatsapp,
        origenLead: TWENTY_LEAD_ORIGIN,
      }),
    });

    if (!res.ok) {
      const raw = await res.text();
      console.error(`crm-lead: Twenty POST /rest/people failed (${res.status}):\n${raw}`);
    }
  } catch (err) {
    console.error(`crm-lead: Twenty API unreachable: ${(err as Error).message}`);
  }

  return Response.json({ ok: true });
}
