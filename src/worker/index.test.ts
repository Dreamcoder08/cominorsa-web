// src/worker/index.test.ts
//
// T9: the Cloudflare Worker entry for the static site
// (`cominorsa-web-static`, see wrangler.static.jsonc). With
// `run_worker_first: ["/api/*"]`, this fetch handler only ever sees
// `/api/*` requests — everything else is served directly by Static
// Assets without invoking the Worker at all. It reuses the EXISTING,
// unmodified `app/api/crm-lead/route.ts` / `app/api/next-business-day/
// route.ts` handlers verbatim (both are already library-free — zero
// imports, plain Request/Response — confirmed by reading their source
// and by tests/qa/crm-lead-route.test.mjs already importing
// `app/api/crm-lead/route.ts` directly with no Next runtime involved),
// so the two integrations' behavior/contract is byte-identical to
// today, not re-implemented.
//
// The `env.ASSETS.fetch(request)` fallback below is defensive: with the
// configured `run_worker_first`, no non-`/api/*` request should ever
// reach this handler in production, but keeping a correct fallback
// means a future routing-config change degrades gracefully instead of
// silently 404ing everything.

import { describe, expect, test } from "bun:test";
import worker from "./index";

const VALID_CRM_LEAD_PAYLOAD = {
  name: "Ana Torres",
  city: "Piura",
  service: "REINFO",
  question: "Necesito ayuda con mi expediente REINFO.",
  whatsappLine: "51910728575",
};

function makeAssetsFetcher(): { fetch: (request: Request) => Promise<Response> } {
  return {
    fetch: async () => new Response("asset-fallback", { status: 200 }),
  };
}

describe("worker.fetch", () => {
  test("POST /api/crm-lead calls the existing handler and returns 200 {ok:true} with security headers", async () => {
    // No TWENTY_API_KEY/TWENTY_API_URL/RESEND_API_KEY set here (and none
    // are set in this sandbox) — the handler's own env gate makes both
    // integrations true no-ops; this only proves routing + header wrap.
    // Same-origin `Origin`, as a browser sends it (P4 origin guard).
    const request = new Request("http://localhost/api/crm-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: JSON.stringify(VALID_CRM_LEAD_PAYLOAD),
    });
    const env = { ASSETS: makeAssetsFetcher() };
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body).toEqual({ ok: true });
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  test("P4: a cross-origin POST /api/crm-lead is rejected with 403 and still carries security headers", async () => {
    const request = new Request("http://localhost/api/crm-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify(VALID_CRM_LEAD_PAYLOAD),
    });
    const originalError = console.error;
    console.error = () => {};
    try {
      const response = await worker.fetch(request, { ASSETS: makeAssetsFetcher() });
      expect(response.status).toBe(403);
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    } finally {
      console.error = originalError;
    }
  });

  test("GET /api/next-business-day calls the existing handler and returns its date shape with security headers", async () => {
    const request = new Request("http://localhost/api/next-business-day");
    const env = { ASSETS: makeAssetsFetcher() };
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { date: string };
    expect(typeof body.date).toBe("string");
    expect(Number.isNaN(Date.parse(body.date))).toBe(false);
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
  });

  test("an unknown /api/* path returns 404 with security headers, not the assets fallback", async () => {
    const request = new Request("http://localhost/api/does-not-exist");
    const env = { ASSETS: makeAssetsFetcher() };
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  test("the wrong method on a known /api/* path returns 404, not the assets fallback", async () => {
    const request = new Request("http://localhost/api/crm-lead", { method: "GET" });
    const env = { ASSETS: makeAssetsFetcher() };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(404);
  });

  test("a non-/api/ path falls through to env.ASSETS.fetch (defensive — run_worker_first should never actually route this here)", async () => {
    const request = new Request("http://localhost/seguridad-minera");
    const env = { ASSETS: makeAssetsFetcher() };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset-fallback");
  });
});
