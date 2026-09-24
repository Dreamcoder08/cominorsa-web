// src/build/robots.ts
//
// T8 built `robots.txt` at build time as a byte-for-byte equivalent of
// the live production output (verified 2026-09-22: `curl -s
// https://cominorsa.com/robots.txt`), including a `Disallow: /_next/`
// line kept only for parity with the Next.js site that was still live
// at the time. T11 (the cutover) drops that line: this build has no
// `/_next/` path at all (its own hashed assets live under `/assets/*`
// and `/fonts/*`, see build.ts), so keeping it would be dead weight.
import { SITE_URL } from "./site-config";

export function buildRobotsTxt(): string {
  return (
    [
      "User-Agent: *",
      "Allow: /",
      "Disallow: /api/",
      "",
      `Host: ${SITE_URL}`,
      `Sitemap: ${SITE_URL}/sitemap.xml`,
    ].join("\n") + "\n"
  );
}
