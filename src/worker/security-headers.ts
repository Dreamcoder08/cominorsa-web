// src/worker/security-headers.ts
//
// T9: wraps a Worker-script Response with the same security header set
// `../build/headers.ts` writes to `dist-static/_headers` (both consume
// `../build/security-policy.ts`, so they can never drift).
//
// Why this exists (documented per this task's own instruction):
// Cloudflare's `_headers` file only applies to responses served
// directly from the static-assets binding — it is NEVER applied to a
// response the Worker script itself returns (developers.cloudflare.com/
// workers/static-assets/headers/: "_headers ... is not applied to
// responses returned by your Worker code"). `index.ts`'s 2 API routes
// (POST /api/crm-lead, GET /api/next-business-day) ARE Worker-script
// responses — `run_worker_first` routes them there specifically — so
// without this wrapper they would ship with zero security headers.
// Today, before this migration, `proxy.ts`'s middleware matcher already
// covers `/api/*` and decorates every response including the API ones;
// this keeps that same parity explicit and unit-testable rather than
// silently dropped.
import { buildCsp, SECURITY_HEADERS } from "../build/security-policy";

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", buildCsp());
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
