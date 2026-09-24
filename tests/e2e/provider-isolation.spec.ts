import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { assertLoopbackBaseURL, expect, test } from "./guarded-test";

const TEST_LEAD = { name: "Isolation Test", service: "REINFO" };

let server: Server;
let serverURL: string;
const mutationRequests: string[] = [];

test.beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      mutationRequests.push(`${request.method} ${request.url}`);
    }

    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<!doctype html>
      <form id="lead-form"><button type="submit">Send lead</button></form>
      <script>
        document.querySelector('#lead-form').addEventListener('submit', (event) => {
          event.preventDefault();
          fetch('/api/crm-lead', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(${JSON.stringify(TEST_LEAD)})
          });
        });
      </script>`);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  serverURL = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test.beforeEach(() => {
  mutationRequests.length = 0;
});

test("captures CRM submission without forwarding it to the local server", async ({
  page,
  crmLeadPayloads,
}) => {
  await page.goto(serverURL);
  await page.getByRole("button", { name: "Send lead" }).click();

  await expect.poll(() => crmLeadPayloads).toEqual([TEST_LEAD]);
  expect(mutationRequests).toEqual([]);
});

test("rejects a production base URL before a request can be sent", () => {
  expect(() => assertLoopbackBaseURL("https://cominorsa.com.pe")).toThrow(
    /loopback/i,
  );
  expect(mutationRequests).toEqual([]);
});
