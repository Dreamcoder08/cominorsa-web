// tests/qa/ci-workflow.test.mjs
//
// Pins the shape of `.github/workflows/ci.yml`. T11 cutover: CI now runs
// the full static-build pipeline end to end — lint, typecheck, the Bun
// unit suite, the Node QA suite (which builds via `pnpm test`), and the
// deterministic `e2e:static` Playwright run (see playwright.config.ts's
// `webServer`) — instead of the old Next build + a separate throwaway
// `bun run build:static` smoke step.
//
// Plain string/regex assertions (no YAML parser available without adding a
// dependency — zero new deps is a hard constraint for this migration).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ciYaml = readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8");

test("CI still triggers on pushes and PRs to main", () => {
  assert.match(ciYaml, /push:\s*\n\s*branches:\s*\[main\]/);
  assert.match(ciYaml, /pull_request:\s*\n(?:.*\n)*?\s*branches:\s*\n?\s*-?\s*.*main/);
});

test("CI also triggers on PRs targeting the migration branch chain", () => {
  const pullRequestBlock = ciYaml.match(/pull_request:\n([\s\S]*?)\n\n/)?.[1] ?? "";
  assert.match(
    pullRequestBlock,
    /feat\/bun-vanilla-migration\*\*/,
    `expected pull_request.branches to include the migration chain glob, got:\n${pullRequestBlock}`,
  );
});

test("Bun is installed via the official oven-sh/setup-bun action, pinned to a major version", () => {
  assert.match(
    ciYaml,
    /uses:\s*oven-sh\/setup-bun@v\d+/,
    "expected a pinned oven-sh/setup-bun@vN step",
  );
});

test("the Bun-native test suite runs in CI", () => {
  assert.match(ciYaml, /run:\s*bun test src\//);
});

test("lint and typecheck both run in CI", () => {
  assert.match(ciYaml, /run:\s*pnpm run lint/);
  assert.match(ciYaml, /run:\s*pnpm run typecheck/);
});

test("the deterministic static e2e suite runs in CI, with Playwright browsers cached", () => {
  assert.match(ciYaml, /run:\s*pnpm run e2e:static/);
  assert.match(ciYaml, /playwright install/);
  assert.match(ciYaml, /actions\/cache@v\d+/);
  assert.match(ciYaml, /ms-playwright/);
});

test("existing pnpm/Node steps and checks are preserved", () => {
  for (const needle of [
    "pnpm/action-setup@v4",
    "actions/setup-node@v4",
    "pnpm install --frozen-lockfile",
    "pnpm run validate",
    "pnpm audit --audit-level=high",
    "pnpm test",
  ]) {
    assert.ok(ciYaml.includes(needle), `expected CI to still run: ${needle}`);
  }
});

test("CI never invokes the retired Next/vinext build", () => {
  assert.doesNotMatch(ciYaml, /vinext/);
  assert.doesNotMatch(ciYaml, /\bnext build\b/);
});
