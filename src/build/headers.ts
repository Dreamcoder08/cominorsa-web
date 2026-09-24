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
import { buildCsp, type CspOptions, SECURITY_HEADERS } from "./security-policy";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

// P6 (audit P2-12): images served under fixed, non-hashed names — the
// OG image, the header/footer logo and the favicons. They used to fall
// through to Cloudflare's default (revalidate every time); a one-day
// public cache saves the round trips while a replaced file still
// propagates within a day. Never `immutable`: the names don't change
// when the bytes do. HTML keeps no Cache-Control override (always
// revalidated). Listed explicitly rather than by extension so a new
// file never inherits a cache policy by accident.
const IMAGE_CACHE = "public, max-age=86400";
export const CACHED_IMAGE_PATHS: readonly string[] = [
  "/og.jpg",
  "/logo-44.webp",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
];

/** P11: `cspOptions.styleHashes` carries the inlined stylesheet's hash. */
export function buildHeadersFile(cspOptions: CspOptions = {}): string {
  const securityLines = [
    `Content-Security-Policy: ${buildCsp(cspOptions)}`,
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
      // P6: font files are content-hashed by the build (build.ts,
      // buildFonts), so immutable is safe here too.
      "/fonts/*",
      `  Cache-Control: ${IMMUTABLE_CACHE}`,
      ...CACHED_IMAGE_PATHS.flatMap((path) => ["", path, `  Cache-Control: ${IMAGE_CACHE}`]),
    ].join("\n") + "\n"
  );
}
