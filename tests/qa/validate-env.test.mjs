/**
 * Smoke test: the env validator script itself runs cleanly.
 *
 * This guards against silent regressions in scripts/validate-env.mjs
 * (e.g. someone breaks the JSON read or a required-file check).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import test from "node:test";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

test("scripts/validate-env.mjs exits 0 with current project state", () => {
  const result = spawnSync(
    "node",
    [resolve(ROOT, "scripts/validate-env.mjs")],
    { encoding: "utf8", cwd: ROOT },
  );
  assert.equal(
    result.status,
    0,
    `validator failed:\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  // Sanity: the summary line is present
  assert.match(result.stdout, /all required checks passed/);
});

test("integrity-qualified packageManager matches the pnpm user-agent semver", () => {
  const result = spawnSync(
    "node",
    [resolve(ROOT, "scripts/validate-env.mjs")],
    {
      encoding: "utf8",
      cwd: ROOT,
      env: {
        ...process.env,
        npm_config_user_agent: "pnpm/11.25.0 npm/? node/v22.13.0 linux x64",
      },
    },
  );
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /mismatch with package\.json/);
});

test("CI lets pnpm/action-setup use packageManager instead of pinning another version", async () => {
  const { readFile } = await import("node:fs/promises");
  const workflow = await readFile(
    resolve(ROOT, ".github/workflows/ci.yml"),
    "utf8",
  );
  const setupStep = workflow.match(
    /- name: Setup pnpm[\s\S]*?(?=\n\s+- name: Setup Node)/,
  )?.[0];
  assert.ok(setupStep, "Setup pnpm step missing");
  assert.doesNotMatch(setupStep, /\bversion:/);
});

test("package.json declares the `validate` script", async () => {
  const { readFile } = await import("node:fs/promises");
  const pkg = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8"));
  assert.ok(
    typeof pkg.scripts?.validate === "string",
    "package.json scripts.validate missing",
  );
  assert.match(pkg.scripts.validate, /validate-env\.mjs/);
});

test(".env.example exists and is committed (not gitignored)", async () => {
  const { readFile, stat } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");
  const p = resolve(ROOT, ".env.example");
  assert.ok(existsSync(p), ".env.example missing");
  const raw = await readFile(p, "utf8");
  // Must document the bindings policy so devs do not reintroduce D1/R2 stubs
  assert.match(raw, /\.openai\/hosting\.json/);
  assert.match(raw, /must NOT declare.+d1.+r2/s);
  // Should be a real file, not a symlink
  const s = await stat(p);
  assert.ok(s.size > 200, ".env.example too short to be useful");
});

// The QA suite imports `.ts` route handlers directly (crm-lead,
// next-business-day), which relies on Node's native type stripping —
// unflagged only from 22.18.0. `engines.node` is the single source of
// truth for the minimum; CI must test exactly that minimum so a
// too-old runtime fails here instead of at import time.
const MIN_NODE_FOR_TYPE_STRIPPING = [22, 18, 0];

function engineMinimum(pkg) {
  const match = pkg.engines?.node?.match(/^>=(\d+)\.(\d+)\.(\d+)$/);
  assert.ok(match, `engines.node must be ">=X.Y.Z", got ${pkg.engines?.node}`);
  return match.slice(1).map(Number);
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

test("engines.node minimum supports native TypeScript type stripping", async () => {
  const { readFile } = await import("node:fs/promises");
  const pkg = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8"));
  assert.ok(
    compareVersions(engineMinimum(pkg), MIN_NODE_FOR_TYPE_STRIPPING) >= 0,
    `engines.node ${pkg.engines.node} is below 22.18.0`,
  );
});

test("every workflow pins Node to the engines.node minimum", async () => {
  const { readFile } = await import("node:fs/promises");
  const pkg = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8"));
  const minimum = engineMinimum(pkg).join(".");
  for (const file of ["ci.yml", "twenty-ci.yml"]) {
    const workflow = await readFile(resolve(ROOT, ".github/workflows", file), "utf8");
    const pins = [...workflow.matchAll(/node-version:\s*(\S+)/g)].map((m) => m[1]);
    assert.ok(pins.length > 0, `${file} does not pin node-version`);
    for (const pin of pins) assert.equal(pin, minimum, `${file} pins ${pin}`);
  }
});

test("validator compares Node versions numerically, not as strings", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(resolve(ROOT, "scripts/validate-env.mjs"), "utf8");
  assert.doesNotMatch(source, /process\.versions\.node\s*>=\s*["']/);
});
