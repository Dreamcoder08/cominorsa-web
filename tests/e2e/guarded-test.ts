import {
  expect,
  test as base,
  type BrowserContext,
  type Request,
} from "@playwright/test";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const payloadsByContext = new WeakMap<BrowserContext, unknown[]>();

export function assertLoopbackBaseURL(baseURL: string | undefined): void {
  if (!baseURL) throw new Error("Playwright baseURL is required");

  const url = new URL(baseURL);
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(
      `E2E baseURL must use a loopback host, received ${url.origin}`,
    );
  }
}

function parsePayload(request: Request): unknown {
  const body = request.postData();
  if (body === null) return null;

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

interface GuardedFixtures {
  crmLeadPayloads: unknown[];
}

export const test = base.extend<GuardedFixtures>({
  context: async ({ browser, contextOptions, baseURL }, provide) => {
    assertLoopbackBaseURL(baseURL);

    const context = await browser.newContext({
      ...contextOptions,
      baseURL,
      serviceWorkers: "block",
    });
    const payloads: unknown[] = [];
    payloadsByContext.set(context, payloads);

    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const isLoopback = LOOPBACK_HOSTS.has(url.hostname);

      if (isLoopback && url.pathname === "/api/crm-lead") {
        if (request.method() !== "POST") return route.abort("blockedbyclient");
        payloads.push(parsePayload(request));
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      }

      if (!isLoopback || MUTATION_METHODS.has(request.method())) {
        return route.abort("blockedbyclient");
      }

      return route.continue();
    });

    await provide(context);
    await context.close();
  },

  crmLeadPayloads: async ({ context }, provide) => {
    const payloads = payloadsByContext.get(context);
    if (!payloads) throw new Error("Guarded browser context was not installed");
    await provide(payloads);
  },
});

export { expect };
export type { Page } from "@playwright/test";
