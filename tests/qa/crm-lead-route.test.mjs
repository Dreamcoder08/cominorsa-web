import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../../app/api/crm-lead/route.ts";

const VALID_PAYLOAD = {
  name: "Ana Torres",
  city: "Piura",
  service: "REINFO",
  question: "Necesito ayuda con mi expediente REINFO.",
  whatsappLine: "51910728575",
};

function makeRequest(body) {
  return new Request("http://localhost/api/crm-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeStreamingRequest(chunks) {
  const encoder = new TextEncoder();
  return new Request("http://localhost/api/crm-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    duplex: "half",
  });
}

/**
 * Sets/unsets TWENTY_API_KEY and TWENTY_API_URL for the duration of a
 * test and restores the previous values (or absence) afterward, so tests
 * never leak env state into each other or the real process env.
 */
async function withEnv(env, fn) {
  const keys = ["TWENTY_API_KEY", "TWENTY_API_URL", "RESEND_API_KEY"];
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

  for (const key of keys) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }

  try {
    await fn();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("env-gate: missing TWENTY_API_KEY/TWENTY_API_URL returns 200 and never calls fetch", async (t) => {
  const fetchSpy = t.mock.fn(() => {
    throw new Error("fetch must not be called when env vars are unset");
  });
  t.mock.method(globalThis, "fetch", fetchSpy);

  await withEnv({}, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.deepEqual(json, { ok: true });
  });

  assert.equal(fetchSpy.mock.calls.length, 0);
});

test("env-gate: empty-string env vars also no-op (never calls fetch)", async (t) => {
  const fetchSpy = t.mock.fn(() => {
    throw new Error("fetch must not be called when env vars are empty");
  });
  t.mock.method(globalThis, "fetch", fetchSpy);

  await withEnv({ TWENTY_API_KEY: "", TWENTY_API_URL: "" }, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD));
    assert.equal(response.status, 200);
  });

  assert.equal(fetchSpy.mock.calls.length, 0);
});

test("happy path: posts to /rest/people with Bearer auth, split name, city, all 5 custom fields, and returns 200", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes("filter=")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { people: [] } }),
      };
    }
    return { ok: true, status: 200, text: async () => "" };
  });

  await withEnv(
    { TWENTY_API_KEY: "secret-key", TWENTY_API_URL: "http://localhost:3000" },
    async () => {
      const response = await POST(makeRequest(VALID_PAYLOAD));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.deepEqual(json, { ok: true });
    },
  );

  assert.equal(calls.length, 2, "expected the duplicate-check GET and the create POST");
  const createCall = calls.find(({ options }) => options?.method === "POST");
  assert.ok(createCall, "expected a POST call creating the Person");
  const { url, options } = createCall;
  assert.equal(url, "http://localhost:3000/rest/people");
  assert.equal(options.method, "POST");
  assert.equal(options.headers.Authorization, "Bearer secret-key");

  const body = JSON.parse(options.body);
  assert.deepEqual(body.name, { firstName: "Ana", lastName: "Torres" });
  assert.equal(body.ciudadConsulta, "Piura");
  assert.equal(body.servicioConsulta, "REINFO");
  assert.equal(body.consultaMensaje, VALID_PAYLOAD.question);
  assert.equal(body.lineaWhatsapp, "PRINCIPAL_910728575");
  assert.equal(body.origenLead, "Sitio Web - Formulario de Consulta");
});

test("happy path: whatsappLine ending in the secondary number maps to SECUNDARIA_987817100", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes("filter=")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { people: [] } }),
      };
    }
    return { ok: true, status: 200, text: async () => "" };
  });

  await withEnv(
    { TWENTY_API_KEY: "secret-key", TWENTY_API_URL: "http://localhost:3000" },
    async () => {
      await POST(
        makeRequest({ ...VALID_PAYLOAD, whatsappLine: "51987817100" }),
      );
    },
  );

  const createCall = calls.find(({ options }) => options?.method === "POST");
  const body = JSON.parse(createCall.options.body);
  assert.equal(body.lineaWhatsapp, "SECUNDARIA_987817100");
});

test("Twenty non-2xx response: still returns 200, logs via console.error, never throws", async (t) => {
  const errorMessages = [];
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(globalThis, "fetch", async () => ({
    ok: false,
    status: 500,
    text: async () => "internal error",
  }));

  await withEnv(
    { TWENTY_API_KEY: "secret-key", TWENTY_API_URL: "http://localhost:3000" },
    async () => {
      const response = await POST(makeRequest(VALID_PAYLOAD));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.deepEqual(json, { ok: true });
    },
  );

  assert.ok(
    errorMessages.some(
      (m) => m.includes("500") && m.includes("internal error"),
    ),
    "expected the non-2xx status and body to be logged",
  );
});

test("Twenty network error: still returns 200, logs via console.error, never throws", async (t) => {
  const errorMessages = [];
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("ECONNREFUSED");
  });

  await withEnv(
    { TWENTY_API_KEY: "secret-key", TWENTY_API_URL: "http://localhost:3000" },
    async () => {
      const response = await POST(makeRequest(VALID_PAYLOAD));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.deepEqual(json, { ok: true });
    },
  );

  assert.ok(
    errorMessages.some(
      (m) => m.includes("unreachable") && m.includes("ECONNREFUSED"),
    ),
    "expected an 'unreachable' error message naming the underlying cause",
  );
});

test("duplicate detection: a matching recent Person skips the create POST but still returns 200", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes("filter=")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { people: [{ id: "existing-person" }] } }),
      };
    }
    throw new Error("the create POST must not be called for a duplicate");
  });

  await withEnv(
    { TWENTY_API_KEY: "secret-key", TWENTY_API_URL: "http://localhost:3000" },
    async () => {
      const response = await POST(makeRequest(VALID_PAYLOAD));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
    },
  );

  assert.equal(calls.length, 1, "only the duplicate-check GET should fire");
  assert.ok(String(calls[0].url).includes("filter="));
});

test("duplicate detection: a broken duplicate check fails open and still creates the Person", async (t) => {
  t.mock.method(console, "log", () => {});
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes("filter=")) {
      throw new Error("Twenty filter query unreachable");
    }
    return { ok: true, status: 200, text: async () => "" };
  });

  await withEnv(
    { TWENTY_API_KEY: "secret-key", TWENTY_API_URL: "http://localhost:3000" },
    async () => {
      const response = await POST(makeRequest(VALID_PAYLOAD));
      assert.equal(response.status, 200);
    },
  );

  const createCall = calls.find(({ options }) => options?.method === "POST");
  assert.ok(
    createCall,
    "the create POST must still fire when the duplicate check itself fails",
  );
});

test("email env-gate: missing RESEND_API_KEY never calls Resend, even with Twenty configured", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    if (String(url).includes("filter=")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { people: [] } }),
      };
    }
    return { ok: true, status: 200, text: async () => "" };
  });

  await withEnv(
    { TWENTY_API_KEY: "secret-key", TWENTY_API_URL: "http://localhost:3000" },
    async () => {
      await POST(makeRequest(VALID_PAYLOAD));
    },
  );

  assert.equal(calls.length, 2, "duplicate-check GET and create POST, nothing else");
  assert.ok(calls.includes("http://localhost:3000/rest/people"));
  assert.ok(calls.every((url) => !url.includes("resend.com")));
});

test("email happy path: posts to Resend with Bearer auth, correct recipient, escaped HTML body", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, text: async () => "" };
  });

  await withEnv({ RESEND_API_KEY: "resend-secret" }, async () => {
    const response = await POST(
      makeRequest({
        ...VALID_PAYLOAD,
        name: "<script>alert(1)</script>",
        question: 'Consulta con "comillas" & símbolos',
      }),
    );
    assert.equal(response.status, 200);
  });

  assert.equal(calls.length, 1);
  const { url, options } = calls[0];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(options.method, "POST");
  assert.equal(options.headers.Authorization, "Bearer resend-secret");

  const body = JSON.parse(options.body);
  assert.equal(body.to.length, 1);
  assert.match(body.to[0], /@/);
  assert.ok(
    !body.html.includes("<script>"),
    "raw <script> tag must never appear in the email body",
  );
  assert.ok(
    body.html.includes("&lt;script&gt;"),
    "the name must be HTML-escaped, not stripped",
  );
  assert.ok(body.html.includes("&quot;comillas&quot;"));
  assert.ok(body.html.includes("&amp;"));
});

test("Resend non-2xx response: still returns 200, logs via console.error, never throws", async (t) => {
  const errorMessages = [];
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(globalThis, "fetch", async () => ({
    ok: false,
    status: 422,
    text: async () => "invalid `from` address",
  }));

  await withEnv({ RESEND_API_KEY: "resend-secret" }, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD));
    assert.equal(response.status, 200);
  });

  assert.ok(
    errorMessages.some(
      (m) => m.includes("422") && m.includes("invalid `from` address"),
    ),
    "expected the non-2xx status and body to be logged",
  );
});

test("Resend network error: still returns 200, logs via console.error, never throws", async (t) => {
  const errorMessages = [];
  t.mock.method(console, "error", (msg) => errorMessages.push(msg));
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("ECONNREFUSED");
  });

  await withEnv({ RESEND_API_KEY: "resend-secret" }, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD));
    assert.equal(response.status, 200);
  });

  assert.ok(
    errorMessages.some(
      (m) => m.includes("Resend") && m.includes("unreachable"),
    ),
    "expected an 'unreachable' error message naming the Resend integration",
  );
});

test("independence: Twenty failing does not block or skip the email notification", async (t) => {
  const calls = [];
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    if (url.includes("rest/people")) {
      throw new Error("Twenty is down");
    }
    return { ok: true, status: 200, text: async () => "" };
  });

  await withEnv(
    {
      TWENTY_API_KEY: "secret-key",
      TWENTY_API_URL: "http://localhost:3000",
      RESEND_API_KEY: "resend-secret",
    },
    async () => {
      const response = await POST(makeRequest(VALID_PAYLOAD));
      assert.equal(response.status, 200);
    },
  );

  assert.ok(
    calls.some((url) => url.includes("rest/people")),
    "the Twenty duplicate-check and/or create call must have been attempted",
  );
  assert.ok(
    calls.includes("https://api.resend.com/emails"),
    "the email notification must fire independently of Twenty's failure",
  );
});

test("independence: Resend failing does not block or skip the Twenty Person creation", async (t) => {
  const calls = [];
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    if (url.includes("resend.com")) {
      throw new Error("Resend is down");
    }
    if (String(url).includes("filter=")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { people: [] } }),
      };
    }
    return { ok: true, status: 200, text: async () => "" };
  });

  await withEnv(
    {
      TWENTY_API_KEY: "secret-key",
      TWENTY_API_URL: "http://localhost:3000",
      RESEND_API_KEY: "resend-secret",
    },
    async () => {
      const response = await POST(makeRequest(VALID_PAYLOAD));
      assert.equal(response.status, 200);
    },
  );

  const twentyCall = calls.find(
    (c) => c.url.includes("rest/people") && c.options?.method === "POST",
  );
  assert.ok(twentyCall, "Twenty must still have been called");
  assert.equal(JSON.parse(twentyCall.options.body).name.firstName, "Ana");
});

test("invalid payload fields are rejected before either integration fetches", async (t) => {
  const fetchSpy = t.mock.fn(() => {
    throw new Error("fetch must not be called for invalid payloads");
  });
  t.mock.method(globalThis, "fetch", fetchSpy);
  t.mock.method(console, "error", () => {});

  const invalidPayloads = [
    { ...VALID_PAYLOAD, service: "Unlisted service" },
    { ...VALID_PAYLOAD, whatsappLine: "51999999999" },
    { ...VALID_PAYLOAD, name: "A".repeat(121) },
    { ...VALID_PAYLOAD, question: 42 },
  ];

  await withEnv(
    {
      TWENTY_API_KEY: "secret-key",
      TWENTY_API_URL: "http://localhost:3000",
      RESEND_API_KEY: "resend-secret",
    },
    async () => {
      for (const payload of invalidPayloads) {
        const response = await POST(makeRequest(payload));
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
      }
    },
  );

  assert.equal(fetchSpy.mock.calls.length, 0);
});

test("streamed request bodies are byte-bounded without relying on Content-Length", async (t) => {
  const fetchSpy = t.mock.fn(() => {
    throw new Error("fetch must not be called for oversized request bodies");
  });
  t.mock.method(globalThis, "fetch", fetchSpy);
  t.mock.method(console, "error", () => {});

  await withEnv(
    {
      TWENTY_API_KEY: "secret-key",
      TWENTY_API_URL: "http://localhost:3000",
      RESEND_API_KEY: "resend-secret",
    },
    async () => {
      const response = await POST(
        makeStreamingRequest([
          '{"name":"Ana","padding":"',
          "x".repeat(20_000),
          '"}',
        ]),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
    },
  );

  assert.equal(fetchSpy.mock.calls.length, 0);
});

test("malformed JSON body: returns 200, no throw, no fetch call", async (t) => {
  const fetchSpy = t.mock.fn(() => {
    throw new Error("fetch must not be called on a malformed body");
  });
  t.mock.method(globalThis, "fetch", fetchSpy);
  t.mock.method(console, "error", () => {});

  await withEnv(
    { TWENTY_API_KEY: "secret-key", TWENTY_API_URL: "http://localhost:3000" },
    async () => {
      const response = await POST(makeRequest("not valid json"));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.deepEqual(json, { ok: true });
    },
  );

  assert.equal(fetchSpy.mock.calls.length, 0);
});
