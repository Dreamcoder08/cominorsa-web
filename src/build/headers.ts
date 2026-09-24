// src/build/headers.ts
//
// T10: generates `dist-static/_headers`. See headers.test.ts's module
// comment for why this file, unlike today's `public/_headers`, actually
// governs page responses once served from Cloudflare Static Assets
// (T9/T11) — every response NOT routed to the Worker by
// `run_worker_first` (i.e. everything except `/api/*`) comes straight
// from the assets binding, which is exactly what `_headers` applies to.
//
// IMPORTANT (documented per this task's own instruction): `_headers`
// does NOT apply to a response the Worker script itself returns. The
// two API routes ARE Worker-script responses (`run_worker_first:
// ["/api/*"]`), so this file's rules never reach them — see
// `../worker/security-headers.ts`, which applies the exact same
// `SECURITY_HEADERS`/`buildCsp()` policy directly to those responses so
// they keep the same header parity `proxy.ts` gives every route today
// (its matcher already includes `/api/*`).
import { buildCsp, SECURITY_HEADERS } from "./security-policy";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

export function buildHeadersFile(): string {
  const securityLines = [
    `Content-Security-Policy: ${buildCsp()}`,
    ...Object.entries(SECURITY_HEADERS).map(([name, value]) => `${name}: ${value}`),
  ];

  return (
    [
      "/*",
      ...securityLines.map((line) => `  ${line}`),
      "",
      "/assets/*",
      `  Cache-Control: ${IMMUTABLE_CACHE}`,
      "",
      "/fonts/*",
      `  Cache-Control: ${IMMUTABLE_CACHE}`,
    ].join("\n") + "\n"
  );
}
