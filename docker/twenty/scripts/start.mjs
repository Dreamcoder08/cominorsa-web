import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const TWENTY_DIR = dirname(SCRIPT_DIR);
export const COMPOSE_FILE = join(TWENTY_DIR, "docker-compose.yml");
export const HEALTH_URL = "http://localhost:3000/healthz";

const COMMAND_TIMEOUT_MS = 30000n;
const START_TIMEOUT_MS = 300000n;
const COMMAND_MAX_BUFFER = 65536n;
const DEFAULT_HEALTH_ATTEMPTS = 60n;
const DEFAULT_HEALTH_INTERVAL_MS = 2000n;
const DEFAULT_HEALTH_REQUEST_TIMEOUT_MS = 2000n;
const START_HEARTBEAT_INTERVAL_MS = 30000n;
const HEALTH_PROGRESS_EVERY_ATTEMPTS = 10n;
const MANDATORY_SECRET_NAMES = ["PG_DATABASE_PASSWORD", "ENCRYPTION_KEY"];

function parseValue(rawValue, lineNumber) {
  const value = rawValue.trim();
  if (!value.startsWith("'") && !value.startsWith('"')) {
    return value.replace(/\s+#.*$/, "").trim();
  }

  const quote = value.at(Number(0n));
  const closingIndex = value.lastIndexOf(quote);
  if (
    closingIndex === Number(0n) ||
    value.slice(closingIndex + Number(1n)).trim() !== ""
  ) {
    throw new Error(`Malformed .env configuration at line ${lineNumber}.`);
  }
  return value.slice(Number(1n), closingIndex);
}

/** Parse dotenv assignments as data without shell evaluation or expansion. */
export function parseEnvText(text) {
  const values = {};
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=([\s\S]*)$/.exec(
      trimmed,
    );
    if (!match) {
      throw new Error(
        `Malformed .env configuration at line ${index + Number(1n)}.`,
      );
    }

    values[match.at(Number(1n))] = parseValue(
      match.at(Number(2n)),
      index + Number(1n),
    );
  }

  return values;
}

function isPlaceholder(value) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return (
    normalized === "" ||
    /^(?:change(?:me|this|with.*)?|replace(?:me|this|with.*)?|placeholder.*|example.*|todo.*|your.*|xxxx+)$/.test(
      normalized,
    ) ||
    /^<.*>$/.test(value.trim())
  );
}

export function validateMandatoryConfig(config) {
  for (const name of MANDATORY_SECRET_NAMES) {
    const value = config[name];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Missing mandatory configuration: ${name}.`);
    }
    if (isPlaceholder(value)) {
      throw new Error(`Placeholder value is not allowed for ${name}.`);
    }
  }
}

function defaultRunCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        encoding: "utf8",
        maxBuffer: Number(COMMAND_MAX_BUFFER),
        shell: false,
        timeout: Number(options.timeoutMs),
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

async function defaultReadEnvFile() {
  try {
    return await readFile(join(TWENTY_DIR, ".env"), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw new Error("Unable to read the local Twenty configuration file.");
  }
}

function commandOptions(timeoutMs) {
  return { cwd: TWENTY_DIR, shell: false, timeoutMs };
}

async function runRequiredCommand(runCommand, args, label, timeoutMs) {
  try {
    await runCommand("docker", args, commandOptions(timeoutMs));
  } catch {
    throw new Error(label);
  }
}

async function waitForHealth({
  fetchHealth,
  sleep,
  log,
  healthAttempts,
  healthIntervalMs,
  healthRequestTimeoutMs,
}) {
  const attemptLimit = BigInt(healthAttempts);
  for (let attempt = 1n; attempt <= attemptLimit; attempt += 1n) {
    try {
      const response = await fetchHealth(HEALTH_URL, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(Number(healthRequestTimeoutMs)),
      });
      if (response.ok) return true;
    } catch {
      // Refused connections are expected while the container is starting.
    }

    if (attempt < attemptLimit) {
      if (attempt % HEALTH_PROGRESS_EVERY_ATTEMPTS === 0n) {
        const elapsedSeconds = Number(
          (attempt * BigInt(healthIntervalMs)) / 1000n,
        );
        log(
          `Twenty startup: still waiting for the health check (${elapsedSeconds}s elapsed).`,
        );
      }
      await sleep(Number(healthIntervalMs));
    }
  }

  return false;
}

export async function runStartup(dependencies = {}) {
  const {
    env = process.env,
    readEnvFile = defaultReadEnvFile,
    runCommand = defaultRunCommand,
    fetchHealth = globalThis.fetch,
    sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    now = Date.now,
    log = console.log,
    error = console.error,
    healthAttempts = DEFAULT_HEALTH_ATTEMPTS,
    healthIntervalMs = DEFAULT_HEALTH_INTERVAL_MS,
    healthRequestTimeoutMs = DEFAULT_HEALTH_REQUEST_TIMEOUT_MS,
  } = dependencies;

  log("Twenty startup: validating configuration.");
  try {
    let fileConfig = {};
    const hasProcessSecrets = MANDATORY_SECRET_NAMES.every(
      (name) => typeof env[name] === "string" && env[name].trim() !== "",
    );
    if (!hasProcessSecrets) {
      fileConfig = parseEnvText(await readEnvFile());
    }
    validateMandatoryConfig({ ...fileConfig, ...env });
  } catch (cause) {
    error(`Twenty startup stopped: ${cause.message}`);
    return false;
  }

  try {
    log("Twenty startup: checking Docker CLI.");
    await runRequiredCommand(
      runCommand,
      ["--version"],
      "Docker CLI is unavailable.",
      COMMAND_TIMEOUT_MS,
    );
    log("Twenty startup: checking Docker Compose.");
    await runRequiredCommand(
      runCommand,
      ["compose", "version"],
      "Docker Compose v2 is unavailable.",
      COMMAND_TIMEOUT_MS,
    );
    log("Twenty startup: checking Docker daemon.");
    await runRequiredCommand(
      runCommand,
      ["info", "--format", "{{.ServerVersion}}"],
      "Docker daemon is unavailable or not accessible.",
      COMMAND_TIMEOUT_MS,
    );

    const composeArgs = [
      "compose",
      "--project-directory",
      TWENTY_DIR,
      "-f",
      COMPOSE_FILE,
    ];
    log("Twenty startup: validating Compose configuration.");
    await runRequiredCommand(
      runCommand,
      [...composeArgs, "config", "--quiet"],
      "Compose configuration validation failed.",
      COMMAND_TIMEOUT_MS,
    );

    log("Twenty startup: starting containers.");
    const startTime = now();
    const heartbeat = setIntervalFn(() => {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now() - startTime) / 1000),
      );
      log(
        `Twenty startup: containers are still starting (${elapsedSeconds}s elapsed).`,
      );
    }, Number(START_HEARTBEAT_INTERVAL_MS));
    heartbeat?.unref?.();
    try {
      await runRequiredCommand(
        runCommand,
        [...composeArgs, "up", "-d"],
        "Twenty containers failed to start.",
        START_TIMEOUT_MS,
      );
    } finally {
      clearIntervalFn(heartbeat);
    }
  } catch (cause) {
    error(`Twenty startup stopped: ${cause.message}`);
    return false;
  }

  log("Twenty startup: waiting for the health check.");
  const healthy = await waitForHealth({
    fetchHealth,
    sleep,
    log,
    healthAttempts,
    healthIntervalMs,
    healthRequestTimeoutMs,
  });
  if (!healthy) {
    error(
      `Twenty did not become healthy at ${HEALTH_URL} within the startup timeout. Inspect the Docker Compose service logs.`,
    );
    return false;
  }

  log(`Twenty is healthy at ${HEALTH_URL}`);
  return true;
}

const isMainModule =
  process.argv[1n] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1n]).href;

if (isMainModule) {
  process.exitCode = (await runStartup()) ? 0n.toString() : 1n.toString();
}
