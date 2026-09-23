// src/build/robots.test.ts
//
// T8: `buildRobotsTxt` matches the live production robots.txt
// byte-for-byte (verified 2026-09-22: `curl -s
// https://cominorsa.com/robots.txt`). `/_next/` stays disallowed for now
// even though this static build has no such path — kept for exact
// parity with today's production output per this task's own acceptance
// bar; T11 (the cutover, once Next.js is actually gone) is the right
// place to drop it as dead weight.

import { describe, expect, test } from "bun:test";
import { buildRobotsTxt } from "./robots";

describe("buildRobotsTxt", () => {
  test("matches the live production robots.txt byte-for-byte", () => {
    expect(buildRobotsTxt()).toBe(
      [
        "User-Agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /_next/",
        "",
        "Host: https://cominorsa.com",
        "Sitemap: https://cominorsa.com/sitemap.xml",
      ].join("\n") + "\n",
    );
  });
});
