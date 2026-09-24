// app/api/crm-lead/route.ts
//
// Route Handler that turns a `ConsultationForm` submission into (a) a
// Twenty CRM Person record and (b) an email notification to the team,
// without ever surfacing an error to the client or slowing down the
// site's WhatsApp handoff (see `app/ConsultationForm.tsx`, which calls
// this endpoint fire-and-forget, never awaited).
//
// The Twenty and Resend request shapes have local regression coverage. This
// correction does not claim a fresh production write test or email delivery
// check; those require separate, explicit operational authorization. Resend's
// POST shape follows https://resend.com/docs/api-reference/emails/send-email.
//
// Response contract: this handler ALWAYS returns `200 {"ok":true}`,
// whatever happens internally (env unset, bad JSON, an integration's
// non-2xx response, network error). Nothing on the client reads this
// response — a non-2xx here would only mislead uptime/monitoring tooling
// about an intentional no-op path. Real diagnostics go to server-side
// `console.error` only.
//
// The two integrations (Twenty, email notification) are independent: each
// gates on its own env vars and runs even if the other's are unset, and
// one's failure never blocks or is masked by the other's (`Promise.allSettled`,
// not sequential awaits).
//
// Deliberately does NOT import `twentyRequest` from
// `docker/twenty/scripts/create-fields.mjs`: that helper calls
// `process.exit(1)` on failure, which is fine for a one-off CLI script but
// would crash the entire Workers isolate serving live traffic if reused
// here. This handler implements its own non-exiting, defensive variant.

const PRIMARY_WHATSAPP_NUMBER = "51910728575";
const SECONDARY_WHATSAPP_NUMBER = "51987817100";

const SERVICE_OPTIONS = [
  "Formalización minera e IGAFOM",
  "REINFO",
  "DIA, PAMA e instrumentos ambientales",
  "DAC y ESTAMIN",
  "Informes y expedientes técnicos",
  "Planes de minado, mapas y planos",
  "Seguridad y salud ocupacional",
  "Trámites ante MINEM, INGEMMET o DREM",
  "Otra consulta minera o ambiental",
] as const;

const FIELD_LIMITS = {
  name: 120,
  city: 120,
  question: 2_000,
} as const;

const MAX_REQUEST_BYTES = 16_384;
const SERVICE_OPTION_SET = new Set<string>(SERVICE_OPTIONS);
const WHATSAPP_LINE_SET = new Set([
  PRIMARY_WHATSAPP_NUMBER,
  SECONDARY_WHATSAPP_NUMBER,
]);

interface CrmLeadPayload {
  name: string;
  city: string;
  service: (typeof SERVICE_OPTIONS)[number];
  question: string;
  whatsappLine: string;
}

const TWENTY_LEAD_ORIGIN = "Sitio Web - Formulario de Consulta";
const LEAD_NOTIFICATION_FROM = "COMINORSA Web <avisos@cominorsa.com>";
const LEAD_NOTIFICATION_TO = "cominorsa@gmail.com";

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody = await readBoundedBody(request);
    const body = validatePayload(JSON.parse(rawBody));
    if (!body) throw new Error("invalid payload");

    await Promise.allSettled([
      createTwentyPerson(body),
      sendLeadNotificationEmail(body),
    ]);
  } catch (error) {
    console.error(`crm-lead: rejected request: ${errorMessage(error)}`);
  }

  return Response.json({ ok: true });
}

async function readBoundedBody(request: Request): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_REQUEST_BYTES
    ) {
      throw new Error("request body exceeds byte limit");
    }
  }
  if (!request.body) throw new Error("request body is missing");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      await reader.cancel("request body exceeds byte limit");
      throw new Error("request body exceeds byte limit");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function validatePayload(value: unknown): CrmLeadPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = boundedString(record.name, FIELD_LIMITS.name);
  const city = boundedString(record.city, FIELD_LIMITS.city);
  const question = boundedString(record.question, FIELD_LIMITS.question);
  const service = boundedString(record.service, 80);
  const whatsappLine = boundedString(record.whatsappLine, 16);

  if (
    !name ||
    !city ||
    !question ||
    !service ||
    !SERVICE_OPTION_SET.has(service) ||
    !whatsappLine ||
    !WHATSAPP_LINE_SET.has(whatsappLine)
  ) {
    return null;
  }

  return {
    name,
    city,
    service: service as CrmLeadPayload["service"],
    question,
    whatsappLine,
  };
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength
    ? normalized
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

// A resubmit (double-click, page refresh, WhatsApp-didn't-open retry) must
// not create a second Twenty Person, since the "Consulta Web" workflow
// creates a fresh Opportunity + Task from every Person it sees. This window
// only catches near-duplicate resubmissions, not a genuine second inquiry
// from the same person later on.
const DUPLICATE_LOOKBACK_MS = 5 * 60 * 1000;

// Twenty's REST filter syntax uses "(", ")" and "," as structural
// delimiters around quoted values. Strip them from free-text input so a
// city or name can never break out of its quoted value and reshape the
// filter query.
function sanitizeFilterValue(value: string): string {
  return value.replace(/["(),]/g, "").trim();
}

async function isDuplicateSubmission(
  apiUrl: string,
  apiKey: string,
  firstName: string,
  lastName: string,
  service: string,
  lineaWhatsapp: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DUPLICATE_LOOKBACK_MS).toISOString();
  const filter = [
    `name.firstName[eq]:"${sanitizeFilterValue(firstName)}"`,
    `name.lastName[eq]:"${sanitizeFilterValue(lastName)}"`,
    `servicioConsulta[eq]:"${sanitizeFilterValue(service)}"`,
    `lineaWhatsapp[eq]:"${lineaWhatsapp}"`,
    `createdAt[gte]:"${since}"`,
  ].join(",");

  try {
    const res = await fetch(
      `${apiUrl.replace(/\/+$/, "")}/rest/people?filter=and(${filter})&limit=1`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    // Fail open: a broken duplicate check must never block a real submission.
    if (!res.ok) return false;
    const json = (await res.json()) as { data?: { people?: unknown[] } };
    return (json.data?.people?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// Env gate MUST be the very first thing this does, before any network
// call: production had no Twenty instance for a while, and this must stay
// a true no-op until real secrets are set.
async function createTwentyPerson(body: CrmLeadPayload): Promise<void> {
  const apiKey = process.env.TWENTY_API_KEY;
  const apiUrl = process.env.TWENTY_API_URL;
  if (!apiKey || !apiUrl) return;

  const [firstName, ...rest] = body.name.split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ");

  const lineaWhatsapp =
    body.whatsappLine === SECONDARY_WHATSAPP_NUMBER
      ? "SECUNDARIA_987817100"
      : "PRINCIPAL_910728575";

  try {
    if (
      await isDuplicateSubmission(
        apiUrl,
        apiKey,
        firstName ?? "",
        lastName,
        body.service,
        lineaWhatsapp,
      )
    ) {
      console.log(
        `crm-lead: skipped duplicate submission for "${body.name}" within ${DUPLICATE_LOOKBACK_MS / 1000}s window`,
      );
      return;
    }

    const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/rest/people`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: { firstName: firstName ?? "", lastName },
        ciudadConsulta: body.city,
        servicioConsulta: body.service,
        consultaMensaje: body.question,
        lineaWhatsapp,
        origenLead: TWENTY_LEAD_ORIGIN,
      }),
    });

    if (!res.ok) {
      const raw = await res.text();
      console.error(
        `crm-lead: Twenty POST /rest/people failed (${res.status}):\n${raw}`,
      );
    }
  } catch (err) {
    console.error(
      `crm-lead: Twenty API unreachable: ${(err as Error).message}`,
    );
  }
}

// Independent of the Twenty integration: fires even if Twenty's env vars
// are unset (and vice versa). Env-gated the same way — no-op, not an
// error, until RESEND_API_KEY is set.
async function sendLeadNotificationEmail(body: CrmLeadPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const { name, city, service, question } = body;

  const html = `
    <h2>Nuevo lead desde la web</h2>
    <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
    <p><strong>Ciudad / Región:</strong> ${escapeHtml(city)}</p>
    <p><strong>Servicio:</strong> ${escapeHtml(service)}</p>
    <p><strong>Consulta:</strong> ${escapeHtml(question)}</p>
    <p style="color:#666;font-size:12px">Guardado automáticamente en el CRM. El cliente todavía tiene que enviar el WhatsApp para que te llegue el mensaje directo.</p>
  `.trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: LEAD_NOTIFICATION_FROM,
        to: [LEAD_NOTIFICATION_TO],
        subject: `Nuevo lead: ${name || "sin nombre"} — ${service || "consulta general"}`,
        html,
      }),
    });

    if (!res.ok) {
      const raw = await res.text();
      console.error(
        `crm-lead: Resend POST /emails failed (${res.status}):\n${raw}`,
      );
    }
  } catch (err) {
    console.error(
      `crm-lead: Resend API unreachable: ${(err as Error).message}`,
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
