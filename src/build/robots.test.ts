// src/build/robots.test.ts
//
// T8 shipped `buildRobotsTxt` as a byte-for-byte match of the live
// production robots.txt (verified 2026-09-22: `curl -s
// https://cominorsa.com/robots.txt`), including a `Disallow: /_next/`
// line kept only for parity with the still-live Next.js site at the
// time. T11 (this cutover, Next.js actually gone) drops that line as
// dead weight — this build has no `/_next/` path at all (see
// robots.ts's module comment) — otherwise matching production exactly.

import { describe, expect, test } from "bun:test";
import { buildRobotsTxt } from "./robots";

describe("buildRobotsTxt", () => {
  test("matches production, minus the now-dead-weight /_next/ disallow rule", () => {
    expect(buildRobotsTxt()).toBe(
      [
        "User-Agent: *",
        "Allow: /",
        "Disallow: /api/",
        "",
        "Host: https://cominorsa.com",
        "Sitemap: https://cominorsa.com/sitemap.xml",
      ].join("\n") + "\n",
    );
  });

  test("never disallows /_next/ — no such path exists in the static build", () => {
    expect(buildRobotsTxt()).not.toContain("/_next/");
  });
});
