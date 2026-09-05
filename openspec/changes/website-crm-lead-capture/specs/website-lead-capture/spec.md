# Website Lead Capture Specification

## Purpose

Defines the behavior of `app/api/crm-lead/route.ts` (Route Handler) and its
non-blocking caller in `app/ConsultationForm.tsx`. Together they turn a
`ConsultationForm` submission into a Twenty CRM Person record, without ever
delaying, blocking, or breaking the form's existing WhatsApp handoff.

## Requirements

### Requirement: Non-Blocking Lead Capture Call

The client MUST NOT await the lead-capture `fetch` call before calling
`window.open()` to open WhatsApp. The call to `app/api/crm-lead` MUST be
fire-and-forget: its outcome MUST NOT affect whether, when, or how
WhatsApp opens.

#### Scenario: WhatsApp opens without waiting for the CRM call

- GIVEN a visitor submits `ConsultationForm` with valid data
- WHEN the form's submit handler runs
- THEN `window.open()` for the WhatsApp URL is invoked without first
  awaiting a response from `app/api/crm-lead`
- AND the WhatsApp tab/window opens with no added perceptible delay

#### Scenario: A slow or unreachable CRM never delays WhatsApp

- GIVEN the Twenty instance is unreachable or responds slowly
- WHEN a visitor submits `ConsultationForm`
- THEN WhatsApp still opens immediately, exactly as if the CRM call did
  not exist

### Requirement: Environment-Gated No-Op

The Route Handler MUST no-op — returning a success response and creating
no Person — whenever `TWENTY_API_KEY` or `TWENTY_API_URL` is unset or
empty. This is the actual state of production until a Twenty instance is
deployed there.

#### Scenario: Missing environment variables produce a silent no-op

- GIVEN `TWENTY_API_KEY` or `TWENTY_API_URL` is unset
- WHEN `app/api/crm-lead` receives a request
- THEN it returns a success response
- AND it makes no outbound request to any Twenty instance
- AND it creates no Person record

### Requirement: Silent Server-Side Failure Handling

The Route Handler MUST catch every failure mode — network error, a
non-2xx response from Twenty, and a malformed or non-JSON response body —
and log it server-side only. The handler MUST NEVER surface an error to
the end user, and the client-side call MUST NEVER produce a visible
browser-console error suggesting something broke.

#### Scenario: Twenty is unreachable

- GIVEN Twenty's API URL refuses connections or times out
- WHEN `app/api/crm-lead` attempts to create a Person
- THEN the handler catches the network error and logs it server-side
- AND no error is surfaced to the client
- AND the visitor's WhatsApp flow is unaffected

#### Scenario: Twenty returns a non-2xx response

- GIVEN Twenty's Core REST API rejects the request (e.g. 401, 500)
- WHEN `app/api/crm-lead` processes the response
- THEN the handler logs the status and body server-side
- AND no error is surfaced to the client

#### Scenario: Twenty returns a malformed or non-JSON body

- GIVEN Twenty's response body is not valid JSON or lacks the expected
  shape
- WHEN `app/api/crm-lead` parses the response
- THEN the handler catches the parsing failure and logs it server-side
- AND no error is surfaced to the client

### Requirement: Person Creation With Standard and Custom Fields

WHEN `TWENTY_API_KEY` and `TWENTY_API_URL` are set and Twenty is
reachable, the Route Handler MUST create a Twenty Person record
populating: the standard Name field from the submission's `name`, the
standard City field from `city`, and four custom fields —
`servicioConsulta` from the selected service, `consultaMensaje` from the
question text, `lineaWhatsapp` from the selected WhatsApp line, and
`origenLead` set to the fixed value `"Sitio Web - Formulario de
Consulta"`.

#### Scenario: A complete submission creates a fully populated Person

- GIVEN `TWENTY_API_KEY` and `TWENTY_API_URL` are set and Twenty is
  reachable
- WHEN a visitor submits `ConsultationForm` with name, city, service,
  WhatsApp line, and a question
- THEN a Person is created in Twenty with Name and City set from the
  submission
- AND `servicioConsulta`, `consultaMensaje`, and `lineaWhatsapp` are set
  from the corresponding submitted values
- AND `origenLead` is set to `"Sitio Web - Formulario de Consulta"`
