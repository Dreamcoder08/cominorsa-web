// src/build/robots.ts
//
// T8: builds `robots.txt` at build time. Byte-for-byte equivalent to the
// live production output (verified 2026-09-22: `curl -s
// https://cominorsa.com/robots.txt`), replacing `app/robots.ts`'s
// per-request `MetadataRoute.Robots` generation with a static file.
import { SITE_URL } from "./site-config";

export function buildRobotsTxt(): string {
  return (
    [
      "User-Agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /_next/",
      "",
      `Host: ${SITE_URL}`,
      `Sitemap: ${SITE_URL}/sitemap.xml`,
    ].join("\n") + "\n"
  );
}
