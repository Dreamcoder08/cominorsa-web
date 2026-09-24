// src/worker/security-headers.test.ts
//
// T9/T10: Cloudflare's `_headers` file is never applied to a response
// the Worker script itself returns (only to responses served directly
// from the static-assets binding) — confirmed against Cloudflare's own
// docs (developers.cloudflare.com/workers/static-assets/headers/,
// "_headers ... is not applied to responses returned by your Worker
// code"). The 2 API routes ARE Worker-script responses, so without this
// helper they would ship with zero security headers once `dist-static/
// _headers` is the only other source of them — a real regression from
// today, where `proxy.ts`'s middleware matcher already includes
// `/api/*` and decorates every response, API included.
//
// applySecurityHeaders reuses the exact same policy `../build/headers.ts`
// writes to `_headers` (security-policy.ts), so the two can never drift.

import { describe, expect, test } from "bun:test";
import { buildCsp, SECURITY_HEADERS } from "../build/security-policy";
import { applySecurityHeaders } from "./security-headers";

describe("applySecurityHeaders", () => {
  test("adds the full CSP + security header set", () => {
    const wrapped = applySecurityHeaders(Response.json({ ok: true }));
    expect(wrapped.headers.get("Content-Security-Policy")).toBe(buildCsp());
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(wrapped.headers.get(name)).toBe(value);
    }
  });

  test("preserves the original status and body", async () => {
    const original = Response.json({ ok: true }, { status: 201 });
    const wrapped = applySecurityHeaders(original);
    expect(wrapped.status).toBe(201);
    const body = (await wrapped.json()) as { ok: boolean };
    expect(body).toEqual({ ok: true });
  });

  test("preserves existing headers not overridden by the policy", () => {
    const original = new Response("{}", {
      headers: { "Content-Type": "application/json", "X-Custom": "keep-me" },
    });
    const wrapped = applySecurityHeaders(original);
    expect(wrapped.headers.get("Content-Type")).toBe("application/json");
    expect(wrapped.headers.get("X-Custom")).toBe("keep-me");
  });
});
