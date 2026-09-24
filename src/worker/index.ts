// src/worker/index.ts
//
// Cloudflare Worker entry point for the static site
// (`cominorsa-web-static`, `wrangler.static.jsonc` — a DISTINCT Worker
// name/config from production's `cominorsa-web` /
// `dist/server/wrangler.json`, so nothing here can accidentally deploy
// over production; the cutover to this Worker happens in T11).
//
// `wrangler.static.jsonc`'s `assets.run_worker_first: ["/api/*"]` means
// this `fetch` handler ONLY ever receives `/api/*` requests — every
// other request (every page, sitemap.xml, robots.txt,
// manifest.webmanifest, hashed assets, fonts, 404) is served directly
// from the `dist-static/` Static Assets binding with zero Worker
// invocation, per Cloudflare's own routing docs
// (developers.cloudflare.com/workers/static-assets/binding/#run_worker_first).
//
// Both API handlers below are reused verbatim from `app/`, not copied:
// `app/api/crm-lead/route.ts` and `app/api/next-business-day/route.ts`
// are already library-free (zero imports, plain Request/Response —
// confirmed by reading their source, and by
// `tests/qa/crm-lead-route.test.mjs` already importing
// `app/api/crm-lead/route.ts` directly with no Next.js runtime
// involved), so importing them here drags in nothing Next-specific.
// Same env var names as today (`TWENTY_API_KEY`, `TWENTY_API_URL`,
// `RESEND_API_KEY`), read via `process.env` — available at runtime via
// this config's `nodejs_compat` compatibility flag, same as production.
import { POST as crmLeadPost } from "../../app/api/crm-lead/route";
import { GET as nextBusinessDayGet } from "../../app/api/next-business-day/route";
import { applySecurityHeaders } from "./security-headers";

// Narrower than the ambient Cloudflare `Fetcher` type (which also
// requires a `connect()` TCP-socket method this Worker never uses) —
// only the one method actually called below, and simpler to satisfy
// with a plain mock in tests.
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/crm-lead" && request.method === "POST") {
      return applySecurityHeaders(await crmLeadPost(request));
    }

    if (url.pathname === "/api/next-business-day" && request.method === "GET") {
      return applySecurityHeaders(await nextBusinessDayGet());
    }

    if (url.pathname.startsWith("/api/")) {
      return applySecurityHeaders(new Response("Not Found", { status: 404 }));
    }

    // Defensive only: `run_worker_first` should never route a
    // non-`/api/*` request here. Falling back to the assets binding
    // (rather than a hardcoded 404) means a future routing-config
    // change degrades gracefully instead of breaking every page.
    return env.ASSETS.fetch(request);
  },
};

export default worker;
