# Design: Website CRM Lead Capture (ConsultationForm → Twenty)

## Technical Approach

A new App Router Route Handler (`app/api/crm-lead/route.ts`) exposes `POST`.
`vinext`'s README confirms `route.ts` support ("Named HTTP methods, auto
OPTIONS/HEAD") — this repo has zero `app/api/` precedent today, so this is
the site's first backend path. `ConsultationForm.tsx` fires a non-awaited
`fetch()` to it after building the WhatsApp URL; WhatsApp opening never
waits on it. The handler is env-gated, builds a best-effort Twenty Person
payload, and always returns `200`. Field provisioning reuses change 1's
GET-diff-POST pattern, extended with a second Person-only field set.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Response contract | Route Handler always returns `200 {"ok":true}`, whatever happens internally (env unset, bad JSON, Twenty non-2xx, network error) | Return 4xx/5xx on failure | The client fetch has no `.then()`/status check — nothing reads the response. A non-2xx here would only mislead uptime/monitoring tooling about an intentional no-op path. Real diagnostics go to server-side `console.error` only. |
| Reuse of `twentyRequest()` | Mirror its defensive pattern (read raw body, never assume JSON shape) but do NOT import it | Import `twentyRequest` from `create-fields.mjs` directly | That function calls `process.exit(1)` on failure — fatal for a one-off CLI script, but it would crash the entire Workers isolate serving live traffic if reused in a request handler. The route needs its own non-exiting variant. |
| Call ordering in `ConsultationForm.tsx` | `window.open()` and `setSent(true)` stay first and unchanged; the non-awaited `fetch()` is appended last | Fire `fetch()` before `window.open()` | `fetch()` only *initiates* a request synchronously (no `await`), so ordering doesn't affect the popup-blocker's click-gesture window either way. Keeping the existing WhatsApp code untouched and appending last minimizes diff risk to the one flow that must never regress. |
| Missing `.catch()` risk | Add `.catch(() => {})` to the fire-and-forget `fetch()` | Leave it bare | A rejected, unhandled promise (offline, DNS failure, CORS) fires the browser's `unhandledrejection` path, logging "Uncaught (in promise)" to the console. It doesn't crash the app or block `window.open()`, but it is a console-visible error — contrary to "never surface errors to the client." A no-op `.catch` silences it. |
| Person payload shape | Best-effort: `name.firstName`/`lastName` split from the single form `name` field, `city` on the standard field, 4 custom fields set by their `field-definitions.mjs` `name` key | Store everything in a Note instead of Person fields | Matches proposal's explicit field table; consistent with change 1's precedent of setting custom-field values by name. Unverified against a live instance — see Open Questions, same risk class as change 1. |
| `create-fields.mjs` field-set model | Refactor `ensureFieldsForObject(config, objectName, fields)` to take a field list; run it once per set instead of one global `CUSTOM_FIELDS` | Duplicate the whole script for the new field set | Keeps one GET-diff-POST implementation; each object declares which field sets apply to it, avoiding company ever receiving Person-only fields. |

## Data Flow

```
ConsultationForm.tsx (browser)
  handleSubmit()
    → window.open(wa.me/...)      // unchanged, first, synchronous
    → setSent(true)                // unchanged
    → fetch("/api/crm-lead", {POST, JSON body}).catch(()=>{})   // new, not awaited

app/api/crm-lead/route.ts (Workers isolate)
  POST(request)
    → env gate: TWENTY_API_KEY / TWENTY_API_URL unset → return 200, no network call
    → parse JSON body (try/catch) → build Person payload
    → POST {TWENTY_API_URL}/rest/people  (Bearer TWENTY_API_KEY)
    → non-2xx or parse failure → console.error(raw body), still return 200
    → 2xx → return 200
```

## File Changes

| File | Action | Description |
|---|---|---|
| `app/api/crm-lead/route.ts` | Create | `POST` handler: env-gated, builds Person payload, defensive fetch, always 200 |
| `app/ConsultationForm.tsx` | Modify | Append non-awaited, `.catch()`-guarded `fetch()` call after `window.open()`/`setSent(true)` |
| `docker/twenty/scripts/field-definitions.mjs` | Modify | Add `WEBSITE_LEAD_FIELDS` (4 entries) |
| `docker/twenty/scripts/create-fields.mjs` | Modify | `ensureFieldsForObject` takes a `fields` param; `OBJECT_FIELD_SETS` maps `company → [CUSTOM_FIELDS]`, `person → [CUSTOM_FIELDS, WEBSITE_LEAD_FIELDS]` |
| `tests/qa/twenty-create-fields.test.mjs` | Modify | Update calls to `ensureFieldsForObject`'s new 3-arg signature; assert `WEBSITE_LEAD_FIELDS` provisions on person only |
| `tests/qa/crm-lead-route.test.mjs` | Create | Route Handler unit tests, mocked global `fetch` |
| `.env.example` (root) | Modify (blocked) | Document `TWENTY_API_KEY`/`TWENTY_API_URL` — see Open Questions |

## Interfaces / Contracts

```ts
// app/api/crm-lead/route.ts
type CrmLeadPayload = {
  name: string; city: string; service: string;
  question: string; whatsappLine: string; // recipient number string
};

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.TWENTY_API_KEY;
  const apiUrl = process.env.TWENTY_API_URL;
  if (!apiKey || !apiUrl) return Response.json({ ok: true }); // no-op, first check

  let body: CrmLeadPayload;
  try { body = await request.json(); } catch { return Response.json({ ok: true }); }

  const [firstName, ...rest] = body.name.trim().split(/\s+/);
  const lineaWhatsapp = body.whatsappLine.endsWith("987817100")
    ? "SECUNDARIA_987817100" : "PRINCIPAL_910728575";

  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/rest/people`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: { firstName: firstName ?? "", lastName: rest.join(" ") },
        city: body.city,
        servicioConsulta: body.service,
        consultaMensaje: body.question,
        lineaWhatsapp,
        origenLead: "Sitio Web - Formulario de Consulta",
      }),
    });
    if (!res.ok) console.error(`Twenty POST /rest/people failed (${res.status}):\n${await res.text()}`);
  } catch (err) {
    console.error(`Twenty API unreachable: ${(err as Error).message}`);
  }
  return Response.json({ ok: true });
}
```

```js
// docker/twenty/scripts/field-definitions.mjs (append)
export const WEBSITE_LEAD_FIELDS = [
  { name: "servicioConsulta", label: "Servicio de Consulta", type: "TEXT" },
  { name: "consultaMensaje", label: "Consulta", type: "TEXT" },
  { name: "lineaWhatsapp", label: "Línea WhatsApp", type: "SELECT",
    options: ["PRINCIPAL_910728575", "SECUNDARIA_987817100"] },
  { name: "origenLead", label: "Origen del Lead", type: "TEXT" },
];
```

`ConsultationForm.tsx` diff — appended only, nothing else moves:

```diff
     window.open(url, "_blank", "noopener,noreferrer");
     setSent(true);
+
+    fetch("/api/crm-lead", {
+      method: "POST",
+      headers: { "Content-Type": "application/json" },
+      body: JSON.stringify({ name, city, service, question, whatsappLine: recipient }),
+    }).catch(() => {});
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Env gate: unset key/url → `200`, zero `fetch` calls | `node --test`, mocked global `fetch`, assert call count 0 |
| Unit | Happy path: correct `/rest/people` body, Bearer header, `200` returned | Mocked `fetch`, inspect captured request |
| Unit | Twenty non-2xx / network throw → still `200`, error logged | Mocked `fetch` rejecting/returning 500 |
| Unit | Malformed JSON body → `200`, no throw | `request.json()` rejection path |
| Unit | `WEBSITE_LEAD_FIELDS` has exactly 4 entries; `create-fields.mjs` provisions it on person only, not company | `node --test`, mocked Metadata API, same convention as `twenty-create-fields.test.mjs` |
| Manual (Phase-6-style) | Real Person creation with all 4 fields populated against change 1's local stack | Human: `pnpm twenty:up` + `pnpm twenty:fields`, set local env vars, submit form, inspect record |

## Threat Matrix

| Concern | Applicable? | Notes |
|---|---|---|
| Injection into Twenty API request | Applicable, low risk | Body values are JSON-stringified into a JSON payload, not interpolated into a URL or shell — no injection vector beyond a malformed/oversized CRM field value |
| SSRF via user-controlled URL | N/A | `TWENTY_API_URL` comes only from server env, never from the request body; no user-controlled URL parameter exists |
| Secret exposure | Applicable | `TWENTY_API_KEY` read from env only, never echoed in the always-200 response or client-visible logs |
| Rate limiting / abuse | Applicable, accepted risk | Public POST endpoint with no auth; a spammer could flood fake Person records / burn Twenty API quota. No mitigation in v1 — low-traffic marketing site; note as accepted risk, revisit with Cloudflare edge rate limiting if abuse is observed post-launch |
| Shell/subprocess injection | N/A | `fetch` only, no `child_process` |

## Migration / Rollout

No migration. Ships dark until `TWENTY_API_KEY`/`TWENTY_API_URL` are set
anywhere (unset in production until change 3). Rollback: revert
`ConsultationForm.tsx`, delete the route file, drop `WEBSITE_LEAD_FIELDS`.

## Open Questions

- [ ] Root `.env.example` could not be read this session — `Read` returned "denied by your permission settings" for that exact path (not a general root-directory issue; sibling files like `package.json` read fine). The same tool will likely be denied on `Edit`/`Write` in `sdd-apply`; flag for a human/maintainer to add the two lines manually if so.
- [ ] Twenty Core REST payload shape for `POST /rest/people` (field names, `name` composite shape, whether custom fields are set by bare `name` key at create time) is unverified against a live instance — same risk class as change 1's Metadata API. Defensive handling (log raw body, never assume 2xx shape) covers it in the meantime.
- [x] **Resolved** (orchestrator, verified via Cloudflare's own changelog/docs, not assumed): `process.env.TWENTY_API_KEY`/`TWENTY_API_URL` WILL resolve on a deployed Cloudflare Workers isolate. Since 2025-03-11, `nodejs_compat` + the `nodejs_compat_populate_process_env` flag populate `process.env` from a Worker's vars/secrets bindings, lazily on first access; that sub-flag defaults ON for any `compatibility_date` on or after 2025-04-01. This project's generated `dist/server/wrangler.json` shows `"compatibility_date":"2026-08-31"` with `nodejs_compat` already set (see `vite.config.ts`) — well past the threshold, no extra flag needed. In change 3 (`twenty-crm-cloud-deploy`), the two vars just need to be set as real Wrangler secrets/vars (e.g. `wrangler secret put TWENTY_API_KEY`); no code change or shim is required for `process.env` to see them in production.
