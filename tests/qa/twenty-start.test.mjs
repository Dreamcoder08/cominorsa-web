import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEnvText,
  runStartup,
  validateMandatoryConfig,
} from "../../docker/twenty/scripts/start.mjs";

const VALID_ENV = `
PG_DATABASE_PASSWORD=local-db-secret
ENCRYPTION_KEY="local-encryption-secret"
SERVER_URL=http://localhost:3000
`;

function createHarness(overrides = {}) {
  const commands = [];
  const requests = [];
  const logs = [];
  const errors = [];
  let healthCall = 0;

  const dependencies = {
    env: {},
    readEnvFile: async () => VALID_ENV,
    runCommand: async (command, args, options) => {
      commands.push({ command, args, options });
      return { stdout: "", stderr: "" };
    },
    fetchHealth: async (url, options) => {
      requests.push({ url, options });
      healthCall += 1;
      return { ok: healthCall >= 2, status: healthCall >= 2 ? 200 : 503 };
    },
    sleep: async () => {},
    setIntervalFn: () => ({ unref() {} }),
    clearIntervalFn: () => {},
    log: (message) => logs.push(message),
    error: (message) => errors.push(message),
    healthAttempts: 3,
    healthIntervalMs: 1,
    healthRequestTimeoutMs: 50,
    ...overrides,
  };

  return { dependencies, commands, requests, logs, errors };
}

test("parseEnvText parses comments and quoted values without evaluating shell syntax", () => {
  const parsed = parseEnvText(`
# local configuration
PG_DATABASE_PASSWORD='db-$literal'
ENCRYPTION_KEY="encryption-literal"
SERVER_URL=http://localhost:3000
`);

  assert.deepEqual(parsed, {
    PG_DATABASE_PASSWORD: "db-$literal",
    ENCRYPTION_KEY: "encryption-literal",
    SERVER_URL: "http://localhost:3000",
  });
});

test("parseEnvText fails closed on malformed configuration", () => {
  assert.throws(
    () => parseEnvText("PG_DATABASE_PASSWORD=ok\nthis is not an assignment"),
    /line 2/i,
  );
  assert.throws(() => parseEnvText('ENCRYPTION_KEY="unterminated'), /line 1/i);
});

test("mandatory secrets reject missing, empty, and placeholder values without echoing them", () => {
  assert.throws(
    () => validateMandatoryConfig({ ENCRYPTION_KEY: "real-key" }),
    /PG_DATABASE_PASSWORD/,
  );
  assert.throws(
    () =>
      validateMandatoryConfig({
        PG_DATABASE_PASSWORD: "change-me",
        ENCRYPTION_KEY: "real-key",
      }),
    /placeholder.+PG_DATABASE_PASSWORD/i,
  );
  assert.throws(
    () =>
      validateMandatoryConfig({
        PG_DATABASE_PASSWORD: "real-password",
        ENCRYPTION_KEY: "<replace-with-random-value>",
      }),
    /placeholder.+ENCRYPTION_KEY/i,
  );
});

test("startup uses absolute Compose paths, bounded commands, and no shell", async () => {
  const harness = createHarness();

  const result = await runStartup(harness.dependencies);

  assert.equal(result, true);
  assert.deepEqual(
    harness.commands.slice(0, 3).map(({ command, args }) => [command, ...args]),
    [
      ["docker", "--version"],
      ["docker", "compose", "version"],
      ["docker", "info", "--format", "{{.ServerVersion}}"],
    ],
  );
  const configCall = harness.commands[3];
  const upCall = harness.commands[4];
  assert.deepEqual(configCall.args.slice(-2), ["config", "--quiet"]);
  assert.deepEqual(upCall.args.slice(-2), ["up", "-d"]);
  for (const call of [configCall, upCall]) {
    assert.equal(call.command, "docker");
    assert.match(call.args[2], /docker[\\/]twenty$/);
    assert.match(call.args[4], /docker[\\/]twenty[\\/]docker-compose\.yml$/);
  }
  for (const call of harness.commands) {
    assert.equal(call.options.shell, false);
    assert.ok(call.options.timeoutMs > 0);
    assert.match(call.options.cwd, /docker[\\/]twenty$/);
  }
  assert.deepEqual(
    harness.requests.map(({ url }) => url),
    ["http://localhost:3000/healthz", "http://localhost:3000/healthz"],
  );
});

test("startup reports stages in order and cleans the Compose heartbeat after success", async () => {
  const timerHandles = [];
  const clearedHandles = [];
  let currentTime = 0;
  const harness = createHarness({
    now: () => currentTime,
    setIntervalFn: (callback, milliseconds) => {
      const handle = { callback, milliseconds, unrefCalled: false };
      handle.unref = () => {
        handle.unrefCalled = true;
      };
      timerHandles.push(handle);
      return handle;
    },
    clearIntervalFn: (handle) => clearedHandles.push(handle),
    runCommand: async (command, args, options) => {
      harness.commands.push({ command, args, options });
      if (args.includes("up")) {
        currentTime = 30_000;
        timerHandles[0].callback();
      }
      return { stdout: "hidden stdout", stderr: "hidden stderr" };
    },
  });

  assert.equal(await runStartup(harness.dependencies), true);
  assert.deepEqual(harness.logs, [
    "Twenty startup: validating configuration.",
    "Twenty startup: checking Docker CLI.",
    "Twenty startup: checking Docker Compose.",
    "Twenty startup: checking Docker daemon.",
    "Twenty startup: validating Compose configuration.",
    "Twenty startup: starting containers.",
    "Twenty startup: containers are still starting (30s elapsed).",
    "Twenty startup: waiting for the health check.",
    "Twenty is healthy at http://localhost:3000/healthz",
  ]);
  assert.equal(timerHandles.length, 1);
  assert.equal(timerHandles[0].milliseconds, 30_000);
  assert.equal(timerHandles[0].unrefCalled, true);
  assert.deepEqual(clearedHandles, timerHandles);
  assert.doesNotMatch(harness.logs.join("\n"), /hidden stdout|hidden stderr/);
});

test("Compose heartbeat is cleaned when container startup fails", async () => {
  const timerHandle = { unref() {} };
  const clearedHandles = [];
  const harness = createHarness({
    setIntervalFn: () => timerHandle,
    clearIntervalFn: (handle) => clearedHandles.push(handle),
    runCommand: async (command, args, options) => {
      harness.commands.push({ command, args, options });
      if (args.includes("up")) throw new Error("private Docker failure detail");
      return { stdout: "", stderr: "" };
    },
  });

  assert.equal(await runStartup(harness.dependencies), false);
  assert.deepEqual(clearedHandles, [timerHandle]);
  assert.match(harness.errors.join("\n"), /containers failed to start/i);
  assert.doesNotMatch(
    harness.errors.join("\n"),
    /private Docker failure detail/,
  );
});

test("health polling reports bounded progress rather than every attempt", async () => {
  const harness = createHarness({
    healthAttempts: 11,
    healthIntervalMs: 2000,
    fetchHealth: async (url, options) => {
      harness.requests.push({ url, options });
      return { ok: false, status: 503 };
    },
  });

  assert.equal(await runStartup(harness.dependencies), false);
  assert.deepEqual(
    harness.logs.filter((message) => message.includes("still waiting")),
    ["Twenty startup: still waiting for the health check (20s elapsed)."],
  );
});

test("process environment overrides parsed configuration without sourcing a file", async () => {
  const harness = createHarness({
    env: {
      PG_DATABASE_PASSWORD: "process-db-secret",
      ENCRYPTION_KEY: "process-encryption-secret",
    },
    readEnvFile: async () => "malformed line that must not be read",
    fetchHealth: async () => ({ ok: true, status: 200 }),
  });

  assert.equal(await runStartup(harness.dependencies), true);
});

test("invalid configuration stops before any Docker or network operation", async () => {
  const harness = createHarness({
    readEnvFile: async () =>
      "PG_DATABASE_PASSWORD=change-me\nENCRYPTION_KEY=real-key",
  });

  assert.equal(await runStartup(harness.dependencies), false);
  assert.equal(harness.commands.length, 0);
  assert.equal(harness.requests.length, 0);
  assert.match(harness.errors.join("\n"), /PG_DATABASE_PASSWORD/);
  assert.doesNotMatch(harness.errors.join("\n"), /change-me/);
});

test("Docker daemon failure stops before Compose validation or startup", async () => {
  const harness = createHarness({
    runCommand: async (command, args, options) => {
      harness.commands.push({ command, args, options });
      if (args[0] === "info") throw new Error("daemon unavailable");
      return { stdout: "", stderr: "" };
    },
  });

  assert.equal(await runStartup(harness.dependencies), false);
  assert.equal(harness.commands.length, 3);
  assert.equal(harness.requests.length, 0);
  assert.match(harness.errors.join("\n"), /Docker daemon/i);
});

test("Compose validation failure stops before up", async () => {
  const harness = createHarness({
    runCommand: async (command, args, options) => {
      harness.commands.push({ command, args, options });
      if (args.includes("config")) throw new Error("invalid compose config");
      return { stdout: "", stderr: "" };
    },
  });

  assert.equal(await runStartup(harness.dependencies), false);
  assert.equal(
    harness.commands.some(({ args }) => args.includes("up")),
    false,
  );
  assert.equal(harness.requests.length, 0);
  assert.match(harness.errors.join("\n"), /Compose configuration/i);
});

test("health polling times out after the configured bounded attempts", async () => {
  const harness = createHarness({
    healthAttempts: 2,
    fetchHealth: async (url, options) => {
      harness.requests.push({ url, options });
      throw new Error("connection refused");
    },
  });

  assert.equal(await runStartup(harness.dependencies), false);
  assert.equal(harness.requests.length, 2);
  assert.match(harness.errors.join("\n"), /did not become healthy/i);
  assert.doesNotMatch(harness.errors.join("\n"), /connection refused/i);
});
