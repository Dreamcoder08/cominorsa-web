// tests/qa/ci-workflow.test.mjs
//
// Pins the shape of `.github/workflows/ci.yml` so the Bun vanilla-migration
// chain (`feat/bun-vanilla-migration*` branches) actually gets CI: without
// this, every child PR of the migration chain targets a non-`main` branch
// and silently gets zero CI, and `bun test src/` / `bun run build:static`
// never run anywhere before the T11 cutover.
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

test("the static build runs in CI", () => {
  assert.match(ciYaml, /run:\s*bun run build:static/);
});

test("existing pnpm/Node steps are preserved", () => {
  for (const needle of [
    "pnpm/action-setup@v4",
    "actions/setup-node@v4",
    "pnpm install --frozen-lockfile",
    "pnpm run validate",
    "pnpm audit --audit-level=high",
    "pnpm run build",
    "node --test tests/rendered-html.test.mjs 'tests/qa/*.test.mjs'",
    "pnpm run lint",
  ]) {
    assert.ok(ciYaml.includes(needle), `expected CI to still run: ${needle}`);
  }
});
